import json
import math
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_workspace_membership, require_workspace_role
from app.db.session import get_db
from app.models.rota import GenerationRun, Rota, Shift, StaffingRequirement, StaffingRequirementBand
from app.models.staff import Skill, StaffMember
from app.models.workspace import WorkspaceMembership
from app.schemas.rota import (
    BulkRequirementsUpdateRequest,
    CopyRequirementsRequest,
    DiagnosticItem,
    GenerateRotaRequest,
    GenerationRunResponse,
    RotaCreateRequest,
    RotaDetailResponse,
    RotaResponse,
    RotaUpdateRequest,
    ShiftResponse,
    StaffingRequirementBandResponse,
    StaffingRequirementResponse,
)
from app.services.scheduler import calculate_band_durations, generate_rota_schedule

router = APIRouter()


# ---------------------------------------------------------
# Helper: Fetch rota with strict workspace isolation
# ---------------------------------------------------------
def _get_rota_or_404(
    rota_id: str,
    workspace_id: str,
    db: Session,
) -> Rota:
    stmt = (
        select(Rota)
        .where(
            Rota.id == rota_id,
            Rota.workspace_id == workspace_id,
        )
        .options(
            selectinload(Rota.requirements)
            .selectinload(StaffingRequirement.bands)
            .selectinload(StaffingRequirementBand.skill),
            selectinload(Rota.shifts).selectinload(Shift.staff_member),
            selectinload(Rota.shifts).selectinload(Shift.skill),
            selectinload(Rota.generation_runs),
        )
    )
    rota = db.scalar(stmt)
    if not rota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rota not found in this workspace.",
        )
    return rota


def _format_shift_response(shift: Shift) -> ShiftResponse:
    staff_name = (
        f"{shift.staff_member.first_name} {shift.staff_member.last_name}"
        if shift.staff_member
        else "Unknown"
    )
    skill_name = shift.skill.name if shift.skill else None
    _, _, paid_hours = calculate_band_durations(shift.start_time, shift.end_time)
    if shift.unpaid_break_minutes > 0:
        # recalculate paid hours with exact unpaid break minutes
        from app.services.scheduler import time_to_minutes
        s_min = time_to_minutes(shift.start_time)
        e_min = time_to_minutes(shift.end_time)
        gross = e_min - s_min if e_min > s_min else (24 * 60 - s_min) + e_min
        paid_hours = round(max(0, gross - shift.unpaid_break_minutes) / 60.0, 2)

    return ShiftResponse(
        id=shift.id,
        rota_id=shift.rota_id,
        staff_id=shift.staff_id,
        staff_name=staff_name,
        date=shift.date,
        start_time=shift.start_time,
        end_time=shift.end_time,
        unpaid_break_minutes=shift.unpaid_break_minutes,
        paid_hours=paid_hours,
        skill_id=shift.skill_id,
        skill_name=skill_name,
        status=shift.status,
        notes=shift.notes,
        created_at=shift.created_at,
    )


def _format_generation_run_response(run: GenerationRun) -> GenerationRunResponse:
    diagnostics_list: list[DiagnosticItem] = []
    if run.diagnostics:
        try:
            raw = json.loads(run.diagnostics)
            for item in raw:
                diagnostics_list.append(DiagnosticItem(**item))
        except (json.JSONDecodeError, TypeError, ValueError):
            diagnostics_list.append(DiagnosticItem(type="info", message=str(run.diagnostics)))

    return GenerationRunResponse(
        id=run.id,
        rota_id=run.rota_id,
        status=run.status,
        solve_time_seconds=run.solve_time_seconds,
        shifts_created=run.shifts_created,
        coverage_score=run.coverage_score,
        diagnostics=diagnostics_list,
        created_at=run.created_at,
    )


def _format_rota_detail(rota: Rota) -> RotaDetailResponse:
    total_shifts = len(rota.shifts)
    formatted_shifts = [_format_shift_response(s) for s in rota.shifts]
    total_paid_hours = round(sum(s.paid_hours for s in formatted_shifts), 2)

    # Sort requirements by date
    formatted_reqs = []
    for req in sorted(rota.requirements, key=lambda r: r.date):
        bands = [
            StaffingRequirementBandResponse.model_validate(b)
            for b in sorted(req.bands, key=lambda b: b.start_time)
        ]
        formatted_reqs.append(
            StaffingRequirementResponse(
                id=req.id,
                rota_id=req.rota_id,
                date=req.date,
                bands=bands,
                created_at=req.created_at,
                updated_at=req.updated_at,
            )
        )

    latest_run = None
    if rota.generation_runs:
        latest_run = _format_generation_run_response(max(rota.generation_runs, key=lambda r: r.created_at))

    return RotaDetailResponse(
        id=rota.id,
        workspace_id=rota.workspace_id,
        name=rota.name,
        start_date=rota.start_date,
        end_date=rota.end_date,
        status=rota.status,
        total_shifts=total_shifts,
        total_paid_hours=total_paid_hours,
        latest_generation_status=latest_run.status if latest_run else None,
        created_at=rota.created_at,
        updated_at=rota.updated_at,
        requirements=formatted_reqs,
        shifts=formatted_shifts,
        latest_run=latest_run,
    )


# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@router.get(
    "/workspaces/{workspace_id}/rotas",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
def list_rotas(
    workspace_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
):
    """List rotas for a workspace with pagination and statistics."""
    stmt = (
        select(Rota)
        .where(Rota.workspace_id == workspace_id)
        .options(
            selectinload(Rota.shifts).selectinload(Shift.staff_member),
            selectinload(Rota.shifts).selectinload(Shift.skill),
            selectinload(Rota.generation_runs),
        )
    )
    if status_filter:
        stmt = stmt.where(Rota.status == status_filter)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.scalar(count_stmt) or 0

    stmt = stmt.order_by(desc(Rota.start_date)).offset((page - 1) * page_size).limit(page_size)
    rotas = db.scalars(stmt).all()

    items = []
    for r in rotas:
        total_shifts = len(r.shifts)
        shifts_formatted = [_format_shift_response(s) for s in r.shifts]
        total_paid_hours = round(sum(s.paid_hours for s in shifts_formatted), 2)
        latest_run = (
            max(r.generation_runs, key=lambda run: run.created_at)
            if r.generation_runs
            else None
        )
        items.append(
            RotaResponse(
                id=r.id,
                workspace_id=r.workspace_id,
                name=r.name,
                start_date=r.start_date,
                end_date=r.end_date,
                status=r.status,
                total_shifts=total_shifts,
                total_paid_hours=total_paid_hours,
                latest_generation_status=latest_run.status if latest_run else None,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total_count / page_size) if total_count > 0 else 0,
    }


@router.post(
    "/workspaces/{workspace_id}/rotas",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rota(
    workspace_id: str,
    payload: RotaCreateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new rota period and initialize default staffing requirement bands.
    """
    # Create rota
    new_rota = Rota(
        workspace_id=workspace_id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="draft",
    )
    db.add(new_rota)
    db.flush()

    # Pre-populate daily requirements with default band if requested
    curr = payload.start_date
    while curr <= payload.end_date:
        req = StaffingRequirement(
            rota_id=new_rota.id,
            date=curr,
        )
        db.add(req)
        db.flush()

        if payload.default_band_start and payload.default_band_end and payload.default_staff_count:
            band = StaffingRequirementBand(
                requirement_id=req.id,
                start_time=payload.default_band_start,
                end_time=payload.default_band_end,
                target_staff_count=payload.default_staff_count,
                skill_id=None,
            )
            db.add(band)

        curr += timedelta(days=1)

    db.commit()
    db.refresh(new_rota)
    return _format_rota_detail(_get_rota_or_404(new_rota.id, workspace_id, db))


@router.get(
    "/workspaces/{workspace_id}/rotas/{rota_id}",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_rota(
    workspace_id: str,
    rota_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve full details of a rota including requirements, shifts, and generation runs."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)
    return _format_rota_detail(rota)


@router.patch(
    "/workspaces/{workspace_id}/rotas/{rota_id}",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_200_OK,
)
def update_rota(
    workspace_id: str,
    rota_id: str,
    payload: RotaUpdateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Update rota name or status (draft, published, archived)."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)
    if payload.name is not None:
        rota.name = payload.name
    if payload.status is not None:
        rota.status = payload.status
    db.commit()
    db.refresh(rota)
    return _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))


@router.delete(
    "/workspaces/{workspace_id}/rotas/{rota_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_rota(
    workspace_id: str,
    rota_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Delete a rota and its associated requirements, shifts, and generation runs."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)
    db.delete(rota)
    db.commit()


@router.put(
    "/workspaces/{workspace_id}/rotas/{rota_id}/requirements",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_200_OK,
)
def update_requirements(
    workspace_id: str,
    rota_id: str,
    payload: BulkRequirementsUpdateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Bulk update staffing requirements for dates within the rota.
    Replaces bands on specified dates with new configuration.
    """
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    # Validate all dates are within rota range
    for req_input in payload.requirements:
        if req_input.date < rota.start_date or req_input.date > rota.end_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requirement date {req_input.date} is outside rota range ({rota.start_date} to {rota.end_date}).",
            )
        # Validate skills belong to workspace if specified
        for band_input in req_input.bands:
            if band_input.skill_id:
                skill = db.scalar(
                    select(Skill).where(
                        Skill.id == band_input.skill_id,
                        Skill.workspace_id == workspace_id,
                    )
                )
                if not skill:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Skill '{band_input.skill_id}' does not exist in this workspace.",
                    )

    # Map existing requirements by date
    existing_reqs = {r.date: r for r in rota.requirements}

    for req_input in payload.requirements:
        if req_input.date in existing_reqs:
            req_obj = existing_reqs[req_input.date]
            # Clear existing bands and replace
            req_obj.bands.clear()
        else:
            req_obj = StaffingRequirement(rota_id=rota.id, date=req_input.date)
            db.add(req_obj)
            db.flush()

        for band_input in req_input.bands:
            new_band = StaffingRequirementBand(
                requirement_id=req_obj.id,
                start_time=band_input.start_time,
                end_time=band_input.end_time,
                target_staff_count=band_input.target_staff_count,
                skill_id=band_input.skill_id,
            )
            req_obj.bands.append(new_band)

    db.commit()
    db.refresh(rota)
    return _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))


@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/copy-requirements",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_200_OK,
)
def copy_requirements(
    workspace_id: str,
    rota_id: str,
    payload: CopyRequirementsRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Quick action: Copy requirement bands from a source date to multiple target dates.
    """
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    source_req = next((r for r in rota.requirements if r.date == payload.source_date), None)
    if not source_req or not source_req.bands:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source date {payload.source_date} has no staffing requirements to copy.",
        )

    # Validate target dates
    for t_date in payload.target_dates:
        if t_date < rota.start_date or t_date > rota.end_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Target date {t_date} is outside rota range ({rota.start_date} to {rota.end_date}).",
            )

    req_by_date = {r.date: r for r in rota.requirements}

    for t_date in payload.target_dates:
        if t_date in req_by_date:
            target_req = req_by_date[t_date]
            target_req.bands.clear()
        else:
            target_req = StaffingRequirement(rota_id=rota.id, date=t_date)
            db.add(target_req)
            db.flush()

        for src_band in source_req.bands:
            new_band = StaffingRequirementBand(
                requirement_id=target_req.id,
                start_time=src_band.start_time,
                end_time=src_band.end_time,
                target_staff_count=src_band.target_staff_count,
                skill_id=src_band.skill_id,
            )
            target_req.bands.append(new_band)

    db.commit()
    db.refresh(rota)
    return _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))


@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/generate",
    response_model=RotaDetailResponse,
    status_code=status.HTTP_200_OK,
)
def generate_rota(
    workspace_id: str,
    rota_id: str,
    payload: GenerateRotaRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Trigger the OR-Tools constraint-based scheduling engine for the rota.
    Atomically generates draft shifts, records run diagnostics, and returns updated rota.
    """
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    # Load active staff members in this workspace with full constraints
    staff_stmt = (
        select(StaffMember)
        .where(
            StaffMember.workspace_id == workspace_id,
            StaffMember.is_archived.is_(False),
        )
        .options(
            selectinload(StaffMember.skills),
            selectinload(StaffMember.contract),
            selectinload(StaffMember.availability_rules),
            selectinload(StaffMember.unavailability_blocks),
        )
    )
    staff_members = db.scalars(staff_stmt).all()

    # Execute constraint-based solver
    result = generate_rota_schedule(
        rota=rota,
        staff_members=staff_members,
        time_limit_seconds=payload.time_limit_seconds,
    )

    # In database transaction:
    # 1. Record generation run
    run = GenerationRun(
        rota_id=rota.id,
        status=result.status,
        solve_time_seconds=result.solve_time_seconds,
        shifts_created=result.shifts_created_count,
        coverage_score=result.coverage_score,
        diagnostics=json.dumps(result.diagnostics),
    )
    db.add(run)

    # 2. If feasible or partially_feasible, replace existing draft shifts
    if result.status in ("feasible", "partially_feasible"):
        # Delete old draft shifts
        db.query(Shift).filter(
            Shift.rota_id == rota.id,
            Shift.status == "draft",
        ).delete(synchronize_session="fetch")

        # Insert newly generated shifts
        for shift_data in result.shifts_to_create:
            new_shift = Shift(
                rota_id=shift_data["rota_id"],
                staff_id=shift_data["staff_id"],
                date=shift_data["date"],
                start_time=shift_data["start_time"],
                end_time=shift_data["end_time"],
                unpaid_break_minutes=shift_data["unpaid_break_minutes"],
                skill_id=shift_data["skill_id"],
                status=shift_data["status"],
                notes=shift_data["notes"],
            )
            db.add(new_shift)

    db.commit()
    db.refresh(rota)
    return _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))
