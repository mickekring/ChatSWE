import axios from 'axios'

// NocoDB configuration - use defaults for client-side, actual values on server
const NOCODB_API_URL = process.env.NOCODB_API_URL || 'https://nocodb.labbytan.se'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NOCODB_BASE_NAME = process.env.NOCODB_BASE_NAME || 'BergetGPT'
const CONVERSATIONS_TABLE = 'conversations'
const MESSAGES_TABLE = 'messages'

// Interfaces
export interface Conversation {
  Id?: number
  id?: number
  user_id: number
  title: string
  model_used?: string
  prompt_used?: string
  message_count: number
  is_archived: boolean
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ChatMessage {
  Id?: number
  id?: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  model_used?: string
  prompt_used?: string
  metadata?: string // JSON string for function calls, files, etc.
  timestamp: string
  CreatedAt?: string
  UpdatedAt?: string
}

// Conversation functions
export async function getUserConversations(userId: number): Promise<Conversation[]> {
  try {
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      },
      params: {
        where: `(user_id,eq,${userId})`,
        sort: '-CreatedAt',
        limit: 50
      }
    })
    
    return response.data.list || []
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
}

export async function createConversation(conversationData: {
  userId: number
  title: string
  modelUsed?: string
  promptUsed?: string
}): Promise<Conversation | null> {
  try {
    const newConversation = {
      user_id: conversationData.userId,
      title: conversationData.title,
      model_used: conversationData.modelUsed || '',
      prompt_used: conversationData.promptUsed || '',
      message_count: 0,
      is_archived: false
    }
    
    const response = await axios.post(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}`, newConversation, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    return response.data
  } catch (error) {
    console.error('Error creating conversation:', error)
    return null
  }
}

export async function updateConversation(conversationId: number, updates: Partial<Conversation>): Promise<Conversation | null> {
  try {
    const response = await axios.patch(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, updates, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    return response.data
  } catch (error) {
    console.error('Error updating conversation:', error)
    return null
  }
}

export async function deleteConversation(conversationId: number): Promise<boolean> {
  try {
    // First delete all messages in the conversation
    await deleteConversationMessages(conversationId)
    
    // Then delete the conversation
    await axios.delete(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    return true
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return false
  }
}

// Message functions
export async function getConversationMessages(conversationId: number): Promise<ChatMessage[]> {
  try {
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${MESSAGES_TABLE}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      },
      params: {
        where: `(conversation_id,eq,${conversationId})`,
        sort: 'timestamp',
        limit: 1000
      }
    })
    
    return response.data.list || []
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

export async function createMessage(messageData: {
  conversationId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  modelUsed?: string
  promptUsed?: string
  metadata?: any
}): Promise<ChatMessage | null> {
  try {
    const newMessage = {
      conversation_id: messageData.conversationId,
      role: messageData.role,
      content: messageData.content,
      model_used: messageData.modelUsed || '',
      prompt_used: messageData.promptUsed || '',
      metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : '',
      timestamp: new Date().toISOString()
    }
    
    const response = await axios.post(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${MESSAGES_TABLE}`, newMessage, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    // Update conversation message count
    await incrementMessageCount(messageData.conversationId)
    
    return response.data
  } catch (error) {
    console.error('Error creating message:', error)
    return null
  }
}

export async function updateMessage(messageId: number, updates: Partial<ChatMessage>): Promise<ChatMessage | null> {
  try {
    const response = await axios.patch(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${MESSAGES_TABLE}/${messageId}`, updates, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    return response.data
  } catch (error) {
    console.error('Error updating message:', error)
    return null
  }
}

export async function deleteMessage(messageId: number, conversationId: number): Promise<boolean> {
  try {
    await axios.delete(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${MESSAGES_TABLE}/${messageId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    // Update conversation message count
    await decrementMessageCount(conversationId)
    
    return true
  } catch (error) {
    console.error('Error deleting message:', error)
    return false
  }
}

// Helper functions
async function deleteConversationMessages(conversationId: number): Promise<boolean> {
  try {
    const messages = await getConversationMessages(conversationId)
    for (const message of messages) {
      await axios.delete(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${MESSAGES_TABLE}/${message.Id || message.id}`, {
        headers: {
          'xc-token': NOCODB_API_TOKEN,
          'Content-Type': 'application/json'
        }
      })
    }
    return true
  } catch (error) {
    console.error('Error deleting conversation messages:', error)
    return false
  }
}

async function incrementMessageCount(conversationId: number): Promise<void> {
  try {
    // Get current conversation
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    const conversation = response.data
    const newCount = (conversation.message_count || 0) + 1
    
    await axios.patch(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, {
      message_count: newCount
    }, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error incrementing message count:', error)
  }
}

async function decrementMessageCount(conversationId: number): Promise<void> {
  try {
    // Get current conversation
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    const conversation = response.data
    const newCount = Math.max((conversation.message_count || 0) - 1, 0)
    
    await axios.patch(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${CONVERSATIONS_TABLE}/${conversationId}`, {
      message_count: newCount
    }, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error decrementing message count:', error)
  }
}

// Utility function to generate conversation title from first user message
export function generateConversationTitle(firstMessage: string): string {
  const maxLength = 50
  const cleanMessage = firstMessage.trim().replace(/\n+/g, ' ')
  
  if (cleanMessage.length <= maxLength) {
    return cleanMessage
  }
  
  // Try to cut at a word boundary
  const truncated = cleanMessage.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...'
  }
  
  return truncated + '...'
}