from fastapi import APIRouter, HTTPException, status, Response, Depends, Cookie
from fastapi.security import OAuth2PasswordRequestForm
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
from database import get_session
from repo.user import verify_user
from repo.auth_token import create_access_token, create_refresh_token, decode_access_token
from model import Token
from datetime import timedelta
import os
from dotenv import load_dotenv
from typing import Annotated

load_dotenv()

ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

router = APIRouter(
    prefix="/login",
    tags=["login"]
)


def issue_auth_tokens(response: Response, username: str) -> Token:
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires
    )

    refresh_token_expires = timedelta(days=30)
    refresh_token = create_refresh_token(
        data={"sub": username},
        expires_delta=refresh_token_expires
    )

    is_development = ENVIRONMENT.lower() == "development"
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none" if is_development else "lax",
        max_age=30 * 24 * 60 * 60,
        path="/",
        domain=None,
    )

    return Token(access_token=access_token, token_type="bearer")


@router.post("/")
async def login(response: Response, login_form: Annotated[OAuth2PasswordRequestForm, Depends()], session: AsyncSession = Depends(get_session)):
    user = await verify_user(login_form.username, login_form.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return issue_auth_tokens(response, user.username)


@router.post("/refresh")
async def refresh_token(response: Response, refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = decode_access_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires
    )

    return Token(access_token=access_token, token_type="bearer")


logout_router = APIRouter(
    prefix="/logout",
    tags=["logout"]
)


@logout_router.post("/")
async def logout(response: Response):
    is_development = ENVIRONMENT.lower() == "development"
    response.delete_cookie(
        key="refresh_token",
        path="/",
        secure=True,
        samesite="none" if is_development else "lax",
        domain=None,
        httponly=True,
    )
    return {"message": "Successfully logged out"}
