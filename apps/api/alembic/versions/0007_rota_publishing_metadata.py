"""Add rota publishing and archive metadata

Revision ID: 0007_rota_publishing_metadata
Revises: 0006_shift_override_audits
Create Date: 2026-10-27 20:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_rota_publishing_metadata"
down_revision: str | None = "0006_shift_override_audits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("rotas") as batch_op:
        batch_op.add_column(sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column(
                "published_by_user_id",
                sa.String(36),
                sa.ForeignKey(
                    "users.id",
                    name="fk_rotas_published_by_user_id_users",
                    ondelete="SET NULL",
                ),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index("ix_rotas_published_at", ["published_at"])
        batch_op.create_index("ix_rotas_archived_at", ["archived_at"])


def downgrade() -> None:
    with op.batch_alter_table("rotas") as batch_op:
        batch_op.drop_index("ix_rotas_archived_at")
        batch_op.drop_index("ix_rotas_published_at")
        batch_op.drop_column("archived_at")
        batch_op.drop_column("published_by_user_id")
        batch_op.drop_column("published_at")
