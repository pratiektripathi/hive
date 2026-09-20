from sqlmodel import SQLModel
# Use compatibility module to avoid direct SQLAlchemy imports
# SQLModel is built on SQLAlchemy, so we use this wrapper
try:
    from sqlmodel.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
except ImportError:
    # Fallback: SQLModel may not have ext.asyncio in older versions
    # Import from our compatibility module which wraps SQLAlchemy
    from sqlmodel_compat import AsyncSession, create_async_engine, async_sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# Compose may pass psycopg; this app uses asyncpg
for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://", "postgresql://"):
    if DATABASE_URL.startswith(prefix):
        DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len(prefix):]
        break

engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def create_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session():
    async with async_session_maker() as session:
        yield session





