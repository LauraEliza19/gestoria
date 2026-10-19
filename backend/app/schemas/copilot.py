import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CopilotIntent = Literal[
    "daily_priorities",
    "orders_in_preparation",
    "critical_stock",
    "quotes_follow_up",
    "fiscal_attention",
    "production_availability",
    "sales_today",
    "top_customers",
    "active_employees",
    "cost_centers_summary",
    "unknown",
]
CopilotResponseStatus = Literal[
    "answered",
    "guided",
    "confirmation_required",
]
CopilotToolStatus = Literal["success", "empty", "error"]

Message = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=500,
    ),
]
ShortText = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=200,
    ),
]
InternalPath = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        pattern=r"^/",
        max_length=200,
    ),
]


class CopilotInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CopilotChatRequest(CopilotInput):
    message: Message


class CopilotToolRead(BaseModel):
    name: Literal["orders_in_preparation"]
    status: CopilotToolStatus


class CopilotItemRead(BaseModel):
    id: uuid.UUID
    title: ShortText
    description: ShortText
    path: InternalPath


class CopilotActionRead(BaseModel):
    id: ShortText
    label: ShortText
    path: InternalPath
    requires_confirmation: bool = False


class CopilotConfirmationRead(BaseModel):
    title: ShortText
    description: Message
    confirm_label: ShortText
    cancel_label: ShortText = "Cancelar"


class CopilotChatResponse(BaseModel):
    message_id: uuid.UUID
    status: CopilotResponseStatus
    intent: CopilotIntent
    message: Message
    tool: CopilotToolRead | None = None
    items: list[CopilotItemRead] = Field(default_factory=list)
    actions: list[CopilotActionRead] = Field(default_factory=list)
    confirmation: CopilotConfirmationRead | None = None
    generated_at: datetime
