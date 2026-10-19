export type CopilotMessageRole = 'user' | 'assistant'

export type CopilotIntent =
  | 'daily_priorities'
  | 'orders_in_preparation'
  | 'critical_stock'
  | 'quotes_follow_up'
  | 'fiscal_attention'
  | 'production_availability'
  | 'sales_today'
  | 'top_customers'
  | 'active_employees'
  | 'cost_centers_summary'
  | 'unknown'

export type CopilotResponseStatus = 'answered' | 'guided' | 'confirmation_required'

export type CopilotToolStatus = 'success' | 'empty' | 'error'

export type CopilotTool = {
  name: 'orders_in_preparation'
  status: CopilotToolStatus
}

export type CopilotItem = {
  id: string
  title: string
  description: string
  path: string
}

export type CopilotAction = {
  id: string
  label: string
  path: string
  requires_confirmation: boolean
}

export type CopilotConfirmation = {
  title: string
  description: string
  confirm_label: string
  cancel_label: string
}

export type CopilotChatResponse = {
  message_id: string
  status: CopilotResponseStatus
  intent: CopilotIntent
  message: string
  tool: CopilotTool | null
  items: CopilotItem[]
  actions: CopilotAction[]
  confirmation: CopilotConfirmation | null
  generated_at: string
}

export type CopilotMessage = {
  id: string
  role: CopilotMessageRole
  text: string
  status?: CopilotResponseStatus
  tool?: CopilotTool | null
  items?: CopilotItem[]
  actions?: CopilotAction[]
  confirmation?: CopilotConfirmation | null
  retryPrompt?: string
}

export type CopilotSuggestion = readonly [title: string, description: string, prompt: string]
