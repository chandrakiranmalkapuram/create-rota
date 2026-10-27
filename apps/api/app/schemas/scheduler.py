from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' string to minutes from midnight."""
    if not TIME_REGEX.match(time_str):
        raise ValueError(f"Invalid time format '{time_str}'. Expected 24-hour HH:MM.")
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


# ---------------------------------------------------------
# Break Policy Specifications & Calculations
# ---------------------------------------------------------

class BreakTierSpec(BaseModel):
    threshold_minutes: int = Field(
        ...,
        ge=0,
        description="Shift gross duration threshold in minutes to trigger this break tier (e.g. 360 for 6 hours)",
    )
    break_minutes: int = Field(
        ...,
        ge=0,
        description="Duration of break in minutes (e.g. 30)",
    )
    is_unpaid: bool = Field(
        default=True,
        description="Whether this break is unpaid (deducted from gross hours)",
    )


class BreakPolicySpec(BaseModel):
    name: str = Field(default="standard", description="Identifier for this break policy preset")
    description: str = Field(
        default="Standard workplace break policy (30m unpaid break for >=6h, 45m for >=8h)",
        description="Human-readable description of policy assumptions",
    )
    tiers: list[BreakTierSpec] = Field(
        default_factory=lambda: [
            BreakTierSpec(threshold_minutes=360, break_minutes=30, is_unpaid=True),
            BreakTierSpec(threshold_minutes=480, break_minutes=45, is_unpaid=True),
        ]
    )
    compliance_disclaimer: str = Field(
        default=(
            "Notice: Configured break policies and rest rules reflect workspace configuration. "
            "They do not constitute legal advice or an official guarantee of statutory employment law compliance."
        )
    )

    model_config = ConfigDict(from_attributes=True)


@dataclass
class ShiftDurationResult:
    gross_minutes: int
    unpaid_break_minutes: int
    paid_minutes: int
    paid_hours: float
    is_overnight: bool
    assumptions_summary: str


def calculate_shift_durations(
    start_time: str,
    end_time: str,
    policy: BreakPolicySpec | None = None,
) -> ShiftDurationResult:
    """
    Calculate gross minutes, unpaid break minutes, and paid hours based on policy.
    Handles standard shifts, overnight shifts, and exact threshold boundaries.
    """
    if policy is None:
        policy = BreakPolicySpec()

    start_min = time_to_minutes(start_time)
    end_min = time_to_minutes(end_time)

    if start_min == end_min:
        raise ValueError("Shift start time and end time cannot be identical.")

    if end_min > start_min:
        gross_minutes = end_min - start_min
        is_overnight = False
    else:
        # Overnight shift crosses midnight
        gross_minutes = (24 * 60 - start_min) + end_min
        is_overnight = True

    # Find highest applicable tier where gross_minutes >= tier.threshold_minutes
    unpaid_break = 0
    applied_threshold = 0
    # Sort tiers descending by threshold
    sorted_tiers = sorted(policy.tiers, key=lambda t: t.threshold_minutes, reverse=True)
    for tier in sorted_tiers:
        if gross_minutes >= tier.threshold_minutes:
            if tier.is_unpaid:
                unpaid_break = tier.break_minutes
            applied_threshold = tier.threshold_minutes
            break

    paid_minutes = max(0, gross_minutes - unpaid_break)
    paid_hours = round(paid_minutes / 60.0, 2)

    gross_h = gross_minutes // 60
    gross_m = gross_minutes % 60
    time_str = f"{gross_h}h {gross_m}m" if gross_m else f"{gross_h}h"

    if unpaid_break > 0:
        thresh_h = applied_threshold // 60
        assumptions = f"Gross {time_str}; {unpaid_break}m unpaid break applied (shift >= {thresh_h}h threshold); Paid {paid_hours}h"
    else:
        assumptions = f"Gross {time_str}; 0m unpaid break (below threshold); Paid {paid_hours}h"

    return ShiftDurationResult(
        gross_minutes=gross_minutes,
        unpaid_break_minutes=unpaid_break,
        paid_minutes=paid_minutes,
        paid_hours=paid_hours,
        is_overnight=is_overnight,
        assumptions_summary=assumptions,
    )


# ---------------------------------------------------------
# Pure Domain DTOs for Isolated Solver Service
# ---------------------------------------------------------

@dataclass
class StaffAvailabilitySpec:
    weekday: int  # 0=Monday .. 6=Sunday
    is_available: bool = True
    is_recurring_day_off: bool = False
    start_time: str | None = None
    end_time: str | None = None


@dataclass
class StaffUnavailabilitySpec:
    start_date: date
    end_date: date
    reason_category: str
    start_time: str | None = None
    end_time: str | None = None


@dataclass
class StaffContractSpec:
    contracted_hours_per_week: float = 37.5
    min_hours_per_week: float | None = None
    max_hours_per_week: float | None = None
    max_shifts_per_week: int | None = None
    max_consecutive_days: int | None = None
    min_rest_hours_between_shifts: float | None = 11.0


@dataclass
class StaffSpec:
    id: str
    first_name: str
    last_name: str
    category: str = "full_time"  # "full_time", "restricted_hours"
    is_archived: bool = False
    skill_ids: set[str] = field(default_factory=set)
    contract: StaffContractSpec | None = None
    availability_rules: list[StaffAvailabilitySpec] = field(default_factory=list)
    unavailability_blocks: list[StaffUnavailabilitySpec] = field(default_factory=list)


@dataclass
class BandSpec:
    id: str
    date: date
    start_time: str
    end_time: str
    target_staff_count: int
    skill_id: str | None = None
    skill_name: str | None = None


@dataclass
class SchedulerInputSpec:
    rota_id: str
    start_date: date
    end_date: date
    bands: list[BandSpec]
    staff: list[StaffSpec]
    break_policy: BreakPolicySpec = field(default_factory=BreakPolicySpec)
    time_limit_seconds: float = 10.0
    random_seed: int = 42


@dataclass
class RelaxationSuggestion:
    id: str
    category: str  # "skill", "max_shifts", "max_hours", "availability", "workforce_capacity", "rest_period"
    is_confirmed: bool  # True if confirmed mathematical finding; False if heuristic recommendation
    title: str
    description: str
    affected_date: date | None = None
    affected_band: str | None = None
    affected_staff_id: str | None = None
    affected_staff_name: str | None = None
    potential_impact: str = "May allow filling unmet shift demand"


@dataclass
class DiagnosticItemSpec:
    type: str  # "info", "warning", "error"
    message: str
    date: date | None = None
    band: str | None = None
    staff_name: str | None = None
    is_proven: bool = False


@dataclass
class ShiftSpec:
    rota_id: str
    staff_id: str
    staff_name: str
    date: date
    start_time: str
    end_time: str
    unpaid_break_minutes: int
    paid_hours: float
    skill_id: str | None = None
    status: str = "draft"
    notes: str = "Generated automatically by OR-Tools engine"


@dataclass
class AssumptionsSpec:
    break_policy_name: str
    break_tiers_summary: str
    rest_period_hours: float
    random_seed: int
    compliance_disclaimer: str


@dataclass
class SchedulerOutputSpec:
    status: str  # "feasible", "partially_feasible", "infeasible", "timeout", "unknown"
    solve_time_seconds: float
    shifts: list[ShiftSpec]
    shifts_created_count: int
    coverage_score: float
    diagnostics: list[DiagnosticItemSpec]
    relaxation_suggestions: list[RelaxationSuggestion]
    assumptions: AssumptionsSpec
