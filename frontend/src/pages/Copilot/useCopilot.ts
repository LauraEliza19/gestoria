import { useRef, useState } from 'react'
import { apiFetch } from '../../services/api'
import { COPILOT_HISTORY_KEY, WELCOME_MESSAGE } from './copilotData'
import type { CopilotMessage } from './copilotTypes'

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

function createMessage(role: CopilotMessage['role'], text: string): CopilotMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    text,
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

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim()

    if (!text || requestInFlight.current) {
      return
    }

    requestInFlight.current = true
    setSending(true)
    setInput('')

    setMessages((current) => [...current, createMessage('user', text)])

    setHistory((current) => {
      const nextHistory = [text, ...current.filter((item) => item !== text)].slice(0, HISTORY_LIMIT)

      sessionStorage.setItem(COPILOT_HISTORY_KEY, JSON.stringify(nextHistory))

      return nextHistory
    })

    try {
      const response = await apiFetch<{ message: string }>('/api/copilot/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })

      setMessages((current) => [...current, createMessage('assistant', response.message)])
    } catch {
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          'A API de conversa ainda não foi configurada. Você pode continuar usando os módulos manuais abaixo.',
        ),
      ])
    } finally {
      requestInFlight.current = false
      setSending(false)
    }
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
  }
}
