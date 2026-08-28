import uuid

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

    model_config = ConfigDict(from_attributes=True)


class CurrentUserRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: str
    organization: OrganizationRead
