import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from ortools.sat.python import cp_model

from app.models.rota import Rota, StaffingRequirementBand
from app.models.staff import StaffMember

logger = logging.getLogger(__name__)


def time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' string to minutes from midnight."""
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def calculate_band_durations(start_time: str, end_time: str) -> tuple[int, int, float]:
    """
    Calculate gross minutes, unpaid break minutes, and paid hours.
    Overnight shifts wrap around 24 hours.
    Standard break policy:
    - Under 6 hours: 0 break
    - 6 to <8 hours: 30 min break
    - 8+ hours: 45 min break
    """
    start_min = time_to_minutes(start_time)
    end_min = time_to_minutes(end_time)
    if end_min > start_min:
        gross_minutes = end_min - start_min
    else:
        # Overnight shift
        gross_minutes = (24 * 60 - start_min) + end_min

    if gross_minutes >= 480:
        unpaid_break = 45
    elif gross_minutes >= 360:
        unpaid_break = 30
    else:
        unpaid_break = 0

    paid_minutes = max(0, gross_minutes - unpaid_break)
    paid_hours = round(paid_minutes / 60.0, 2)
    return gross_minutes, unpaid_break, paid_hours


@dataclass
class SolverBandInfo:
    band: StaffingRequirementBand
    date_val: date
    start_min: int
    end_min: int
    gross_minutes: int
    unpaid_break: int
    paid_minutes: int
    paid_hours: float
    target_count: int
    skill_id: str | None


@dataclass
class SolverResult:
    status: str  # "feasible", "partially_feasible", "infeasible", "timeout"
    solve_time_seconds: float
    shifts_to_create: list[dict[str, Any]]
    shifts_created_count: int
    coverage_score: float
    diagnostics: list[dict[str, Any]]


def is_staff_eligible_for_band(
    staff: StaffMember,
    band_info: SolverBandInfo,
) -> tuple[bool, str | None]:
    """
    Determine if staff member meets hard constraints for a specific band on a given date.
    Returns (is_eligible, reason_if_not).
    """
    # 1. Staff must not be archived
    if staff.is_archived:
        return False, "Staff member is archived"

    # 2. Skill check
    if band_info.skill_id:
        staff_skill_ids = {s.id for s in staff.skills}
        if band_info.skill_id not in staff_skill_ids:
            return False, "Missing required skill"

    # 3. Weekly Availability rules
    w = band_info.date_val.weekday()  # 0=Monday .. 6=Sunday
    rule = next((r for r in staff.availability_rules if r.weekday == w), None)
    if rule:
        if rule.is_recurring_day_off or not rule.is_available:
            return False, f"Regular day off / unavailable on {band_info.date_val.strftime('%A')}"
        if rule.start_time and rule.end_time:
            rule_start = time_to_minutes(rule.start_time)
            rule_end = time_to_minutes(rule.end_time)
            # If band starts before rule availability or ends after
            if band_info.start_min < rule_start or band_info.end_min > rule_end:
                return False, f"Shift outside available hours ({rule.start_time}-{rule.end_time})"

    # 4. Unavailability Blocks (approved leave, sickness, holidays)
    for block in staff.unavailability_blocks:
        if block.start_date <= band_info.date_val <= block.end_date:
            # Check if block has time constraints or is all-day
            if not block.start_time or not block.end_time:
                return False, f"Approved {block.reason_category} block ({block.start_date} to {block.end_date})"
            # Overlap check for partial-day leave
            block_start = time_to_minutes(block.start_time)
            block_end = time_to_minutes(block.end_time)
            if not (band_info.end_min <= block_start or band_info.start_min >= block_end):
                return False, f"Approved {block.reason_category} ({block.start_time}-{block.end_time})"

    return True, None


def generate_rota_schedule(
    rota: Rota,
    staff_members: list[StaffMember],
    time_limit_seconds: float = 10.0,
) -> SolverResult:
    """
    Core OR-Tools CP-SAT scheduling engine.
    Constructs constraint programming model with hard & soft constraints,
    executes solver, formats assignments, and generates actionable diagnostics.
    """
    start_timestamp = time.time()

    # Pre-diagnostics check: Active staff
    active_staff = [s for s in staff_members if not s.is_archived]
    diagnostics: list[dict[str, Any]] = []

    if not active_staff:
        return SolverResult(
            status="infeasible",
            solve_time_seconds=round(time.time() - start_timestamp, 3),
            shifts_to_create=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[{
                "type": "error",
                "message": "No active staff members found in this workspace. Add or unarchive staff before generating.",
            }],
        )

    # Collect all requirements & bands
    dates_in_period: list[date] = []
    curr = rota.start_date
    while curr <= rota.end_date:
        dates_in_period.append(curr)
        curr += timedelta(days=1)

    all_bands: list[SolverBandInfo] = []
    total_slots_required = 0

    req_by_date = {r.date: r for r in rota.requirements}

    for d in dates_in_period:
        req = req_by_date.get(d)
        if req and req.bands:
            for b in req.bands:
                gross_min, unpaid_break, paid_hrs = calculate_band_durations(b.start_time, b.end_time)
                paid_min = max(0, gross_min - unpaid_break)
                band_info = SolverBandInfo(
                    band=b,
                    date_val=d,
                    start_min=time_to_minutes(b.start_time),
                    end_min=time_to_minutes(b.end_time),
                    gross_minutes=gross_min,
                    unpaid_break=unpaid_break,
                    paid_minutes=paid_min,
                    paid_hours=paid_hrs,
                    target_count=b.target_staff_count,
                    skill_id=b.skill_id,
                )
                all_bands.append(band_info)
                total_slots_required += b.target_staff_count

    if total_slots_required == 0:
        return SolverResult(
            status="feasible",
            solve_time_seconds=round(time.time() - start_timestamp, 3),
            shifts_to_create=[],
            shifts_created_count=0,
            coverage_score=100.0,
            diagnostics=[{
                "type": "info",
                "message": "No staffing requirement bands defined for this rota period. Nothing to schedule.",
            }],
        )

    # Build CP-SAT Model
    model = cp_model.CpModel()

    # Variables:
    # x[staff_id, band_idx] in {0, 1}
    # slack[band_idx] in [0, target_count]
    x: dict[tuple[str, int], cp_model.IntVar] = {}
    slack_vars: list[cp_model.IntVar] = []

    # Map staff to index
    staff_by_id = {s.id: s for s in active_staff}

    # Pre-check eligibility per band
    band_eligible_staff: dict[int, list[str]] = {}
    for b_idx, b_info in enumerate(all_bands):
        eligible_ids = []
        for s in active_staff:
            eligible, _ = is_staff_eligible_for_band(s, b_info)
            if eligible:
                var = model.NewBoolVar(f"x_{s.id}_{b_idx}")
                x[s.id, b_idx] = var
                eligible_ids.append(s.id)
            else:
                x[s.id, b_idx] = model.NewConstant(0)
        band_eligible_staff[b_idx] = eligible_ids

        # Slack variable for unfulfilled demand
        s_var = model.NewIntVar(0, b_info.target_count, f"slack_{b_idx}")
        slack_vars.append(s_var)

        # Coverage constraint: sum(x) + slack == target_count
        model.Add(sum(x[s_id, b_idx] for s_id in eligible_ids) + s_var == b_info.target_count)

    # HARD CONSTRAINT 1: At most 1 shift per day per staff member (no overlapping shifts)
    for s in active_staff:
        for d in dates_in_period:
            bands_on_day = [b_idx for b_idx, b_info in enumerate(all_bands) if b_info.date_val == d]
            if bands_on_day:
                model.Add(sum(x[s.id, b_idx] for b_idx in bands_on_day) <= 1)

    # HARD CONSTRAINT 2: Minimum rest between shifts across adjacent days
    # (e.g. 11 hours standard UK/EU working time rest rule)
    for d_idx in range(len(dates_in_period) - 1):
        day_curr = dates_in_period[d_idx]
        day_next = dates_in_period[d_idx + 1]

        bands_curr = [(b_idx, b_info) for b_idx, b_info in enumerate(all_bands) if b_info.date_val == day_curr]
        bands_next = [(b_idx, b_info) for b_idx, b_info in enumerate(all_bands) if b_info.date_val == day_next]

        for s in active_staff:
            min_rest_hours = 11.0
            if s.contract and s.contract.min_rest_hours_between_shifts is not None:
                min_rest_hours = s.contract.min_rest_hours_between_shifts
            min_rest_minutes = int(min_rest_hours * 60)

            for b_idx1, b1 in bands_curr:
                for b_idx2, b2 in bands_next:
                    # Rest between b1 end on day_curr and b2 start on day_next
                    rest_between = (24 * 60 - b1.end_min) + b2.start_min
                    if rest_between < min_rest_minutes:
                        # Cannot assign both
                        model.Add(x[s.id, b_idx1] + x[s.id, b_idx2] <= 1)

    # HARD CONSTRAINT 3: Max shifts per week
    # HARD CONSTRAINT 4: Max hours per week
    # Split dates_in_period into weekly 7-day chunks
    period_length = len(dates_in_period)
    weeks = [dates_in_period[i : i + 7] for i in range(0, period_length, 7)]

    for s in active_staff:
        contract = s.contract
        max_shifts = contract.max_shifts_per_week if contract else None
        max_hours = contract.max_hours_per_week if contract else None

        for week_dates in weeks:
            week_band_indices = [
                b_idx for b_idx, b_info in enumerate(all_bands) if b_info.date_val in week_dates
            ]
            if max_shifts is not None and max_shifts >= 0:
                model.Add(sum(x[s.id, b_idx] for b_idx in week_band_indices) <= max_shifts)

            if max_hours is not None and max_hours >= 0:
                max_minutes = int(max_hours * 60)
                model.Add(
                    sum(all_bands[b_idx].paid_minutes * x[s.id, b_idx] for b_idx in week_band_indices)
                    <= max_minutes
                )

    # HARD CONSTRAINT 5: Max consecutive working days
    for s in active_staff:
        contract = s.contract
        max_consec = contract.max_consecutive_days if contract else None
        if max_consec is not None and 1 <= max_consec < period_length:
            # worked_day[d] in {0, 1}
            worked_days: list[cp_model.IntVar] = []
            for d in dates_in_period:
                bands_on_day = [b_idx for b_idx, b_info in enumerate(all_bands) if b_info.date_val == d]
                if bands_on_day:
                    w_var = model.NewBoolVar(f"worked_{s.id}_{d}")
                    model.Add(w_var == sum(x[s.id, b_idx] for b_idx in bands_on_day))
                    worked_days.append(w_var)
                else:
                    worked_days.append(model.NewConstant(0))

            # Over any window of max_consec + 1 days, sum <= max_consec
            window_size = max_consec + 1
            for start_i in range(len(worked_days) - window_size + 1):
                model.Add(sum(worked_days[start_i : start_i + window_size]) <= max_consec)

    # SOFT OBJECTIVES:
    # 1. Heavily penalize unassigned slots (slack): weight 10,000 per slot
    # 2. Minimize absolute deviation from contracted weekly hours: weight 10 per hour deviation
    # 3. Workload balancing across available staff
    objective_terms: list[Any] = []

    # Coverage penalty
    for s_var in slack_vars:
        objective_terms.append(s_var * 10000)

    # Contract hours deviation penalty
    num_days = max(1, period_length)
    for s in active_staff:
        contracted_weekly = s.contract.contracted_hours_per_week if s.contract else 37.5
        # Scale to the length of the rota period (e.g. 7 days -> 1.0, 14 days -> 2.0)
        target_minutes = int((contracted_weekly * 60) * (num_days / 7.0))

        # Total minutes assigned to this staff member
        assigned_mins_expr = sum(
            all_bands[b_idx].paid_minutes * x[s.id, b_idx]
            for b_idx in range(len(all_bands))
        )

        # Deviation variable dev >= |assigned - target|
        dev = model.NewIntVar(0, 24 * 60 * num_days, f"dev_{s.id}")
        model.Add(dev >= assigned_mins_expr - target_minutes)
        model.Add(dev >= target_minutes - assigned_mins_expr)
        objective_terms.append(dev * 1)

    model.Minimize(sum(objective_terms))

    # Run Solver
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    solver.parameters.num_workers = 4

    solve_status = solver.Solve(model)
    solve_duration = round(time.time() - start_timestamp, 3)

    if solve_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Extract shifts and evaluate slack
        shifts_to_create: list[dict[str, Any]] = []
        unmet_count = 0

        for b_idx, b_info in enumerate(all_bands):
            slack_val = solver.Value(slack_vars[b_idx])
            unmet_count += slack_val

            if slack_val > 0:
                skill_note = f" (requires skill '{b_info.skill_id}')" if b_info.skill_id else ""
                diagnostics.append({
                    "type": "warning",
                    "date": b_info.date_val.isoformat(),
                    "band": f"{b_info.band.start_time}-{b_info.band.end_time}",
                    "message": (
                        f"Unmet coverage on {b_info.date_val.strftime('%a, %d %b')}: "
                        f"{b_info.band.start_time}–{b_info.band.end_time} "
                        f"short by {slack_val} of {b_info.target_count} required staff{skill_note}."
                    ),
                })

            for s_id in band_eligible_staff[b_idx]:
                if solver.Value(x[s_id, b_idx]) == 1:
                    staff_obj = staff_by_id[s_id]
                    full_name = f"{staff_obj.first_name} {staff_obj.last_name}"
                    shifts_to_create.append({
                        "rota_id": rota.id,
                        "staff_id": s_id,
                        "staff_name": full_name,
                        "date": b_info.date_val,
                        "start_time": b_info.band.start_time,
                        "end_time": b_info.band.end_time,
                        "unpaid_break_minutes": b_info.unpaid_break,
                        "paid_hours": b_info.paid_hours,
                        "skill_id": b_info.skill_id,
                        "status": "draft",
                        "notes": "Generated automatically by OR-Tools engine",
                    })

        total_slots = total_slots_required
        filled_slots = total_slots - unmet_count
        coverage_score = round((filled_slots / total_slots) * 100.0, 1) if total_slots > 0 else 100.0

        if unmet_count == 0:
            final_status = "feasible"
            diagnostics.insert(0, {
                "type": "info",
                "message": (
                    f"Optimal feasible rota generated in {solve_duration}s. "
                    f"All {total_slots} required shift slots successfully filled."
                ),
            })
        else:
            final_status = "partially_feasible"
            diagnostics.insert(0, {
                "type": "warning",
                "message": (
                    f"Partially feasible rota generated in {solve_duration}s: "
                    f"{filled_slots}/{total_slots} slots filled ({coverage_score}%). "
                    f"{unmet_count} slots could not be scheduled within staff constraints."
                ),
            })

        return SolverResult(
            status=final_status,
            solve_time_seconds=solve_duration,
            shifts_to_create=shifts_to_create,
            shifts_created_count=len(shifts_to_create),
            coverage_score=coverage_score,
            diagnostics=diagnostics,
        )

    elif solve_status == cp_model.INFEASIBLE:
        # Determine why it is infeasible
        return SolverResult(
            status="infeasible",
            solve_time_seconds=solve_duration,
            shifts_to_create=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[{
                "type": "error",
                "message": (
                    "No valid schedule could satisfy the mandatory constraints. "
                    "Review staff availability, leave blocks, or rest period requirements."
                ),
            }],
        )

    elif solve_status == cp_model.UNKNOWN:
        return SolverResult(
            status="timeout",
            solve_time_seconds=solve_duration,
            shifts_to_create=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[{
                "type": "error",
                "message": (
                    f"Solver timed out after {time_limit_seconds} seconds without proving a solution. "
                    "Try increasing the solver time limit or simplifying requirements."
                ),
            }],
        )

    else:
        return SolverResult(
            status="infeasible",
            solve_time_seconds=solve_duration,
            shifts_to_create=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[{
                "type": "error",
                "message": f"OR-Tools solver returned unexpected status code {solve_status}.",
            }],
        )
