from __future__ import annotations

from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import get_session
from enums import ImportMethodEnum
from imports.ai_suggest import suggest_import_mappings
from imports.apply import apply_import
from imports.mapping import (
    IMPORT_FIELDS,
    RECOMMENDATION_VALUES,
    build_suggested_mappings,
    build_suggested_recommendation_mappings,
    extract_recommendation_values,
)
from imports.parser import parse_spreadsheet
from imports.session_cache import session_store
from model import ShowUser
from routers.user import show_user_me

try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession


router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 40 * 1024 * 1024


class ImportFieldOut(BaseModel):
    key: str
    label: str
    group: str


class ColumnMappingIn(BaseModel):
    sourceColumn: str
    mapsTo: Optional[str] = None


class RecommendationMappingIn(BaseModel):
    sourceValue: str
    mapsTo: Optional[str] = None


class ApplyImportRequest(BaseModel):
    importSessionId: str
    mappings: List[ColumnMappingIn] = Field(default_factory=list)
    recommendationMappings: List[RecommendationMappingIn] = Field(default_factory=list)
    templateName: str = Field(min_length=1)
    description: Optional[str] = None
    importMethod: Optional[str] = None


class AiSuggestRequest(BaseModel):
    importSessionId: str


@router.get("/fields", response_model=List[ImportFieldOut])
async def list_import_fields(
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
):
    _ = currentuser
    return IMPORT_FIELDS


@router.get("/recommendations")
async def list_recommendation_options(
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
):
    _ = currentuser
    return {"values": RECOMMENDATION_VALUES}


@router.post("/parse")
async def parse_import_file(
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    file: UploadFile = File(...),
):
    filename = file.filename or "upload.csv"
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File is too large (max 40MB).",
        )

    try:
        parsed = parse_spreadsheet(content, filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {exc}",
        ) from exc

    session = session_store.put(currentuser.id, parsed)
    suggested = build_suggested_mappings(parsed.headers)
    recommendation_values = extract_recommendation_values(parsed.headers, parsed.rows)
    suggested_recommendations = build_suggested_recommendation_mappings(
        recommendation_values
    )

    return {
        "importSessionId": session.id,
        "sourceFileName": parsed.source_file_name,
        "headers": parsed.headers,
        "samples": parsed.samples,
        "stats": parsed.stats,
        "suggestedMappings": suggested,
        "recommendationValues": recommendation_values,
        "suggestedRecommendationMappings": suggested_recommendations,
    }


@router.post("/ai-suggest")
async def ai_suggest_mappings(
    payload: AiSuggestRequest,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
):
    import_session = session_store.get(payload.importSessionId, currentuser.id)
    if not import_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import session expired or not found. Please upload the file again.",
        )

    result = suggest_import_mappings(import_session.parsed)
    session_store.set_ai_suggest(payload.importSessionId, currentuser.id, result)
    return {
        "importSessionId": payload.importSessionId,
        "suggestedMappings": result["columnMappings"],
        "suggestedRecommendationMappings": result["recommendationMappings"],
        "sectionIconHints": result.get("sectionIconHints") or {},
        "status": result["status"],
        "modelName": result.get("modelName"),
        "promptVersion": result.get("promptVersion"),
        "reasoningSummary": result.get("reasoningSummary"),
        "usedAi": bool(result.get("usedAi")),
    }


def _resolve_import_method(
    raw: Optional[str], ai_suggest: Optional[dict[str, Any]]
) -> ImportMethodEnum:
    if not raw:
        return ImportMethodEnum.parser
    normalized = raw.strip().lower()
    if normalized == "ai":
        if ai_suggest and ai_suggest.get("usedAi"):
            return ImportMethodEnum.ai
        return ImportMethodEnum.hybrid
    if normalized == "hybrid":
        return ImportMethodEnum.hybrid
    if normalized == "parser":
        return ImportMethodEnum.parser
    try:
        return ImportMethodEnum(normalized)
    except ValueError:
        return ImportMethodEnum.parser


@router.post("/apply")
async def apply_import_file(
    payload: ApplyImportRequest,
    currentuser: Annotated[ShowUser, Depends(show_user_me)],
    session: AsyncSession = Depends(get_session),
):
    import_session = session_store.get(payload.importSessionId, currentuser.id)
    if not import_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import session expired or not found. Please upload the file again.",
        )

    mappings: list[dict[str, Any]] = [
        {"sourceColumn": m.sourceColumn, "mapsTo": m.mapsTo} for m in payload.mappings
    ]
    recommendation_mappings: list[dict[str, Any]] = [
        {"sourceValue": m.sourceValue, "mapsTo": m.mapsTo}
        for m in payload.recommendationMappings
    ]

    ai_suggest = import_session.ai_suggest
    import_method = _resolve_import_method(payload.importMethod, ai_suggest)
    section_icon_hints: dict[str, str] = {}
    if ai_suggest and isinstance(ai_suggest.get("sectionIconHints"), dict):
        section_icon_hints = {
            str(k): str(v)
            for k, v in ai_suggest["sectionIconHints"].items()
            if k and v
        }

    try:
        result = await apply_import(
            user_id=currentuser.id,
            parsed=import_session.parsed,
            mappings=mappings,
            template_name=payload.templateName,
            description=payload.description,
            session=session,
            recommendation_mappings=recommendation_mappings,
            import_method=import_method,
            section_icon_hints=section_icon_hints,
            ai_run=ai_suggest,
        )
    except HTTPException:
        raise
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import could not be saved due to a data constraint: {exc.orig}",
        ) from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed while saving to the database: {exc}",
        ) from exc
    except Exception as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {exc}",
        ) from exc

    session_store.pop(payload.importSessionId, currentuser.id)
    return result
