export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIToolCall {
  name: string
  arguments: Record<string, unknown>
}

export interface AIResponse {
  content: string | null
  toolCall: AIToolCall | null
}

export interface AIToolParameter {
  type: string
  properties: Record<string, unknown>
  required?: string[]
}

export interface AITool {
  name: string
  description: string
  parameters: AIToolParameter
}

export interface AIProvider {
  chat(messages: AIMessage[], tools?: AITool[]): Promise<AIResponse>
}
