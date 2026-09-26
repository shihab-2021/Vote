"""candidate-branded voter slips: candidates table, users/print_batches.candidate_id,
new candidate/candidate_agent roles + permissions

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

NEW_ROLES = [
    ("candidate", "প্রার্থী"),
    ("candidate_agent", "প্রার্থীর এজেন্ট"),
]

NEW_PERMISSIONS = [
    ("manage_candidates", "প্রার্থী ব্যবস্থাপনা"),
    ("manage_own_template", "নিজের স্লিপ ডিজাইন ব্যবস্থাপনা"),
    ("manage_own_agents", "নিজের এজেন্ট ব্যবস্থাপনা"),
]

ROLE_PERMISSIONS = {
    "candidate": ["view_voter", "search_voter", "print_voter", "generate_voter_card",
                  "manage_own_template", "manage_own_agents"],
    "candidate_agent": ["view_voter", "search_voter", "print_voter", "generate_voter_card"],
}


def upgrade() -> None:
    op.create_table(
        "candidates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("constituency_label", sa.Text, nullable=True),
        sa.Column("symbol_name", sa.Text, nullable=True),
        sa.Column("symbol_image", sa.LargeBinary, nullable=True),
        sa.Column("photo_image", sa.LargeBinary, nullable=True),
        sa.Column("slogan", sa.Text, nullable=True),
        sa.Column("primary_color", sa.String(16), nullable=True),
        sa.Column("accent_color", sa.String(16), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column("users", sa.Column("candidate_id", sa.Integer, sa.ForeignKey("candidates.id"), nullable=True))
    op.add_column("print_batches", sa.Column("candidate_id", sa.Integer, sa.ForeignKey("candidates.id"), nullable=True))
    op.create_index("ix_users_candidate_id", "users", ["candidate_id"])
    op.create_index("ix_print_batches_candidate_id", "print_batches", ["candidate_id"])

    conn = op.get_bind()

    roles_tbl = sa.table("roles", sa.column("id", sa.Integer), sa.column("key", sa.String), sa.column("label", sa.String))
    perms_tbl = sa.table("permissions", sa.column("id", sa.Integer), sa.column("key", sa.String), sa.column("label", sa.String))
    role_perms_tbl = sa.table("role_permissions", sa.column("role_id", sa.Integer), sa.column("permission_id", sa.Integer))

    role_ids = {}
    for key, label in NEW_ROLES:
        res = conn.execute(roles_tbl.insert().values(key=key, label=label).returning(roles_tbl.c.id))
        role_ids[key] = res.scalar()

    perm_ids = {}
    for key, label in NEW_PERMISSIONS:
        res = conn.execute(perms_tbl.insert().values(key=key, label=label).returning(perms_tbl.c.id))
        perm_ids[key] = res.scalar()

    existing_perm_ids = {
        row.key: row.id for row in conn.execute(sa.select(perms_tbl.c.key, perms_tbl.c.id))
    }

    role_perm_rows = [
        {"role_id": role_ids[role_key], "permission_id": existing_perm_ids.get(perm_key, perm_ids.get(perm_key))}
        for role_key, perm_keys in ROLE_PERMISSIONS.items()
        for perm_key in perm_keys
    ]
    if role_perm_rows:
        op.bulk_insert(role_perms_tbl, role_perm_rows)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE key IN ('candidate', 'candidate_agent'))"
    ))
    conn.execute(sa.text(
        "DELETE FROM permissions WHERE key IN ('manage_candidates', 'manage_own_template', 'manage_own_agents')"
    ))
    conn.execute(sa.text("DELETE FROM roles WHERE key IN ('candidate', 'candidate_agent')"))

    op.drop_index("ix_print_batches_candidate_id", table_name="print_batches")
    op.drop_index("ix_users_candidate_id", table_name="users")
    op.drop_column("print_batches", "candidate_id")
    op.drop_column("users", "candidate_id")
    op.drop_table("candidates")
