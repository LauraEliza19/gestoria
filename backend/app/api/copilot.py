from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DatabaseSession
from app.schemas import CopilotChatRequest, CopilotChatResponse
from app.services import answer_copilot

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
) -> CopilotChatResponse:
    return answer_copilot(
        db,
        current.organization.id,
        current.membership.role,
        payload.message,
    )
