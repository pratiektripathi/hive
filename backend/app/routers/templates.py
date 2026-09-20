from typing import Annotated, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel, Field

from database import get_session
from image_storage import save_upload
from imports.ai_comment import assist_comment
from imports.export import export_template
from model import ShowUser
from routers.user import show_user_me
from repo import templates as templates_repo

try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession


router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateListItem(BaseModel):
    id: str
    name: str
    sections: int
    lineItems: int
    updatedAt: str
    createdAt: str


class TemplateCreate(BaseModel):
    name: str = Field(default="Untitled Template", min_length=1)


class TemplateCopyRequest(BaseModel):
    name: Optional[str] = None


class TemplateCommentIn(BaseModel):
    id: str
    name: str
    type: str = "info"
    answerFormat: Optional[str] = None
    answerChoices: Optional[str] = None
    unitChoices: Optional[str] = None
    category: Optional[str] = None
    recommendation: Optional[str] = None
    defaultChecked: Optional[bool] = None
    defaultValue: Optional[str] = None
    defaultValue2: Optional[str] = None
    defaultLocation: Optional[str] = None
    defaultText: Optional[Any] = None


class TemplateItemIn(BaseModel):
    id: str
    title: str
    reminders: Optional[Any] = None
    comments: List[TemplateCommentIn] = Field(default_factory=list)


class TemplateSectionIn(BaseModel):
    id: str
    title: str
    icon: str = "layers"
    standardsOfPractice: Optional[Any] = None
    reminders: Optional[Any] = None
    items: List[TemplateItemIn] = Field(default_factory=list)


class TemplateUpdate(BaseModel):
    name: str
    sections: List[TemplateSectionIn] = Field(default_factory=list)


class TemplateDetail(BaseModel):
    id: str
    name: str
    updatedAt: str
    createdAt: str
    sections: List[dict[str, Any]]


class CommentImageOut(BaseModel):
    id: str
    imageUrl: str
    importImageUrl: Optional[str] = None
    imageCaption: str = ""
    sortOrder: int = 0


class CommentImageCaptionUpdate(BaseModel):
    imageCaption: str = ""


class CommentAiAssistRequest(BaseModel):
    mode: str = "generate"
    sectionTitle: str = ""
    itemTitle: str = ""
    commentType: str = "info"
    answerFormat: str = "checkbox"
    name: str = ""
    choices: str = ""
    defaultText: str = ""
    category: Optional[str] = None
    recommendation: str = ""


@router.get("/", response_model=List[TemplateListItem])
async def list_templates(
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    return await templates_repo.list_templates(currentuser.id, session)


@router.post("/", response_model=TemplateListItem, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    return await templates_repo.create_template(currentuser.id, payload.name, session)


@router.post("/ai/comment")
async def comment_ai_assist(
    payload: CommentAiAssistRequest,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
):
    """AI comment assist — OpenAI credentials stay on the server only."""
    _ = currentuser
    return assist_comment(
        mode=payload.mode,
        section_title=payload.sectionTitle,
        item_title=payload.itemTitle,
        comment_type=payload.commentType,
        answer_format=payload.answerFormat,
        name=payload.name,
        choices=payload.choices,
        default_text=payload.defaultText,
        category=payload.category,
        recommendation=payload.recommendation,
    )


@router.get("/{template_id}/export")
async def export_template_file(
    template_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
    format: str = "json",
):
    return await export_template(template_id, currentuser.id, format, session)


@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(
    template_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    return await templates_repo.get_template_tree(template_id, currentuser.id, session)


@router.put("/{template_id}", response_model=TemplateDetail)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    sections = [section.model_dump() for section in payload.sections]
    return await templates_repo.replace_template_tree(
        template_id, currentuser.id, payload.name, sections, session
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    await templates_repo.delete_template(template_id, currentuser.id, session)
    return None


@router.post("/{template_id}/copy", response_model=TemplateDetail, status_code=status.HTTP_201_CREATED)
async def copy_template(
    template_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
    payload: Optional[TemplateCopyRequest] = None,
):
    name = payload.name if payload else None
    return await templates_repo.copy_template(template_id, currentuser.id, session, name)


@router.post(
    "/{template_id}/comments/{comment_id}/images",
    response_model=CommentImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_comment_image(
    template_id: UUID,
    comment_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
    file: UploadFile = File(...),
    caption: str = Form(""),
):
    filename = await save_upload(file)
    return await templates_repo.add_comment_image(
        template_id,
        comment_id,
        currentuser.id,
        filename,
        caption,
        session,
    )


@router.patch(
    "/{template_id}/images/{image_id}",
    response_model=CommentImageOut,
)
async def update_comment_image(
    template_id: UUID,
    image_id: UUID,
    payload: CommentImageCaptionUpdate,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    return await templates_repo.update_comment_image_caption(
        template_id,
        image_id,
        currentuser.id,
        payload.imageCaption,
        session,
    )


@router.delete(
    "/{template_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment_image(
    template_id: UUID,
    image_id: UUID,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    await templates_repo.delete_comment_image(
        template_id, image_id, currentuser.id, session
    )
    return None
