from fastapi import APIRouter, HTTPException, Depends, status, Cookie, Header
from model import  CreateUser, ShowUser, User, DisplayUser
from pydantic import BaseModel
from database import get_session
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
from repo.user import get_user, add_user, all_users, update_user_theme
from fastapi.security import OAuth2PasswordBearer
from repo.auth_token import decode_access_token
from typing import Annotated, List
from model import ThemeUpdate
from repo.apikey import validate_api_key

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

router=APIRouter(
    prefix="/user",
    tags=["user"]
)






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


@router.post("/",response_model=ShowUser,status_code=status.HTTP_201_CREATED)
async def create(currentuser : Annotated[ShowUser,Depends(show_user_me)],user:CreateUser, session: AsyncSession=Depends(get_session)):  
    existing_user = await get_user(username=user.username,session=session)
    if currentuser.role !="admin" and currentuser.role !="superuser":
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="You are not permited")




    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    
    user_add=User(**user.model_dump())
    user_add.created_by=currentuser.id
    db_user=await add_user(user_add,session)
    return db_user


@router.get("/",response_model=List[DisplayUser])
async def show_users(currentuser : Annotated[ShowUser,Depends(show_user_me)],session:AsyncSession=Depends(get_session),skip:int=0,limit:int=20):
    if currentuser.role !="admin" and currentuser.role !="superuser":
        raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="You are not permited")
        
    else:
        users=await all_users(skip,limit,session=session)

    return users



@router.patch("/me/theme", response_model=ShowUser)
async def update_theme(theme_update: ThemeUpdate,currentuser: Annotated[ShowUser, Depends(show_user_me)],session: AsyncSession = Depends(get_session)):
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





    




