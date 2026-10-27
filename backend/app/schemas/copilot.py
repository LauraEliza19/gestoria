import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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


class CopilotDTO(BaseModel):
    """Internal values only: reject extra capabilities and revalidate instances."""

    model_config = ConfigDict(
        extra="forbid", frozen=True, revalidate_instances="always"
    )


class CopilotNoArguments(CopilotDTO):
    pass


class CopilotOrdersArguments(CopilotDTO):
    limit: int = Field(default=5, strict=True, ge=1, le=5)


class CopilotOrderResult(CopilotDTO):
    id: uuid.UUID
    customer_name: ShortText
    total_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    created_at: datetime


class CopilotOrdersResult(CopilotDTO):
    total: int = Field(strict=True, ge=0)
    orders: tuple[CopilotOrderResult, ...] = Field(max_length=5)

    @model_validator(mode="after")
    def validate_total(self):
        if len(self.orders) > self.total:
            raise ValueError("Quantidade de pedidos inconsistente.")
        return self


class CopilotProviderRequest(CopilotDTO):
    # Neither free-form prompts nor tenant, user, ORM or Session objects cross
    # the provider boundary. This MVP needs only an intent and an aggregate.
    intent: CopilotIntent
    order_count: int | None = Field(default=None, strict=True, ge=0)

    @model_validator(mode="after")
    def validate_order_count(self):
        if (self.intent == "orders_in_preparation") != (self.order_count is not None):
            raise ValueError("Contagem incompatível com a ferramenta.")
        return self


class CopilotProviderResponse(CopilotDTO):
    message: Message


EmployeeRecordOperation = Literal[
    "list", "create", "read", "update", "resolve", "cancel"
]
CopilotAuditToolName = (
    CopilotIntent
    | Literal[
        "employee_records.list",
        "employee_records.create",
        "employee_records.read",
        "employee_records.update",
        "employee_records.resolve",
        "employee_records.cancel",
    ]
)
CopilotAuditStatus = Literal["executed", "denied", "rate_limited", "error"]


class CopilotAuditWrite(CopilotDTO):
    question_id: CopilotIntent | None
    tool_name: CopilotAuditToolName
    input_payload: CopilotNoArguments | CopilotOrdersArguments
    status: CopilotAuditStatus
    execution_time_ms: int = Field(strict=True, ge=0, le=2147483647)

    @model_validator(mode="after")
    def validate_tool_payload(self):
        if self.tool_name.startswith("employee_records."):
            if self.question_id is not None:
                raise ValueError("Operação de gestão não recebe pergunta do Copiloto.")
        elif self.question_id != self.tool_name:
            raise ValueError("Pergunta e ferramenta inconsistentes.")
        expected = (
            CopilotOrdersArguments
            if self.tool_name == "orders_in_preparation"
            else CopilotNoArguments
        )
        if not isinstance(self.input_payload, expected):
            # Pydantic reports ValueError as a validation error; TypeError would
            # escape validation and break the safe audit boundary.
            raise ValueError("Argumentos incompatíveis com a ferramenta.")  # noqa: TRY004
        return self


class CopilotAuditRead(CopilotAuditWrite):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class CopilotAuditListArguments(CopilotDTO):
    limit: int = Field(default=50, strict=True, ge=1, le=100)


class CopilotRateLimitArguments(CopilotDTO):
    user_id: uuid.UUID
    window: int = Field(strict=True, ge=0)
