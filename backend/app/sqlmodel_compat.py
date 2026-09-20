"""
Compatibility module for SQLModel async support.
This module provides async components that SQLModel uses from SQLAlchemy,
allowing us to avoid direct SQLAlchemy imports in the rest of the codebase.
"""
# Re-export async components from SQLAlchemy
# SQLModel is built on SQLAlchemy, so we need these for async operations
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine
)

__all__ = [
    "AsyncSession",
    "create_async_engine", 
    "async_sessionmaker",
    "AsyncEngine"
]

