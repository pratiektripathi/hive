"""Template comment default photos.

Revision ID: 0004_comment_images
Revises: 0003_editor_fields
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0004_comment_images"
down_revision: Union[str, None] = "0003_editor_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    if "template_comment_images" in _table_names():
        return

    op.create_table(
        "template_comment_images",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_comment_id", sa.Uuid(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("import_image_url", sa.String(), nullable=True),
        sa.Column("image_caption", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["template_comment_id"],
            ["template_comments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("image_url"),
    )
    op.create_index(
        "ix_template_comment_images_template_comment_id",
        "template_comment_images",
        ["template_comment_id"],
    )
    op.create_index(
        "ix_template_comment_images_user_id",
        "template_comment_images",
        ["user_id"],
    )
    op.create_index(
        "ix_template_comment_images_image_url",
        "template_comment_images",
        ["image_url"],
        unique=True,
    )


def downgrade() -> None:
    if "template_comment_images" not in _table_names():
        return
    op.drop_index("ix_template_comment_images_image_url", table_name="template_comment_images")
    op.drop_index("ix_template_comment_images_user_id", table_name="template_comment_images")
    op.drop_index(
        "ix_template_comment_images_template_comment_id",
        table_name="template_comment_images",
    )
    op.drop_table("template_comment_images")
