from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status

IMAGE_DIR = Path(__file__).resolve().parent / "images"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
MAX_BYTES = 10 * 1024 * 1024


def ensure_image_dir() -> Path:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    return IMAGE_DIR


def public_image_path(filename: str) -> str:
    return f"/images/{filename}"


def disk_path_for(filename: str) -> Path:
    return IMAGE_DIR / filename


def _extension_for(upload: UploadFile) -> str:
    name = upload.filename or ""
    ext = Path(name).suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext
    content_type = (upload.content_type or "").lower()
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
    }
    if content_type in mapping:
        return mapping[content_type]
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported image type. Use jpg, png, gif, webp, or bmp.",
    )


async def save_upload(upload: UploadFile) -> str:
    """Save upload under a unique UUID filename. Returns the stored filename (unique image_url)."""
    ensure_image_dir()
    ext = _extension_for(upload)
    filename = f"{uuid4()}{ext}"
    destination = disk_path_for(filename)

    total = 0
    try:
        with destination.open("wb") as handle:
            while True:
                chunk = await upload.read(1024 * 64)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Image exceeds 10MB limit.",
                    )
                handle.write(chunk)
    except HTTPException:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image: {exc}",
        ) from exc
    finally:
        await upload.close()

    return filename


def delete_stored_file(image_url: str) -> None:
    """image_url may be a bare filename or /images/filename."""
    filename = os.path.basename(image_url or "")
    if not filename:
        return
    path = disk_path_for(filename)
    if path.exists() and path.is_file():
        path.unlink(missing_ok=True)
