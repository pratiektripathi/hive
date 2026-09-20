from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from enums import ValidationStatusEnum
from imports.mapping import (
    FIELD_KEYS,
    IMPORT_FIELDS,
    RECOMMENDATION_VALUES,
    SECTION_ICON_IDS,
    build_suggested_mappings,
    build_suggested_recommendation_mappings,
    extract_recommendation_values,
)
from imports.parser import ParsedSpreadsheet

logger = logging.getLogger(__name__)

PROMPT_VERSION = "ai-import-v1"
DEFAULT_MODEL = "gpt-4o-mini"
MAX_SAMPLE_ROWS = 12
MAX_SAMPLE_CELLS = 8


def _openai_api_key() -> Optional[str]:
    return (os.getenv("OPENAI_API_KEY") or "").strip() or None


def _openai_model() -> str:
    return (os.getenv("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _heuristic_payload(parsed: ParsedSpreadsheet) -> dict[str, Any]:
    column_mappings = build_suggested_mappings(parsed.headers)
    recommendation_values = extract_recommendation_values(parsed.headers, parsed.rows)
    recommendation_mappings = build_suggested_recommendation_mappings(
        recommendation_values
    )
    return {
        "columnMappings": column_mappings,
        "recommendationMappings": recommendation_mappings,
        "sectionIconHints": {},
        "reasoningSummary": "Heuristic field matching (AI unavailable).",
        "status": ValidationStatusEnum.unavailable.value,
        "modelName": None,
        "promptVersion": PROMPT_VERSION,
        "usedAi": False,
    }


def _sample_rows(parsed: ParsedSpreadsheet) -> list[dict[str, Optional[str]]]:
    rows: list[dict[str, Optional[str]]] = []
    for row in parsed.rows[:MAX_SAMPLE_ROWS]:
        trimmed: dict[str, Optional[str]] = {}
        for header in parsed.headers[:MAX_SAMPLE_CELLS]:
            value = row.get(header)
            if value is None:
                trimmed[header] = None
            else:
                text = str(value)
                trimmed[header] = text if len(text) <= 200 else text[:197] + "..."
        rows.append(trimmed)
    return rows


def _validate_mappings(
    headers: list[str],
    column_mappings: list[dict[str, Any]],
    recommendation_mappings: list[dict[str, Any]],
    section_icon_hints: dict[str, Any],
    heuristic: dict[str, Any],
) -> tuple[list[dict[str, Optional[str]]], list[dict[str, Optional[str]]], dict[str, str], str]:
    header_set = set(headers)
    used: set[str] = set()
    validated_columns: list[dict[str, Optional[str]]] = []
    seen_sources: set[str] = set()

    for raw in column_mappings:
        source = str(raw.get("sourceColumn") or "").strip()
        if not source or source not in header_set or source in seen_sources:
            continue
        maps_to = raw.get("mapsTo")
        maps_to_str = str(maps_to).strip() if maps_to is not None else None
        if maps_to_str in ("", "null", "None"):
            maps_to_str = None
        if maps_to_str and maps_to_str not in FIELD_KEYS:
            maps_to_str = None
        if maps_to_str and maps_to_str != "skip":
            if maps_to_str in used:
                maps_to_str = None
            else:
                used.add(maps_to_str)
        seen_sources.add(source)
        validated_columns.append({"sourceColumn": source, "mapsTo": maps_to_str})

    # Ensure every header appears (fill from heuristic).
    heuristic_by_source = {
        m["sourceColumn"]: m.get("mapsTo")
        for m in heuristic["columnMappings"]
    }
    for header in headers:
        if header in seen_sources:
            continue
        suggested = heuristic_by_source.get(header)
        if suggested and suggested != "skip" and suggested in used:
            suggested = None
        if suggested and suggested != "skip":
            used.add(suggested)
        validated_columns.append({"sourceColumn": header, "mapsTo": suggested})
        seen_sources.add(header)

    mapped_keys = {
        m["mapsTo"] for m in validated_columns if m.get("mapsTo") and m["mapsTo"] != "skip"
    }
    if "section_name" not in mapped_keys and "item_name" not in mapped_keys:
        # Prefer heuristic structural mappings when AI omitted them.
        for hm in heuristic["columnMappings"]:
            maps_to = hm.get("mapsTo")
            if maps_to in ("section_name", "item_name") and maps_to not in mapped_keys:
                source = hm["sourceColumn"]
                for row in validated_columns:
                    if row["sourceColumn"] == source:
                        old = row.get("mapsTo")
                        if old and old != "skip" and old in used:
                            used.discard(old)
                        row["mapsTo"] = maps_to
                        used.add(maps_to)
                        mapped_keys.add(maps_to)
                        break

    rec_allowed = set(RECOMMENDATION_VALUES)
    validated_recs: list[dict[str, Optional[str]]] = []
    seen_rec: set[str] = set()
    for raw in recommendation_mappings:
        source_value = str(raw.get("sourceValue") or "").strip()
        if not source_value or source_value in seen_rec:
            continue
        maps_to = raw.get("mapsTo")
        maps_to_str = str(maps_to).strip() if maps_to is not None else None
        if maps_to_str and maps_to_str not in rec_allowed:
            maps_to_str = None
        validated_recs.append({"sourceValue": source_value, "mapsTo": maps_to_str})
        seen_rec.add(source_value)

    if not validated_recs:
        validated_recs = list(heuristic["recommendationMappings"])

    icon_allowed = set(SECTION_ICON_IDS)
    validated_icons: dict[str, str] = {}
    if isinstance(section_icon_hints, dict):
        for title, icon_id in section_icon_hints.items():
            title_str = str(title or "").strip()
            icon_str = str(icon_id or "").strip()
            if title_str and icon_str in icon_allowed:
                validated_icons[title_str] = icon_str

    status = ValidationStatusEnum.valid.value
    if not mapped_keys:
        status = ValidationStatusEnum.rejected.value
    elif "section_name" not in mapped_keys and "item_name" not in mapped_keys:
        status = ValidationStatusEnum.partial.value

    return validated_columns, validated_recs, validated_icons, status


def _call_openai(parsed: ParsedSpreadsheet, heuristic: dict[str, Any]) -> dict[str, Any]:
    from openai import OpenAI

    field_catalog = [
        {"key": f["key"], "label": f["label"], "group": f["group"]}
        for f in IMPORT_FIELDS
        if f["key"] != "skip"
    ]
    payload = {
        "headers": parsed.headers,
        "sampleRows": _sample_rows(parsed),
        "fieldCatalog": field_catalog,
        "recommendationValues": RECOMMENDATION_VALUES,
        "sectionIconIds": SECTION_ICON_IDS,
        "heuristicColumnMappings": heuristic["columnMappings"],
        "heuristicRecommendationMappings": heuristic["recommendationMappings"],
    }

    system = (
        "You map home-inspection template spreadsheet columns to a fixed field catalog. "
        "Return JSON only. Prefer accurate structural fields (section_name, item_name, "
        "comment_name, comment_text, comment_type). Use skip for irrelevant columns. "
        "Do not invent source columns. Recommendation mapsTo must be from recommendationValues. "
        "sectionIconHints maps section titles to sectionIconIds when confident."
    )
    user = (
        "Produce JSON with keys: columnMappings (array of {sourceColumn, mapsTo}), "
        "recommendationMappings (array of {sourceValue, mapsTo}), "
        "sectionIconHints (object), reasoningSummary (string).\n\n"
        f"Input:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    client = OpenAI(api_key=_openai_api_key())
    model = _openai_model()
    response = client.chat.completions.create(
        model=model,
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = response.choices[0].message.content or "{}"
    data = json.loads(content)
    return {
        "raw": data,
        "modelName": model,
    }


def suggest_import_mappings(parsed: ParsedSpreadsheet) -> dict[str, Any]:
    heuristic = _heuristic_payload(parsed)

    if not _openai_api_key():
        logger.info("OPENAI_API_KEY not set; using heuristic import mappings.")
        return heuristic

    try:
        ai_result = _call_openai(parsed, heuristic)
        data = ai_result["raw"]
        columns, recs, icons, status = _validate_mappings(
            parsed.headers,
            list(data.get("columnMappings") or []),
            list(data.get("recommendationMappings") or []),
            dict(data.get("sectionIconHints") or {}),
            heuristic,
        )
        if status == ValidationStatusEnum.rejected.value:
            # Fall back fully to heuristics if AI produced nothing usable.
            fallback = dict(heuristic)
            fallback["status"] = ValidationStatusEnum.rejected.value
            fallback["reasoningSummary"] = str(
                data.get("reasoningSummary") or "AI output rejected; using heuristics."
            )
            fallback["modelName"] = ai_result["modelName"]
            fallback["usedAi"] = False
            return fallback

        used_ai = True
        final_status = status
        if status == ValidationStatusEnum.partial.value:
            final_status = ValidationStatusEnum.partial.value

        return {
            "columnMappings": columns,
            "recommendationMappings": recs,
            "sectionIconHints": icons,
            "reasoningSummary": str(
                data.get("reasoningSummary") or "AI-suggested column mappings."
            ),
            "status": final_status,
            "modelName": ai_result["modelName"],
            "promptVersion": PROMPT_VERSION,
            "usedAi": used_ai,
        }
    except Exception as exc:
        logger.warning("AI import suggest failed: %s", exc)
        fallback = dict(heuristic)
        fallback["status"] = ValidationStatusEnum.unavailable.value
        fallback["reasoningSummary"] = f"AI failed ({exc}); using heuristic mappings."
        return fallback
