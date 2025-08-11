// Legacy message interface (still used in ChatInterface for in-memory state)
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolCalls?: {
    name: string
    args: any
    status: 'calling' | 'completed'
  }[]
}

// Legacy conversation interface (keeping for compatibility)
export interface Conversation {
  id: string
  title: string
  createdAt: Date
  messages: Message[]
}

export interface Model {
  id: string
  name: string
  description?: string
  capabilities?: string[]
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  content: string
}

export interface DocumentChunk {
  id: string
  content: string
  embedding?: number[]
  metadata: {
    filename: string
    chunkIndex: number
    totalChunks: number
  }
}