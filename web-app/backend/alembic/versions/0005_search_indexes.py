"""trigram indexes for free-text/ILIKE search columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-24

"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

# migration 0001 only added a trigram index on `name` -- build_voter_query's free-text search
# and _apply_generic_filters's ILIKE filters also hit these columns, which had no index at all
TRGM_COLUMNS = ["voter_no", "father_name", "mother_name", "address"]


def upgrade() -> None:
    for col in TRGM_COLUMNS:
        op.execute(
            f"CREATE INDEX ix_voters_{col}_trgm ON voters USING gin ({col} gin_trgm_ops)"
        )


def downgrade() -> None:
    for col in TRGM_COLUMNS:
        op.execute(f"DROP INDEX ix_voters_{col}_trgm")
