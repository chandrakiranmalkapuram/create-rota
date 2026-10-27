import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.workspace import Workspace

# Association table between staff members and skills
staff_skills = Table(
    "staff_skills",
    Base.metadata,
    Column(
        "staff_id",
        String(36),
        ForeignKey("staff_members.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "skill_id",
        String(36),
        ForeignKey("skills.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    color: Mapped[str] = mapped_column(
        String(20),
        default="#4F46E5",
        nullable=False,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="skills")
    staff_members: Mapped[list["StaffMember"]] = relationship(
        "StaffMember",
        secondary=staff_skills,
        back_populates="skills",
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_workspace_skill_name"),
    )


class StaffMember(Base, TimestampMixin):
    __tablename__ = "staff_members"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    display_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        default="full_time",
        nullable=False,
    )  # "restricted_hours" or "full_time"
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="staff_members")
    contract: Mapped["StaffContract | None"] = relationship(
        "StaffContract",
        back_populates="staff_member",
        uselist=False,
        cascade="all, delete-orphan",
    )
    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        secondary=staff_skills,
        back_populates="staff_members",
    )
    availability_rules: Mapped[list["AvailabilityRule"]] = relationship(
        "AvailabilityRule",
        back_populates="staff_member",
        cascade="all, delete-orphan",
    )
    unavailability_blocks: Mapped[list["UnavailabilityBlock"]] = relationship(
        "UnavailabilityBlock",
        back_populates="staff_member",
        cascade="all, delete-orphan",
    )


class StaffContract(Base, TimestampMixin):
    __tablename__ = "staff_contracts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    staff_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("staff_members.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    contracted_hours_per_week: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=37.5,
    )
    min_hours_per_week: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    max_hours_per_week: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    max_shifts_per_week: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    max_consecutive_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    min_rest_hours_between_shifts: Mapped[float] = mapped_column(
        Float,
        default=11.0,
        nullable=False,
    )

    # Relationships
    staff_member: Mapped["StaffMember"] = relationship(
        "StaffMember",
        back_populates="contract",
    )


class AvailabilityRule(Base, TimestampMixin):
    __tablename__ = "availability_rules"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    staff_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("staff_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    weekday: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )  # 0=Monday, 1=Tuesday, ..., 6=Sunday
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    start_time: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True,
    )  # "HH:MM" e.g. "09:00"
    end_time: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True,
    )  # "HH:MM" e.g. "17:00"
    is_recurring_day_off: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    staff_member: Mapped["StaffMember"] = relationship(
        "StaffMember",
        back_populates="availability_rules",
    )


class UnavailabilityBlock(Base, TimestampMixin):
    """
    Consistent model for one-off unavailability, approved holidays,
    and sickness-related unavailable dates.
    Zero medical details or sensitive personal information are recorded.
    """
    __tablename__ = "unavailability_blocks"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    staff_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("staff_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason_category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # "holiday", "sickness", "training", "other"
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    start_time: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True,
    )  # Optional partial day "HH:MM"
    end_time: Mapped[str | None] = mapped_column(
        String(5),
        nullable=True,
    )  # Optional partial day "HH:MM"
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    staff_member: Mapped["StaffMember"] = relationship(
        "StaffMember",
        back_populates="unavailability_blocks",
    )
