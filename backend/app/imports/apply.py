from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status

try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession

from enums import (
    AnswerTypeEnum,
    CommentCategoryEnum,
    CommentTypeEnum,
    DetectedTypeEnum,
    ImportMethodEnum,
    ImportStatusEnum,
    RecommendationEnum,
    WarningSeverityEnum,
)
from imports.mapping import FIELD_KEYS, PHOTO_SLOT_COUNT, suggest_section_icon
from imports.parser import ParsedSpreadsheet
from image_storage import download_image_from_url
from model import (
    ImportWarning,
    Template,
    TemplateComment,
    TemplateCommentImage,
    TemplateImport,
    TemplateItem,
    TemplateRawRow,
    TemplateSection,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _split_choices(value: Optional[str]) -> Optional[list[str]]:
    if value is None:
        return None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return parts or None


def _parse_answer_type(value: Optional[str]) -> Optional[AnswerTypeEnum]:
    if not value:
        return None
    normalized = value.strip().lower()
    aliases = {
        "range": AnswerTypeEnum.numeric_range,
        "numeric-range": AnswerTypeEnum.numeric_range,
        "boolean": AnswerTypeEnum.checkbox,
        "checkbox": AnswerTypeEnum.checkbox,
        "multiple": AnswerTypeEnum.multiple,
        "text": AnswerTypeEnum.text,
        "date": AnswerTypeEnum.date,
        "number": AnswerTypeEnum.number,
        "signature": AnswerTypeEnum.signature,
    }
    if normalized in aliases:
        return aliases[normalized]
    try:
        return AnswerTypeEnum(normalized)
    except ValueError:
        return None


def _parse_comment_type(value: Optional[str]) -> Optional[CommentTypeEnum]:
    if not value:
        return None
    normalized = value.strip().lower()
    try:
        return CommentTypeEnum(normalized)
    except ValueError:
        return None


def _parse_category(value: Optional[str]) -> Optional[CommentCategoryEnum]:
    if value is None or value == "":
        return None
    normalized = str(value).strip().lower()
    numeric = {
        "-1": CommentCategoryEnum.low,
        "0": CommentCategoryEnum.medium,
        "1": CommentCategoryEnum.high,
    }
    if normalized in numeric:
        return numeric[normalized]
    aliases = {
        "low": CommentCategoryEnum.low,
        "med": CommentCategoryEnum.medium,
        "medium": CommentCategoryEnum.medium,
        "high": CommentCategoryEnum.high,
    }
    return aliases.get(normalized)


def _parse_recommendation(
    value: Optional[str],
    value_map: Optional[dict[str, str]] = None,
) -> Optional[RecommendationEnum]:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None

    if value_map:
        mapped = value_map.get(text) or value_map.get(text.lower())
        if mapped:
            text = mapped.strip()

    try:
        return RecommendationEnum(text)
    except ValueError:
        for member in RecommendationEnum:
            if member.value.lower() == text.lower():
                return member
        return None


def _build_recommendation_value_map(
    mappings: Optional[list[dict[str, Any]]],
) -> dict[str, str]:
    result: dict[str, str] = {}
    for entry in mappings or []:
        source = (entry.get("sourceValue") or entry.get("source_value") or "").strip()
        maps_to = (entry.get("mapsTo") or entry.get("maps_to") or "").strip()
        if not source or not maps_to or maps_to == "skip":
            continue
        result[source] = maps_to
        result[source.lower()] = maps_to
    return result


def _parse_float(value: Optional[str]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _parse_int(value: Optional[str], default: int) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return default


def _invert_mappings(
    mappings: list[dict[str, Any]],
) -> tuple[dict[str, str], list[dict[str, Any]]]:
    """Return field_key -> source_column, plus warning dicts for invalid maps."""
    field_to_source: dict[str, str] = {}
    warnings: list[dict[str, Any]] = []
    for entry in mappings:
        source = (entry.get("sourceColumn") or entry.get("source_column") or "").strip()
        maps_to = (entry.get("mapsTo") or entry.get("maps_to") or "").strip()
        if not source:
            continue
        if not maps_to or maps_to == "skip":
            continue
        if maps_to not in FIELD_KEYS:
            warnings.append(
                {
                    "severity": WarningSeverityEnum.warning,
                    "code": "unknown_field",
                    "message": f"Unknown Maps To field '{maps_to}' for column '{source}'",
                    "source_column": source,
                }
            )
            continue
        if maps_to in field_to_source:
            warnings.append(
                {
                    "severity": WarningSeverityEnum.warning,
                    "code": "duplicate_mapping",
                    "message": (
                        f"Field '{maps_to}' mapped more than once; "
                        f"using '{source}' and ignoring '{field_to_source[maps_to]}'"
                    ),
                    "source_column": source,
                }
            )
        field_to_source[maps_to] = source
    return field_to_source, warnings


def _row_value(
    row: dict[str, Optional[str]], field_to_source: dict[str, str], field_key: str
) -> Optional[str]:
    source = field_to_source.get(field_key)
    if not source:
        return None
    return row.get(source)


async def apply_import(
    *,
    user_id: int,
    parsed: ParsedSpreadsheet,
    mappings: list[dict[str, Any]],
    template_name: str,
    description: Optional[str],
    session: AsyncSession,
    recommendation_mappings: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    field_to_source, mapping_warnings = _invert_mappings(mappings)
    recommendation_value_map = _build_recommendation_value_map(recommendation_mappings)

    if "section_name" not in field_to_source and "item_name" not in field_to_source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Map at least Section Name or Line Item Title before importing.",
        )

    name = (template_name or "").strip() or (
        parsed.source_file_name.rsplit(".", 1)[0] or "Imported Template"
    )

    template_id = uuid4()
    import_id = uuid4()
    now = _now()

    template = Template(
        id=template_id,
        user_id=user_id,
        name=name,
        source_system="spectora",
        source_template_name=name,
        source_file_name=parsed.source_file_name,
        description=(description or "").strip() or None,
        import_method=ImportMethodEnum.parser,
        is_seed=False,
        created_at=now,
        updated_at=now,
    )

    warning_payloads = list(mapping_warnings)
    sections_by_title: dict[str, TemplateSection] = {}
    items_by_key: dict[tuple[str, str], TemplateItem] = {}
    section_order = 0
    item_order_by_section: dict[UUID, int] = {}
    comment_count = 0
    image_count = 0
    unsupported = 0

    sections: list[TemplateSection] = []
    items: list[TemplateItem] = []
    comments: list[TemplateComment] = []
    images: list[TemplateCommentImage] = []
    raw_rows: list[TemplateRawRow] = []
    warning_rows: list[ImportWarning] = []

    current_section_title = ""
    current_item_title = ""

    for row_index, row in enumerate(parsed.rows, start=2):
        section_title = (
            _row_value(row, field_to_source, "section_name") or current_section_title or ""
        ).strip()
        item_title = (
            _row_value(row, field_to_source, "item_name") or current_item_title or ""
        ).strip()

        if section_title:
            current_section_title = section_title
        if item_title:
            current_item_title = item_title

        if not section_title:
            section_title = "Imported Section"
            current_section_title = section_title
        if not item_title:
            item_title = "General"
            current_item_title = item_title

        section = sections_by_title.get(section_title)
        if section is None:
            section = TemplateSection(
                id=uuid4(),
                user_id=user_id,
                template_id=template_id,
                title=section_title,
                icon=suggest_section_icon(section_title),
                sort_order=section_order,
                source_ref=f"row:{row_index}",
                created_at=now,
                updated_at=now,
            )
            section_order += 1
            sections.append(section)
            sections_by_title[section_title] = section
            item_order_by_section[section.id] = 0

        item_key = (section_title, item_title)
        item = items_by_key.get(item_key)
        if item is None:
            sort_order = item_order_by_section.get(section.id, 0)
            item = TemplateItem(
                id=uuid4(),
                user_id=user_id,
                template_id=template_id,
                section_id=section.id,
                title=item_title,
                sort_order=sort_order,
                source_ref=f"row:{row_index}",
                created_at=now,
                updated_at=now,
            )
            item_order_by_section[section.id] = sort_order + 1
            items.append(item)
            items_by_key[item_key] = item

        comment_name = _row_value(row, field_to_source, "comment_name")
        comment_text = _row_value(row, field_to_source, "comment_text")
        answer_raw = _row_value(row, field_to_source, "answer_type")
        type_raw = _row_value(row, field_to_source, "comment_type")
        category_raw = _row_value(row, field_to_source, "category")
        recommendation_raw = _row_value(row, field_to_source, "recommendation")

        answer_type = _parse_answer_type(answer_raw)
        comment_type = _parse_comment_type(type_raw) or CommentTypeEnum.info
        category = _parse_category(category_raw)
        recommendation = _parse_recommendation(
            recommendation_raw, recommendation_value_map
        )

        if answer_raw and answer_type is None:
            warning_payloads.append(
                {
                    "severity": WarningSeverityEnum.warning,
                    "code": "unsupported_answer_type",
                    "message": f"Unsupported answer type '{answer_raw}'",
                    "source_row": row_index,
                    "source_column": field_to_source.get("answer_type"),
                    "raw_content": answer_raw,
                }
            )
            unsupported += 1

        if recommendation_raw and recommendation is None:
            warning_payloads.append(
                {
                    "severity": WarningSeverityEnum.info,
                    "code": "unknown_recommendation",
                    "message": f"Unknown recommendation '{recommendation_raw}'",
                    "source_row": row_index,
                    "source_column": field_to_source.get("recommendation"),
                    "raw_content": recommendation_raw,
                }
            )

        order_index = _parse_int(
            _row_value(row, field_to_source, "order_index"), comment_count
        )
        mchoice = _split_choices(_row_value(row, field_to_source, "mchoice"))
        unit_type = _split_choices(_row_value(row, field_to_source, "unit_type"))

        # Spectora checkbox rows with choices behave like multiple-select in Hive.
        if answer_type == AnswerTypeEnum.checkbox and mchoice:
            answer_type = AnswerTypeEnum.multiple

        comment_id = uuid4()
        comment = TemplateComment(
            id=comment_id,
            user_id=user_id,
            template_id=template_id,
            section_id=section.id,
            item_id=item.id,
            name=comment_name,
            text=comment_text,
            type=comment_type,
            category=category,
            answer_type=answer_type,
            recommendation=recommendation,
            default_value=_row_value(row, field_to_source, "default_value"),
            default_value2=_row_value(row, field_to_source, "default_value2"),
            default_unit=_row_value(row, field_to_source, "default_unit"),
            unit_type=unit_type,
            mchoice=mchoice,
            default_estimation_min=_parse_float(
                _row_value(row, field_to_source, "default_estimation_min")
            ),
            default_estimation_max=_parse_float(
                _row_value(row, field_to_source, "default_estimation_max")
            ),
            default_location=_row_value(row, field_to_source, "default_location"),
            pos=order_index,
            created_at=now,
            updated_at=now,
        )
        comments.append(comment)
        comment_count += 1

        for slot in range(1, PHOTO_SLOT_COUNT + 1):
            photo_url = _row_value(row, field_to_source, f"default_photo_{slot}")
            caption = _row_value(row, field_to_source, f"default_photo_caption_{slot}")
            if not photo_url and not caption:
                continue
            if not photo_url:
                warning_payloads.append(
                    {
                        "severity": WarningSeverityEnum.info,
                        "code": "caption_without_photo",
                        "message": f"Caption for photo {slot} ignored (no URL)",
                        "source_row": row_index,
                        "raw_content": caption,
                    }
                )
                continue

            try:
                stored_filename = download_image_from_url(photo_url)
            except ValueError as exc:
                warning_payloads.append(
                    {
                        "severity": WarningSeverityEnum.warning,
                        "code": "image_download_failed",
                        "message": f"Failed to download photo {slot}: {exc}",
                        "source_row": row_index,
                        "source_column": field_to_source.get(f"default_photo_{slot}"),
                        "raw_content": photo_url,
                    }
                )
                continue

            images.append(
                TemplateCommentImage(
                    id=uuid4(),
                    user_id=user_id,
                    template_comment_id=comment_id,
                    image_url=stored_filename,
                    import_image_url=photo_url,
                    image_caption=(caption or "").strip() or None,
                    sort_order=slot - 1,
                    created_at=now,
                    updated_at=now,
                )
            )
            image_count += 1

        raw_rows.append(
            TemplateRawRow(
                id=uuid4(),
                user_id=user_id,
                import_id=import_id,
                template_id=template_id,
                row_number=row_index,
                row_data={k: v for k, v in row.items()},
                detected_type=DetectedTypeEnum.comment,
                mapped_entity_type="comment",
                mapped_entity_id=comment_id,
                created_at=now,
            )
        )

    for payload in warning_payloads:
        warning_rows.append(
            ImportWarning(
                id=uuid4(),
                user_id=user_id,
                import_id=import_id,
                template_id=template_id,
                severity=payload["severity"],
                code=payload["code"],
                message=payload["message"],
                source_row=payload.get("source_row"),
                source_column=payload.get("source_column"),
                raw_content=payload.get("raw_content"),
                created_at=now,
            )
        )

    status_value = ImportStatusEnum.success
    if warning_payloads and comment_count:
        status_value = ImportStatusEnum.partial
    elif comment_count == 0:
        status_value = ImportStatusEnum.failed

    import_row = TemplateImport(
        id=import_id,
        user_id=user_id,
        template_id=template_id,
        source_file_name=parsed.source_file_name,
        source_file_hash=parsed.source_file_hash,
        import_method=ImportMethodEnum.parser,
        status=status_value,
        total_rows=len(parsed.rows),
        imported_sections=len(sections_by_title),
        imported_items=len(items_by_key),
        imported_comments=comment_count,
        unsupported_count=unsupported,
        raw_metadata={
            "headers": parsed.headers,
            "mappings": mappings,
            "recommendationMappings": recommendation_mappings or [],
            "stats": parsed.stats,
        },
        created_at=now,
    )

    # Insert in FK order so parents exist before children.
    session.add(template)
    await session.flush()
    session.add(import_row)
    await session.flush()
    if sections:
        session.add_all(sections)
        await session.flush()
    if items:
        session.add_all(items)
        await session.flush()
    if comments:
        session.add_all(comments)
        await session.flush()
    if images:
        session.add_all(images)
    if raw_rows:
        session.add_all(raw_rows)
    if warning_rows:
        session.add_all(warning_rows)
    await session.commit()

    return {
        "templateId": str(template_id),
        "templateName": name,
        "importId": str(import_id),
        "status": status_value.value,
        "counts": {
            "sections": len(sections_by_title),
            "lineItems": len(items_by_key),
            "comments": comment_count,
            "images": image_count,
            "warnings": len(warning_payloads),
            "totalRows": len(parsed.rows),
        },
        "warnings": [
            {
                "code": w["code"],
                "message": w["message"],
                "severity": w["severity"].value
                if hasattr(w["severity"], "value")
                else str(w["severity"]),
                "sourceRow": w.get("source_row"),
                "sourceColumn": w.get("source_column"),
            }
            for w in warning_payloads[:50]
        ],
    }
