import { useRef, useState } from 'react';

import { COPILOT_SUGGESTIONS, WELCOME_MESSAGE } from './copilotData';
import type {
  CopilotChatResponse,
  CopilotMessage,
} from './copilotTypes';
import { sendCopilotMessage } from './services/copilotService';

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function responseToMessage(
  response: CopilotChatResponse
): CopilotMessage {
  return {
    id: `assistant-${response.message_id}`,
    role: 'assistant',
    text: response.message,
    status: response.status,
    tool: response.tool,
    items: response.items,
    actions: response.actions,
    confirmation: response.confirmation,
  };
}

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    WELCOME_MESSAGE,
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const requestInFlight = useRef(false);

  function newConversation() {
    if (requestInFlight.current) {
      return;
    }

    setMessages([WELCOME_MESSAGE]);
    setInput('');
  }

  async function requestMessage(
    text: string,
    options: {
      appendUserMessage: boolean;
      removeErrorMessageId?: string;
    }
  ) {
    if (requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setSending(true);
    setInput('');

    if (options.removeErrorMessageId) {
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !== options.removeErrorMessageId
        )
      );
    }

    if (options.appendUserMessage) {
      setMessages((current) => [
        ...current,
        {
          id: createLocalId('user'),
          role: 'user',
          text,
        },
      ]);
    }

    try {
      const response = await sendCopilotMessage(text);

      setMessages((current) => [
        ...current,
        responseToMessage(response),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createLocalId('assistant-error'),
          role: 'assistant',
          text:
            'Não foi possível consultar o Copiloto. Verifique sua conexão e tente novamente.',
          retryPrompt: text,
        },
      ]);
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();

    if (!text) {
      return;
    }

    await requestMessage(text, {
      appendUserMessage: true,
    });
  }

  async function retryMessage(
    messageId: string,
    prompt: string
  ) {
    const text = prompt.trim();

    if (!text) {
      return;
    }

    await requestMessage(text, {
      appendUserMessage: false,
      removeErrorMessageId: messageId,
    });
  }

  return {
    suggestions: COPILOT_SUGGESTIONS,
    messages,
    input,
    setInput,
    sending,
    newConversation,
    sendMessage,
    retryMessage,
  };
}