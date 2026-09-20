from pydantic import ConfigDict
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, DateTime, String, Text, text as sa_text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from typing import Any, Optional
from datetime import datetime, timezone
from uuid import UUID, uuid4
from enums import (
    AnswerTypeEnum,
    CommentCategoryEnum,
    CommentTypeEnum,
    DetectedTypeEnum,
    ImportMethodEnum,
    ImportStatusEnum,
    RecommendationEnum,
    ThemeEnum,
    ValidationStatusEnum,
    WarningSeverityEnum,
)


class ApiKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    key: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    user: Optional["User"] = Relationship(back_populates=None)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    firstname: str
    lastname: str
    username: str = Field(unique=True, index=True)
    password: str
    phone: Optional[str] = None
    theme: ThemeEnum = Field(default=ThemeEnum.light)
    isEnable: bool = Field(default=True)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )


class DisplayUser(SQLModel):
    id: Optional[int]
    firstname: str
    lastname: str
    username: str
    theme: ThemeEnum
    isEnable: bool
    created_by: Optional[int]
    created_at: datetime


class CreateUser(SQLModel):
    firstname: str
    lastname: str
    username: str
    password: str = Field(min_length=8)


class ShowUser(SQLModel):
    id: int
    firstname: str
    lastname: str
    username: str
    theme: ThemeEnum


class ThemeUpdate(SQLModel):
    theme: str


class Token(SQLModel):
    access_token: str
    token_type: str


class TokenData(SQLModel):
    username: str


class UserOwned(SQLModel):
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)


class Template(UserOwned, table=True):
    __tablename__ = "templates"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str # template name
    source_system: str = Field(default="")
    source_template_name: Optional[str] = None
    source_file_name: Optional[str] = None
    description: Optional[str] = None
    import_method: ImportMethodEnum = Field(sa_type=String)
    parent_template_id: Optional[UUID] = Field(default=None, foreign_key="templates.id", index=True)
    is_seed: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateImport(UserOwned, table=True):
    __tablename__ = "template_imports"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    source_file_name: str
    source_file_hash: str
    import_method: ImportMethodEnum = Field(sa_type=String)
    status: ImportStatusEnum = Field(sa_type=String)
    total_rows: int = Field(default=0)
    imported_sections: int = Field(default=0)
    imported_items: int = Field(default=0)
    imported_comments: int = Field(default=0)
    unsupported_count: int = Field(default=0)
    raw_metadata: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default=sa_text("'{}'::jsonb")),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateSection(UserOwned, table=True):
    __tablename__ = "template_sections"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    parent_section_id: Optional[UUID] = Field(default=None, foreign_key="template_sections.id", index=True)
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int
    source_ref: Optional[str] = None
    raw_html: Optional[str] = None
    standards_of_practice: Optional[list[Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    reminders: Optional[list[Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateItem(UserOwned, table=True):
    __tablename__ = "template_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    section_id: UUID = Field(foreign_key="template_sections.id", ondelete="CASCADE", index=True)
    title: str
    description: Optional[str] = None
    sort_order: int
    source_ref: Optional[str] = None
    raw_html: Optional[str] = None
    reminders: Optional[list[Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateComment(UserOwned, table=True):
    __tablename__ = "template_comments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    section_id: Optional[UUID] = Field(default=None, foreign_key="template_sections.id", ondelete="CASCADE", index=True)
    item_id: Optional[UUID] = Field(default=None, foreign_key="template_items.id", ondelete="CASCADE", index=True)
    name: Optional[str] = None
    text: Optional[str] = None
    rich_text_html: Optional[str] = None
    raw_html: Optional[str] = None
    type: Optional[CommentTypeEnum] = Field(default=None, sa_type=String)
    category: Optional[CommentCategoryEnum] = Field(default=None, sa_type=String)
    answer_type: Optional[AnswerTypeEnum] = Field(default=None, sa_type=String)
    recommendation: Optional[RecommendationEnum] = Field(default=None, sa_type=String)
    default_checked: bool = Field(default=False)
    default_text: Optional[list[Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    default_value: Optional[str] = None
    default_value2: Optional[str] = None
    default_unit: Optional[str] = None
    unit_type: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text), nullable=True))
    mchoice: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text), nullable=True))
    default_estimation_min: Optional[float] = None
    default_estimation_max: Optional[float] = None
    default_location: Optional[str] = None
    pos: int
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateCommentImage(UserOwned, table=True):
    __tablename__ = "template_comment_images"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    template_comment_id: UUID = Field(
        foreign_key="template_comments.id",
        ondelete="CASCADE",
        index=True,
    )
    image_url: str = Field(unique=True, index=True)
    import_image_url: Optional[str] = None
    image_caption: Optional[str] = None
    sort_order: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class ImportWarning(UserOwned, table=True):
    __tablename__ = "import_warnings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    import_id: UUID = Field(foreign_key="template_imports.id", ondelete="CASCADE", index=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    severity: WarningSeverityEnum = Field(sa_type=String)
    code: str
    message: str
    source_row: Optional[int] = None
    source_column: Optional[str] = None
    raw_content: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class TemplateRawRow(UserOwned, table=True):
    __tablename__ = "template_raw_rows"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    import_id: UUID = Field(foreign_key="template_imports.id", ondelete="CASCADE", index=True)
    template_id: UUID = Field(foreign_key="templates.id", ondelete="CASCADE", index=True)
    row_number: int
    row_data: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    detected_type: DetectedTypeEnum = Field(sa_type=String)
    mapped_entity_type: Optional[str] = None
    mapped_entity_id: Optional[UUID] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )


class AiImportRun(UserOwned, table=True):
    __tablename__ = "ai_import_runs"
    model_config = ConfigDict(protected_namespaces=())

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    import_id: UUID = Field(foreign_key="template_imports.id", ondelete="CASCADE", index=True)
    model_name: Optional[str] = None
    prompt_version: Optional[str] = None
    input_summary: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    output_json: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    validation_status: ValidationStatusEnum = Field(sa_type=String)
    validation_errors: list[Any] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default=sa_text("'[]'::jsonb")),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=sa_text("now()")),
    )
