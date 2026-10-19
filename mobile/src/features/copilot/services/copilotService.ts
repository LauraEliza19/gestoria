import { apiFetch } from '@/services/api';

import type { CopilotChatResponse } from '../copilotTypes';

export function sendCopilotMessage(message: string) {
  return apiFetch<CopilotChatResponse>('/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}