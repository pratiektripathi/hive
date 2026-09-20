from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
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
    ValidationStatusEnum,
    WarningSeverityEnum,
)
from imports.mapping import FIELD_KEYS, PHOTO_SLOT_COUNT, suggest_section_icon
from imports.parser import ParsedSpreadsheet
from image_storage import download_image_from_url
from model import (
    AiImportRun,
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


class _CommentHtmlToPlate(HTMLParser):
    """
    Convert Spectora comment HTML into Plate/Slate JSON.
    Preserves paragraphs and hyperlinks (<a href>).
    """

    BLOCK_TAGS = {"p", "div", "li", "h1", "h2", "h3", "tr", "blockquote"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict[str, Any]] = []
        self._children: list[dict[str, Any]] = []
        self._text_buf = ""
        self._link_stack: list[dict[str, Any]] = []
        self._marks: dict[str, bool] = {}
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag in {"script", "style"}:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return

        if tag in self.BLOCK_TAGS:
            self._flush_text()
            self._flush_block()
            return

        if tag == "br":
            self._text_buf += "\n"
            return

        if tag == "a":
            self._flush_text()
            href = ""
            for key, value in attrs:
                if key.lower() == "href" and value:
                    href = value.strip()
                    break
            self._link_stack.append({"type": "a", "url": href, "children": []})
            return

        if tag in {"strong", "b"}:
            self._flush_text()
            self._marks["bold"] = True
        elif tag in {"em", "i"}:
            self._flush_text()
            self._marks["italic"] = True
        elif tag == "u":
            self._flush_text()
            self._marks["underline"] = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return

        if tag in self.BLOCK_TAGS:
            self._flush_text()
            self._flush_block()
            return

        if tag == "a":
            self._flush_text()
            if self._link_stack:
                link = self._link_stack.pop()
                if not link["children"]:
                    link["children"] = [{"text": link.get("url") or ""}]
                self._append_inline(link)
            return

        if tag in {"strong", "b"}:
            self._flush_text()
            self._marks.pop("bold", None)
        elif tag in {"em", "i"}:
            self._flush_text()
            self._marks.pop("italic", None)
        elif tag == "u":
            self._flush_text()
            self._marks.pop("underline", None)

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = data.replace("\xa0", " ")
        if text:
            self._text_buf += text

    def _leaf(self, text: str) -> dict[str, Any]:
        node: dict[str, Any] = {"text": text}
        for mark, enabled in self._marks.items():
            if enabled:
                node[mark] = True
        return node

    def _append_inline(self, node: dict[str, Any]) -> None:
        if self._link_stack:
            self._link_stack[-1]["children"].append(node)
        else:
            self._children.append(node)

    def _flush_text(self) -> None:
        if not self._text_buf:
            return
        text = self._text_buf
        self._text_buf = ""
        # Collapse whitespace except intentional newlines from <br>
        parts = text.split("\n")
        for index, part in enumerate(parts):
            cleaned = re.sub(r"[ \t]+", " ", part)
            if cleaned:
                self._append_inline(self._leaf(cleaned))
            if index < len(parts) - 1:
                self._append_inline(self._leaf("\n"))

    def _normalize_children(self, children: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not children:
            return [{"text": ""}]
        # Trim leading/trailing pure-whitespace text leaves, keep links intact.
        normalized: list[dict[str, Any]] = []
        for node in children:
            if "text" in node and "type" not in node:
                text = node["text"]
                if not normalized and not text.strip():
                    continue
                normalized.append(node)
            else:
                normalized.append(node)
        while (
            normalized
            and "text" in normalized[-1]
            and "type" not in normalized[-1]
            and not str(normalized[-1].get("text", "")).strip()
        ):
            normalized.pop()
        if not normalized:
            return [{"text": ""}]
        # Slate expects text leaves around inlines in some editors; ensure edges are text.
        if "type" in normalized[0]:
            normalized.insert(0, {"text": ""})
        if "type" in normalized[-1]:
            normalized.append({"text": ""})
        return normalized

    def _flush_block(self) -> None:
        children = self._normalize_children(self._children)
        self._children = []
        # Skip empty paragraphs
        only_empty = all(
            ("text" in child and "type" not in child and not str(child.get("text", "")).strip())
            for child in children
        )
        if only_empty:
            return
        self.blocks.append({"type": "p", "children": children})

    def result(self) -> list[dict[str, Any]]:
        self._flush_text()
        self._flush_block()
        return self.blocks


def comment_html_to_default_text(value: Optional[str]) -> Optional[list[dict[str, Any]]]:
    """
    Convert Spectora Comment Text (HTML or plain) into Plate JSON for defaultText.
    Preserves hyperlinks as { type: 'a', url, children }.
    """
    raw = (value or "").strip()
    if not raw:
        return None

    looks_like_html = "<" in raw and ">" in raw
    if looks_like_html:
        parser = _CommentHtmlToPlate()
        try:
            parser.feed(raw)
            parser.close()
            blocks = parser.result()
        except Exception:
            blocks = []
        if blocks:
            return blocks
        stripped = re.sub(r"<[^>]+>", " ", raw)
        stripped = html.unescape(stripped)
        stripped = re.sub(r"\s+", " ", stripped).strip()
        if not stripped:
            return None
        return [{"type": "p", "children": [{"text": stripped}]}]

    paragraphs = [
        part.strip()
        for part in re.split(r"\n{2,}|\r\n{2,}", raw)
        if part.strip()
    ]
    if not paragraphs:
        return None
    return [
        {"type": "p", "children": [{"text": paragraph}]}
        for paragraph in paragraphs
    ]


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
    import_method: ImportMethodEnum = ImportMethodEnum.parser,
    section_icon_hints: Optional[dict[str, str]] = None,
    ai_run: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    field_to_source, mapping_warnings = _invert_mappings(mappings)
    recommendation_value_map = _build_recommendation_value_map(recommendation_mappings)
    icon_hints = section_icon_hints or {}

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
        import_method=import_method,
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
                icon=icon_hints.get(section_title) or suggest_section_icon(section_title),
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
        # Spectora Comment Text is HTML (may include <a> links).
        # text            -> source HTML text
        # rich_text_html  -> same rich HTML (links preserved)
        # default_text    -> Plate JSON converted from that HTML (editor rendering)
        source_html = (comment_text or "").strip() or None
        default_text = comment_html_to_default_text(source_html)
        comment = TemplateComment(
            id=comment_id,
            user_id=user_id,
            template_id=template_id,
            section_id=section.id,
            item_id=item.id,
            name=comment_name,
            text=source_html,
            rich_text_html=source_html,
            raw_html=source_html,
            type=comment_type,
            category=category,
            answer_type=answer_type,
            recommendation=recommendation,
            default_text=default_text,
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
        import_method=import_method,
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
            "sectionIconHints": icon_hints,
            "stats": parsed.stats,
        },
        created_at=now,
    )

    ai_import_run: Optional[AiImportRun] = None
    if import_method in (ImportMethodEnum.ai, ImportMethodEnum.hybrid) and ai_run:
        validation_raw = str(ai_run.get("status") or ValidationStatusEnum.unavailable.value)
        try:
            validation_status = ValidationStatusEnum(validation_raw)
        except ValueError:
            validation_status = ValidationStatusEnum.unavailable
        ai_import_run = AiImportRun(
            id=uuid4(),
            user_id=user_id,
            import_id=import_id,
            model_name=ai_run.get("modelName"),
            prompt_version=ai_run.get("promptVersion"),
            input_summary={
                "sourceFileName": parsed.source_file_name,
                "headers": parsed.headers,
                "stats": parsed.stats,
                "reasoningSummary": ai_run.get("reasoningSummary"),
            },
            output_json={
                "columnMappings": mappings,
                "recommendationMappings": recommendation_mappings or [],
                "sectionIconHints": icon_hints,
                "usedAi": ai_run.get("usedAi"),
            },
            validation_status=validation_status,
            validation_errors=list(ai_run.get("validationErrors") or []),
            created_at=now,
        )

    # Insert in FK order so parents exist before children.
    session.add(template)
    await session.flush()
    session.add(import_row)
    await session.flush()
    if ai_import_run is not None:
        session.add(ai_import_run)
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
