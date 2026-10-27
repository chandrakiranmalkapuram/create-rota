"""Create rota generation tables

Revision ID: 0004_rota_generation
Revises: 0003_staff_management
Create Date: 2026-10-27 03:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_rota_generation"
down_revision: str | None = "0003_staff_management"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. rotas
    op.create_table(
        "rotas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(50), server_default="draft", nullable=False),
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
    op.create_index("ix_rotas_workspace_id", "rotas", ["workspace_id"])
    op.create_index("ix_rotas_start_date", "rotas", ["start_date"])
    op.create_index("ix_rotas_end_date", "rotas", ["end_date"])
    op.create_index("ix_rotas_status", "rotas", ["status"])

    # 2. staffing_requirements
    op.create_table(
        "staffing_requirements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rota_id",
            sa.String(36),
            sa.ForeignKey("rotas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
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
        sa.UniqueConstraint("rota_id", "date", name="uq_rota_requirement_date"),
    )
    op.create_index("ix_staffing_requirements_rota_id", "staffing_requirements", ["rota_id"])
    op.create_index("ix_staffing_requirements_date", "staffing_requirements", ["date"])

    # 3. staffing_requirement_bands
    op.create_table(
        "staffing_requirement_bands",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "requirement_id",
            sa.String(36),
            sa.ForeignKey("staffing_requirements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("target_staff_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "skill_id",
            sa.String(36),
            sa.ForeignKey("skills.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    op.create_index(
        "ix_staffing_requirement_bands_requirement_id",
        "staffing_requirement_bands",
        ["requirement_id"],
    )
    op.create_index(
        "ix_staffing_requirement_bands_skill_id",
        "staffing_requirement_bands",
        ["skill_id"],
    )

    # 4. shifts
    op.create_table(
        "shifts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rota_id",
            sa.String(36),
            sa.ForeignKey("rotas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "staff_id",
            sa.String(36),
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("unpaid_break_minutes", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "skill_id",
            sa.String(36),
            sa.ForeignKey("skills.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(50), server_default="draft", nullable=False),
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
    op.create_index("ix_shifts_rota_id", "shifts", ["rota_id"])
    op.create_index("ix_shifts_staff_id", "shifts", ["staff_id"])
    op.create_index("ix_shifts_date", "shifts", ["date"])
    op.create_index("ix_shifts_skill_id", "shifts", ["skill_id"])

    # 5. generation_runs
    op.create_table(
        "generation_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rota_id",
            sa.String(36),
            sa.ForeignKey("rotas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("solve_time_seconds", sa.Float(), nullable=False),
        sa.Column("shifts_created", sa.Integer(), server_default="0", nullable=False),
        sa.Column("coverage_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("diagnostics", sa.Text(), nullable=True),
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
    op.create_index("ix_generation_runs_rota_id", "generation_runs", ["rota_id"])


def downgrade() -> None:
    op.drop_table("generation_runs")
    op.drop_table("shifts")
    op.drop_table("staffing_requirement_bands")
    op.drop_table("staffing_requirements")
    op.drop_table("rotas")
