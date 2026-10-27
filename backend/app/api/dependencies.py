from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.copilot import (
    CopilotAuditWrite,
    CopilotNoArguments,
    EmployeeRecordOperation,
)
from app.services import AuthenticatedUser
from app.services.copilot_audit import record_tool_audit
from app.services.sessions import find_session, session_user

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DatabaseSession, request: Request) -> AuthenticatedUser:
    session = find_session(db, request.cookies.get(settings.session_cookie_name))
    return session_user(db, session)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def require_role(current: AuthenticatedUser, allowed: set[str]) -> None:
    if current.membership.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não possui permissão para executar essa ação.",
        )


def require_employee_record_access(
    db: Session,
    current: AuthenticatedUser,
    operation: EmployeeRecordOperation,
) -> None:
    try:
        require_role(current, {"owner", "admin"})
    except HTTPException:
        record_tool_audit(
            db,
            organization_id=current.organization.id,
            user_id=current.user.id,
            entry=CopilotAuditWrite(
                question_id=None,
                tool_name=f"employee_records.{operation}",
                input_payload=CopilotNoArguments(),
                status="denied",
                execution_time_ms=0,
            ),
        )
        raise


def require_finance_read(current: AuthenticatedUser) -> None:
    if current.membership.role not in {"owner", "admin"} and not (
        current.membership.role == "member"
        and current.membership.finance_access_approved
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O acesso de membro ao Financeiro precisa ser aprovado.",
        )


def require_finance_manage(current: AuthenticatedUser) -> None:
    require_role(current, {"owner", "admin"})
