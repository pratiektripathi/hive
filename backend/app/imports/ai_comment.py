from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from enums import (
    CommentCategoryEnum,
    CommentTypeEnum,
    RecommendationEnum,
    ValidationStatusEnum,
)

logger = logging.getLogger(__name__)

PROMPT_VERSION = "comment-assist-v1"
DEFAULT_MODEL = "gpt-4o-mini"

RECOMMENDATION_VALUES = [member.value for member in RecommendationEnum]
CATEGORY_VALUES = [member.value for member in CommentCategoryEnum if member != CommentCategoryEnum.med]
COMMENT_TYPES = [member.value for member in CommentTypeEnum]


def _openai_api_key() -> Optional[str]:
    return (os.getenv("OPENAI_API_KEY") or "").strip() or None


def _openai_model() -> str:
    return (os.getenv("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _unavailable(message: str) -> dict[str, Any]:
    return {
        "name": None,
        "choices": None,
        "defaultText": None,
        "category": None,
        "recommendation": None,
        "status": ValidationStatusEnum.unavailable.value,
        "modelName": None,
        "promptVersion": PROMPT_VERSION,
        "message": message,
    }


def _validate_output(
    data: dict[str, Any],
    *,
    mode: str,
    answer_format: str,
    comment_type: str,
    seed_name: str,
) -> dict[str, Any]:
    name = str(data.get("name") or "").strip() or seed_name or None
    choices_raw = data.get("choices")
    choices = None
    if choices_raw is not None:
        choices = str(choices_raw).strip() or None

    default_text = str(data.get("defaultText") or "").strip() or None

    category = None
    if comment_type == "defect":
        cat = str(data.get("category") or "").strip().lower()
        if cat in CATEGORY_VALUES:
            category = cat

    recommendation = None
    if comment_type == "defect":
        rec = str(data.get("recommendation") or "").strip()
        if rec in RECOMMENDATION_VALUES:
            recommendation = rec

    # Only keep choices when the format supports them.
    if answer_format not in ("multiple", "number", "numeric-range"):
        if mode == "generate" and answer_format != "multiple":
            if answer_format in ("number", "numeric-range"):
                pass  # unit choices
            else:
                choices = None
        elif answer_format != "multiple":
            choices = None

    if answer_format == "checkbox":
        choices = None

    return {
        "name": name,
        "choices": choices,
        "defaultText": default_text,
        "category": category,
        "recommendation": recommendation,
        "status": ValidationStatusEnum.valid.value,
        "modelName": _openai_model(),
        "promptVersion": PROMPT_VERSION,
        "message": None,
    }


def assist_comment(
    *,
    mode: str,
    section_title: str,
    item_title: str,
    comment_type: str,
    answer_format: str,
    name: str = "",
    choices: str = "",
    default_text: str = "",
    category: Optional[str] = None,
    recommendation: str = "",
) -> dict[str, Any]:
    mode = (mode or "generate").strip().lower()
    if mode not in ("generate", "edit"):
        mode = "generate"

    if not _openai_api_key():
        logger.info("OPENAI_API_KEY not set; comment AI assist unavailable.")
        return _unavailable("AI is not configured. Set OPENAI_API_KEY to enable.")

    seed_name = (name or "").strip()
    if mode == "generate" and not seed_name:
        return {
            **_unavailable("Comment name is required before generating with AI."),
            "status": ValidationStatusEnum.rejected.value,
        }

    payload = {
        "mode": mode,
        "sectionTitle": section_title,
        "itemTitle": item_title,
        "commentType": comment_type,
        "answerFormat": answer_format,
        "name": seed_name,
        "choices": choices,
        "defaultText": default_text,
        "category": category,
        "recommendation": recommendation,
        "allowedCategories": CATEGORY_VALUES,
        "allowedRecommendations": RECOMMENDATION_VALUES,
        "allowedCommentTypes": COMMENT_TYPES,
    }

    if mode == "generate":
        instruction = (
            "Generate inspection-comment fields for a home inspection template. "
            "Use the provided name as the comment label seed. "
            "Fill defaultText with concise inspector-facing guidance (plain text, short paragraphs). "
            "For answerFormat=multiple, provide comma-separated choices. "
            "For number/numeric-range, choices are unit types (comma-separated) when useful. "
            "For defect comments, pick category and recommendation from the allowed lists."
        )
    else:
        instruction = (
            "Improve the existing inspection comment fields. "
            "Keep the name unless it is unclear; refine choices and defaultText. "
            "For multiple choice, improve the comma-separated answer choices. "
            "For defects, adjust category/recommendation only if clearly better."
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=_openai_api_key())
        model = _openai_model()
        response = client.chat.completions.create(
            model=model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You assist authors of home-inspection templates. "
                        "Return JSON with keys: name, choices, defaultText, category, recommendation. "
                        "Use null for unused fields. Do not invent unsupported recommendation labels."
                    ),
                },
                {
                    "role": "user",
                    "content": f"{instruction}\n\nContext:\n{json.dumps(payload, ensure_ascii=False)}",
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        result = _validate_output(
            data,
            mode=mode,
            answer_format=answer_format,
            comment_type=comment_type,
            seed_name=seed_name,
        )
        result["modelName"] = model
        return result
    except Exception as exc:
        logger.warning("Comment AI assist failed: %s", exc)
        return _unavailable(f"AI request failed: {exc}")
