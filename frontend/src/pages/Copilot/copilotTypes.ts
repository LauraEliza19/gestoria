export type CopilotMessageRole = 'user' | 'assistant'

export type CopilotMessage = {
  id: string
  role: CopilotMessageRole
  text: string
}

export type CopilotSuggestion = readonly [title: string, description: string, prompt: string]
