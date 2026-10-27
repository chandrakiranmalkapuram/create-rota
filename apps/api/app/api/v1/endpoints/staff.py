import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_workspace_membership, require_workspace_role
from app.db.session import get_db
from app.models.staff import (
    AvailabilityRule,
    Skill,
    StaffContract,
    StaffMember,
    UnavailabilityBlock,
)
from app.models.workspace import WorkspaceMembership
from app.schemas.staff import (
    SkillCreate,
    SkillResponse,
    StaffMemberCreateRequest,
    StaffMemberListResponse,
    StaffMemberResponse,
    StaffMemberUpdateRequest,
    UnavailabilityBlockInput,
    UnavailabilityBlockResponse,
)

router = APIRouter()


# ---------------------------------------------------------
# Helper: fetch staff by ID with strict workspace isolation
# ---------------------------------------------------------
def _get_staff_or_404(
    staff_id: str,
    workspace_id: str,
    db: Session,
) -> StaffMember:
    stmt = (
        select(StaffMember)
        .where(
            StaffMember.id == staff_id,
            StaffMember.workspace_id == workspace_id,
        )
        .options(
            selectinload(StaffMember.skills),
            selectinload(StaffMember.contract),
            selectinload(StaffMember.availability_rules),
            selectinload(StaffMember.unavailability_blocks),
        )
    )
    staff = db.scalar(stmt)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found in this workspace.",
        )
    return staff


# ---------------------------------------------------------
# Skills Endpoints
# ---------------------------------------------------------

@router.get("/workspaces/{workspace_id}/skills", response_model=list[SkillResponse])
def list_skills(
    workspace_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
):
    stmt = (
        select(Skill)
        .where(Skill.workspace_id == workspace_id)
        .order_by(Skill.name.asc())
    )
    return db.scalars(stmt).all()


@router.post(
    "/workspaces/{workspace_id}/skills",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_skill(
    workspace_id: str,
    data: SkillCreate,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    existing = db.scalar(
        select(Skill).where(
            Skill.workspace_id == workspace_id,
            func.lower(Skill.name) == data.name.strip().lower(),
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A skill named '{data.name.strip()}' already exists in this workspace.",
        )

    skill = Skill(
        workspace_id=workspace_id,
        name=data.name.strip(),
        color=data.color.strip(),
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


# ---------------------------------------------------------
# Staff List & Create Endpoints
# ---------------------------------------------------------

@router.get(
    "/workspaces/{workspace_id}/staff",
    response_model=StaffMemberListResponse,
)
def list_staff(
    workspace_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    category: str | None = Query(None),
    is_archived: bool = Query(False),
):
    stmt = select(StaffMember).where(
        StaffMember.workspace_id == workspace_id,
        StaffMember.is_archived == is_archived,
    )

    if category:
        stmt = stmt.where(StaffMember.category == category.strip().lower())

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            (func.lower(StaffMember.first_name).like(term))
            | (func.lower(StaffMember.last_name).like(term))
            | (func.lower(StaffMember.display_name).like(term))
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.scalar(count_stmt) or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items_stmt = (
        stmt.options(
            selectinload(StaffMember.skills),
            selectinload(StaffMember.contract),
            selectinload(StaffMember.availability_rules),
            selectinload(StaffMember.unavailability_blocks),
        )
        .order_by(StaffMember.last_name.asc(), StaffMember.first_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.scalars(items_stmt).all()

    return StaffMemberListResponse(
        items=list(items),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/workspaces/{workspace_id}/staff",
    response_model=StaffMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_staff(
    workspace_id: str,
    data: StaffMemberCreateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    # 1. Create base staff record
    staff = StaffMember(
        workspace_id=workspace_id,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        display_name=data.display_name.strip() if data.display_name else None,
        category=data.category,
        notes=data.notes.strip() if data.notes else None,
        is_archived=False,
    )
    db.add(staff)
    db.flush()

    # 2. Attach skills belonging to this workspace
    if data.skill_ids:
        skills = db.scalars(
            select(Skill).where(
                Skill.workspace_id == workspace_id,
                Skill.id.in_(data.skill_ids),
            )
        ).all()
        staff.skills.extend(skills)

    # 3. Create Contract
    if data.contract:
        contract = StaffContract(
            staff_id=staff.id,
            contracted_hours_per_week=data.contract.contracted_hours_per_week,
            min_hours_per_week=data.contract.min_hours_per_week,
            max_hours_per_week=data.contract.max_hours_per_week,
            max_shifts_per_week=data.contract.max_shifts_per_week,
            max_consecutive_days=data.contract.max_consecutive_days,
            min_rest_hours_between_shifts=data.contract.min_rest_hours_between_shifts,
        )
    else:
        # Safe default according to category
        default_hours = 37.5 if data.category == "full_time" else 20.0
        contract = StaffContract(
            staff_id=staff.id,
            contracted_hours_per_week=default_hours,
            min_hours_per_week=None,
            max_hours_per_week=None,
            max_shifts_per_week=5,
            max_consecutive_days=6,
            min_rest_hours_between_shifts=11.0,
        )
    db.add(contract)

    # 4. Availability rules (if none provided, default Monday to Sunday available)
    if data.availability_rules:
        for rule_in in data.availability_rules:
            rule = AvailabilityRule(
                staff_id=staff.id,
                weekday=rule_in.weekday,
                is_available=rule_in.is_available,
                start_time=rule_in.start_time,
                end_time=rule_in.end_time,
                is_recurring_day_off=rule_in.is_recurring_day_off,
            )
            db.add(rule)
    else:
        for weekday in range(7):
            db.add(
                AvailabilityRule(
                    staff_id=staff.id,
                    weekday=weekday,
                    is_available=True,
                    start_time=None,
                    end_time=None,
                    is_recurring_day_off=False,
                )
            )

    # 5. Unavailability blocks
    for block_in in data.unavailability_blocks:
        block = UnavailabilityBlock(
            staff_id=staff.id,
            reason_category=block_in.reason_category,
            start_date=block_in.start_date,
            end_date=block_in.end_date,
            start_time=block_in.start_time,
            end_time=block_in.end_time,
            notes=block_in.notes.strip() if block_in.notes else None,
        )
        db.add(block)

    db.commit()

    return _get_staff_or_404(staff.id, workspace_id, db)


# ---------------------------------------------------------
# Staff Detail & Update Endpoints
# ---------------------------------------------------------

@router.get(
    "/workspaces/{workspace_id}/staff/{staff_id}",
    response_model=StaffMemberResponse,
)
def get_staff_detail(
    workspace_id: str,
    staff_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
):
    return _get_staff_or_404(staff_id, workspace_id, db)


@router.patch(
    "/workspaces/{workspace_id}/staff/{staff_id}",
    response_model=StaffMemberResponse,
)
def update_staff(
    workspace_id: str,
    staff_id: str,
    data: StaffMemberUpdateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)

    if data.first_name is not None:
        staff.first_name = data.first_name.strip()
    if data.last_name is not None:
        staff.last_name = data.last_name.strip()
    if data.display_name is not None:
        staff.display_name = data.display_name.strip() if data.display_name else None
    if data.category is not None:
        staff.category = data.category
    if data.notes is not None:
        staff.notes = data.notes.strip() if data.notes else None
    if data.is_archived is not None:
        staff.is_archived = data.is_archived

    # Update skills if provided
    if data.skill_ids is not None:
        skills = db.scalars(
            select(Skill).where(
                Skill.workspace_id == workspace_id,
                Skill.id.in_(data.skill_ids),
            )
        ).all()
        staff.skills = list(skills)

    # Update contract if provided
    if data.contract is not None:
        if staff.contract:
            staff.contract.contracted_hours_per_week = data.contract.contracted_hours_per_week
            staff.contract.min_hours_per_week = data.contract.min_hours_per_week
            staff.contract.max_hours_per_week = data.contract.max_hours_per_week
            staff.contract.max_shifts_per_week = data.contract.max_shifts_per_week
            staff.contract.max_consecutive_days = data.contract.max_consecutive_days
            staff.contract.min_rest_hours_between_shifts = data.contract.min_rest_hours_between_shifts
        else:
            staff.contract = StaffContract(
                staff_id=staff.id,
                contracted_hours_per_week=data.contract.contracted_hours_per_week,
                min_hours_per_week=data.contract.min_hours_per_week,
                max_hours_per_week=data.contract.max_hours_per_week,
                max_shifts_per_week=data.contract.max_shifts_per_week,
                max_consecutive_days=data.contract.max_consecutive_days,
                min_rest_hours_between_shifts=data.contract.min_rest_hours_between_shifts,
            )

    # Update availability rules if provided
    if data.availability_rules is not None:
        # Remove existing and replace atomically
        for r in list(staff.availability_rules):
            db.delete(r)
        db.flush()

        for rule_in in data.availability_rules:
            new_rule = AvailabilityRule(
                staff_id=staff.id,
                weekday=rule_in.weekday,
                is_available=rule_in.is_available,
                start_time=rule_in.start_time,
                end_time=rule_in.end_time,
                is_recurring_day_off=rule_in.is_recurring_day_off,
            )
            db.add(new_rule)

    db.commit()
    return _get_staff_or_404(staff.id, workspace_id, db)


@router.post(
    "/workspaces/{workspace_id}/staff/{staff_id}/archive",
    response_model=StaffMemberResponse,
)
def archive_staff(
    workspace_id: str,
    staff_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)
    staff.is_archived = True
    db.commit()
    return _get_staff_or_404(staff.id, workspace_id, db)


@router.post(
    "/workspaces/{workspace_id}/staff/{staff_id}/reactivate",
    response_model=StaffMemberResponse,
)
def reactivate_staff(
    workspace_id: str,
    staff_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)
    staff.is_archived = False
    db.commit()
    return _get_staff_or_404(staff.id, workspace_id, db)


@router.delete(
    "/workspaces/{workspace_id}/staff/{staff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_staff(
    workspace_id: str,
    staff_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)
    if not staff.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff member must be archived before permanent deletion.",
        )
    db.delete(staff)
    db.commit()


# ---------------------------------------------------------
# Leave & Unavailability Endpoints
# ---------------------------------------------------------

@router.post(
    "/workspaces/{workspace_id}/staff/{staff_id}/leave",
    response_model=UnavailabilityBlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_staff_leave(
    workspace_id: str,
    staff_id: str,
    data: UnavailabilityBlockInput,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)
    block = UnavailabilityBlock(
        staff_id=staff.id,
        reason_category=data.reason_category,
        start_date=data.start_date,
        end_date=data.end_date,
        start_time=data.start_time,
        end_time=data.end_time,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.delete(
    "/workspaces/{workspace_id}/staff/{staff_id}/leave/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_staff_leave(
    workspace_id: str,
    staff_id: str,
    block_id: str,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    staff = _get_staff_or_404(staff_id, workspace_id, db)
    block = db.scalar(
        select(UnavailabilityBlock).where(
            UnavailabilityBlock.id == block_id,
            UnavailabilityBlock.staff_id == staff.id,
        )
    )
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave or unavailability block not found.",
        )
    db.delete(block)
    db.commit()
