import { useRef, useState } from 'react'

import { apiFetch } from '../../services/api'
import { COPILOT_HISTORY_KEY, WELCOME_MESSAGE } from './copilotData'
import type { CopilotChatResponse, CopilotMessage } from './copilotTypes'

const HISTORY_LIMIT = 8

function readStoredHistory(): string[] {
  const savedHistory = sessionStorage.getItem(COPILOT_HISTORY_KEY)

  if (!savedHistory) {
    return []
  }

  try {
    const parsedHistory: unknown = JSON.parse(savedHistory)

    if (!Array.isArray(parsedHistory)) {
      sessionStorage.removeItem(COPILOT_HISTORY_KEY)
      return []
    }

    return parsedHistory
      .filter((item): item is string => typeof item === 'string')
      .slice(0, HISTORY_LIMIT)
  } catch {
    sessionStorage.removeItem(COPILOT_HISTORY_KEY)
    return []
  }
}

function createMessage(
  role: CopilotMessage['role'],
  text: string,
  details: Partial<CopilotMessage> = {},
): CopilotMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    text,
    ...details,
  }
}

function responseToMessage(response: CopilotChatResponse): CopilotMessage {
  return {
    id: `assistant-${response.message_id}`,
    role: 'assistant',
    text: response.message,
    status: response.status,
    tool: response.tool,
    items: response.items,
    actions: response.actions,
    confirmation: response.confirmation,
  }
}

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>(readStoredHistory)
  const [sending, setSending] = useState(false)

  const requestInFlight = useRef(false)

  function newConversation() {
    if (requestInFlight.current) {
      return
    }

    setMessages([WELCOME_MESSAGE])
    setInput('')
  }

  function clearHistory() {
    setHistory([])
    sessionStorage.removeItem(COPILOT_HISTORY_KEY)
  }

  function rememberPrompt(text: string) {
    setHistory((current) => {
      const nextHistory = [text, ...current.filter((item) => item !== text)].slice(0, HISTORY_LIMIT)

      sessionStorage.setItem(COPILOT_HISTORY_KEY, JSON.stringify(nextHistory))

      return nextHistory
    })
  }

  async function requestMessage(
    text: string,
    options: {
      appendUserMessage: boolean
      removeErrorMessageId?: string
    },
  ) {
    if (requestInFlight.current) {
      return
    }

    requestInFlight.current = true
    setSending(true)
    setInput('')

    if (options.removeErrorMessageId) {
      setMessages((current) =>
        current.filter((message) => message.id !== options.removeErrorMessageId),
      )
    }

    if (options.appendUserMessage) {
      setMessages((current) => [...current, createMessage('user', text)])
      rememberPrompt(text)
    }

    try {
      const response = await apiFetch<CopilotChatResponse>('/api/copilot/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })

      setMessages((current) => [...current, responseToMessage(response)])
    } catch {
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          'Não foi possível consultar o Copiloto. Verifique sua conexão e tente novamente.',
          {
            retryPrompt: text,
          },
        ),
      ])
    } finally {
      requestInFlight.current = false
      setSending(false)
    }
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim()

    if (!text) {
      return
    }

    await requestMessage(text, {
      appendUserMessage: true,
    })
  }

  async function retryMessage(messageId: string, prompt: string) {
    const text = prompt.trim()

    if (!text) {
      return
    }

    await requestMessage(text, {
      appendUserMessage: false,
      removeErrorMessageId: messageId,
    })
  }

  return {
    messages,
    input,
    setInput,
    history,
    sending,
    newConversation,
    clearHistory,
    sendMessage,
    retryMessage,
  }
}
