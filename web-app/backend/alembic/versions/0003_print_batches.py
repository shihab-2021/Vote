"""print batches and items

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "print_batches",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("voter_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("printed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "print_batch_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("batch_id", sa.Integer, sa.ForeignKey("print_batches.id"), nullable=False),
        sa.Column("voter_id", sa.BigInteger, sa.ForeignKey("voters.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("distributed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_print_batch_items_batch_id", "print_batch_items", ["batch_id"])
    op.create_index("ix_print_batches_created_by", "print_batches", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_print_batches_created_by", table_name="print_batches")
    op.drop_index("ix_print_batch_items_batch_id", table_name="print_batch_items")
    op.drop_table("print_batch_items")
    op.drop_table("print_batches")
