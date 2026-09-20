from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlmodel import select, func, delete

try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession

from enums import (
    AnswerTypeEnum,
    CommentCategoryEnum,
    CommentTypeEnum,
    ImportMethodEnum,
    RecommendationEnum,
)
from image_storage import delete_stored_file, disk_path_for, ensure_image_dir
from model import (
    Template,
    TemplateComment,
    TemplateCommentImage,
    TemplateItem,
    TemplateSection,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _split_choices(value: Optional[str]) -> Optional[list[str]]:
    if value is None:
        return None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return parts or None


def _join_choices(values: Optional[list[str]]) -> Optional[str]:
    if not values:
        return None
    return ", ".join(values)


def _normalize_category(value: Optional[str]) -> Optional[str]:
    if value == "med":
        return "medium"
    return value


def _parse_answer_type(value: Optional[str]) -> Optional[AnswerTypeEnum]:
    if not value:
        return None
    if value == "range":
        return AnswerTypeEnum.numeric_range
    try:
        return AnswerTypeEnum(value)
    except ValueError:
        return None


def _parse_recommendation(value: Optional[str]) -> Optional[RecommendationEnum]:
    if not value:
        return None
    try:
        return RecommendationEnum(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid recommendation: {value}",
        )


def _enum_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


def image_to_api(image: TemplateCommentImage) -> dict[str, Any]:
    filename = image.image_url
    return {
        "id": str(image.id),
        "imageUrl": f"/images/{filename}" if not str(filename).startswith("/") else str(filename),
        "importImageUrl": image.import_image_url,
        "imageCaption": image.image_caption or "",
        "sortOrder": image.sort_order,
    }


def comment_to_api(
    comment: TemplateComment,
    images: Optional[list[TemplateCommentImage]] = None,
) -> dict[str, Any]:
    answer = _enum_value(comment.answer_type)
    category = _normalize_category(_enum_value(comment.category))
    return {
        "id": str(comment.id),
        "name": comment.name or "",
        "type": _enum_value(comment.type) or "info",
        "answerFormat": answer,
        "answerChoices": _join_choices(comment.mchoice),
        "unitChoices": _join_choices(comment.unit_type),
        "category": category,
        "recommendation": _enum_value(comment.recommendation),
        "defaultChecked": comment.default_checked,
        "defaultValue": comment.default_value,
        "defaultValue2": comment.default_value2,
        "defaultLocation": comment.default_location,
        "defaultText": comment.default_text,
        "defaultPhotos": [image_to_api(image) for image in (images or [])],
    }


def item_to_api(
    item: TemplateItem,
    comments: list[TemplateComment],
    images_by_comment: Optional[dict[UUID, list[TemplateCommentImage]]] = None,
) -> dict[str, Any]:
    images_by_comment = images_by_comment or {}
    return {
        "id": str(item.id),
        "title": item.title,
        "reminders": item.reminders,
        "comments": [
            comment_to_api(c, images_by_comment.get(c.id, [])) for c in comments
        ],
    }


def section_to_api(
    section: TemplateSection,
    items: list[TemplateItem],
    comments_by_item: dict[UUID, list[TemplateComment]],
    images_by_comment: Optional[dict[UUID, list[TemplateCommentImage]]] = None,
) -> dict[str, Any]:
    return {
        "id": str(section.id),
        "title": section.title,
        "icon": section.icon or "layers",
        "standardsOfPractice": section.standards_of_practice,
        "reminders": section.reminders,
        "items": [
            item_to_api(item, comments_by_item.get(item.id, []), images_by_comment)
            for item in items
        ],
    }


async def list_templates(user_id: int, session: AsyncSession) -> list[dict[str, Any]]:
    result = await session.execute(
        select(Template)
        .where(Template.user_id == user_id)
        .order_by(Template.updated_at.desc())
    )
    templates = result.scalars().all()
    if not templates:
        return []

    template_ids = [t.id for t in templates]

    section_counts = await session.execute(
        select(TemplateSection.template_id, func.count())
        .where(TemplateSection.template_id.in_(template_ids))
        .group_by(TemplateSection.template_id)
    )
    section_map = {row[0]: row[1] for row in section_counts.all()}

    item_counts = await session.execute(
        select(TemplateItem.template_id, func.count())
        .where(TemplateItem.template_id.in_(template_ids))
        .group_by(TemplateItem.template_id)
    )
    item_map = {row[0]: row[1] for row in item_counts.all()}

    return [
        {
            "id": str(template.id),
            "name": template.name,
            "sections": section_map.get(template.id, 0),
            "lineItems": item_map.get(template.id, 0),
            "updatedAt": template.updated_at.isoformat(),
            "createdAt": template.created_at.isoformat(),
        }
        for template in templates
    ]


async def get_template_or_404(
    template_id: UUID, user_id: int, session: AsyncSession
) -> Template:
    result = await session.execute(
        select(Template).where(Template.id == template_id, Template.user_id == user_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


async def get_template_tree(
    template_id: UUID, user_id: int, session: AsyncSession
) -> dict[str, Any]:
    template = await get_template_or_404(template_id, user_id, session)

    sections_result = await session.execute(
        select(TemplateSection)
        .where(TemplateSection.template_id == template_id, TemplateSection.user_id == user_id)
        .order_by(TemplateSection.sort_order.asc())
    )
    sections = list(sections_result.scalars().all())

    items_result = await session.execute(
        select(TemplateItem)
        .where(TemplateItem.template_id == template_id, TemplateItem.user_id == user_id)
        .order_by(TemplateItem.sort_order.asc())
    )
    items = list(items_result.scalars().all())

    comments_result = await session.execute(
        select(TemplateComment)
        .where(TemplateComment.template_id == template_id, TemplateComment.user_id == user_id)
        .order_by(TemplateComment.pos.asc())
    )
    comments = list(comments_result.scalars().all())

    comment_ids = [comment.id for comment in comments]
    images_by_comment: dict[UUID, list[TemplateCommentImage]] = {}
    if comment_ids:
        images_result = await session.execute(
            select(TemplateCommentImage)
            .where(
                TemplateCommentImage.template_comment_id.in_(comment_ids),
                TemplateCommentImage.user_id == user_id,
            )
            .order_by(TemplateCommentImage.sort_order.asc(), TemplateCommentImage.created_at.asc())
        )
        for image in images_result.scalars().all():
            images_by_comment.setdefault(image.template_comment_id, []).append(image)

    items_by_section: dict[UUID, list[TemplateItem]] = {}
    for item in items:
        items_by_section.setdefault(item.section_id, []).append(item)

    comments_by_item: dict[UUID, list[TemplateComment]] = {}
    for comment in comments:
        if comment.item_id is not None:
            comments_by_item.setdefault(comment.item_id, []).append(comment)

    return {
        "id": str(template.id),
        "name": template.name,
        "updatedAt": template.updated_at.isoformat(),
        "createdAt": template.created_at.isoformat(),
        "sections": [
            section_to_api(
                section,
                items_by_section.get(section.id, []),
                comments_by_item,
                images_by_comment,
            )
            for section in sections
        ],
    }


async def create_template(
    user_id: int, name: str, session: AsyncSession
) -> dict[str, Any]:
    template = Template(
        user_id=user_id,
        name=name.strip() or "Untitled Template",
        source_system="",
        import_method=ImportMethodEnum.manual,
        is_seed=False,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return {
        "id": str(template.id),
        "name": template.name,
        "sections": 0,
        "lineItems": 0,
        "updatedAt": template.updated_at.isoformat(),
        "createdAt": template.created_at.isoformat(),
    }


async def delete_template(template_id: UUID, user_id: int, session: AsyncSession) -> None:
    template = await get_template_or_404(template_id, user_id, session)
    await session.delete(template)
    await session.commit()


async def _clear_template_tree(
    template_id: UUID, user_id: int, session: AsyncSession
) -> list[dict[str, Any]]:
    """Clear tree rows. Returns image snapshots to restore after comments are recreated."""
    comment_ids_result = await session.execute(
        select(TemplateComment.id).where(
            TemplateComment.template_id == template_id,
            TemplateComment.user_id == user_id,
        )
    )
    comment_ids = list(comment_ids_result.scalars().all())
    image_snapshots: list[dict[str, Any]] = []
    if comment_ids:
        images_result = await session.execute(
            select(TemplateCommentImage).where(
                TemplateCommentImage.template_comment_id.in_(comment_ids),
                TemplateCommentImage.user_id == user_id,
            )
        )
        for image in images_result.scalars().all():
            image_snapshots.append(
                {
                    "id": image.id,
                    "user_id": image.user_id,
                    "template_comment_id": image.template_comment_id,
                    "image_url": image.image_url,
                    "import_image_url": image.import_image_url,
                    "image_caption": image.image_caption,
                    "sort_order": image.sort_order,
                }
            )
        await session.execute(
            delete(TemplateCommentImage).where(
                TemplateCommentImage.template_comment_id.in_(comment_ids),
                TemplateCommentImage.user_id == user_id,
            )
        )

    await session.execute(
        delete(TemplateComment).where(
            TemplateComment.template_id == template_id,
            TemplateComment.user_id == user_id,
        )
    )
    await session.execute(
        delete(TemplateItem).where(
            TemplateItem.template_id == template_id,
            TemplateItem.user_id == user_id,
        )
    )
    await session.execute(
        delete(TemplateSection).where(
            TemplateSection.template_id == template_id,
            TemplateSection.user_id == user_id,
        )
    )
    return image_snapshots


def _parse_uuid(value: str, label: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} id: {value}",
        )


async def replace_template_tree(
    template_id: UUID,
    user_id: int,
    name: str,
    sections_payload: list[dict[str, Any]],
    session: AsyncSession,
) -> dict[str, Any]:
    template = await get_template_or_404(template_id, user_id, session)
    template.name = name.strip() or template.name
    template.updated_at = _now()

    image_snapshots = await _clear_template_tree(template_id, user_id, session)

    pending_items: list[tuple[dict[str, Any], UUID, UUID]] = []
    pending_comments: list[tuple[dict[str, Any], UUID, UUID, UUID]] = []

    for section_index, section_data in enumerate(sections_payload):
        section_id = _parse_uuid(str(section_data["id"]), "section")
        section = TemplateSection(
            id=section_id,
            user_id=user_id,
            template_id=template_id,
            title=str(section_data.get("title") or "Untitled Section"),
            icon=section_data.get("icon"),
            sort_order=section_index,
            standards_of_practice=section_data.get("standardsOfPractice"),
            reminders=section_data.get("reminders"),
            updated_at=_now(),
        )
        session.add(section)

        for item_data in section_data.get("items") or []:
            item_id = _parse_uuid(str(item_data["id"]), "item")
            pending_items.append((item_data, section_id, item_id))
            for comment_data in item_data.get("comments") or []:
                comment_id = _parse_uuid(str(comment_data["id"]), "comment")
                pending_comments.append((comment_data, section_id, item_id, comment_id))

    await session.flush()

    item_sort: dict[UUID, int] = {}
    for item_data, section_id, item_id in pending_items:
        sort_order = item_sort.get(section_id, 0)
        item_sort[section_id] = sort_order + 1
        item = TemplateItem(
            id=item_id,
            user_id=user_id,
            template_id=template_id,
            section_id=section_id,
            title=str(item_data.get("title") or "Untitled Item"),
            sort_order=sort_order,
            reminders=item_data.get("reminders"),
            updated_at=_now(),
        )
        session.add(item)

    await session.flush()

    kept_comment_ids = {comment_id for _, _, _, comment_id in pending_comments}
    comment_pos: dict[UUID, int] = {}
    for comment_data, section_id, item_id, comment_id in pending_comments:
        pos = comment_pos.get(item_id, 0)
        comment_pos[item_id] = pos + 1
        comment_type = comment_data.get("type") or "info"
        category_raw = _normalize_category(comment_data.get("category"))
        category = None
        if category_raw:
            try:
                category = CommentCategoryEnum(category_raw)
            except ValueError:
                category = None

        answer_type = _parse_answer_type(comment_data.get("answerFormat"))
        recommendation = _parse_recommendation(comment_data.get("recommendation"))

        comment = TemplateComment(
            id=comment_id,
            user_id=user_id,
            template_id=template_id,
            section_id=section_id,
            item_id=item_id,
            name=comment_data.get("name"),
            type=CommentTypeEnum(comment_type)
            if comment_type in CommentTypeEnum._value2member_map_
            else CommentTypeEnum.info,
            category=category,
            answer_type=answer_type,
            recommendation=recommendation,
            default_checked=bool(comment_data.get("defaultChecked") or False),
            default_text=comment_data.get("defaultText"),
            default_value=comment_data.get("defaultValue"),
            default_value2=comment_data.get("defaultValue2"),
            default_location=comment_data.get("defaultLocation"),
            mchoice=_split_choices(comment_data.get("answerChoices")),
            unit_type=_split_choices(comment_data.get("unitChoices")),
            pos=pos,
            updated_at=_now(),
        )
        session.add(comment)

    await session.flush()

    for snapshot in image_snapshots:
        if snapshot["template_comment_id"] not in kept_comment_ids:
            continue
        session.add(
            TemplateCommentImage(
                id=snapshot["id"],
                user_id=snapshot["user_id"],
                template_comment_id=snapshot["template_comment_id"],
                image_url=snapshot["image_url"],
                import_image_url=snapshot["import_image_url"],
                image_caption=snapshot["image_caption"],
                sort_order=snapshot["sort_order"],
                updated_at=_now(),
            )
        )

    await session.commit()
    return await get_template_tree(template_id, user_id, session)


async def copy_template(
    template_id: UUID, user_id: int, session: AsyncSession, name: Optional[str] = None
) -> dict[str, Any]:
    tree = await get_template_tree(template_id, user_id, session)
    new_name = name.strip() if name and name.strip() else f"{tree['name']} copy"

    created = await create_template(user_id, new_name, session)
    new_id = UUID(created["id"])

    comment_id_map: dict[str, str] = {}
    remapped_sections: list[dict[str, Any]] = []
    for section in tree["sections"]:
        new_section_id = str(uuid4())
        remapped_items = []
        for item in section["items"]:
            new_item_id = str(uuid4())
            remapped_comments = []
            for comment in item["comments"]:
                new_comment_id = str(uuid4())
                comment_id_map[comment["id"]] = new_comment_id
                remapped_comments.append({**comment, "id": new_comment_id, "defaultPhotos": []})
            remapped_items.append({**item, "id": new_item_id, "comments": remapped_comments})
        remapped_sections.append(
            {**section, "id": new_section_id, "items": remapped_items}
        )

    await replace_template_tree(
        new_id, user_id, new_name, remapped_sections, session
    )

    # Copy photo rows with new unique UUID filenames
    import shutil

    ensure_image_dir()
    for section in tree["sections"]:
        for item in section["items"]:
            for comment in item["comments"]:
                new_comment_id = comment_id_map.get(comment["id"])
                if not new_comment_id:
                    continue
                for index, photo in enumerate(comment.get("defaultPhotos") or []):
                    old_filename = str(photo.get("imageUrl") or "").rsplit("/", 1)[-1]
                    if not old_filename:
                        continue
                    source = disk_path_for(old_filename)
                    if not source.exists():
                        continue
                    new_filename = f"{uuid4()}{Path(old_filename).suffix.lower() or '.jpg'}"
                    shutil.copy2(source, disk_path_for(new_filename))
                    session.add(
                        TemplateCommentImage(
                            user_id=user_id,
                            template_comment_id=UUID(new_comment_id),
                            image_url=new_filename,
                            import_image_url=photo.get("importImageUrl"),
                            image_caption=photo.get("imageCaption") or "",
                            sort_order=index,
                        )
                    )
    await session.commit()
    return await get_template_tree(new_id, user_id, session)


async def _get_comment_for_template(
    template_id: UUID,
    comment_id: UUID,
    user_id: int,
    session: AsyncSession,
) -> TemplateComment:
    await get_template_or_404(template_id, user_id, session)
    result = await session.execute(
        select(TemplateComment).where(
            TemplateComment.id == comment_id,
            TemplateComment.template_id == template_id,
            TemplateComment.user_id == user_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    return comment


async def add_comment_image(
    template_id: UUID,
    comment_id: UUID,
    user_id: int,
    filename: str,
    caption: Optional[str],
    session: AsyncSession,
) -> dict[str, Any]:
    await _get_comment_for_template(template_id, comment_id, user_id, session)
    count_result = await session.execute(
        select(func.count())
        .select_from(TemplateCommentImage)
        .where(TemplateCommentImage.template_comment_id == comment_id)
    )
    sort_order = int(count_result.scalar_one() or 0)
    image = TemplateCommentImage(
        user_id=user_id,
        template_comment_id=comment_id,
        image_url=filename,
        import_image_url=None,
        image_caption=(caption or "").strip() or None,
        sort_order=sort_order,
    )
    session.add(image)
    await session.commit()
    await session.refresh(image)
    return image_to_api(image)


async def update_comment_image_caption(
    template_id: UUID,
    image_id: UUID,
    user_id: int,
    caption: Optional[str],
    session: AsyncSession,
) -> dict[str, Any]:
    await get_template_or_404(template_id, user_id, session)
    result = await session.execute(
        select(TemplateCommentImage)
        .join(TemplateComment, TemplateComment.id == TemplateCommentImage.template_comment_id)
        .where(
            TemplateCommentImage.id == image_id,
            TemplateCommentImage.user_id == user_id,
            TemplateComment.template_id == template_id,
        )
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    image.image_caption = (caption or "").strip() or None
    image.updated_at = _now()
    session.add(image)
    await session.commit()
    await session.refresh(image)
    return image_to_api(image)


async def delete_comment_image(
    template_id: UUID,
    image_id: UUID,
    user_id: int,
    session: AsyncSession,
) -> None:
    await get_template_or_404(template_id, user_id, session)
    result = await session.execute(
        select(TemplateCommentImage)
        .join(TemplateComment, TemplateComment.id == TemplateCommentImage.template_comment_id)
        .where(
            TemplateCommentImage.id == image_id,
            TemplateCommentImage.user_id == user_id,
            TemplateComment.template_id == template_id,
        )
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    filename = image.image_url
    await session.delete(image)
    await session.commit()
    delete_stored_file(filename)

