"""Template editor fields: SOP, reminders, recommendation, defaults.

Revision ID: 0003_editor_fields
Revises: 0002_templates
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0003_editor_fields"
down_revision: Union[str, None] = "0002_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    bind = op.get_bind()
    return {col["name"] for col in inspect(bind).get_columns(table)}


def upgrade() -> None:
    section_cols = _columns("template_sections")
    if "standards_of_practice" not in section_cols:
        op.add_column(
            "template_sections",
            sa.Column("standards_of_practice", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    if "reminders" not in section_cols:
        op.add_column(
            "template_sections",
            sa.Column("reminders", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    item_cols = _columns("template_items")
    if "reminders" not in item_cols:
        op.add_column(
            "template_items",
            sa.Column("reminders", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    comment_cols = _columns("template_comments")
    if "recommendation" not in comment_cols:
        op.add_column(
            "template_comments",
            sa.Column("recommendation", sa.String(), nullable=True),
        )
    if "default_checked" not in comment_cols:
        op.add_column(
            "template_comments",
            sa.Column(
                "default_checked",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    if "default_text" not in comment_cols:
        op.add_column(
            "template_comments",
            sa.Column("default_text", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    # Normalize legacy category value med -> medium
    op.execute(
        sa.text(
            "UPDATE template_comments SET category = 'medium' WHERE category = 'med'"
        )
    )


def downgrade() -> None:
    comment_cols = _columns("template_comments")
    if "default_text" in comment_cols:
        op.drop_column("template_comments", "default_text")
    if "default_checked" in comment_cols:
        op.drop_column("template_comments", "default_checked")
    if "recommendation" in comment_cols:
        op.drop_column("template_comments", "recommendation")

    item_cols = _columns("template_items")
    if "reminders" in item_cols:
        op.drop_column("template_items", "reminders")

    section_cols = _columns("template_sections")
    if "reminders" in section_cols:
        op.drop_column("template_sections", "reminders")
    if "standards_of_practice" in section_cols:
        op.drop_column("template_sections", "standards_of_practice")
