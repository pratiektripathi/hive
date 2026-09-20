from model import ApiKey
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
import secrets
from datetime import timedelta, datetime, timezone
from fastapi import HTTPException, status
from typing import List
from sqlmodel import select
from model import User



def generate_api_key() -> str:
    return secrets.token_hex(32) 


async def add_api_key(user_id: int, session: AsyncSession) -> ApiKey:
    api_key = ApiKey(user_id=user_id, key=generate_api_key())
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    return api_key  


async def read_api_keys(session: AsyncSession) -> List[ApiKey]:
    result = await session.execute(select(ApiKey))
    return result.scalars().all()

async def remove_api_key(api_key_id: int, session: AsyncSession):
    result = await session.execute(select(ApiKey).where(ApiKey.id == api_key_id))
    api_key = result.scalar_one_or_none()
    if api_key:
        await session.delete(api_key)
        await session.commit()


async def validate_api_key(api_key: str, session: AsyncSession) -> ApiKey:
    result = await session.execute(select(ApiKey).where(ApiKey.key == api_key))
    api_key_obj = result.scalar_one_or_none()
    if not api_key_obj:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    
    # Then get the user separately and attach it
    user_result = await session.execute(select(User).where(User.id == api_key_obj.user_id))
    user_obj = user_result.scalar_one_or_none()
    if user_obj:
        api_key_obj.user = user_obj
    
    return api_key_obj
