from fastapi import APIRouter, HTTPException, Depends, status, Header, Response
from model import CreateUser, ShowUser, User
from database import get_session
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
from repo.user import get_user, add_user, update_user_theme
from fastapi.security import OAuth2PasswordBearer
from repo.auth_token import decode_access_token
from typing import Annotated
from model import ThemeUpdate, Token
from repo.apikey import validate_api_key
from .token import issue_auth_tokens

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

router = APIRouter(
    prefix="/user",
    tags=["user"]
)

signup_router = APIRouter(
    prefix="/signup",
    tags=["signup"]
)


@signup_router.post("/", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(user: CreateUser, response: Response, session: AsyncSession = Depends(get_session)):
    existing_user = await get_user(username=user.username, session=session)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    user_add = User(**user.model_dump())
    db_user = await add_user(user_add, session)
    return issue_auth_tokens(response, db_user.username)


@router.get("/me", response_model=ShowUser)
async def show_user_me(
    token: Annotated[str, Depends(oauth2_scheme)],
    api_key: Annotated[str | None, Header(alias="x-api-key")] = None,
    session: AsyncSession = Depends(get_session)
):
    if not token and not api_key:
        raise HTTPException(status_code=401, detail="Token or API key missing")

    username = None

    if token:
        try:
            payload = decode_access_token(token=token)
            username = payload.get("sub")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

    if api_key:
        api_key_obj = await validate_api_key(api_key=api_key, session=session)
        username = api_key_obj.user.username

    if not username:
        raise HTTPException(status_code=401, detail="Unable to determine user identity")

    user = await get_user(username=username, session=session)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.patch("/me/theme", response_model=ShowUser)
async def update_theme(theme_update: ThemeUpdate, currentuser: Annotated[ShowUser, Depends(show_user_me)], session: AsyncSession = Depends(get_session)):
    if theme_update.theme not in ["light", "dark"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Theme must be 'light' or 'dark'"
        )

    try:
        updated_user = await update_user_theme(
            username=currentuser.username,
            theme=theme_update.theme,
            session=session
        )
        return updated_user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update theme: {str(e)}"
        )
