"""roles, permissions, area scopes

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

ROLES = [
    ("super_admin", "সুপার অ্যাডমিন"),
    ("area_admin", "এলাকা অ্যাডমিন"),
    ("operations", "অপারেশনস"),
    ("print_distribution", "প্রিন্ট ও বিতরণ"),
    ("field_search", "ফিল্ড সার্চ"),
]

PERMISSIONS = [
    ("view_voter", "ভোটার দেখা"),
    ("search_voter", "ভোটার খোঁজা"),
    ("export_voter", "ভোটার এক্সপোর্ট"),
    ("print_voter", "ভোটার প্রিন্ট"),
    ("generate_voter_card", "ভোটার কার্ড তৈরি"),
    ("manage_users", "ব্যবহারকারী ব্যবস্থাপনা"),
    ("manage_roles", "রোল ব্যবস্থাপনা"),
    ("manage_data", "ডেটা ব্যবস্থাপনা"),
    ("view_reports", "রিপোর্ট দেখা"),
    ("view_audit_logs", "অডিট লগ দেখা"),
]

# রোল -> এই permission key-গুলো পাবে (super_admin কোডে implicit সব পায়, তবে সম্পূর্ণতার জন্য
# এখানেও সব দেওয়া হলো যাতে ডেটাবেজ নিজেই সত্যের উৎস হিসেবে সামঞ্জস্যপূর্ণ থাকে)
ROLE_PERMISSIONS = {
    "super_admin": [k for k, _ in PERMISSIONS],
    "area_admin": ["view_voter", "search_voter", "export_voter", "print_voter",
                   "generate_voter_card", "manage_data", "view_reports"],
    "operations": ["view_voter", "search_voter", "export_voter", "manage_data", "view_reports"],
    "print_distribution": ["view_voter", "search_voter", "print_voter", "generate_voter_card"],
    "field_search": ["view_voter", "search_voter"],
}

# পুরনো ফ্রি-টেক্সট role স্ট্রিং -> নতুন role key
OLD_ROLE_MAP = {"admin": "super_admin"}
DEFAULT_NEW_ROLE = "operations"


def upgrade() -> None:
    roles_tbl = op.create_table(
        "roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(32), nullable=False, unique=True),
        sa.Column("label", sa.String(64), nullable=False),
    )
    perms_tbl = op.create_table(
        "permissions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(32), nullable=False, unique=True),
        sa.Column("label", sa.String(64), nullable=False),
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id"), primary_key=True),
    )
    op.create_table(
        "user_area_scopes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("scope_field", sa.String(32), nullable=False),
        sa.Column("scope_value", sa.Text, nullable=False),
    )
    op.create_index("ix_user_area_scopes_user_id", "user_area_scopes", ["user_id"])

    conn = op.get_bind()

    role_ids = {}
    for key, label in ROLES:
        res = conn.execute(roles_tbl.insert().values(key=key, label=label).returning(roles_tbl.c.id))
        role_ids[key] = res.scalar()

    perm_ids = {}
    for key, label in PERMISSIONS:
        res = conn.execute(perms_tbl.insert().values(key=key, label=label).returning(perms_tbl.c.id))
        perm_ids[key] = res.scalar()

    role_perm_rows = [
        {"role_id": role_ids[role_key], "permission_id": perm_ids[perm_key]}
        for role_key, perm_keys in ROLE_PERMISSIONS.items()
        for perm_key in perm_keys
    ]
    if role_perm_rows:
        op.bulk_insert(
            sa.table(
                "role_permissions",
                sa.column("role_id", sa.Integer),
                sa.column("permission_id", sa.Integer),
            ),
            role_perm_rows,
        )

    # users.role (ফ্রি-টেক্সট) -> users.role_id (FK) মাইগ্রেট
    op.add_column("users", sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id"), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()))

    for old_key, new_key in OLD_ROLE_MAP.items():
        conn.execute(sa.text(
            "UPDATE users SET role_id = :rid WHERE role = :old_key"
        ), {"rid": role_ids[new_key], "old_key": old_key})
    conn.execute(sa.text(
        "UPDATE users SET role_id = :rid WHERE role_id IS NULL"
    ), {"rid": role_ids[DEFAULT_NEW_ROLE]})

    op.alter_column("users", "role_id", nullable=False)
    op.drop_column("users", "role")


def downgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(16), nullable=False, server_default="editor"))
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE users SET role = CASE
            WHEN role_id = (SELECT id FROM roles WHERE key = 'super_admin') THEN 'admin'
            ELSE 'editor'
        END
    """))
    op.drop_column("users", "is_active")
    op.drop_column("users", "role_id")
    op.drop_index("ix_user_area_scopes_user_id", table_name="user_area_scopes")
    op.drop_table("user_area_scopes")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
