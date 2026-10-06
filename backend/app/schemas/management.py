import re
import uuid
from datetime import UTC, date, datetime
from typing import Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.common import Money, normalize_phone


def normalize_employee_document(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = re.sub(r"[^A-Za-z0-9]", "", value).upper()

    if not 5 <= len(normalized) <= 18:
        raise ValueError("O documento deve conter entre 5 e 18 caracteres.")

    return normalized


class CostCenterCreate(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.upper()


class CostCenterUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None


class CostCenterRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeCreate(BaseModel):
    user_id: uuid.UUID | None = None
    full_name: str = Field(min_length=1, max_length=120)
    document: str | None = Field(default=None, max_length=18)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("document")
    @classmethod
    def normalize_document(cls, value: str | None) -> str | None:
        return normalize_employee_document(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        return str(value).lower() if value is not None else None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value is not None else None

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: date | None) -> date | None:
        if value is not None and value > datetime.now(UTC).date():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        return value


class EmployeeUpdate(BaseModel):
    user_id: uuid.UUID | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    document: str | None = Field(default=None, max_length=18)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    is_active: bool | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("document")
    @classmethod
    def normalize_document(cls, value: str | None) -> str | None:
        return normalize_employee_document(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        return str(value).lower() if value is not None else None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value is not None else None

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: date | None) -> date | None:
        if value is not None and value > datetime.now(UTC).date():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        return value


class EmployeeSummaryRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeRead(EmployeeSummaryRead):
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    document: str | None
    birth_date: date | None


EmploymentType = Literal[
    "employee",
    "contractor",
    "intern",
    "temporary",
    "partner",
    "other",
]

EmploymentStatus = Literal[
    "active",
    "on_leave",
    "ended",
]


class EmploymentCreate(BaseModel):
    cost_center_id: uuid.UUID | None = None
    position_title: str = Field(min_length=1, max_length=120)
    employment_type: EmploymentType = "employee"
    status: EmploymentStatus = "active"
    started_at: date
    ended_at: date | None = None
    base_salary: Money | None = None
    notes: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_employment_state(self) -> Self:
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("A data de desligamento não pode ser anterior à admissão.")

        if self.status == "ended" and self.ended_at is None:
            raise ValueError("Um vínculo encerrado deve possuir data de desligamento.")

        if self.status != "ended" and self.ended_at is not None:
            raise ValueError(
                "Somente um vínculo encerrado pode possuir data de desligamento."
            )

        return self


class EmploymentUpdate(BaseModel):
    cost_center_id: uuid.UUID | None = None
    position_title: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )
    employment_type: EmploymentType | None = None
    status: EmploymentStatus | None = None
    started_at: date | None = None
    ended_at: date | None = None
    base_salary: Money | None = None
    notes: str | None = Field(default=None, max_length=1000)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_provided_dates(self) -> Self:
        if (
            self.started_at is not None
            and self.ended_at is not None
            and self.ended_at < self.started_at
        ):
            raise ValueError("A data de desligamento não pode ser anterior à admissão.")

        return self


class EmploymentRead(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    employee_id: uuid.UUID
    cost_center_id: uuid.UUID | None
    position_title: str
    employment_type: EmploymentType
    status: EmploymentStatus
    started_at: date
    ended_at: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmploymentCompensationRead(EmploymentRead):
    base_salary: Money | None


EmployeeRecordType = Literal[
    "warning",
    "incident",
    "commendation",
    "note",
]

EmployeeRecordSeverity = Literal[
    "informational",
    "low",
    "medium",
    "high",
]

EmployeeRecordStatus = Literal[
    "open",
    "resolved",
    "cancelled",
]


def normalize_employee_record_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("A data da ocorrência deve possuir fuso horário.")

    normalized = value.astimezone(UTC)

    if normalized > datetime.now(UTC):
        raise ValueError("A data da ocorrência não pode estar no futuro.")

    return normalized


class EmployeeRecordCreate(BaseModel):
    record_type: EmployeeRecordType
    severity: EmployeeRecordSeverity = "informational"
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=4000)
    occurred_at: datetime

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value: datetime) -> datetime:
        return normalize_employee_record_datetime(value)


class EmployeeRecordUpdate(BaseModel):
    record_type: EmployeeRecordType | None = None
    severity: EmployeeRecordSeverity | None = None
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=160,
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=4000,
    )
    occurred_at: datetime | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        if value is None:
            return None

        return normalize_employee_record_datetime(value)

    @model_validator(mode="after")
    def validate_changes(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualização.")

        return self


class EmployeeRecordResolve(BaseModel):
    resolution_notes: str = Field(min_length=1, max_length=4000)

    model_config = ConfigDict(str_strip_whitespace=True)


class EmployeeRecordCancel(BaseModel):
    cancellation_reason: str = Field(min_length=3, max_length=500)

    model_config = ConfigDict(str_strip_whitespace=True)


class EmployeeRecordSummaryRead(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    record_type: EmployeeRecordType
    severity: EmployeeRecordSeverity
    status: EmployeeRecordStatus
    title: str
    occurred_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeRecordRead(EmployeeRecordSummaryRead):
    organization_id: uuid.UUID
    recorded_by_id: uuid.UUID
    updated_by_id: uuid.UUID
    resolved_by_id: uuid.UUID | None
    cancelled_by_id: uuid.UUID | None
    description: str
    resolution_notes: str | None
    cancellation_reason: str | None
    resolved_at: datetime | None
    cancelled_at: datetime | None


class ManagementOverviewRead(BaseModel):
    total_employees: int = Field(ge=0)
    active_employees: int = Field(ge=0)
    active_cost_centers: int = Field(ge=0)
    active_employments: int = Field(ge=0)
    employees_on_leave: int = Field(ge=0)
