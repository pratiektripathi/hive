from fastapi import APIRouter, Depends, status, HTTPException
from model import ShowUser
from database import get_session
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
from typing import Annotated, List
from .user import show_user_me
from repo.apikey import add_api_key, validate_api_key, remove_api_key, read_api_keys
from model import ApiKey


router = APIRouter(prefix="/apikey", tags=["apikey"])

@router.post("/create", response_model=ApiKey, status_code=status.HTTP_201_CREATED)
async def create_api_key(currentuser: Annotated[ShowUser, Depends(show_user_me)], session: AsyncSession = Depends(get_session)):
    if currentuser.role != "admin" and currentuser.role != "superuser":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to create API keys")
    api_key = await add_api_key(currentuser.id, session)
    return api_key


@router.get("/", response_model=List[ApiKey])
async def get_api_keys(currentuser: Annotated[ShowUser, Depends(show_user_me)], session: AsyncSession = Depends(get_session)):
    if currentuser.role != "admin" and currentuser.role != "superuser":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to get API keys")
    api_keys = await read_api_keys(session)
    return api_keys


@router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(api_key_id: int, currentuser: Annotated[ShowUser, Depends(show_user_me)], session: AsyncSession = Depends(get_session)):
    if currentuser.role != "admin" and currentuser.role != "superuser":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete API keys")
    await remove_api_key(api_key_id, session)
    return {"message": "API key deleted successfully"}


