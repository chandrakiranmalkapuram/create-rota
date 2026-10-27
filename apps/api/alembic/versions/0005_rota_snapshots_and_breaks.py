"""Add rota snapshots and break policies

Revision ID: 0005_rota_snapshots_and_breaks
Revises: 0004_rota_generation
Create Date: 2026-10-27 04:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_rota_snapshots_and_breaks"
down_revision: str | None = "0004_rota_generation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add break_policy column to rotas
    op.add_column("rotas", sa.Column("break_policy", sa.JSON(), nullable=True))

    # 2. Create rota_snapshots table
    op.create_table(
        "rota_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "rota_id",
            sa.String(36),
            sa.ForeignKey("rotas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "snapshot_reason",
            sa.String(100),
            server_default="pre_generation",
            nullable=False,
        ),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("shifts_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("coverage_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("shifts_data", sa.JSON(), nullable=False),
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
    op.create_index("ix_rota_snapshots_rota_id", "rota_snapshots", ["rota_id"])
    op.create_index("ix_rota_snapshots_workspace_id", "rota_snapshots", ["workspace_id"])
    op.create_index("ix_rota_snapshots_created_at", "rota_snapshots", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_rota_snapshots_created_at", table_name="rota_snapshots")
    op.drop_index("ix_rota_snapshots_workspace_id", table_name="rota_snapshots")
    op.drop_index("ix_rota_snapshots_rota_id", table_name="rota_snapshots")
    op.drop_table("rota_snapshots")
    op.drop_column("rotas", "break_policy")
