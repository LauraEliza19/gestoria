from pydantic import BaseModel, ConfigDict, Field, JsonValue


class OrderConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    envelope: dict[str, JsonValue] = Field(min_length=1, max_length=20)


class OrderProposalRead(BaseModel):
    operation_id: str
    status: str
    envelope: dict[str, JsonValue]


class OrderReceiptRead(BaseModel):
    verified: bool
    receipt: dict[str, JsonValue]
