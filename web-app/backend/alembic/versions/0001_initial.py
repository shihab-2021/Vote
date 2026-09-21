"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="editor"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("filename", sa.Text, nullable=False),
        sa.Column("imported_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("row_count", sa.Integer, server_default="0"),
        sa.Column("inserted_count", sa.Integer, server_default="0"),
        sa.Column("updated_count", sa.Integer, server_default="0"),
        sa.Column("error_count", sa.Integer, server_default="0"),
        sa.Column("status", sa.String(16), server_default="processing"),
    )

    op.create_table(
        "custom_field_defs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(64), nullable=False, unique=True),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("field_type", sa.String(16), server_default="text"),
        sa.Column("options", postgresql.JSONB, nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "voters",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("serial_no", sa.Text),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("voter_no", sa.Text),
        sa.Column("father_name", sa.Text),
        sa.Column("mother_name", sa.Text),
        sa.Column("occupation", sa.Text),
        sa.Column("dob", sa.Text),
        sa.Column("gender", sa.Text),
        sa.Column("district", sa.Text),
        sa.Column("municipality", sa.Text),
        sa.Column("upazila", sa.Text),
        sa.Column("union_name", sa.Text),
        sa.Column("ward", sa.Text),
        sa.Column("area_no", sa.Text),
        sa.Column("area_name", sa.Text),
        sa.Column("address", sa.Text),
        sa.Column("upazila_folder", sa.Text),
        sa.Column("union_folder", sa.Text),
        sa.Column("area_folder", sa.Text),
        sa.Column("source_file", sa.Text),
        sa.Column("flag_reasons", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("is_flagged", sa.Boolean,
                  sa.Computed("cardinality(flag_reasons) > 0", persisted=True), nullable=False),
        sa.Column("extra_fields", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("import_batch_id", sa.Integer, sa.ForeignKey("import_batches.id"), nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ux_voters_voter_no", "voters", ["voter_no"], unique=True,
        postgresql_where=sa.text("voter_no IS NOT NULL AND voter_no <> '' AND deleted_at IS NULL"),
    )
    op.execute("CREATE INDEX ix_voters_name_trgm ON voters USING gin (name gin_trgm_ops)")
    op.create_index("ix_voters_ward", "voters", ["ward"], postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("ix_voters_upazila", "voters", ["upazila"], postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("ix_voters_flagged", "voters", ["is_flagged"], postgresql_where=sa.text("deleted_at IS NULL"))
    op.execute("CREATE INDEX ix_voters_extra_gin ON voters USING gin (extra_fields)")

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("voter_id", sa.BigInteger, sa.ForeignKey("voters.id"), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("field", sa.Text),
        sa.Column("old_value", sa.Text),
        sa.Column("new_value", sa.Text),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_index("ix_voters_extra_gin", table_name="voters")
    op.drop_index("ix_voters_flagged", table_name="voters")
    op.drop_index("ix_voters_upazila", table_name="voters")
    op.drop_index("ix_voters_ward", table_name="voters")
    op.drop_index("ix_voters_name_trgm", table_name="voters")
    op.drop_index("ux_voters_voter_no", table_name="voters")
    op.drop_table("voters")
    op.drop_table("custom_field_defs")
    op.drop_table("import_batches")
    op.drop_table("users")
