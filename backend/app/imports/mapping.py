from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Optional

from enums import RecommendationEnum


PHOTO_SLOT_COUNT = 10

# Destination field catalog for the Maps To dropdown.
IMPORT_FIELDS: list[dict[str, str]] = [
    {"key": "section_name", "label": "Section Name", "group": "Structure"},
    {"key": "item_name", "label": "Line Item Title", "group": "Structure"},
    {"key": "comment_name", "label": "Comment Label", "group": "Comment"},
    {"key": "comment_text", "label": "Comment Content", "group": "Comment"},
    {"key": "comment_type", "label": "Comment Type", "group": "Comment"},
    {"key": "category", "label": "Category", "group": "Comment"},
    {"key": "mchoice", "label": "Options", "group": "Comment"},
    {"key": "unit_type", "label": "Unit Types", "group": "Comment"},
    {"key": "recommendation", "label": "Recommendation", "group": "Comment"},
    {"key": "order_index", "label": "Order Index", "group": "Comment"},
    {"key": "answer_type", "label": "Input Type", "group": "Comment"},
    {"key": "default_value", "label": "Default Value", "group": "Defaults"},
    {"key": "default_value2", "label": "Default Value 2 (Range)", "group": "Defaults"},
    {"key": "default_unit", "label": "Default Unit Type", "group": "Defaults"},
    {"key": "default_location", "label": "Location", "group": "Defaults"},
    {"key": "default_estimation_min", "label": "Default Estimate Min", "group": "Defaults"},
    {"key": "default_estimation_max", "label": "Default Estimate Max", "group": "Defaults"},
]

for _n in range(1, PHOTO_SLOT_COUNT + 1):
    IMPORT_FIELDS.append(
        {
            "key": f"default_photo_{_n}",
            "label": f"Default Photo {_n}",
            "group": "Images",
        }
    )
    IMPORT_FIELDS.append(
        {
            "key": f"default_photo_caption_{_n}",
            "label": f"Default Photo Caption {_n}",
            "group": "Images",
        }
    )

IMPORT_FIELDS.append({"key": "skip", "label": "Skip (do not import)", "group": "Other"})

FIELD_KEYS = {field["key"] for field in IMPORT_FIELDS}
FIELD_LABELS = {field["key"]: field["label"] for field in IMPORT_FIELDS}

RECOMMENDATION_VALUES = [member.value for member in RecommendationEnum]

# Hive section icon ids (must stay in sync with frontend SECTION_ICONS).
SECTION_ICON_IDS: list[str] = [
    "report",
    "clipboard",
    "home",
    "roof",
    "flame",
    "chimney",
    "building",
    "wall",
    "car",
    "garage",
    "layers",
    "stairs",
    "snowflake",
    "droplets",
    "pipe",
    "zap",
    "socket",
    "wind",
    "exhaust",
    "fridge",
    "cooktop",
    "washing-machine",
    "toilet",
    "towel-holder",
    "bed",
    "sofa",
    "chair",
    "dining-table",
    "computer-table",
    "books",
    "fence",
    "swimming-pool",
    "grass",
    "wrench",
    "scissors",
]

SECTION_ICON_LABELS: dict[str, str] = {
    "report": "Report",
    "clipboard": "Inspection",
    "home": "Home",
    "roof": "Roof",
    "flame": "Flame",
    "chimney": "Chimney",
    "building": "Building",
    "wall": "Wall",
    "car": "Car",
    "garage": "Garage",
    "layers": "Structure",
    "stairs": "Stairs",
    "snowflake": "Snowflake",
    "droplets": "Plumbing",
    "pipe": "Pipe",
    "zap": "Electrical",
    "socket": "Socket",
    "wind": "Ventilation",
    "exhaust": "Exhaust",
    "fridge": "Fridge",
    "cooktop": "Cook Top",
    "washing-machine": "Washing Machine",
    "toilet": "Toilet",
    "towel-holder": "Towel Holder",
    "bed": "Bed",
    "sofa": "Sofa",
    "chair": "Chair",
    "dining-table": "Dining Table",
    "computer-table": "Computer Table",
    "books": "Books",
    "fence": "Fence",
    "swimming-pool": "Swimming Pool",
    "grass": "Grass",
    "wrench": "Wrench",
    "scissors": "Scissors",
}

# Keyword / shorthand in section title -> icon id
_SECTION_ICON_ALIASES: dict[str, str] = {
    "roof": "roof",
    "roofs": "roof",
    "electrical": "zap",
    "electric": "zap",
    "plumbing": "droplets",
    "plumb": "droplets",
    "heating": "flame",
    "heat": "flame",
    "cooling": "snowflake",
    "cool": "snowflake",
    "hvac": "wind",
    "garage": "garage",
    "carport": "car",
    "car": "car",
    "chimney": "chimney",
    "fireplace": "chimney",
    "stove": "flame",
    "bathroom": "toilet",
    "bathrooms": "toilet",
    "bath": "toilet",
    "toilet": "toilet",
    "kitchen": "cooktop",
    "cooking": "cooktop",
    "cook": "cooktop",
    "laundry": "washing-machine",
    "washer": "washing-machine",
    "bedroom": "bed",
    "bedrooms": "bed",
    "bed": "bed",
    "living": "sofa",
    "sofa": "sofa",
    "interior": "sofa",
    "exterior": "home",
    "outside": "home",
    "attic": "wind",
    "insulation": "wind",
    "ventilation": "wind",
    "vent": "wind",
    "basement": "layers",
    "foundation": "layers",
    "crawlspace": "layers",
    "structure": "layers",
    "structural": "layers",
    "inspection": "clipboard",
    "details": "clipboard",
    "detail": "clipboard",
    "appliance": "fridge",
    "appliances": "fridge",
    "fridge": "fridge",
    "refrigerator": "fridge",
    "deck": "fence",
    "decks": "fence",
    "balcony": "fence",
    "balconies": "fence",
    "fence": "fence",
    "pool": "swimming-pool",
    "swimming": "swimming-pool",
    "grass": "grass",
    "lawn": "grass",
    "landscape": "grass",
    "green": "grass",
    "utility": "wrench",
    "utilities": "wrench",
    "stairs": "stairs",
    "stair": "stairs",
    "wall": "wall",
    "walls": "wall",
    "building": "building",
    "commercial": "building",
    "door": "home",
    "doors": "home",
    "window": "home",
    "windows": "home",
    "pipe": "pipe",
    "exhaust": "exhaust",
    "socket": "socket",
    "dining": "dining-table",
    "chair": "chair",
    "books": "books",
    "office": "computer-table",
    "computer": "computer-table",
    "report": "report",
    "wrench": "wrench",
    "misc": "wrench",
    "miscellaneous": "wrench",
}

_SECTION_ICON_FUZZY_MIN = 0.5
_GENERIC_SECTION_ALIASES = {
    "report",
    "details",
    "detail",
    "misc",
    "miscellaneous",
    "interior",
}

# Spectora shorthand / aliases -> Hive recommendation label
_RECOMMENDATION_ALIASES: dict[str, str] = {
    "pro": RecommendationEnum.qualified_professional.value,
    "professional": RecommendationEnum.qualified_professional.value,
    "qualified professional": RecommendationEnum.qualified_professional.value,
    "electrician": RecommendationEnum.electrical_contractor.value,
    "electrical": RecommendationEnum.electrical_contractor.value,
    "diy": RecommendationEnum.diy.value,
    "plumber": RecommendationEnum.plumbing_contractor.value,
    "plumbing": RecommendationEnum.plumbing_contractor.value,
    "roof": RecommendationEnum.roofing_professional.value,
    "roofer": RecommendationEnum.roofing_professional.value,
    "roofing": RecommendationEnum.roofing_professional.value,
    "gc": RecommendationEnum.general_contractor.value,
    "general contractor": RecommendationEnum.general_contractor.value,
    "window": RecommendationEnum.window_repair_and_installation_contractor.value,
    "windows": RecommendationEnum.window_repair_and_installation_contractor.value,
    "hvac": RecommendationEnum.hvac_professional.value,
    "handyman": RecommendationEnum.handyman.value,
    "garage": RecommendationEnum.garage_door_contractor.value,
    "appliance": RecommendationEnum.appliance_repair.value,
    "structural": RecommendationEnum.structural_engineer.value,
    "monitor": RecommendationEnum.monitor.value,
    "chimney": RecommendationEnum.chimney_repair_contractor.value,
    "insulation": RecommendationEnum.insulation_contractor.value,
    "gutter": RecommendationEnum.gutter_contractor.value,
    "gutters": RecommendationEnum.gutter_contractor.value,
    "carpenter": RecommendationEnum.carpentry_contractor.value,
    "carpentry": RecommendationEnum.carpentry_contractor.value,
    "drywall": RecommendationEnum.drywall_contractor.value,
    "fireplace": RecommendationEnum.fireplace_contractor.value,
    "heating/cooling": RecommendationEnum.heating_and_cooling_contractor.value,
    "heating cooling": RecommendationEnum.heating_and_cooling_contractor.value,
    "handyman-diy": RecommendationEnum.handyman_diy.value,
    "handyman/diy": RecommendationEnum.handyman_diy.value,
    "deck": RecommendationEnum.deck_contractor.value,
    "landscape": RecommendationEnum.landscaping_contractor.value,
    "landscaping": RecommendationEnum.landscaping_contractor.value,
    "flooring": RecommendationEnum.flooring_contractor.value,
    "door": RecommendationEnum.door_repair_and_installation_contractor.value,
    "doors": RecommendationEnum.door_repair_and_installation_contractor.value,
    "siding": RecommendationEnum.siding_contractor.value,
    "paint": RecommendationEnum.painting_contractor.value,
    "painting": RecommendationEnum.painting_contractor.value,
    "concrete": RecommendationEnum.concrete_contractor.value,
    "clean": RecommendationEnum.cleaning_service.value,
    "cleaning": RecommendationEnum.cleaning_service.value,
    "cabinet": RecommendationEnum.cabinet_contractor.value,
    "mold": RecommendationEnum.mold_inspector.value,
    "driveway": RecommendationEnum.driveway_contractor.value,
    "pest": RecommendationEnum.pest_control_pro.value,
    "trees": RecommendationEnum.tree_service.value,
    "tree": RecommendationEnum.tree_service.value,
    "countertop": RecommendationEnum.countertop_contractor.value,
    "fence": RecommendationEnum.fence_contractor.value,
    "fencing": RecommendationEnum.fence_contractor.value,
    "utility": RecommendationEnum.utility_company.value,
    "waterproof": RecommendationEnum.waterproofing_contractor.value,
    "waterproofing": RecommendationEnum.waterproofing_contractor.value,
    "none": RecommendationEnum.no_recommendation.value,
    "no recommendation": RecommendationEnum.no_recommendation.value,
    "n/a": RecommendationEnum.no_recommendation.value,
}

# Spectora header (normalized) -> destination key
_AUTO_MAP_EXACT: dict[str, str] = {
    "section name": "section_name",
    "item name": "item_name",
    "comment name": "comment_name",
    "comment text": "comment_text",
    "comment type (info, limit, defect)": "comment_type",
    "comment type": "comment_type",
    "category (-1: low, 0: med, 1: high)": "category",
    "category": "category",
    "multiple choice options (comma-separated)": "mchoice",
    "multiple choice options": "mchoice",
    "unit type options (numeric answers only, comma-separated)": "unit_type",
    "unit type options": "unit_type",
    "recommendation (from list)": "recommendation",
    "recommendation": "recommendation",
    "order (w/i item)": "order_index",
    "order": "order_index",
    "answer type (boolean, checkbox, date, number, range, text)": "answer_type",
    "answer type": "answer_type",
    "default value": "default_value",
    'default value 2 (for "range" types)': "default_value2",
    "default value 2": "default_value2",
    'default unit type (for "number" and "range" types)': "default_unit",
    "default unit type": "default_unit",
    "default location": "default_location",
    "default estimate min": "default_estimation_min",
    "default estimate max": "default_estimation_max",
    "locked": "skip",
    "simple format": "skip",
    "disable photos": "skip",
    "uses": "skip",
    "last modified": "skip",
}

_PHOTO_RE = re.compile(r"^default\s*photo\s*(\d+)$", re.IGNORECASE)
_CAPTION_RE = re.compile(
    r"^default\s*photo\s*(\d+)\s*caption$", re.IGNORECASE
)
_FUZZY_MIN_RATIO = 0.55


def normalize_header(header: str) -> str:
    return re.sub(r"\s+", " ", (header or "").strip().lower())


def _normalize_recommendation_token(value: str) -> str:
    text = (value or "").strip().lower()
    text = text.replace("_", " ").replace("-", " ")
    text = re.sub(r"[^\w\s/]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def suggest_field_for_header(header: str) -> Optional[str]:
    normalized = normalize_header(header)
    if not normalized:
        return None

    if normalized in _AUTO_MAP_EXACT:
        return _AUTO_MAP_EXACT[normalized]

    caption_match = _CAPTION_RE.match(normalized)
    if caption_match:
        slot = int(caption_match.group(1))
        if 1 <= slot <= PHOTO_SLOT_COUNT:
            return f"default_photo_caption_{slot}"

    photo_match = _PHOTO_RE.match(normalized)
    if photo_match:
        slot = int(photo_match.group(1))
        if 1 <= slot <= PHOTO_SLOT_COUNT:
            return f"default_photo_{slot}"

    for prefix, key in (
        ("section name", "section_name"),
        ("item name", "item_name"),
        ("comment name", "comment_name"),
        ("comment text", "comment_text"),
        ("comment type", "comment_type"),
        ("category", "category"),
        ("multiple choice", "mchoice"),
        ("unit type", "unit_type"),
        ("recommendation", "recommendation"),
        ("order", "order_index"),
        ("answer type", "answer_type"),
        ("default value 2", "default_value2"),
        ("default value", "default_value"),
        ("default unit", "default_unit"),
        ("default location", "default_location"),
        ("default estimate min", "default_estimation_min"),
        ("default estimate max", "default_estimation_max"),
    ):
        if normalized.startswith(prefix):
            return key

    return None


def build_suggested_mappings(headers: list[str]) -> list[dict[str, Optional[str]]]:
    used: set[str] = set()
    mappings: list[dict[str, Optional[str]]] = []
    for header in headers:
        suggested = suggest_field_for_header(header)
        if suggested and suggested != "skip" and suggested in used:
            suggested = None
        if suggested and suggested != "skip":
            used.add(suggested)
        mappings.append(
            {
                "sourceColumn": header,
                "mapsTo": suggested,
            }
        )
    return mappings


def find_recommendation_column(headers: list[str]) -> Optional[str]:
    for header in headers:
        if suggest_field_for_header(header) == "recommendation":
            return header
    return None


def suggest_recommendation_value(source_value: str) -> Optional[str]:
    """Return closest Hive recommendation label for a Spectora cell value."""
    raw = (source_value or "").strip()
    if not raw:
        return None

    for label in RECOMMENDATION_VALUES:
        if label.lower() == raw.lower():
            return label

    token = _normalize_recommendation_token(raw)
    if not token:
        return None

    if token in _RECOMMENDATION_ALIASES:
        return _RECOMMENDATION_ALIASES[token]

    compact = token.replace(" ", "").replace("/", "")
    for alias, label in _RECOMMENDATION_ALIASES.items():
        if alias.replace(" ", "").replace("/", "") == compact:
            return label

    best_label: Optional[str] = None
    best_score = 0.0
    for label in RECOMMENDATION_VALUES:
        label_norm = _normalize_recommendation_token(label)
        if not label_norm:
            continue
        if token == label_norm:
            return label
        if token in label_norm or label_norm in token:
            score = len(token) / max(len(label_norm), 1)
            if score > best_score:
                best_score = score
                best_label = label
            continue
        ratio = SequenceMatcher(None, token, label_norm).ratio()
        if any(
            part.startswith(token) or token.startswith(part)
            for part in label_norm.split()
            if len(part) > 2
        ):
            ratio = max(ratio, 0.72)
        if ratio > best_score:
            best_score = ratio
            best_label = label

    if best_label and best_score >= _FUZZY_MIN_RATIO:
        return best_label
    return None


def extract_recommendation_values(
    headers: list[str],
    rows: list[dict[str, Optional[str]]],
) -> list[str]:
    column = find_recommendation_column(headers)
    if not column:
        return []
    seen: set[str] = set()
    values: list[str] = []
    for row in rows:
        value = (row.get(column) or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        values.append(value)
    values.sort(key=lambda item: item.lower())
    return values


def build_suggested_recommendation_mappings(
    source_values: list[str],
) -> list[dict[str, Optional[str]]]:
    return [
        {
            "sourceValue": value,
            "mapsTo": suggest_recommendation_value(value),
        }
        for value in source_values
    ]


def _decode_html_entities(text: str) -> str:
    return (
        (text or "")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )


def suggest_section_icon(section_title: str) -> str:
    """
    Pick the closest Hive section icon for a section name.
    Falls back to a deterministic-ish random icon when nothing matches well.
    """
    import hashlib
    import random

    raw = _decode_html_entities(section_title or "").strip()
    if not raw:
        return random.choice(SECTION_ICON_IDS)

    token = _normalize_recommendation_token(raw)
    # Prefer longer keyword matches from aliases found in the title.
    # Domain-specific aliases beat generic ones like "report" / "interior".
    alias_hits: list[tuple[int, int, str]] = []
    for alias, icon_id in _SECTION_ICON_ALIASES.items():
        matched = (
            alias in token.split()
            or f" {alias} " in f" {token} "
            or token == alias
            or alias in token
        )
        if not matched:
            continue
        specificity = 0 if alias in _GENERIC_SECTION_ALIASES else 1
        alias_hits.append((specificity, len(alias), icon_id))
    if alias_hits:
        alias_hits.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return alias_hits[0][2]

    best_id: Optional[str] = None
    best_score = 0.0
    for icon_id in SECTION_ICON_IDS:
        candidates = [
            icon_id.replace("-", " "),
            _normalize_recommendation_token(SECTION_ICON_LABELS.get(icon_id, "")),
        ]
        for candidate in candidates:
            if not candidate:
                continue
            if candidate == token or candidate in token or token in candidate:
                score = len(candidate) / max(len(token), len(candidate), 1)
                score = max(score, 0.75)
            else:
                score = SequenceMatcher(None, token, candidate).ratio()
                # Boost if any significant word overlaps
                title_words = {w for w in token.split() if len(w) > 2}
                cand_words = {w for w in candidate.split() if len(w) > 2}
                if title_words & cand_words:
                    score = max(score, 0.7)
            if score > best_score:
                best_score = score
                best_id = icon_id

    if best_id and best_score >= _SECTION_ICON_FUZZY_MIN:
        return best_id

    # Stable pseudo-random fallback so the same section title keeps the same icon.
    digest = hashlib.md5(token.encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % len(SECTION_ICON_IDS)
    return SECTION_ICON_IDS[index]
