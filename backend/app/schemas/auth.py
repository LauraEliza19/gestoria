import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    document: str | None
    state_registration: str | None
    municipal_registration: str | None
    phone: str | None
    postal_code: str | None
    street: str | None
    number: str | None
    complement: str | None
    neighborhood: str | None
    city: str | None
    state: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    document: str | None = Field(default=None, max_length=18)
    state_registration: str | None = Field(default=None, max_length=30)
    municipal_registration: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)
    postal_code: str | None = Field(default=None, max_length=9)
    street: str | None = Field(default=None, max_length=160)
    number: str | None = Field(default=None, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=2)

    model_config = ConfigDict(str_strip_whitespace=True)


class CurrentUserRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: str
    organization: OrganizationRead