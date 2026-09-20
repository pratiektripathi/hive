from enum import Enum


class ThemeEnum(str, Enum):
    light = "light"
    dark = "dark"


class ImportMethodEnum(str, Enum):
    parser = "parser"
    ai = "ai"
    hybrid = "hybrid"
    sample = "sample"


class ImportStatusEnum(str, Enum):
    success = "success"
    partial = "partial"
    failed = "failed"


class CommentTypeEnum(str, Enum):
    info = "info"
    limit = "limit"
    defect = "defect"


class CommentCategoryEnum(str, Enum):
    low = "low"
    med = "med"
    high = "high"


class AnswerTypeEnum(str, Enum):
    text = "text"
    checkbox = "checkbox"
    date = "date"
    range = "range"
    boolean = "boolean"
    number = "number"


class WarningSeverityEnum(str, Enum):
    info = "info"
    warning = "warning"
    error = "error"


class DetectedTypeEnum(str, Enum):
    section = "section"
    item = "item"
    comment = "comment"
    unknown = "unknown"


class ValidationStatusEnum(str, Enum):
    valid = "valid"
    malformed = "malformed"
    partial = "partial"
    rejected = "rejected"
    unavailable = "unavailable"
