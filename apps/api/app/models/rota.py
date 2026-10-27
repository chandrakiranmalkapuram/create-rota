import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.staff import Skill, StaffMember
    from app.models.workspace import Workspace


class Rota(Base, TimestampMixin):
    __tablename__ = "rotas"

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
        String(150),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
        index=True,
    )  # "draft", "published", "archived"

    # Relationships
    workspace: Mapped["Workspace"] = relationship(
        "Workspace",
        back_populates="rotas",
    )
    requirements: Mapped[list["StaffingRequirement"]] = relationship(
        "StaffingRequirement",
        back_populates="rota",
        cascade="all, delete-orphan",
        order_by="StaffingRequirement.date",
    )
    shifts: Mapped[list["Shift"]] = relationship(
        "Shift",
        back_populates="rota",
        cascade="all, delete-orphan",
        order_by="[Shift.date, Shift.start_time]",
    )
    generation_runs: Mapped[list["GenerationRun"]] = relationship(
        "GenerationRun",
        back_populates="rota",
        cascade="all, delete-orphan",
        order_by="desc(GenerationRun.created_at)",
    )


class StaffingRequirement(Base, TimestampMixin):
    __tablename__ = "staffing_requirements"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    rota_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rotas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # Relationships
    rota: Mapped["Rota"] = relationship(
        "Rota",
        back_populates="requirements",
    )
    bands: Mapped[list["StaffingRequirementBand"]] = relationship(
        "StaffingRequirementBand",
        back_populates="requirement",
        cascade="all, delete-orphan",
        order_by="StaffingRequirementBand.start_time",
    )

    __table_args__ = (
        UniqueConstraint("rota_id", "date", name="uq_rota_requirement_date"),
    )


class StaffingRequirementBand(Base, TimestampMixin):
    __tablename__ = "staffing_requirement_bands"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    requirement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("staffing_requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
    )  # "HH:MM" e.g. "09:00"
    end_time: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
    )  # "HH:MM" e.g. "17:00"
    target_staff_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    skill_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    requirement: Mapped["StaffingRequirement"] = relationship(
        "StaffingRequirement",
        back_populates="bands",
    )
    skill: Mapped["Skill | None"] = relationship("Skill")


class Shift(Base, TimestampMixin):
    __tablename__ = "shifts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    rota_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rotas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    staff_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("staff_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    start_time: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
    )  # "HH:MM"
    end_time: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
    )  # "HH:MM"
    unpaid_break_minutes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    skill_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skills.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
    )  # "draft", "published", "cancelled"
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    rota: Mapped["Rota"] = relationship(
        "Rota",
        back_populates="shifts",
    )
    staff_member: Mapped["StaffMember"] = relationship("StaffMember")
    skill: Mapped["Skill | None"] = relationship("Skill")


class GenerationRun(Base, TimestampMixin):
    __tablename__ = "generation_runs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    rota_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rotas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # "feasible", "partially_feasible", "infeasible", "timeout"
    solve_time_seconds: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    shifts_created: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    coverage_score: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    diagnostics: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )  # JSON-serialized list of diagnostic messages

    # Relationships
    rota: Mapped["Rota"] = relationship(
        "Rota",
        back_populates="generation_runs",
    )
