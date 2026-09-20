from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, DateTime
from typing import Optional
from datetime import datetime, timezone
from enums import ThemeEnum


class ApiKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    key: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
    user: Optional["User"] = Relationship(back_populates=None)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    firstname: str
    lastname: str
    username: str = Field(unique=True, index=True)
    password: str
    phone: Optional[str] = None
    theme: ThemeEnum = Field(default=ThemeEnum.light)
    isEnable: bool = Field(default=True)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )


class DisplayUser(SQLModel):
    id: Optional[int]
    firstname: str
    lastname: str
    username: str
    theme: ThemeEnum
    isEnable: bool
    created_by: Optional[int]
    created_at: datetime


class CreateUser(SQLModel):
    firstname: str
    lastname: str
    username: str
    password: str = Field(min_length=8)


class ShowUser(SQLModel):
    id: int
    firstname: str
    lastname: str
    username: str
    theme: ThemeEnum


class ThemeUpdate(SQLModel):
    theme: str


class Token(SQLModel):
    access_token: str
    token_type: str


class TokenData(SQLModel):
    username: str
