from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import CurrentUser, DatabaseSession
from app.schemas import CopilotChatRequest, CopilotChatResponse
from app.services import answer_copilot
from app.services.copilot_provider import CopilotAIProvider, get_copilot_provider

router = APIRouter(
    prefix="/api/copilot",
    tags=["copilot"],
)


@router.post(
    "/chat",
    response_model=CopilotChatResponse,
)
def chat(
    payload: CopilotChatRequest,
    db: DatabaseSession,
    current: CurrentUser,
    provider: Annotated[CopilotAIProvider, Depends(get_copilot_provider)],
) -> CopilotChatResponse:
    return answer_copilot(
        db,
        current.organization.id,
        current.membership.role,
        payload.message,
        user_id=current.user.id,
        provider=provider,
    )
