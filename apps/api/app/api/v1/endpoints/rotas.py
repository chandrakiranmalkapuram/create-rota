import json
import math
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_workspace_membership, require_workspace_role
from app.db.session import get_db
from app.models.rota import (
    GenerationRun,
    Rota,
    RotaSnapshot,
    Shift,
    ShiftOverrideAudit,
    StaffingRequirement,
    StaffingRequirementBand,
)
from app.models.staff import Skill, StaffMember
from app.models.workspace import WorkspaceMembership
from app.schemas.rota import (
    AssumptionsResponse,
    BulkRequirementsUpdateRequest,
    CopyRequirementsRequest,
    DiagnosticItem,
    GenerateRotaRequest,
    GenerationRunResponse,
    RelaxationSuggestionResponse,
    RestoreSnapshotResponse,
    RotaCreateRequest,
    RotaDetailResponse,
    RotaResponse,
    RotaSnapshotResponse,
    RotaUpdateRequest,
    ShiftCopyRequest,
    ShiftCreate,
    ShiftMutationResponse,
    ShiftOverrideAuditResponse,
    ShiftResponse,
    ShiftUpdate,
    ShiftValidationRequest,
    ShiftValidationResponse,
    StaffingRequirementBandResponse,
    StaffingRequirementResponse,
)
from app.services.scheduler import calculate_band_durations, generate_rota_schedule
from app.services.shift_validation import validate_shift_candidate

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
            selectinload(Rota.shifts).selectinload(Shift.override_audits),
            selectinload(Rota.generation_runs),
            selectinload(Rota.snapshots),
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

    active_audit = next(
        (a for a in getattr(shift, "override_audits", []) if a.status == "active"),
        None,
    )
    active_override_resp = (
        ShiftOverrideAuditResponse(
            id=active_audit.id,
            shift_id=active_audit.shift_id,
            user_id=active_audit.user_id,
            warning_codes=active_audit.warning_codes,
            status=active_audit.status,
            overridden_at=active_audit.overridden_at,
        )
        if active_audit
        else None
    )

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
        active_override=active_override_resp,
        created_at=shift.created_at,
    )


def _format_generation_run_response(run: GenerationRun) -> GenerationRunResponse:
    diagnostics_list: list[DiagnosticItem] = []
    relaxation_suggestions: list[RelaxationSuggestionResponse] = []
    assumptions: AssumptionsResponse | None = None

    if run.diagnostics:
        try:
            raw = json.loads(run.diagnostics)
            if isinstance(raw, dict):
                diag_raw = raw.get("diagnostics", [])
                for item in diag_raw:
                    diagnostics_list.append(DiagnosticItem(**item))
                sug_raw = raw.get("relaxation_suggestions", [])
                for item in sug_raw:
                    relaxation_suggestions.append(RelaxationSuggestionResponse(**item))
                assump_raw = raw.get("assumptions")
                if assump_raw:
                    assumptions = AssumptionsResponse(**assump_raw)
            elif isinstance(raw, list):
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
        relaxation_suggestions=relaxation_suggestions,
        assumptions=assumptions,
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
        snapshots_count=len(rota.snapshots) if rota.snapshots else 0,
    )


def _create_snapshot_from_shifts(
    rota: Rota,
    workspace_id: str,
    user_id: str | None,
    reason: str,
    description: str | None,
    db: Session,
) -> RotaSnapshot:
    shifts_data = []
    for s in rota.shifts:
        staff_name = (
            f"{s.staff_member.first_name} {s.staff_member.last_name}"
            if s.staff_member
            else "Unknown"
        )
        shifts_data.append({
            "staff_id": s.staff_id,
            "staff_name": staff_name,
            "date": s.date.isoformat() if hasattr(s.date, "isoformat") else str(s.date),
            "start_time": s.start_time,
            "end_time": s.end_time,
            "unpaid_break_minutes": s.unpaid_break_minutes,
            "skill_id": s.skill_id,
            "status": s.status,
            "notes": s.notes,
        })

    coverage = 0.0
    if rota.generation_runs:
        latest = max(rota.generation_runs, key=lambda r: r.created_at)
        coverage = latest.coverage_score

    snapshot = RotaSnapshot(
        rota_id=rota.id,
        workspace_id=workspace_id,
        created_by_id=user_id,
        snapshot_reason=reason,
        description=description,
        shifts_count=len(shifts_data),
        coverage_score=coverage,
        shifts_data=shifts_data,
    )
    db.add(snapshot)
    db.flush()
    return snapshot


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
    Atomically snapshots current draft shifts, runs solver with deterministic seed & break policy,
    records run diagnostics & suggestions, and returns updated rota.
    """
    from dataclasses import asdict

    from app.schemas.scheduler import (
        BandSpec,
        BreakPolicySpec,
        SchedulerInputSpec,
        StaffAvailabilitySpec,
        StaffContractSpec,
        StaffSpec,
        StaffUnavailabilitySpec,
    )

    rota = _get_rota_or_404(rota_id, workspace_id, db)

    # 1. Protection: Prevent regenerating published or archived rotas
    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot regenerate a {rota.status} rota. Unpublish or duplicate the rota first.",
        )

    # 2. Transactional Safety: Snapshot existing draft shifts before replacing
    draft_shifts = [s for s in rota.shifts if s.status == "draft"]
    if draft_shifts:
        _create_snapshot_from_shifts(
            rota=rota,
            workspace_id=workspace_id,
            user_id=membership.user_id,
            reason="pre_generation",
            description=f"Automatic pre-generation snapshot (seed {payload.random_seed})",
            db=db,
        )

    # 3. Load active staff members with related models
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

    # 4. Map DB models to pure domain DTOs
    bands: list[BandSpec] = []
    for req in rota.requirements:
        for b in req.bands:
            bands.append(
                BandSpec(
                    id=b.id,
                    date=req.date,
                    start_time=b.start_time,
                    end_time=b.end_time,
                    target_staff_count=b.target_staff_count,
                    skill_id=b.skill_id,
                    skill_name=b.skill.name if b.skill else None,
                )
            )

    staff_specs: list[StaffSpec] = []
    for s in staff_members:
        contract_spec = None
        if s.contract:
            contract_spec = StaffContractSpec(
                contracted_hours_per_week=s.contract.contracted_hours_per_week,
                min_hours_per_week=s.contract.min_hours_per_week,
                max_hours_per_week=s.contract.max_hours_per_week,
                max_shifts_per_week=s.contract.max_shifts_per_week,
                max_consecutive_days=s.contract.max_consecutive_days,
                min_rest_hours_between_shifts=s.contract.min_rest_hours_between_shifts or 11.0,
            )

        avail_specs = [
            StaffAvailabilitySpec(
                weekday=r.weekday,
                is_available=r.is_available,
                is_recurring_day_off=r.is_recurring_day_off,
                start_time=r.start_time,
                end_time=r.end_time,
            )
            for r in s.availability_rules
        ]

        unavail_specs = [
            StaffUnavailabilitySpec(
                start_date=u.start_date,
                end_date=u.end_date,
                reason_category=u.reason_category,
                start_time=u.start_time,
                end_time=u.end_time,
            )
            for u in s.unavailability_blocks
        ]

        staff_specs.append(
            StaffSpec(
                id=s.id,
                first_name=s.first_name,
                last_name=s.last_name,
                category=s.category,
                is_archived=s.is_archived,
                skill_ids={sk.id for sk in s.skills},
                contract=contract_spec,
                availability_rules=avail_specs,
                unavailability_blocks=unavail_specs,
            )
        )

    # Resolve break policy
    if payload.break_policy:
        break_policy = payload.break_policy
        rota.break_policy = payload.break_policy.model_dump()
    elif rota.break_policy:
        break_policy = BreakPolicySpec(**rota.break_policy)
    else:
        break_policy = BreakPolicySpec()

    scheduler_input = SchedulerInputSpec(
        rota_id=rota.id,
        start_date=rota.start_date,
        end_date=rota.end_date,
        bands=bands,
        staff=staff_specs,
        break_policy=break_policy,
        time_limit_seconds=payload.time_limit_seconds,
        random_seed=payload.random_seed,
    )

    # 5. Execute isolated solver
    result = generate_rota_schedule(scheduler_input)

    # 6. Record generation run with full structured payload
    diagnostics_payload = {
        "diagnostics": [
            {
                "type": d.type,
                "message": d.message,
                "date": d.date.isoformat() if d.date else None,
                "band": d.band,
                "staff_name": d.staff_name,
                "is_proven": d.is_proven,
            }
            for d in result.diagnostics
        ],
        "relaxation_suggestions": [
            {
                "id": s.id,
                "category": s.category,
                "is_confirmed": s.is_confirmed,
                "title": s.title,
                "description": s.description,
                "affected_date": s.affected_date.isoformat() if s.affected_date else None,
                "affected_band": s.affected_band,
                "affected_staff_id": s.affected_staff_id,
                "affected_staff_name": s.affected_staff_name,
                "potential_impact": s.potential_impact,
            }
            for s in result.relaxation_suggestions
        ],
        "assumptions": asdict(result.assumptions),
    }

    run = GenerationRun(
        rota_id=rota.id,
        status=result.status,
        solve_time_seconds=result.solve_time_seconds,
        shifts_created=result.shifts_created_count,
        coverage_score=result.coverage_score,
        diagnostics=json.dumps(diagnostics_payload),
    )
    db.add(run)

    # 7. Atomically replace draft shifts if feasible or partially feasible
    if result.status in ("feasible", "partially_feasible"):
        db.query(Shift).filter(
            Shift.rota_id == rota.id,
            Shift.status == "draft",
        ).delete(synchronize_session="fetch")

        for s_spec in result.shifts:
            new_shift = Shift(
                rota_id=s_spec.rota_id,
                staff_id=s_spec.staff_id,
                date=s_spec.date,
                start_time=s_spec.start_time,
                end_time=s_spec.end_time,
                unpaid_break_minutes=s_spec.unpaid_break_minutes,
                skill_id=s_spec.skill_id,
                status=s_spec.status,
                notes=s_spec.notes,
            )
            db.add(new_shift)

    db.commit()
    db.refresh(rota)
    return _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))


@router.get(
    "/workspaces/{workspace_id}/rotas/{rota_id}/snapshots",
    response_model=list[RotaSnapshotResponse],
    status_code=status.HTTP_200_OK,
)
def list_rota_snapshots(
    workspace_id: str,
    rota_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List historical version snapshots for a rota.
    """
    rota = _get_rota_or_404(rota_id, workspace_id, db)
    stmt = (
        select(RotaSnapshot)
        .where(
            RotaSnapshot.rota_id == rota.id,
            RotaSnapshot.workspace_id == workspace_id,
        )
        .order_by(desc(RotaSnapshot.created_at))
    )
    snapshots = db.scalars(stmt).all()
    return [RotaSnapshotResponse.model_validate(s) for s in snapshots]


@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/snapshots/{snapshot_id}/restore",
    response_model=RestoreSnapshotResponse,
    status_code=status.HTTP_200_OK,
)
def restore_rota_snapshot(
    workspace_id: str,
    rota_id: str,
    snapshot_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Restore draft shifts from a historical snapshot.
    Preserves historical snapshots and creates a safety snapshot of the current draft state first.
    """
    from datetime import date as dt_date

    rota = _get_rota_or_404(rota_id, workspace_id, db)

    # 1. Protect published or archived rotas
    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot restore shifts into a {rota.status} rota. Unpublish or duplicate the rota first.",
        )

    # 2. Fetch snapshot with workspace isolation
    stmt = select(RotaSnapshot).where(
        RotaSnapshot.id == snapshot_id,
        RotaSnapshot.rota_id == rota.id,
        RotaSnapshot.workspace_id == workspace_id,
    )
    snapshot = db.scalar(stmt)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snapshot not found for this rota.",
        )

    # 3. Create safety snapshot of current shifts if any exist
    current_shifts = [s for s in rota.shifts if s.status == "draft"]
    safety_snapshot = None
    if current_shifts:
        safety_snapshot = _create_snapshot_from_shifts(
            rota=rota,
            workspace_id=workspace_id,
            user_id=membership.user_id,
            reason="pre_restore",
            description=f"Safety snapshot before restoring snapshot {snapshot.id[:8]}",
            db=db,
        )

    # 4. Clear current draft shifts
    db.query(Shift).filter(
        Shift.rota_id == rota.id,
        Shift.status == "draft",
    ).delete(synchronize_session="fetch")

    # 5. Restore shifts from snapshot.shifts_data
    restored_count = 0
    for s_data in snapshot.shifts_data:
        date_val = s_data["date"]
        if isinstance(date_val, str):
            date_val = dt_date.fromisoformat(date_val)

        new_shift = Shift(
            rota_id=rota.id,
            staff_id=s_data["staff_id"],
            date=date_val,
            start_time=s_data["start_time"],
            end_time=s_data["end_time"],
            unpaid_break_minutes=s_data.get("unpaid_break_minutes", 0),
            skill_id=s_data.get("skill_id"),
            status="draft",
            notes=s_data.get("notes") or f"Restored from snapshot {snapshot.id[:8]}",
        )
        db.add(new_shift)
        restored_count += 1

    db.commit()
    db.refresh(rota)

    updated_detail = _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))
    return RestoreSnapshotResponse(
        message=f"Successfully restored {restored_count} shift(s) from snapshot.",
        restored_shifts_count=restored_count,
        safety_snapshot_id=safety_snapshot.id if safety_snapshot else None,
        rota=updated_detail,
    )


# ---------------------------------------------------------
# Manual Shift Management Endpoints (Milestone 6)
# ---------------------------------------------------------

@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/shifts/validate",
    response_model=ShiftValidationResponse,
    status_code=status.HTTP_200_OK,
)
def validate_shift(
    workspace_id: str,
    rota_id: str,
    payload: ShiftValidationRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Pre-flight validation for a proposed shift change without persisting."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)
    return validate_shift_candidate(
        db=db,
        rota=rota,
        staff_id=payload.staff_id,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        skill_id=payload.skill_id,
        existing_shift_id=payload.shift_id,
        unpaid_break_override=payload.unpaid_break_minutes,
    )


@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/shifts",
    response_model=ShiftMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    workspace_id: str,
    rota_id: str,
    payload: ShiftCreate,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a manual draft shift with server-side validation and break calculation."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add shifts to a {rota.status} rota. Change status to draft first.",
        )

    # Re-validate inside the write transaction
    validation = validate_shift_candidate(
        db=db,
        rota=rota,
        staff_id=payload.staff_id,
        shift_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        skill_id=payload.skill_id,
        unpaid_break_override=payload.unpaid_break_minutes,
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Cannot save shift due to blocking validation errors.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "blocking"],
            },
        )

    if validation.has_warnings and not payload.override_warnings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Validation warnings detected. Confirm override to save.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "warning"],
            },
        )

    new_shift = Shift(
        rota_id=rota.id,
        staff_id=payload.staff_id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        unpaid_break_minutes=validation.unpaid_break_minutes,
        skill_id=payload.skill_id,
        status="draft",
        notes=payload.notes or None,
    )
    db.add(new_shift)
    db.flush()

    if validation.has_warnings and payload.override_warnings:
        warning_codes = [f.code for f in validation.findings if f.severity == "warning"]
        audit = ShiftOverrideAudit(
            shift_id=new_shift.id,
            rota_id=rota.id,
            workspace_id=workspace_id,
            user_id=membership.user_id,
            warning_codes=warning_codes,
            status="active",
            overridden_at=datetime.now(UTC),
        )
        db.add(audit)

    db.commit()
    db.refresh(new_shift)

    updated_rota = _get_rota_or_404(rota_id, workspace_id, db)
    return ShiftMutationResponse(
        shift=_format_shift_response(new_shift),
        warnings=validation.findings,
        message="Shift created successfully.",
        rota=_format_rota_detail(updated_rota),
    )


@router.patch(
    "/workspaces/{workspace_id}/rotas/{rota_id}/shifts/{shift_id}",
    response_model=ShiftMutationResponse,
    status_code=status.HTTP_200_OK,
)
def update_shift(
    workspace_id: str,
    rota_id: str,
    shift_id: str,
    payload: ShiftUpdate,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Edit shift details or move/reassign shift with server-side validation."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit shifts in a {rota.status} rota. Change status to draft first.",
        )

    shift = db.scalar(
        select(Shift)
        .options(
            selectinload(Shift.staff_member),
            selectinload(Shift.skill),
            selectinload(Shift.override_audits),
        )
        .where(Shift.id == shift_id, Shift.rota_id == rota.id)
    )
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found.")

    target_staff_id = payload.staff_id if payload.staff_id is not None else shift.staff_id
    target_date = payload.date if payload.date is not None else shift.date
    target_start = payload.start_time if payload.start_time is not None else shift.start_time
    target_end = payload.end_time if payload.end_time is not None else shift.end_time
    target_skill = payload.skill_id if payload.skill_id is not None else shift.skill_id
    target_break = payload.unpaid_break_minutes

    # Transactional validation
    validation = validate_shift_candidate(
        db=db,
        rota=rota,
        staff_id=target_staff_id,
        shift_date=target_date,
        start_time=target_start,
        end_time=target_end,
        skill_id=target_skill,
        existing_shift_id=shift.id,
        unpaid_break_override=target_break,
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Cannot update shift due to blocking validation errors.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "blocking"],
            },
        )

    if validation.has_warnings and not payload.override_warnings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Validation warnings detected. Confirm override to update shift.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "warning"],
            },
        )

    shift.staff_id = target_staff_id
    shift.date = target_date
    shift.start_time = target_start
    shift.end_time = target_end
    shift.skill_id = target_skill
    shift.unpaid_break_minutes = validation.unpaid_break_minutes

    if payload.notes is not None:
        shift.notes = payload.notes or None

    if validation.has_warnings and payload.override_warnings:
        warning_codes = [f.code for f in validation.findings if f.severity == "warning"]
        for a in shift.override_audits:
            if a.status == "active":
                a.status = "superseded"
        new_audit = ShiftOverrideAudit(
            shift_id=shift.id,
            rota_id=rota.id,
            workspace_id=workspace_id,
            user_id=membership.user_id,
            warning_codes=warning_codes,
            status="active",
            overridden_at=datetime.now(UTC),
        )
        db.add(new_audit)
    else:
        for a in shift.override_audits:
            if a.status == "active":
                a.status = "cleared"

    db.commit()
    db.refresh(shift)

    updated_rota = _get_rota_or_404(rota_id, workspace_id, db)
    return ShiftMutationResponse(
        shift=_format_shift_response(shift),
        warnings=validation.findings,
        message="Shift updated successfully.",
        rota=_format_rota_detail(updated_rota),
    )


@router.delete(
    "/workspaces/{workspace_id}/rotas/{rota_id}/shifts/{shift_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
def delete_shift(
    workspace_id: str,
    rota_id: str,
    shift_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Delete a draft shift from a rota."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete shifts from a {rota.status} rota.",
        )

    shift = db.scalar(select(Shift).where(Shift.id == shift_id, Shift.rota_id == rota.id))
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found.")

    db.delete(shift)
    db.commit()

    updated_rota = _format_rota_detail(_get_rota_or_404(rota_id, workspace_id, db))
    return {
        "message": "Shift deleted successfully.",
        "rota": updated_rota.model_dump(mode="json"),
    }


@router.post(
    "/workspaces/{workspace_id}/rotas/{rota_id}/shifts/{shift_id}/copy",
    response_model=ShiftMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
def copy_shift(
    workspace_id: str,
    rota_id: str,
    shift_id: str,
    payload: ShiftCopyRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
):
    """Copy an existing shift to a target date and/or staff member."""
    rota = _get_rota_or_404(rota_id, workspace_id, db)

    if rota.status in ("published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot copy shifts in a {rota.status} rota.",
        )

    source_shift = db.scalar(select(Shift).where(Shift.id == shift_id, Shift.rota_id == rota.id))
    if not source_shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source shift not found.")

    target_staff_id = payload.target_staff_id or source_shift.staff_id

    validation = validate_shift_candidate(
        db=db,
        rota=rota,
        staff_id=target_staff_id,
        shift_date=payload.target_date,
        start_time=source_shift.start_time,
        end_time=source_shift.end_time,
        skill_id=source_shift.skill_id,
        unpaid_break_override=source_shift.unpaid_break_minutes,
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Cannot copy shift due to blocking validation errors.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "blocking"],
            },
        )

    if validation.has_warnings and not payload.override_warnings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Validation warnings detected. Confirm override to copy shift.",
                "findings": [f.model_dump() for f in validation.findings if f.severity == "warning"],
            },
        )

    new_shift = Shift(
        rota_id=rota.id,
        staff_id=target_staff_id,
        date=payload.target_date,
        start_time=source_shift.start_time,
        end_time=source_shift.end_time,
        unpaid_break_minutes=validation.unpaid_break_minutes,
        skill_id=source_shift.skill_id,
        status="draft",
        notes=source_shift.notes,
    )
    db.add(new_shift)
    db.flush()

    if validation.has_warnings and payload.override_warnings:
        warning_codes = [f.code for f in validation.findings if f.severity == "warning"]
        audit = ShiftOverrideAudit(
            shift_id=new_shift.id,
            rota_id=rota.id,
            workspace_id=workspace_id,
            user_id=membership.user_id,
            warning_codes=warning_codes,
            status="active",
            overridden_at=datetime.now(UTC),
        )
        db.add(audit)

    db.commit()
    db.refresh(new_shift)

    updated_rota = _get_rota_or_404(rota_id, workspace_id, db)
    return ShiftMutationResponse(
        shift=_format_shift_response(new_shift),
        warnings=validation.findings,
        message="Shift copied successfully.",
        rota=_format_rota_detail(updated_rota),
    )

