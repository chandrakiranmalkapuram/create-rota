"""Add shift override audits table

Revision ID: 0006_shift_override_audits
Revises: 0005_rota_snapshots_and_breaks
Create Date: 2026-10-27 19:35:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_shift_override_audits"
down_revision: str | None = "0005_rota_snapshots_and_breaks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shift_override_audits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "shift_id",
            sa.String(36),
            sa.ForeignKey("shifts.id", ondelete="CASCADE"),
            nullable=False,
        ),
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
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(50),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "warning_codes",
            sa.JSON(),
            nullable=False,
        ),
        sa.Column(
            "overridden_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
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
    op.create_index("ix_shift_override_audits_shift_id", "shift_override_audits", ["shift_id"])
    op.create_index("ix_shift_override_audits_rota_id", "shift_override_audits", ["rota_id"])
    op.create_index("ix_shift_override_audits_workspace_id", "shift_override_audits", ["workspace_id"])
    op.create_index("ix_shift_override_audits_user_id", "shift_override_audits", ["user_id"])
    op.create_index("ix_shift_override_audits_status", "shift_override_audits", ["status"])


def downgrade() -> None:
    op.drop_index("ix_shift_override_audits_status", table_name="shift_override_audits")
    op.drop_index("ix_shift_override_audits_user_id", table_name="shift_override_audits")
    op.drop_index("ix_shift_override_audits_workspace_id", table_name="shift_override_audits")
    op.drop_index("ix_shift_override_audits_rota_id", table_name="shift_override_audits")
    op.drop_index("ix_shift_override_audits_shift_id", table_name="shift_override_audits")
    op.drop_table("shift_override_audits")
