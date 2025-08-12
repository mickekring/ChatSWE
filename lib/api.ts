import { Message, UploadedFile } from './types'

export async function* streamMessage(messages: Message[], model: string, systemPrompt?: string, onFunctionCall?: (name: string, args: any) => void, documentChunks?: any[], mcpEnabled: boolean = true, uploadedFiles?: UploadedFile[]) {
  try {
    const formattedMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }))

    // Add system prompt if provided
    const messagesWithSystem = systemPrompt 
      ? [{ role: 'system' as const, content: systemPrompt }, ...formattedMessages]
      : formattedMessages

    // Get auth token from localStorage
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Add authorization header if token exists
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messagesWithSystem,
        model: model,
        documentChunks: documentChunks || [],
        mcpEnabled: mcpEnabled,
        uploadedFiles: uploadedFiles || []
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get response')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }
          try {
            const json = JSON.parse(data)
            if (json.function_call && onFunctionCall) {
              onFunctionCall(json.function_call.name, json.function_call.arguments)
            }
            if (json.content) {
              yield json.content
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Error streaming from API:', error)
    throw error
  }
}