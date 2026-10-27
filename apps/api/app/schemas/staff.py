import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------------------------------------------------------
# Skill Schemas
# ---------------------------------------------------------

class SkillResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    color: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#4F46E5", max_length=20)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Skill name cannot be empty or whitespace only.")
        return cleaned


# ---------------------------------------------------------
# Contract Schemas
# ---------------------------------------------------------

class StaffContractInput(BaseModel):
    contracted_hours_per_week: float = Field(
        ...,
        gt=0,
        le=168,
        description="Paid contracted hours per week.",
    )
    min_hours_per_week: float | None = Field(None, ge=0, le=168)
    max_hours_per_week: float | None = Field(None, ge=0, le=168)
    max_shifts_per_week: int | None = Field(None, ge=1, le=14)
    max_consecutive_days: int | None = Field(None, ge=1, le=14)
    min_rest_hours_between_shifts: float = Field(11.0, ge=0, le=48)

    @model_validator(mode="after")
    def validate_hours_range(self) -> "StaffContractInput":
        if (
            self.min_hours_per_week is not None
            and self.max_hours_per_week is not None
            and self.min_hours_per_week > self.max_hours_per_week
        ):
            raise ValueError("Minimum weekly hours cannot exceed maximum weekly hours.")
        return self


class StaffContractResponse(BaseModel):
    id: str
    staff_id: str
    contracted_hours_per_week: float
    min_hours_per_week: float | None
    max_hours_per_week: float | None
    max_shifts_per_week: int | None
    max_consecutive_days: int | None
    min_rest_hours_between_shifts: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Availability Rule Schemas
# ---------------------------------------------------------

class AvailabilityRuleInput(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Monday ... 6=Sunday")
    is_available: bool = Field(True, description="Whether available to work on this weekday.")
    start_time: str | None = Field(None, description="HH:MM start window, or None for whole day.")
    end_time: str | None = Field(None, description="HH:MM end window, or None for whole day.")
    is_recurring_day_off: bool = Field(False, description="Recurring regular day off.")

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str | None) -> str | None:
        if v is not None and not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g. '09:00').")
        return v


class AvailabilityRuleResponse(BaseModel):
    id: str
    staff_id: str
    weekday: int
    is_available: bool
    start_time: str | None
    end_time: str | None
    is_recurring_day_off: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Unavailability / Leave Block Schemas
# ---------------------------------------------------------

VALID_REASON_CATEGORIES = {"holiday", "sickness", "training", "other"}


class UnavailabilityBlockInput(BaseModel):
    reason_category: str = Field(
        ...,
        description="'holiday', 'sickness', 'training', or 'other'. Zero medical details stored.",
    )
    start_date: date
    end_date: date
    start_time: str | None = Field(None, description="Optional partial-day start time HH:MM")
    end_time: str | None = Field(None, description="Optional partial-day end time HH:MM")
    notes: str | None = Field(None, description="Operational notes only. No sensitive/medical data.")

    @field_validator("reason_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_REASON_CATEGORIES:
            raise ValueError(
                f"Invalid reason_category '{v}'. Must be one of: {', '.join(sorted(VALID_REASON_CATEGORIES))}."
            )
        return clean

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str | None) -> str | None:
        if v is not None and not TIME_REGEX.match(v):
            raise ValueError("Time must be in 24-hour HH:MM format (e.g. '09:00').")
        return v

    @model_validator(mode="after")
    def validate_dates_and_times(self) -> "UnavailabilityBlockInput":
        if self.start_date > self.end_date:
            raise ValueError("Start date cannot be after end date.")
        if (
            self.start_date == self.end_date
            and self.start_time is not None
            and self.end_time is not None
            and self.start_time >= self.end_time
        ):
            raise ValueError("Start time must be before end time for a same-day block.")
        return self


class UnavailabilityBlockResponse(BaseModel):
    id: str
    staff_id: str
    reason_category: str
    start_date: date
    end_date: date
    start_time: str | None
    end_time: str | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Staff Member Schemas
# ---------------------------------------------------------

VALID_STAFF_CATEGORIES = {"full_time", "restricted_hours"}


class StaffMemberCreateRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    display_name: str | None = Field(None, max_length=150)
    category: str = Field("full_time", description="'full_time' or 'restricted_hours'")
    notes: str | None = None
    skill_ids: list[str] = Field(default_factory=list)
    contract: StaffContractInput | None = None
    availability_rules: list[AvailabilityRuleInput] = Field(default_factory=list)
    unavailability_blocks: list[UnavailabilityBlockInput] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def validate_staff_category(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_STAFF_CATEGORIES:
            raise ValueError(
                f"Invalid staff category '{v}'. Must be one of: {', '.join(sorted(VALID_STAFF_CATEGORIES))}."
            )
        return clean

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_names(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Name cannot be empty or blank.")
        return clean


class StaffMemberUpdateRequest(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    display_name: str | None = Field(None, max_length=150)
    category: str | None = None
    notes: str | None = None
    is_archived: bool | None = None
    skill_ids: list[str] | None = None
    contract: StaffContractInput | None = None
    availability_rules: list[AvailabilityRuleInput] | None = None

    @field_validator("category")
    @classmethod
    def validate_staff_category(cls, v: str | None) -> str | None:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_STAFF_CATEGORIES:
                raise ValueError(
                    f"Invalid staff category '{v}'. Must be one of: {', '.join(sorted(VALID_STAFF_CATEGORIES))}."
                )
            return clean
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_names(cls, v: str | None) -> str | None:
        if v is not None:
            clean = v.strip()
            if not clean:
                raise ValueError("Name cannot be empty or blank.")
            return clean
        return v


class StaffMemberResponse(BaseModel):
    id: str
    workspace_id: str
    first_name: str
    last_name: str
    display_name: str | None
    category: str
    is_archived: bool
    notes: str | None
    skills: list[SkillResponse]
    contract: StaffContractResponse | None
    availability_rules: list[AvailabilityRuleResponse]
    unavailability_blocks: list[UnavailabilityBlockResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StaffMemberListResponse(BaseModel):
    items: list[StaffMemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
