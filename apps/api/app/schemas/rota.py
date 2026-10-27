from __future__ import annotations

import re
from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.scheduler import BreakPolicySpec
from app.schemas.staff import SkillResponse

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------------------------------------------------------
# Staffing Requirement Band Schemas
# ---------------------------------------------------------

class StaffingRequirementBandCreate(BaseModel):
    start_time: str = Field(..., description="Start time in HH:MM format (e.g. 09:00)")
    end_time: str = Field(..., description="End time in HH:MM format (e.g. 17:00)")
    target_staff_count: int = Field(default=1, ge=1, le=100, description="Target staff count required")
    skill_id: str | None = Field(default=None, description="Optional required skill ID")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g., '09:00' or '17:30').")
        return v

    @model_validator(mode="after")
    def validate_time_range(self) -> StaffingRequirementBandCreate:
        if self.start_time == self.end_time:
            raise ValueError("Start time and end time cannot be identical.")
        return self


class StaffingRequirementBandResponse(BaseModel):
    id: str
    requirement_id: str
    start_time: str
    end_time: str
    target_staff_count: int
    skill_id: str | None = None
    skill: SkillResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Staffing Requirement (Daily) Schemas
# ---------------------------------------------------------

class StaffingRequirementCreate(BaseModel):
    date: dt_date
    bands: list[StaffingRequirementBandCreate] = Field(default_factory=list)


class StaffingRequirementResponse(BaseModel):
    id: str
    rota_id: str
    date: dt_date
    bands: list[StaffingRequirementBandResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Shift Schemas
# ---------------------------------------------------------

class ShiftOverrideAuditResponse(BaseModel):
    id: str
    shift_id: str
    user_id: str | None = None
    warning_codes: list[str] = Field(default_factory=list)
    status: str
    overridden_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShiftResponse(BaseModel):
    id: str
    rota_id: str
    staff_id: str
    staff_name: str
    date: dt_date
    start_time: str
    end_time: str
    unpaid_break_minutes: int
    paid_hours: float
    skill_id: str | None = None
    skill_name: str | None = None
    status: str
    notes: str | None = None
    active_override: ShiftOverrideAuditResponse | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Diagnostics & Generation Run Schemas
# ---------------------------------------------------------

class DiagnosticItem(BaseModel):
    type: str = Field(default="info", description="'error', 'warning', or 'info'")
    message: str
    date: dt_date | None = None
    band: str | None = None
    staff_name: str | None = None
    is_proven: bool = False


class RelaxationSuggestionResponse(BaseModel):
    id: str
    category: str
    is_confirmed: bool
    title: str
    description: str
    affected_date: dt_date | None = None
    affected_band: str | None = None
    affected_staff_id: str | None = None
    affected_staff_name: str | None = None
    potential_impact: str


class AssumptionsResponse(BaseModel):
    break_policy_name: str
    break_tiers_summary: str
    rest_period_hours: float
    random_seed: int
    compliance_disclaimer: str


class GenerationRunResponse(BaseModel):
    id: str
    rota_id: str
    status: str  # "feasible", "partially_feasible", "infeasible", "timeout"
    solve_time_seconds: float
    shifts_created: int
    coverage_score: float
    diagnostics: list[DiagnosticItem] = Field(default_factory=list)
    relaxation_suggestions: list[RelaxationSuggestionResponse] = Field(default_factory=list)
    assumptions: AssumptionsResponse | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Rota Request / Response Schemas
# ---------------------------------------------------------

class RotaCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    start_date: dt_date
    end_date: dt_date
    default_band_start: str | None = Field(default="09:00", description="Default band start time")
    default_band_end: str | None = Field(default="17:00", description="Default band end time")
    default_staff_count: int | None = Field(default=2, ge=1, le=50, description="Default staffing per day")

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Rota name cannot be empty.")
        return cleaned

    @model_validator(mode="after")
    def validate_dates(self) -> RotaCreateRequest:
        if self.start_date > self.end_date:
            raise ValueError("Start date must be before or equal to end date.")
        delta = (self.end_date - self.start_date).days
        if delta > 31:
            raise ValueError("Rota period cannot exceed 31 days (4 weeks) per generation batch.")
        return self


class RotaUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    status: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Rota name cannot be empty.")
            return cleaned
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ("draft", "published", "archived"):
            raise ValueError("Status must be 'draft', 'published', or 'archived'.")
        return v


class RotaResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    start_date: dt_date
    end_date: dt_date
    status: str
    total_shifts: int = 0
    total_paid_hours: float = 0.0
    latest_generation_status: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RotaDetailResponse(RotaResponse):
    requirements: list[StaffingRequirementResponse] = Field(default_factory=list)
    shifts: list[ShiftResponse] = Field(default_factory=list)
    latest_run: GenerationRunResponse | None = None
    snapshots_count: int = 0


class GenerateRotaRequest(BaseModel):
    time_limit_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="Maximum solver time in seconds (1.0 to 60.0)",
    )
    random_seed: int = Field(
        default=42,
        ge=0,
        description="Configurable seed for deterministic, repeatable schedule generation",
    )
    break_policy: BreakPolicySpec | None = Field(
        default=None,
        description="Optional configurable break policy override",
    )


class BulkRequirementsUpdateRequest(BaseModel):
    requirements: list[StaffingRequirementCreate]


class CopyRequirementsRequest(BaseModel):
    source_date: dt_date
    target_dates: list[dt_date]


# ---------------------------------------------------------
# Snapshot & Restoration Schemas
# ---------------------------------------------------------

class RotaSnapshotResponse(BaseModel):
    id: str
    rota_id: str
    workspace_id: str
    created_by_id: str | None = None
    snapshot_reason: str
    description: str | None = None
    shifts_count: int
    coverage_score: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RestoreSnapshotResponse(BaseModel):
    message: str
    restored_shifts_count: int
    safety_snapshot_id: str | None = None
    rota: RotaDetailResponse


# ---------------------------------------------------------
# Manual Shift Management & Validation Schemas (Milestone 6)
# ---------------------------------------------------------

class ShiftCreate(BaseModel):
    staff_id: str = Field(..., description="Staff member ID assigned to this shift")
    date: dt_date = Field(..., description="Date of the shift")
    start_time: str = Field(..., description="Start time in HH:MM format")
    end_time: str = Field(..., description="End time in HH:MM format")
    skill_id: str | None = Field(default=None, description="Optional required skill ID")
    unpaid_break_minutes: int | None = Field(default=None, ge=0, le=360, description="Optional override for unpaid break minutes")
    notes: str | None = Field(default=None, max_length=500, description="Optional manager notes")
    override_warnings: bool = Field(default=False, description="Set to true if manager explicitly acknowledges and overrides non-blocking warnings")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g., '09:00' or '17:30').")
        return v


class ShiftUpdate(BaseModel):
    staff_id: str | None = Field(default=None, description="Reassign to another staff member ID")
    date: dt_date | None = Field(default=None, description="Move shift to a different date")
    start_time: str | None = Field(default=None, description="Updated start time (HH:MM)")
    end_time: str | None = Field(default=None, description="Updated end time (HH:MM)")
    skill_id: str | None = Field(default=None, description="Updated skill ID (or null to remove)")
    unpaid_break_minutes: int | None = Field(default=None, ge=0, le=360, description="Override unpaid break minutes")
    notes: str | None = Field(default=None, max_length=500, description="Updated notes")
    override_warnings: bool = Field(default=False, description="Acknowledge and override non-blocking warnings")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str | None) -> str | None:
        if v is not None and not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g., '09:00' or '17:30').")
        return v


class ShiftCopyRequest(BaseModel):
    target_date: dt_date = Field(..., description="Date to copy shift to")
    target_staff_id: str | None = Field(default=None, description="Optional staff ID to assign copy to (defaults to same staff)")
    override_warnings: bool = Field(default=False, description="Acknowledge and override non-blocking warnings")


class ShiftValidationFinding(BaseModel):
    code: str = Field(..., description="Stable error/warning code (e.g. ARCHIVED_STAFF, OVERLAPPING_SHIFT)")
    severity: str = Field(..., description="'blocking' (cannot save) or 'warning' (manager can override)")
    message: str = Field(..., description="Human-readable explanation")
    date: str | None = Field(default=None, description="Relevant date reference")
    shift_id: str | None = Field(default=None, description="Relevant conflicting shift ID if applicable")


class CoverageSummaryItem(BaseModel):
    date: dt_date
    target_staff_count: int
    scheduled_staff_count: int
    is_understaffed: bool
    is_overstaffed: bool


class ShiftValidationRequest(BaseModel):
    shift_id: str | None = Field(default=None, description="Existing shift ID if editing (excluded from self-conflict checks)")
    staff_id: str = Field(..., description="Staff member ID")
    date: dt_date = Field(..., description="Shift date")
    start_time: str = Field(..., description="Start time (HH:MM)")
    end_time: str = Field(..., description="End time (HH:MM)")
    skill_id: str | None = Field(default=None, description="Optional skill ID")
    unpaid_break_minutes: int | None = Field(default=None, description="Optional break override")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g., '09:00' or '17:30').")
        return v


class ShiftValidationResponse(BaseModel):
    is_valid: bool = Field(..., description="True if no blocking errors exist")
    has_warnings: bool = Field(..., description="True if one or more warnings exist")
    can_override: bool = Field(..., description="True if save can proceed with manager override")
    findings: list[ShiftValidationFinding] = Field(default_factory=list)
    gross_hours: float
    unpaid_break_minutes: int
    paid_hours: float
    assumptions_summary: str
    daily_coverage: CoverageSummaryItem | None = None
    adjacent_rest_checks: dict[str, str] = Field(
        default_factory=dict,
        description="Verification status of adjacent rota weeks (e.g. 'previous_week': 'verified' | 'unavailable')",
    )


class ShiftMutationResponse(BaseModel):
    shift: ShiftResponse
    warnings: list[ShiftValidationFinding] = Field(default_factory=list)
    message: str
    rota: RotaDetailResponse

