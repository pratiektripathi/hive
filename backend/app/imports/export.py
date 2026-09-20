from __future__ import annotations

import csv
import io
import json
import re
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.responses import Response, StreamingResponse
from openpyxl import Workbook

from imports.mapping import IMPORT_FIELDS, PHOTO_SLOT_COUNT
from repo import templates as templates_repo

try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession


EXPORT_COLUMNS = [f["key"] for f in IMPORT_FIELDS if f["key"] != "skip"]


def _safe_filename(name: str, extension: str) -> str:
    base = re.sub(r"[^\w.\- ]+", "", (name or "template").strip()) or "template"
    base = base.replace(" ", "-")[:80]
    return f"{base}.{extension}"


def _plain_from_rich(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if not isinstance(value, list):
        return str(value)

    parts: list[str] = []

    def walk(nodes: list[Any]) -> None:
        for node in nodes:
            if not isinstance(node, dict):
                continue
            text = node.get("text")
            if isinstance(text, str) and text:
                parts.append(text)
            children = node.get("children")
            if isinstance(children, list):
                walk(children)
            if node.get("type") in ("p", "h1", "h2", "h3", "li", "blockquote"):
                parts.append("\n")

    walk(value)
    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def _escape_html(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _inline_html_from_nodes(nodes: list[Any]) -> str:
    parts: list[str] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_type = node.get("type")
        children = node.get("children")
        if node_type == "a":
            url = str(node.get("url") or "").strip()
            label = _inline_html_from_nodes(children) if isinstance(children, list) else ""
            if not label:
                label = _escape_html(url)
            if url:
                parts.append(
                    f'<a href="{_escape_html(url)}" target="_blank">{label}</a>'
                )
            else:
                parts.append(label)
            continue

        if isinstance(children, list) and node_type:
            parts.append(_inline_html_from_nodes(children))
            continue

        text = node.get("text")
        if not isinstance(text, str) or text == "":
            continue
        chunk = _escape_html(text).replace("\n", "<br>")
        if node.get("bold"):
            chunk = f"<strong>{chunk}</strong>"
        if node.get("italic"):
            chunk = f"<em>{chunk}</em>"
        if node.get("underline"):
            chunk = f"<u>{chunk}</u>"
        parts.append(chunk)
    return "".join(parts)


def _html_from_rich(value: Any) -> str:
    """Convert Plate/Slate defaultText JSON into Spectora-style rich HTML."""
    if value is None:
        return ""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return ""
        if "<" in text and ">" in text:
            return text
        return f"<p>{_escape_html(text)}</p>"
    if not isinstance(value, list):
        text = str(value).strip()
        return f"<p>{_escape_html(text)}</p>" if text else ""

    paragraphs: list[str] = []
    for node in value:
        if not isinstance(node, dict):
            continue
        children = node.get("children")
        if not isinstance(children, list):
            continue
        inner = _inline_html_from_nodes(children).strip()
        if not inner:
            continue
        paragraphs.append(f"<p>{inner}</p>")
    return "\n\n".join(paragraphs)


def _comment_text_for_export(comment: dict[str, Any]) -> str:
    """Prefer stored rich HTML; otherwise convert defaultText Plate JSON to HTML."""
    rich_html = comment.get("richTextHtml") or comment.get("rich_text_html")
    if isinstance(rich_html, str) and rich_html.strip():
        return rich_html.strip()
    return _html_from_rich(comment.get("defaultText"))


def _flatten_template(tree: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    order_index = 0
    for section in tree.get("sections") or []:
        section_title = str(section.get("title") or "")
        for item in section.get("items") or []:
            item_title = str(item.get("title") or "")
            comments = item.get("comments") or []
            if not comments:
                row = {key: "" for key in EXPORT_COLUMNS}
                row["section_name"] = section_title
                row["item_name"] = item_title
                rows.append(row)
                continue
            for comment in comments:
                row = {key: "" for key in EXPORT_COLUMNS}
                row["section_name"] = section_title
                row["item_name"] = item_title
                row["comment_name"] = str(comment.get("name") or "")
                row["comment_text"] = _comment_text_for_export(comment)
                row["comment_type"] = str(comment.get("type") or "")
                row["category"] = str(comment.get("category") or "")
                row["mchoice"] = str(comment.get("answerChoices") or "")
                row["unit_type"] = str(comment.get("unitChoices") or "")
                row["recommendation"] = str(comment.get("recommendation") or "")
                row["order_index"] = str(order_index)
                row["answer_type"] = str(comment.get("answerFormat") or "")
                row["default_value"] = str(comment.get("defaultValue") or "")
                row["default_value2"] = str(comment.get("defaultValue2") or "")
                row["default_unit"] = ""
                row["default_location"] = str(comment.get("defaultLocation") or "")
                row["default_estimation_min"] = ""
                row["default_estimation_max"] = ""

                photos = sorted(
                    comment.get("defaultPhotos") or [],
                    key=lambda p: int(p.get("sortOrder") or 0),
                )
                for slot in range(1, PHOTO_SLOT_COUNT + 1):
                    photo = photos[slot - 1] if slot - 1 < len(photos) else None
                    if photo:
                        url = photo.get("importImageUrl") or photo.get("imageUrl") or ""
                        row[f"default_photo_{slot}"] = str(url)
                        row[f"default_photo_caption_{slot}"] = str(
                            photo.get("imageCaption") or ""
                        )
                rows.append(row)
                order_index += 1
    return rows


async def export_template(
    template_id: UUID,
    user_id: int,
    fmt: str,
    session: AsyncSession,
) -> Response:
    normalized = (fmt or "json").strip().lower()
    if normalized in ("excel", "xls"):
        normalized = "xlsx"
    if normalized not in ("json", "csv", "xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="format must be json, csv, or xlsx",
        )

    tree = await templates_repo.get_template_tree(template_id, user_id, session)
    name = str(tree.get("name") or "template")

    if normalized == "json":
        body = json.dumps(tree, ensure_ascii=False, indent=2).encode("utf-8")
        return Response(
            content=body,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{_safe_filename(name, "json")}"'
            },
        )

    flat_rows = _flatten_template(tree)
    headers = EXPORT_COLUMNS

    if normalized == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in flat_rows:
            writer.writerow({key: row.get(key, "") for key in headers})
        data = buffer.getvalue().encode("utf-8-sig")
        return Response(
            content=data,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{_safe_filename(name, "csv")}"'
            },
        )

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Template"
    sheet.append(headers)
    for row in flat_rows:
        sheet.append([row.get(key, "") for key in headers])
    stream = io.BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(name, "xlsx")}"'
        },
    )
