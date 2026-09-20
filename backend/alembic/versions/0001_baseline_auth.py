"""Baseline user and apikey tables.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def _index_names(table: str) -> set[str]:
    return {index["name"] for index in inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    theme_enum = sa.Enum("light", "dark", name="themeenum")
    theme_enum.create(bind, checkfirst=True)

    tables = _table_names()
    if "user" not in tables:
        op.create_table(
            "user",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("firstname", sa.String(), nullable=False),
            sa.Column("lastname", sa.String(), nullable=False),
            sa.Column("username", sa.String(), nullable=False),
            sa.Column("password", sa.String(), nullable=False),
            sa.Column("phone", sa.String(), nullable=True),
            sa.Column(
                "theme",
                sa.Enum("light", "dark", name="themeenum", create_type=False),
                nullable=False,
            ),
            sa.Column("isEnable", sa.Boolean(), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["user.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_user_username", "user", ["username"], unique=True)
    else:
        op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS role')
        op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS department')
        op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS super_user')
        if "ix_user_username" not in _index_names("user"):
            op.create_index("ix_user_username", "user", ["username"], unique=True)

    tables = _table_names()
    if "apikey" not in tables:
        op.create_table(
            "apikey",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_apikey_key", "apikey", ["key"], unique=True)
        op.create_index("ix_apikey_user_id", "apikey", ["user_id"])
    else:
        if "ix_apikey_key" not in _index_names("apikey"):
            op.create_index("ix_apikey_key", "apikey", ["key"], unique=True)
        if "ix_apikey_user_id" not in _index_names("apikey"):
            op.create_index("ix_apikey_user_id", "apikey", ["user_id"])


def downgrade() -> None:
    tables = _table_names()
    if "apikey" in tables:
        if "ix_apikey_key" in _index_names("apikey"):
            op.drop_index("ix_apikey_key", table_name="apikey")
        if "ix_apikey_user_id" in _index_names("apikey"):
            op.drop_index("ix_apikey_user_id", table_name="apikey")
        op.drop_table("apikey")
    if "user" in tables:
        if "ix_user_username" in _index_names("user"):
            op.drop_index("ix_user_username", table_name="user")
        op.drop_table("user")
    sa.Enum(name="themeenum").drop(op.get_bind(), checkfirst=True)
