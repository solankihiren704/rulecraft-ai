import { apiClient } from './client'

export interface AiChatInput {
  message: string
  route?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}

export interface AiChatResponse {
  reply: string
  suggestedQuestions?: string[]
  citedRegulations?: string[]
  isAiGrounded: boolean
}

export async function askAi(input: AiChatInput): Promise<AiChatResponse> {
  const res = await apiClient.post<{ success: true; data: AiChatResponse }>('/ai/chat', input)
  return res.data.data
}
