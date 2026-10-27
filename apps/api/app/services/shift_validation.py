from __future__ import annotations

import logging
from datetime import date as dt_date
from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.rota import Rota, Shift, StaffingRequirement
from app.models.staff import Skill, StaffMember
from app.schemas.rota import CoverageSummaryItem, ShiftValidationFinding, ShiftValidationResponse
from app.schemas.scheduler import BreakPolicySpec, calculate_shift_durations, time_to_minutes

logger = logging.getLogger(__name__)


def _calculate_consecutive_days(dates_worked: set[dt_date], target_date: dt_date) -> int:
    """Calculate the consecutive working days streak including target_date."""
    # Count consecutive days before target_date
    current = target_date - timedelta(days=1)
    streak_before = 0
    while current in dates_worked:
        streak_before += 1
        current -= timedelta(days=1)

    # Count consecutive days after target_date
    current = target_date + timedelta(days=1)
    streak_after = 0
    while current in dates_worked:
        streak_after += 1
        current += timedelta(days=1)

    return streak_before + 1 + streak_after


def validate_shift_candidate(
    db: Session,
    rota: Rota,
    staff_id: str,
    shift_date: dt_date,
    start_time: str,
    end_time: str,
    skill_id: str | None = None,
    existing_shift_id: str | None = None,
    unpaid_break_override: int | None = None,
) -> ShiftValidationResponse:
    """
    Validate a proposed shift creation, edit, move, or copy.
    Distinguishes hard blocking errors (cannot be overridden) from
    actionable warnings (manager can explicitly override).
    """
    findings: list[ShiftValidationFinding] = []

    # 1. Start/End Time validity
    start_min = time_to_minutes(start_time)
    end_min = time_to_minutes(end_time)
    if start_min == end_min:
        findings.append(
            ShiftValidationFinding(
                code="INVALID_TIME",
                severity="blocking",
                message="Shift start time and end time cannot be identical.",
                date=shift_date.isoformat(),
            )
        )
        return ShiftValidationResponse(
            is_valid=False,
            has_warnings=False,
            can_override=False,
            findings=findings,
            gross_hours=0.0,
            unpaid_break_minutes=0,
            paid_hours=0.0,
            assumptions_summary="Invalid identical start and end times",
            daily_coverage=None,
        )

    # 2. Date within rota boundaries
    if shift_date < rota.start_date or shift_date > rota.end_date:
        findings.append(
            ShiftValidationFinding(
                code="DATE_OUT_OF_ROTA_RANGE",
                severity="blocking",
                message=f"Shift date {shift_date} is outside the rota period ({rota.start_date} to {rota.end_date}).",
                date=shift_date.isoformat(),
            )
        )

    # 3. Rota status protection
    if rota.status in ("published", "archived"):
        findings.append(
            ShiftValidationFinding(
                code="PUBLISHED_OR_ARCHIVED_ROTA",
                severity="blocking",
                message=f"Cannot add, edit, move, or delete shifts in a {rota.status} rota.",
                date=shift_date.isoformat(),
            )
        )

    # 4. Break & Paid hour calculation
    policy = BreakPolicySpec.from_dict(rota.break_policy) if rota.break_policy else BreakPolicySpec()
    duration_res = calculate_shift_durations(start_time, end_time, policy)
    gross_hours = round(duration_res.gross_minutes / 60.0, 2)
    unpaid_break = unpaid_break_override if unpaid_break_override is not None else duration_res.unpaid_break_minutes
    paid_minutes = max(0, duration_res.gross_minutes - unpaid_break)
    paid_hours = round(paid_minutes / 60.0, 2)
    assumptions = duration_res.assumptions_summary
    if unpaid_break_override is not None:
        assumptions += f" (Custom break override of {unpaid_break_override}m applied)"

    # 5. Fetch and validate staff member
    stmt = (
        select(StaffMember)
        .options(
            selectinload(StaffMember.skills),
            selectinload(StaffMember.contract),
            selectinload(StaffMember.availability_rules),
            selectinload(StaffMember.unavailability_blocks),
        )
        .where(StaffMember.id == staff_id)
    )
    staff = db.scalar(stmt)

    if not staff or staff.workspace_id != rota.workspace_id:
        findings.append(
            ShiftValidationFinding(
                code="CROSS_WORKSPACE_STAFF",
                severity="blocking",
                message="Staff member not found in this workspace.",
                date=shift_date.isoformat(),
            )
        )
        return ShiftValidationResponse(
            is_valid=False,
            has_warnings=False,
            can_override=False,
            findings=findings,
            gross_hours=gross_hours,
            unpaid_break_minutes=unpaid_break,
            paid_hours=paid_hours,
            assumptions_summary=assumptions,
            daily_coverage=None,
        )

    if staff.is_archived:
        findings.append(
            ShiftValidationFinding(
                code="ARCHIVED_STAFF",
                severity="blocking",
                message=f"Staff member '{staff.first_name} {staff.last_name}' is archived and cannot be assigned shifts.",
                date=shift_date.isoformat(),
            )
        )

    # 6. Skill validation
    if skill_id:
        skill = db.scalar(select(Skill).where(Skill.id == skill_id))
        if not skill or skill.workspace_id != rota.workspace_id:
            findings.append(
                ShiftValidationFinding(
                    code="CROSS_WORKSPACE_SKILL",
                    severity="blocking",
                    message="Specified skill does not exist in this workspace.",
                    date=shift_date.isoformat(),
                )
            )
        else:
            staff_skill_ids = [s.id for s in staff.skills]
            if skill.id not in staff_skill_ids:
                findings.append(
                    ShiftValidationFinding(
                        code="MISSING_SKILL",
                        severity="warning",
                        message=f"{staff.first_name} {staff.last_name} does not possess required skill '{skill.name}'.",
                        date=shift_date.isoformat(),
                    )
                )

    # 7. Availability rules (Recurring day off / Available time range)
    weekday = shift_date.weekday()
    rule = next((r for r in staff.availability_rules if r.weekday == weekday), None)
    if rule:
        if rule.is_recurring_day_off or not rule.is_available:
            findings.append(
                ShiftValidationFinding(
                    code="RECURRING_DAY_OFF",
                    severity="warning",
                    message=f"Shift falls on regular day off ({shift_date.strftime('%A')}) for {staff.first_name} {staff.last_name}.",
                    date=shift_date.isoformat(),
                )
            )
        elif rule.start_time and rule.end_time:
            rule_start = time_to_minutes(rule.start_time)
            rule_end = time_to_minutes(rule.end_time)
            if start_min < rule_start or (end_min > rule_end and not duration_res.is_overnight):
                findings.append(
                    ShiftValidationFinding(
                        code="OUTSIDE_AVAILABILITY",
                        severity="warning",
                        message=f"Shift hours ({start_time}-{end_time}) fall outside recurring availability ({rule.start_time}-{rule.end_time}).",
                        date=shift_date.isoformat(),
                    )
                )

    # 8. Unavailability / Leave blocks
    for block in staff.unavailability_blocks:
        if block.start_date <= shift_date <= block.end_date:
            has_time_overlap = True
            if block.start_time and block.end_time:
                b_start = time_to_minutes(block.start_time)
                b_end = time_to_minutes(block.end_time)
                # Overlap between [start_min, end_min] and [b_start, b_end]
                if not (max(start_min, b_start) < min(end_min, b_end)):
                    has_time_overlap = False

            if has_time_overlap:
                reason = block.reason_category.replace("_", " ").capitalize()
                findings.append(
                    ShiftValidationFinding(
                        code="LEAVE_CONFLICT",
                        severity="warning",
                        message=f"{staff.first_name} {staff.last_name} has an approved '{reason}' leave block on {shift_date}.",
                        date=shift_date.isoformat(),
                    )
                )

    # 9. Overlapping shifts & Rest periods (within rota and across adjacent rota weeks)
    candidate_start_dt = datetime.combine(shift_date, time.fromisoformat(start_time))
    if duration_res.is_overnight:
        candidate_end_dt = datetime.combine(shift_date + timedelta(days=1), time.fromisoformat(end_time))
    else:
        candidate_end_dt = datetime.combine(shift_date, time.fromisoformat(end_time))

    # All shifts for this staff member in this rota (excluding the shift being edited)
    all_staff_shifts = [
        s for s in rota.shifts
        if s.staff_id == staff_id and (existing_shift_id is None or s.id != existing_shift_id)
    ]

    adjacent_rest_checks: dict[str, str] = {}

    # Inspect adjacent rota boundaries
    adj_boundary_dates: list[dt_date] = []
    if shift_date - timedelta(days=1) < rota.start_date:
        prev_day = shift_date - timedelta(days=1)
        adj_boundary_dates.append(prev_day)
        prev_rota = db.scalar(
            select(Rota).where(
                Rota.workspace_id == rota.workspace_id,
                Rota.id != rota.id,
                Rota.start_date <= prev_day,
                Rota.end_date >= prev_day,
            )
        )
        adjacent_rest_checks["previous_week"] = "verified" if prev_rota else "unavailable"

    if shift_date + timedelta(days=1) > rota.end_date:
        next_day = shift_date + timedelta(days=1)
        adj_boundary_dates.append(next_day)
        next_rota = db.scalar(
            select(Rota).where(
                Rota.workspace_id == rota.workspace_id,
                Rota.id != rota.id,
                Rota.start_date <= next_day,
                Rota.end_date >= next_day,
            )
        )
        adjacent_rest_checks["next_week"] = "verified" if next_rota else "unavailable"

    adjacent_shifts: list[Shift] = []
    if adj_boundary_dates:
        adj_stmt = (
            select(Shift)
            .join(Rota, Shift.rota_id == Rota.id)
            .where(
                Rota.workspace_id == rota.workspace_id,
                Shift.rota_id != rota.id,
                Shift.staff_id == staff_id,
                Shift.date.in_(adj_boundary_dates),
            )
        )
        if existing_shift_id is not None:
            adj_stmt = adj_stmt.where(Shift.id != existing_shift_id)
        adjacent_shifts = list(db.scalars(adj_stmt).all())

    # Deduplicate and combine shifts
    seen_shift_ids: set[str] = set()
    combined_shifts: list[tuple[Shift, bool]] = []
    for s in all_staff_shifts:
        if s.id not in seen_shift_ids:
            seen_shift_ids.add(s.id)
            combined_shifts.append((s, False))
    for s in adjacent_shifts:
        if s.id not in seen_shift_ids:
            seen_shift_ids.add(s.id)
            combined_shifts.append((s, True))

    min_rest_hours = staff.contract.min_rest_hours_between_shifts if staff.contract else 11.0

    for other, is_adj in combined_shifts:
        o_start_min = time_to_minutes(other.start_time)
        o_end_min = time_to_minutes(other.end_time)
        other_start_dt = datetime.combine(other.date, time.fromisoformat(other.start_time))
        if o_end_min <= o_start_min:
            other_end_dt = datetime.combine(other.date + timedelta(days=1), time.fromisoformat(other.end_time))
        else:
            other_end_dt = datetime.combine(other.date, time.fromisoformat(other.end_time))

        # Check overlap
        if max(candidate_start_dt, other_start_dt) < min(candidate_end_dt, other_end_dt):
            suffix = " in adjacent rota" if is_adj else ""
            findings.append(
                ShiftValidationFinding(
                    code="OVERLAPPING_SHIFT",
                    severity="warning",
                    message=f"Shift overlaps with another shift on {other.date} ({other.start_time}–{other.end_time}){suffix}.",
                    date=shift_date.isoformat(),
                    shift_id=other.id,
                )
            )

        # Check rest before candidate
        if other_end_dt <= candidate_start_dt:
            rest_hours = round((candidate_start_dt - other_end_dt).total_seconds() / 3600.0, 1)
            if rest_hours < min_rest_hours:
                suffix = " (previous rota)" if is_adj else ""
                findings.append(
                    ShiftValidationFinding(
                        code="INSUFFICIENT_REST",
                        severity="warning",
                        message=f"Insufficient rest ({rest_hours}h < {min_rest_hours}h required) after shift on {other.date} ending at {other.end_time}{suffix}.",
                        date=shift_date.isoformat(),
                        shift_id=other.id,
                    )
                )

        # Check rest after candidate
        if candidate_end_dt <= other_start_dt:
            rest_hours = round((other_start_dt - candidate_end_dt).total_seconds() / 3600.0, 1)
            if rest_hours < min_rest_hours:
                suffix = " (next rota)" if is_adj else ""
                findings.append(
                    ShiftValidationFinding(
                        code="INSUFFICIENT_REST",
                        severity="warning",
                        message=f"Insufficient rest ({rest_hours}h < {min_rest_hours}h required) before shift on {other.date} starting at {other.start_time}{suffix}.",
                        date=shift_date.isoformat(),
                        shift_id=other.id,
                    )
                )

    # 10. Weekly maximum hours, contracted hours, and shift limits
    existing_paid_hours = 0.0
    for s in all_staff_shifts:
        from app.services.scheduler import time_to_minutes as s_ttm
        s_s = s_ttm(s.start_time)
        s_e = s_ttm(s.end_time)
        g = s_e - s_s if s_e > s_s else (24 * 60 - s_s) + s_e
        p = max(0, g - s.unpaid_break_minutes)
        existing_paid_hours += round(p / 60.0, 2)

    total_paid_hours = round(existing_paid_hours + paid_hours, 2)
    total_shifts_count = len(all_staff_shifts) + 1

    if staff.contract:
        if staff.contract.max_hours_per_week and total_paid_hours > staff.contract.max_hours_per_week:
            findings.append(
                ShiftValidationFinding(
                    code="MAX_HOURS_EXCEEDED",
                    severity="warning",
                    message=f"Total scheduled hours ({total_paid_hours}h) exceed maximum limit ({staff.contract.max_hours_per_week}h).",
                    date=shift_date.isoformat(),
                )
            )
        elif staff.contract.contracted_hours_per_week and total_paid_hours > staff.contract.contracted_hours_per_week:
            findings.append(
                ShiftValidationFinding(
                    code="CONTRACT_HOURS_EXCEEDED",
                    severity="warning",
                    message=f"Total scheduled hours ({total_paid_hours}h) exceed contracted weekly hours ({staff.contract.contracted_hours_per_week}h).",
                    date=shift_date.isoformat(),
                )
            )

        if staff.contract.max_shifts_per_week and total_shifts_count > staff.contract.max_shifts_per_week:
            findings.append(
                ShiftValidationFinding(
                    code="MAX_SHIFTS_EXCEEDED",
                    severity="warning",
                    message=f"Total shifts ({total_shifts_count}) exceed weekly shift limit ({staff.contract.max_shifts_per_week}).",
                    date=shift_date.isoformat(),
                )
            )

        if staff.contract.max_consecutive_days:
            dates_worked = {s.date for s in all_staff_shifts}
            for s in adjacent_shifts:
                dates_worked.add(s.date)
            dates_worked.add(shift_date)
            consec_days = _calculate_consecutive_days(dates_worked, shift_date)
            if consec_days > staff.contract.max_consecutive_days:
                findings.append(
                    ShiftValidationFinding(
                        code="CONSECUTIVE_DAYS_EXCEEDED",
                        severity="warning",
                        message=f"Working {consec_days} consecutive days exceeds limit ({staff.contract.max_consecutive_days} days).",
                        date=shift_date.isoformat(),
                    )
                )

    # 11. Daily Coverage summary for shift_date
    req = db.scalar(
        select(StaffingRequirement)
        .options(selectinload(StaffingRequirement.bands))
        .where(
            StaffingRequirement.rota_id == rota.id,
            StaffingRequirement.date == shift_date,
        )
    )
    target_count = sum(b.target_staff_count for b in req.bands) if req else 0
    # Scheduled shifts on this day in rota + this new shift
    current_scheduled_count = len([
        s for s in rota.shifts
        if s.date == shift_date and (existing_shift_id is None or s.id != existing_shift_id)
    ]) + 1

    daily_cov = CoverageSummaryItem(
        date=shift_date,
        target_staff_count=target_count,
        scheduled_staff_count=current_scheduled_count,
        is_understaffed=current_scheduled_count < target_count,
        is_overstaffed=current_scheduled_count > target_count,
    )

    has_blocking = any(f.severity == "blocking" for f in findings)
    has_warnings = any(f.severity == "warning" for f in findings)

    return ShiftValidationResponse(
        is_valid=not has_blocking,
        has_warnings=has_warnings,
        can_override=not has_blocking,
        findings=findings,
        gross_hours=gross_hours,
        unpaid_break_minutes=unpaid_break,
        paid_hours=paid_hours,
        assumptions_summary=assumptions,
        daily_coverage=daily_cov,
        adjacent_rest_checks=adjacent_rest_checks,
    )
