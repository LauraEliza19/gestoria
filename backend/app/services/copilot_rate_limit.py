import time
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.repositories.copilot import CopilotRepository
from app.schemas.copilot import CopilotRateLimitArguments


def consume_copilot_request(
    db: Session, *, organization_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    now = int(time.time())
    window_seconds = settings.copilot_rate_limit_window_seconds
    attempts = CopilotRepository.consume_rate_limit(
        db,
        organization_id=organization_id,
        arguments=CopilotRateLimitArguments(
            user_id=user_id, window=now // window_seconds
        ),
    )
    if attempts > settings.copilot_rate_limit_max_requests:
        raise HTTPException(
            429,
            "Muitas solicitações ao Copiloto. Aguarde e tente novamente.",
            headers={"Retry-After": str(window_seconds - now % window_seconds)},
        )
