from __future__ import annotations

import re
from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


class GenerationRunResponse(BaseModel):
    id: str
    rota_id: str
    status: str  # "feasible", "partially_feasible", "infeasible", "timeout"
    solve_time_seconds: float
    shifts_created: int
    coverage_score: float
    diagnostics: list[DiagnosticItem] = Field(default_factory=list)
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


class GenerateRotaRequest(BaseModel):
    time_limit_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="Maximum solver time in seconds (1.0 to 60.0)",
    )


class BulkRequirementsUpdateRequest(BaseModel):
    requirements: list[StaffingRequirementCreate]


class CopyRequirementsRequest(BaseModel):
    source_date: dt_date
    target_dates: list[dt_date]
