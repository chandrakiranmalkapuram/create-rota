"""Create staff management tables

Revision ID: 0003_staff_management
Revises: 0002_auth_and_workspaces
Create Date: 2026-10-27 02:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_staff_management"
down_revision: str | None = "0002_auth_and_workspaces"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. skills
    op.create_table(
        "skills",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="#4F46E5"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("workspace_id", "name", name="uq_workspace_skill_name"),
    )
    op.create_index("ix_skills_workspace_id", "skills", ["workspace_id"])

    # 2. staff_members
    op.create_table(
        "staff_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(150), nullable=True),
        sa.Column("category", sa.String(50), nullable=False, server_default="full_time"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_staff_members_workspace_id", "staff_members", ["workspace_id"])
    op.create_index("ix_staff_members_is_archived", "staff_members", ["is_archived"])

    # 3. staff_skills
    op.create_table(
        "staff_skills",
        sa.Column(
            "staff_id",
            sa.String(36),
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "skill_id",
            sa.String(36),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # 4. staff_contracts
    op.create_table(
        "staff_contracts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "staff_id",
            sa.String(36),
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("contracted_hours_per_week", sa.Float(), nullable=False, server_default="37.5"),
        sa.Column("min_hours_per_week", sa.Float(), nullable=True),
        sa.Column("max_hours_per_week", sa.Float(), nullable=True),
        sa.Column("max_shifts_per_week", sa.Integer(), nullable=True),
        sa.Column("max_consecutive_days", sa.Integer(), nullable=True),
        sa.Column("min_rest_hours_between_shifts", sa.Float(), nullable=False, server_default="11.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_staff_contracts_staff_id", "staff_contracts", ["staff_id"], unique=True)

    # 5. availability_rules
    op.create_table(
        "availability_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "staff_id",
            sa.String(36),
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("start_time", sa.String(5), nullable=True),
        sa.Column("end_time", sa.String(5), nullable=True),
        sa.Column("is_recurring_day_off", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_availability_rules_staff_id", "availability_rules", ["staff_id"])

    # 6. unavailability_blocks
    op.create_table(
        "unavailability_blocks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "staff_id",
            sa.String(36),
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason_category", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(5), nullable=True),
        sa.Column("end_time", sa.String(5), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_unavailability_blocks_staff_id", "unavailability_blocks", ["staff_id"])


def downgrade() -> None:
    op.drop_table("unavailability_blocks")
    op.drop_table("availability_rules")
    op.drop_table("staff_contracts")
    op.drop_table("staff_skills")
    op.drop_table("staff_members")
    op.drop_table("skills")
