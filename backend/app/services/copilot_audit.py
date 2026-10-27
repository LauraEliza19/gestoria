import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories.copilot import CopilotRepository
from app.schemas.copilot import CopilotAuditWrite


def record_tool_audit(
    db: Session,
    *,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    entry: CopilotAuditWrite,
) -> None:
    try:
        entry = CopilotAuditWrite.model_validate(entry)
        CopilotRepository.write_tool_audit(
            db, organization_id=organization_id, user_id=user_id, entry=entry
        )
    except Exception:  # noqa: BLE001 -- fail closed without leaking plugin/DB errors
        db.rollback()
        # Fail closed if audit storage is unavailable. No successful result is
        # returned without a persisted event, and no internal error is exposed.
        raise HTTPException(
            503, "Auditoria indisponível. Tente novamente mais tarde."
        ) from None
