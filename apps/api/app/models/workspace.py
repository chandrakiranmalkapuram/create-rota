import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.rota import Rota
    from app.models.staff import Skill, StaffMember
    from app.models.user import User


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="Europe/London",
        nullable=False,
    )

    # Relationships
    memberships: Mapped[list["WorkspaceMembership"]] = relationship(
        "WorkspaceMembership",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    staff_members: Mapped[list["StaffMember"]] = relationship(
        "StaffMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    rotas: Mapped[list["Rota"]] = relationship(
        "Rota",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class WorkspaceMembership(Base, TimestampMixin):
    __tablename__ = "workspace_memberships"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="owner",
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="memberships")
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", name="uq_user_workspace"),
    )
