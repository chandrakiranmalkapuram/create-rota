from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from typing import Any

from ortools.sat.python import cp_model

from app.schemas.scheduler import (
    AssumptionsSpec,
    BandSpec,
    BreakPolicySpec,
    DiagnosticItemSpec,
    RelaxationSuggestion,
    SchedulerInputSpec,
    SchedulerOutputSpec,
    ShiftDurationResult,
    ShiftSpec,
    StaffSpec,
    calculate_shift_durations,
    time_to_minutes,
)

logger = logging.getLogger(__name__)


# Backwards compatibility alias
def calculate_band_durations(start_time: str, end_time: str) -> tuple[int, int, float]:
    """Legacy helper returning (gross_minutes, unpaid_break_minutes, paid_hours)."""
    res = calculate_shift_durations(start_time, end_time, BreakPolicySpec())
    return res.gross_minutes, res.unpaid_break_minutes, res.paid_hours


def is_staff_eligible_for_band(
    staff: StaffSpec,
    band: BandSpec,
) -> tuple[bool, str | None, str | None]:
    """
    Check if a staff member satisfies hard constraints for a specific band on a given date.
    Returns (is_eligible, reason_if_not, category_of_reason).
    """
    # 1. Staff must not be archived
    if staff.is_archived:
        return False, f"{staff.first_name} {staff.last_name} is archived", "archived"

    # 2. Skill check
    if band.skill_id and band.skill_id not in staff.skill_ids:
        skill_desc = f"skill '{band.skill_name}'" if band.skill_name else "required skill"
        return False, f"Missing {skill_desc}", "skill"

    # 3. Weekly Availability rules
    w = band.date.weekday()  # 0=Monday .. 6=Sunday
    rule = next((r for r in staff.availability_rules if r.weekday == w), None)
    if rule:
        if rule.is_recurring_day_off or not rule.is_available:
            return False, f"Regular day off / unavailable on {band.date.strftime('%A')}", "availability"
        if rule.start_time and rule.end_time:
            rule_start = time_to_minutes(rule.start_time)
            rule_end = time_to_minutes(rule.end_time)
            band_start = time_to_minutes(band.start_time)
            band_end = time_to_minutes(band.end_time)
            # If band starts before available window or ends after
            if band_start < rule_start or band_end > rule_end:
                return False, f"Shift outside available window ({rule.start_time}–{rule.end_time})", "availability"

    # 4. Unavailability Blocks (approved leave, sickness, holidays)
    band_start_min = time_to_minutes(band.start_time)
    band_end_min = time_to_minutes(band.end_time)
    for block in staff.unavailability_blocks:
        if block.start_date <= band.date <= block.end_date:
            if not block.start_time or not block.end_time:
                return (
                    False,
                    f"Approved {block.reason_category} ({block.start_date} to {block.end_date})",
                    "leave",
                )
            block_start = time_to_minutes(block.start_time)
            block_end = time_to_minutes(block.end_time)
            if not (band_end_min <= block_start or band_start_min >= block_end):
                return (
                    False,
                    f"Approved {block.reason_category} ({block.start_time}–{block.end_time})",
                    "leave",
                )

    return True, None, None


def analyze_relaxation_suggestions(
    all_bands: list[BandSpec],
    slack_by_band: dict[int, int],
    active_staff: list[StaffSpec],
    durations_by_band: list[ShiftDurationResult],
) -> list[RelaxationSuggestion]:
    """
    Produce structured, actionable suggestions for unfilled slots.
    Distinguishes mathematically confirmed findings from heuristic recommendations.
    Never claims a constraint is the proven cause without evidence.
    """
    suggestions: list[RelaxationSuggestion] = []
    seen_suggestions: set[str] = set()

    # 1. Total workforce hours capacity check across all active staff
    total_unmet_slots = sum(slack_by_band.values())
    if total_unmet_slots > 0:
        total_demand_minutes = sum(
            durations_by_band[b_idx].paid_minutes * b.target_staff_count
            for b_idx, b in enumerate(all_bands)
        )
        total_capacity_minutes = sum(
            int((s.contract.contracted_hours_per_week if s.contract else 37.5) * 60)
            for s in active_staff
        )
        if total_demand_minutes > total_capacity_minutes:
            deficit_hours = round((total_demand_minutes - total_capacity_minutes) / 60.0, 1)
            s_key = "capacity_deficit"
            if s_key not in seen_suggestions:
                seen_suggestions.add(s_key)
                suggestions.append(
                    RelaxationSuggestion(
                        id=f"sug_cap_{len(suggestions)}",
                        category="workforce_capacity",
                        is_confirmed=True,  # Proven deficit
                        title="Workforce Contract Capacity Deficit",
                        description=(
                            f"Total weekly demand ({round(total_demand_minutes / 60.0, 1)}h) exceeds "
                            f"total active staff contract capacity ({round(total_capacity_minutes / 60.0, 1)}h) "
                            f"by approximately {deficit_hours} hours. "
                            "Consider adding staff members or approving overtime."
                        ),
                        potential_impact="Required to bridge overall hours shortfall",
                    )
                )

    # 2. Inspect each band with unfilled demand
    for b_idx, slack in slack_by_band.items():
        if slack <= 0:
            continue
        band = all_bands[b_idx]

        # Skill bottleneck check
        if band.skill_id:
            skilled_staff = [s for s in active_staff if band.skill_id in s.skill_ids]
            if len(skilled_staff) == 0:
                s_key = f"no_skill_{band.skill_id}"
                if s_key not in seen_suggestions:
                    seen_suggestions.add(s_key)
                    suggestions.append(
                        RelaxationSuggestion(
                            id=f"sug_skill_{b_idx}",
                            category="skill",
                            is_confirmed=True,  # Proven absence of skilled staff
                            title="No Qualified Staff in Workspace",
                            description=(
                                f"Zero active staff members possess the skill required for band "
                                f"{band.start_time}–{band.end_time} on {band.date.strftime('%a, %d %b')}. "
                                "Assign this skill to at least one staff member or remove the requirement."
                            ),
                            affected_date=band.date,
                            affected_band=f"{band.start_time}–{band.end_time}",
                            potential_impact=f"Will unblock {slack} required slot(s)",
                        )
                    )
            else:
                # Skilled staff exist; check why they were ineligible or unavailable
                for s in skilled_staff:
                    eligible, reason, category = is_staff_eligible_for_band(s, band)
                    if not eligible:
                        s_key = f"staff_{s.id}_inelig_{category}_{band.date}"
                        if s_key not in seen_suggestions:
                            seen_suggestions.add(s_key)
                            if category == "availability":
                                suggestions.append(
                                    RelaxationSuggestion(
                                        id=f"sug_avail_{s.id}_{b_idx}",
                                        category="availability",
                                        is_confirmed=False,  # Recommendation
                                        title=f"Adjust Availability for {s.first_name} {s.last_name}",
                                        description=(
                                            f"{s.first_name} {s.last_name} possesses the required skill but is unavailable "
                                            f"on {band.date.strftime('%a, %d %b')} ({reason}). "
                                            "Adjusting weekly availability may allow filling this slot."
                                        ),
                                        affected_date=band.date,
                                        affected_band=f"{band.start_time}–{band.end_time}",
                                        affected_staff_id=s.id,
                                        affected_staff_name=f"{s.first_name} {s.last_name}",
                                        potential_impact="May allow assigning a qualified staff member",
                                    )
                                )
                    elif s.contract and s.contract.max_shifts_per_week:
                        s_key = f"max_shifts_{s.id}"
                        if s_key not in seen_suggestions:
                            seen_suggestions.add(s_key)
                            suggestions.append(
                                RelaxationSuggestion(
                                    id=f"sug_shift_cap_{s.id}_{b_idx}",
                                    category="max_shifts",
                                    is_confirmed=False,  # Heuristic recommendation
                                    title=f"Consider Relaxing Max Shifts for {s.first_name} {s.last_name}",
                                    description=(
                                        f"{s.first_name} {s.last_name} is capped at {s.contract.max_shifts_per_week} "
                                        f"shift(s) per week. Relaxing this limit or offering overtime could fill unmet demand."
                                    ),
                                    affected_date=band.date,
                                    affected_band=f"{band.start_time}–{band.end_time}",
                                    affected_staff_id=s.id,
                                    affected_staff_name=f"{s.first_name} {s.last_name}",
                                    potential_impact="Permits additional shift allocation",
                                )
                            )

        # General availability check for dates with zero eligible staff
        eligible_for_band = [s for s in active_staff if is_staff_eligible_for_band(s, band)[0]]
        if len(eligible_for_band) == 0 and not band.skill_id:
            s_key = f"zero_eligible_{band.date}_{band.start_time}"
            if s_key not in seen_suggestions:
                seen_suggestions.add(s_key)
                suggestions.append(
                    RelaxationSuggestion(
                        id=f"sug_zero_{b_idx}",
                        category="availability",
                        is_confirmed=True,  # Proven zero available staff
                        title="No Available Staff on Date",
                        description=(
                            f"No staff members in the workspace are available for {band.start_time}–{band.end_time} "
                            f"on {band.date.strftime('%a, %d %b')} due to recurring days off, restricted hours, or approved leave."
                        ),
                        affected_date=band.date,
                        affected_band=f"{band.start_time}–{band.end_time}",
                        potential_impact=f"Unblocks {slack} slot(s)",
                    )
                )

    return suggestions


def generate_rota_schedule(request: SchedulerInputSpec) -> SchedulerOutputSpec:
    """
    Isolated OR-Tools CP-SAT scheduling engine.
    Consumes pure domain DTOs (SchedulerInputSpec), executes constraint programming solver
    with deterministic random seeds and configurable break policy, and returns structured
    SchedulerOutputSpec with verified diagnostics and relaxation suggestions.
    """
    start_timestamp = time.time()
    diagnostics: list[DiagnosticItemSpec] = []

    # Assumptions specification for transparency
    policy = request.break_policy
    tier_desc = ", ".join(
        f"{t.threshold_minutes // 60}h+ -> {t.break_minutes}m ({'unpaid' if t.is_unpaid else 'paid'})"
        for t in policy.tiers
    )
    assumptions = AssumptionsSpec(
        break_policy_name=policy.name,
        break_tiers_summary=tier_desc or "No breaks configured",
        rest_period_hours=11.0,
        random_seed=request.random_seed,
        compliance_disclaimer=policy.compliance_disclaimer,
    )

    # 1. Pre-validation: Active staff check
    active_staff = [s for s in request.staff if not s.is_archived]
    if not active_staff:
        duration = round(time.time() - start_timestamp, 3)
        return SchedulerOutputSpec(
            status="infeasible",
            solve_time_seconds=duration,
            shifts=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[
                DiagnosticItemSpec(
                    type="error",
                    message="No active staff members found in workspace. Add or unarchive staff before generating.",
                    is_proven=True,
                )
            ],
            relaxation_suggestions=[
                RelaxationSuggestion(
                    id="sug_no_active_staff",
                    category="staffing_level",
                    is_confirmed=True,
                    title="Add Active Staff",
                    description="Create active staff members or unarchive existing staff to generate a schedule.",
                    potential_impact="Prerequisite for generating any schedule",
                )
            ],
            assumptions=assumptions,
        )

    # 2. Check total staffing demand
    all_bands = request.bands
    total_slots_required = sum(b.target_staff_count for b in all_bands)
    if total_slots_required == 0:
        duration = round(time.time() - start_timestamp, 3)
        return SchedulerOutputSpec(
            status="feasible",
            solve_time_seconds=duration,
            shifts=[],
            shifts_created_count=0,
            coverage_score=100.0,
            diagnostics=[
                DiagnosticItemSpec(
                    type="info",
                    message="No staffing requirement bands defined for this rota period. Nothing to schedule.",
                    is_proven=True,
                )
            ],
            relaxation_suggestions=[],
            assumptions=assumptions,
        )

    # Pre-calculate durations for each band according to configurable break policy
    durations_by_band: list[ShiftDurationResult] = []
    for b in all_bands:
        d_res = calculate_shift_durations(b.start_time, b.end_time, policy)
        durations_by_band.append(d_res)

    # Collect distinct dates
    dates_in_period: list[date] = []
    curr = request.start_date
    while curr <= request.end_date:
        dates_in_period.append(curr)
        curr += timedelta(days=1)

    # 3. Construct CP-SAT Model
    model = cp_model.CpModel()

    # Variables:
    # x[staff_id, band_idx] in {0, 1}
    # slack[band_idx] in [0, target_count]
    x: dict[tuple[str, int], cp_model.IntVar] = {}
    slack_vars: list[cp_model.IntVar] = []

    staff_by_id = {s.id: s for s in active_staff}
    band_eligible_staff: dict[int, list[str]] = {}

    for b_idx, band in enumerate(all_bands):
        eligible_ids: list[str] = []
        for s in active_staff:
            eligible, _, _ = is_staff_eligible_for_band(s, band)
            if eligible:
                var = model.NewBoolVar(f"x_{s.id}_{b_idx}")
                x[s.id, b_idx] = var
                eligible_ids.append(s.id)
            else:
                x[s.id, b_idx] = model.NewConstant(0)
        band_eligible_staff[b_idx] = eligible_ids

        # Slack variable for unfulfilled demand
        s_var = model.NewIntVar(0, band.target_staff_count, f"slack_{b_idx}")
        slack_vars.append(s_var)

        # Coverage constraint: sum(x) + slack == target_count
        model.Add(sum(x[s_id, b_idx] for s_id in eligible_ids) + s_var == band.target_staff_count)

    # HARD CONSTRAINT 1: At most 1 shift per day per staff member (no overlapping shifts)
    for s in active_staff:
        for d in dates_in_period:
            bands_on_day = [b_idx for b_idx, b in enumerate(all_bands) if b.date == d]
            if bands_on_day:
                model.Add(sum(x[s.id, b_idx] for b_idx in bands_on_day) <= 1)

    # HARD CONSTRAINT 2: Minimum rest between shifts across adjacent days
    for d_idx in range(len(dates_in_period) - 1):
        day_curr = dates_in_period[d_idx]
        day_next = dates_in_period[d_idx + 1]

        bands_curr = [(b_idx, b) for b_idx, b in enumerate(all_bands) if b.date == day_curr]
        bands_next = [(b_idx, b) for b_idx, b in enumerate(all_bands) if b.date == day_next]

        for s in active_staff:
            min_rest_hours = 11.0
            if s.contract and s.contract.min_rest_hours_between_shifts is not None:
                min_rest_hours = s.contract.min_rest_hours_between_shifts
            min_rest_minutes = int(min_rest_hours * 60)

            for b_idx1, b1 in bands_curr:
                b1_end = time_to_minutes(b1.end_time)
                for b_idx2, b2 in bands_next:
                    b2_start = time_to_minutes(b2.start_time)
                    rest_between = (24 * 60 - b1_end) + b2_start
                    if rest_between < min_rest_minutes:
                        # Cannot assign both
                        model.Add(x[s.id, b_idx1] + x[s.id, b_idx2] <= 1)

    # HARD CONSTRAINT 3: Max shifts per week
    # HARD CONSTRAINT 4: Max hours per week
    period_length = len(dates_in_period)
    weeks = [dates_in_period[i : i + 7] for i in range(0, period_length, 7)]

    for s in active_staff:
        contract = s.contract
        max_shifts = contract.max_shifts_per_week if contract else None
        max_hours = contract.max_hours_per_week if contract else None

        for week_dates in weeks:
            week_band_indices = [
                b_idx for b_idx, b in enumerate(all_bands) if b.date in week_dates
            ]
            if max_shifts is not None and max_shifts >= 0:
                model.Add(sum(x[s.id, b_idx] for b_idx in week_band_indices) <= max_shifts)

            if max_hours is not None and max_hours >= 0:
                max_minutes = int(max_hours * 60)
                model.Add(
                    sum(durations_by_band[b_idx].paid_minutes * x[s.id, b_idx] for b_idx in week_band_indices)
                    <= max_minutes
                )

    # HARD CONSTRAINT 5: Max consecutive working days
    for s in active_staff:
        contract = s.contract
        max_consec = contract.max_consecutive_days if contract else None
        if max_consec is not None and 1 <= max_consec < period_length:
            worked_days: list[cp_model.IntVar] = []
            for d in dates_in_period:
                bands_on_day = [b_idx for b_idx, b in enumerate(all_bands) if b.date == d]
                if bands_on_day:
                    w_var = model.NewBoolVar(f"worked_{s.id}_{d}")
                    model.Add(w_var == sum(x[s.id, b_idx] for b_idx in bands_on_day))
                    worked_days.append(w_var)
                else:
                    worked_days.append(model.NewConstant(0))

            window_size = max_consec + 1
            for start_i in range(len(worked_days) - window_size + 1):
                model.Add(sum(worked_days[start_i : start_i + window_size]) <= max_consec)

    # SOFT OBJECTIVES:
    # 1. Heavily penalize unassigned slots (slack): weight 10,000 per slot
    # 2. Minimize absolute deviation from contracted weekly hours: weight 1 per minute deviation
    objective_terms: list[Any] = []

    # Coverage penalty
    for s_var in slack_vars:
        objective_terms.append(s_var * 10000)

    # Contract hours deviation penalty
    num_days = max(1, period_length)
    for s in active_staff:
        contracted_weekly = s.contract.contracted_hours_per_week if s.contract else 37.5
        target_minutes = int((contracted_weekly * 60) * (num_days / 7.0))

        assigned_mins_expr = sum(
            durations_by_band[b_idx].paid_minutes * x[s.id, b_idx]
            for b_idx in range(len(all_bands))
        )

        dev = model.NewIntVar(0, 24 * 60 * num_days, f"dev_{s.id}")
        model.Add(dev >= assigned_mins_expr - target_minutes)
        model.Add(dev >= target_minutes - assigned_mins_expr)
        objective_terms.append(dev * 1)

    model.Minimize(sum(objective_terms))

    # 4. Solver Parameters & Deterministic Execution
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(request.time_limit_seconds)
    # Using 1 worker guarantees strictly reproducible, deterministic branch order
    solver.parameters.num_workers = 1
    solver.parameters.random_seed = int(request.random_seed)

    solve_status = solver.Solve(model)
    solve_duration = round(time.time() - start_timestamp, 3)

    # 5. Evaluate Results
    if solve_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        shifts_to_create: list[ShiftSpec] = []
        slack_by_band: dict[int, int] = {}
        unmet_count = 0

        for b_idx, band in enumerate(all_bands):
            slack_val = int(solver.Value(slack_vars[b_idx]))
            slack_by_band[b_idx] = slack_val
            unmet_count += slack_val

            if slack_val > 0:
                skill_note = f" (requires {band.skill_name or 'skill'})" if band.skill_id else ""
                diagnostics.append(
                    DiagnosticItemSpec(
                        type="warning",
                        date=band.date,
                        band=f"{band.start_time}–{band.end_time}",
                        message=(
                            f"Unmet coverage on {band.date.strftime('%a, %d %b')}: "
                            f"{band.start_time}–{band.end_time} "
                            f"short by {slack_val} of {band.target_staff_count} required staff{skill_note}."
                        ),
                        is_proven=True,
                    )
                )

            for s_id in band_eligible_staff[b_idx]:
                if solver.Value(x[s_id, b_idx]) == 1:
                    staff_obj = staff_by_id[s_id]
                    full_name = f"{staff_obj.first_name} {staff_obj.last_name}"
                    d_res = durations_by_band[b_idx]
                    shifts_to_create.append(
                        ShiftSpec(
                            rota_id=request.rota_id,
                            staff_id=s_id,
                            staff_name=full_name,
                            date=band.date,
                            start_time=band.start_time,
                            end_time=band.end_time,
                            unpaid_break_minutes=d_res.unpaid_break_minutes,
                            paid_hours=d_res.paid_hours,
                            skill_id=band.skill_id,
                            status="draft",
                            notes="Generated automatically by OR-Tools engine",
                        )
                    )

        total_slots = total_slots_required
        filled_slots = total_slots - unmet_count
        coverage_score = round((filled_slots / total_slots) * 100.0, 1) if total_slots > 0 else 100.0

        relaxation_suggestions = analyze_relaxation_suggestions(
            all_bands=all_bands,
            slack_by_band=slack_by_band,
            active_staff=active_staff,
            durations_by_band=durations_by_band,
        )

        if unmet_count == 0:
            final_status = "feasible"
            diagnostics.insert(
                0,
                DiagnosticItemSpec(
                    type="info",
                    message=(
                        f"Feasible schedule found in {solve_duration}s (Seed {request.random_seed}). "
                        f"All {total_slots} required shift slots successfully allocated."
                    ),
                    is_proven=True,
                ),
            )
        else:
            final_status = "partially_feasible"
            diagnostics.insert(
                0,
                DiagnosticItemSpec(
                    type="warning",
                    message=(
                        f"Partially feasible schedule found in {solve_duration}s: "
                        f"{filled_slots}/{total_slots} slots filled ({coverage_score}%). "
                        f"{unmet_count} slots could not be scheduled within configured staff constraints."
                    ),
                    is_proven=True,
                ),
            )

        return SchedulerOutputSpec(
            status=final_status,
            solve_time_seconds=solve_duration,
            shifts=shifts_to_create,
            shifts_created_count=len(shifts_to_create),
            coverage_score=coverage_score,
            diagnostics=diagnostics,
            relaxation_suggestions=relaxation_suggestions,
            assumptions=assumptions,
        )

    elif solve_status == cp_model.INFEASIBLE:
        # Construct suggestions for infeasible model
        slack_by_band = {b_idx: band.target_staff_count for b_idx, band in enumerate(all_bands)}
        suggestions = analyze_relaxation_suggestions(
            all_bands=all_bands,
            slack_by_band=slack_by_band,
            active_staff=active_staff,
            durations_by_band=durations_by_band,
        )
        return SchedulerOutputSpec(
            status="infeasible",
            solve_time_seconds=solve_duration,
            shifts=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[
                DiagnosticItemSpec(
                    type="error",
                    message=(
                        "No valid schedule could satisfy the mandatory constraints. "
                        "Review staff availability, leave blocks, or rest period requirements."
                    ),
                    is_proven=True,
                )
            ],
            relaxation_suggestions=suggestions,
            assumptions=assumptions,
        )

    elif solve_status == cp_model.UNKNOWN:
        return SchedulerOutputSpec(
            status="timeout",
            solve_time_seconds=solve_duration,
            shifts=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[
                DiagnosticItemSpec(
                    type="error",
                    message=(
                        f"Solver reached time limit ({request.time_limit_seconds}s) without proving a solution. "
                        "Try increasing the solver time limit or simplifying requirements."
                    ),
                    is_proven=True,
                )
            ],
            relaxation_suggestions=[
                RelaxationSuggestion(
                    id="sug_timeout_retry",
                    category="workforce_capacity",
                    is_confirmed=False,
                    title="Increase Solver Time Limit",
                    description=(
                        f"Solver hit the {request.time_limit_seconds}s limit before completing search. "
                        "Increase time limit to 20s or 30s for complex multi-week periods."
                    ),
                    potential_impact="Allows the solver additional search iterations to prove feasibility",
                )
            ],
            assumptions=assumptions,
        )

    else:
        return SchedulerOutputSpec(
            status="unknown",
            solve_time_seconds=solve_duration,
            shifts=[],
            shifts_created_count=0,
            coverage_score=0.0,
            diagnostics=[
                DiagnosticItemSpec(
                    type="error",
                    message=f"OR-Tools solver returned unexpected status code {solve_status}.",
                    is_proven=False,
                )
            ],
            relaxation_suggestions=[],
            assumptions=assumptions,
        )
