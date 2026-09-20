"""Template importer schema.

Revision ID: 0002_templates
Revises: 0001_baseline
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0002_templates"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    tables = _table_names()

    if "templates" not in tables:
        op.create_table(
            "templates",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("source_system", sa.String(), nullable=False),
            sa.Column("source_template_name", sa.String(), nullable=True),
            sa.Column("source_file_name", sa.String(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("import_method", sa.String(), nullable=False),
            sa.Column("parent_template_id", sa.Uuid(), nullable=True),
            sa.Column("is_seed", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["parent_template_id"], ["templates.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_templates_parent_template_id", "templates", ["parent_template_id"])
        op.create_index("ix_templates_user_id", "templates", ["user_id"])

    if "template_imports" not in tables:
        op.create_table(
            "template_imports",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("source_file_name", sa.String(), nullable=False),
            sa.Column("source_file_hash", sa.String(), nullable=False),
            sa.Column("import_method", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("total_rows", sa.Integer(), nullable=False),
            sa.Column("imported_sections", sa.Integer(), nullable=False),
            sa.Column("imported_items", sa.Integer(), nullable=False),
            sa.Column("imported_comments", sa.Integer(), nullable=False),
            sa.Column("unsupported_count", sa.Integer(), nullable=False),
            sa.Column(
                "raw_metadata",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_template_imports_template_id", "template_imports", ["template_id"])
        op.create_index("ix_template_imports_user_id", "template_imports", ["user_id"])

    if "template_sections" not in tables:
        op.create_table(
            "template_sections",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("parent_section_id", sa.Uuid(), nullable=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("icon", sa.String(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("source_ref", sa.String(), nullable=True),
            sa.Column("raw_html", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["parent_section_id"], ["template_sections.id"]),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_template_sections_parent_section_id", "template_sections", ["parent_section_id"])
        op.create_index("ix_template_sections_template_id", "template_sections", ["template_id"])
        op.create_index("ix_template_sections_user_id", "template_sections", ["user_id"])

    if "template_items" not in tables:
        op.create_table(
            "template_items",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("section_id", sa.Uuid(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("source_ref", sa.String(), nullable=True),
            sa.Column("raw_html", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["section_id"], ["template_sections.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_template_items_section_id", "template_items", ["section_id"])
        op.create_index("ix_template_items_template_id", "template_items", ["template_id"])
        op.create_index("ix_template_items_user_id", "template_items", ["user_id"])

    if "template_comments" not in tables:
        op.create_table(
            "template_comments",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("section_id", sa.Uuid(), nullable=True),
            sa.Column("item_id", sa.Uuid(), nullable=True),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("text", sa.String(), nullable=True),
            sa.Column("rich_text_html", sa.String(), nullable=True),
            sa.Column("raw_html", sa.String(), nullable=True),
            sa.Column("type", sa.String(), nullable=True),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("answer_type", sa.String(), nullable=True),
            sa.Column("default_value", sa.String(), nullable=True),
            sa.Column("default_value2", sa.String(), nullable=True),
            sa.Column("default_unit", sa.String(), nullable=True),
            sa.Column("unit_type", postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column("mchoice", postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column("default_estimation_min", sa.Float(), nullable=True),
            sa.Column("default_estimation_max", sa.Float(), nullable=True),
            sa.Column("default_location", sa.String(), nullable=True),
            sa.Column("pos", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["item_id"], ["template_items.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["section_id"], ["template_sections.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_template_comments_item_id", "template_comments", ["item_id"])
        op.create_index("ix_template_comments_section_id", "template_comments", ["section_id"])
        op.create_index("ix_template_comments_template_id", "template_comments", ["template_id"])
        op.create_index("ix_template_comments_user_id", "template_comments", ["user_id"])

    if "import_warnings" not in tables:
        op.create_table(
            "import_warnings",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("import_id", sa.Uuid(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("severity", sa.String(), nullable=False),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("source_row", sa.Integer(), nullable=True),
            sa.Column("source_column", sa.String(), nullable=True),
            sa.Column("raw_content", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["import_id"], ["template_imports.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_import_warnings_import_id", "import_warnings", ["import_id"])
        op.create_index("ix_import_warnings_template_id", "import_warnings", ["template_id"])
        op.create_index("ix_import_warnings_user_id", "import_warnings", ["user_id"])

    if "template_raw_rows" not in tables:
        op.create_table(
            "template_raw_rows",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("import_id", sa.Uuid(), nullable=False),
            sa.Column("template_id", sa.Uuid(), nullable=False),
            sa.Column("row_number", sa.Integer(), nullable=False),
            sa.Column("row_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("detected_type", sa.String(), nullable=False),
            sa.Column("mapped_entity_type", sa.String(), nullable=True),
            sa.Column("mapped_entity_id", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["import_id"], ["template_imports.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["template_id"], ["templates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_template_raw_rows_import_id", "template_raw_rows", ["import_id"])
        op.create_index("ix_template_raw_rows_template_id", "template_raw_rows", ["template_id"])
        op.create_index("ix_template_raw_rows_user_id", "template_raw_rows", ["user_id"])

    if "ai_import_runs" not in tables:
        op.create_table(
            "ai_import_runs",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("import_id", sa.Uuid(), nullable=False),
            sa.Column("model_name", sa.String(), nullable=True),
            sa.Column("prompt_version", sa.String(), nullable=True),
            sa.Column("input_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("output_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("validation_status", sa.String(), nullable=False),
            sa.Column(
                "validation_errors",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[]'::jsonb"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["import_id"], ["template_imports.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ai_import_runs_import_id", "ai_import_runs", ["import_id"])
        op.create_index("ix_ai_import_runs_user_id", "ai_import_runs", ["user_id"])


def downgrade() -> None:
    tables = _table_names()
    drop_order = [
        ("ai_import_runs", ["ix_ai_import_runs_import_id", "ix_ai_import_runs_user_id"]),
        ("template_raw_rows", ["ix_template_raw_rows_import_id", "ix_template_raw_rows_template_id", "ix_template_raw_rows_user_id"]),
        ("import_warnings", ["ix_import_warnings_import_id", "ix_import_warnings_template_id", "ix_import_warnings_user_id"]),
        (
            "template_comments",
            [
                "ix_template_comments_item_id",
                "ix_template_comments_section_id",
                "ix_template_comments_template_id",
                "ix_template_comments_user_id",
            ],
        ),
        ("template_items", ["ix_template_items_section_id", "ix_template_items_template_id", "ix_template_items_user_id"]),
        (
            "template_sections",
            [
                "ix_template_sections_parent_section_id",
                "ix_template_sections_template_id",
                "ix_template_sections_user_id",
            ],
        ),
        ("template_imports", ["ix_template_imports_template_id", "ix_template_imports_user_id"]),
        ("templates", ["ix_templates_parent_template_id", "ix_templates_user_id"]),
    ]
    for table, indexes in drop_order:
        if table not in tables:
            continue
        for index in indexes:
            op.drop_index(index, table_name=table)
        op.drop_table(table)
