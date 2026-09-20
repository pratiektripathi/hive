
from model import User
try:
    from sqlmodel.ext.asyncio import AsyncSession
except ImportError:
    from sqlmodel_compat import AsyncSession
from sqlmodel import select
from hashing import get_hash_pass, verify_pass


async def get_user(username:str, session: AsyncSession):
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return user


async def add_user(user:User, session: AsyncSession):
    user.password = get_hash_pass(user.password)
    db_user = User(**user.model_dump())
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user


async def verify_user(username:str, password:str, session: AsyncSession):
    user = await get_user(username=username, session=session)
    if not user:
        return False
    if not verify_pass(password, user.password):
        return False
    
    return user


async def update_user_theme(username: str, theme: str, session: AsyncSession):
    user = await get_user(username=username, session=session)
    if not user:
        raise ValueError("User not found")
    
    user.theme = theme
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user