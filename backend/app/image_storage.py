from __future__ import annotations

import mimetypes
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional
from uuid import uuid4
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile, status

IMAGE_DIR = Path(__file__).resolve().parent / "images"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
MAX_BYTES = 10 * 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 30
USER_AGENT = "HiveTemplateImporter/1.0"


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


def _extension_from_url_and_type(url: str, content_type: Optional[str]) -> str:
    path = urlparse(url).path or ""
    ext = Path(path).suffix.lower()
    if ext in ALLOWED_EXTENSIONS:
        return ext
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guessed == ".jpe":
            guessed = ".jpg"
        if guessed and guessed.lower() in ALLOWED_EXTENSIONS:
            return guessed.lower()
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
    }
    if content_type:
        ctype = content_type.split(";")[0].strip().lower()
        if ctype in mapping:
            return mapping[ctype]
    return ".jpg"


def save_bytes(data: bytes, extension: str = ".jpg") -> str:
    """Persist raw image bytes. Returns stored filename (unique image_url)."""
    ensure_image_dir()
    ext = extension.lower() if extension.startswith(".") else f".{extension.lower()}"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    if len(data) > MAX_BYTES:
        raise ValueError("Image exceeds 10MB limit.")
    if not data:
        raise ValueError("Downloaded image is empty.")
    filename = f"{uuid4()}{ext}"
    destination = disk_path_for(filename)
    destination.write_bytes(data)
    return filename


def download_image_from_url(url: str) -> str:
    """
    Download a remote image and store it under IMAGE_DIR.
    Returns the stored filename to use as image_url.
    Raises ValueError on failure.
    """
    cleaned = (url or "").strip()
    if not cleaned:
        raise ValueError("Image URL is empty.")
    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported image URL scheme: {parsed.scheme or '(none)'}")

    request = urllib.request.Request(
        cleaned,
        headers={"User-Agent": USER_AGENT},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type")
            data = response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise ValueError(f"HTTP {exc.code} downloading image") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"Network error downloading image: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ValueError("Timed out downloading image") from exc

    if len(data) > MAX_BYTES:
        raise ValueError("Image exceeds 10MB limit.")

    ext = _extension_from_url_and_type(cleaned, content_type)
    return save_bytes(data, ext)


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
    if not filename or filename.startswith("import:"):
        return
    path = disk_path_for(filename)
    if path.exists() and path.is_file():
        path.unlink(missing_ok=True)
