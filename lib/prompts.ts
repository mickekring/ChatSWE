import axios from 'axios'

// NocoDB configuration
const NOCODB_API_URL = process.env.NOCODB_API_URL || 'https://nocodb.labbytan.se'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NOCODB_BASE_NAME = process.env.NOCODB_BASE_NAME || 'BergetGPT'
const PROMPTS_TABLE_NAME = 'prompts'

// Create axios instance with default config
const nocodb = axios.create({
  baseURL: `${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}`,
  headers: {
    'xc-token': NOCODB_API_TOKEN,
    'Content-Type': 'application/json'
  }
})

// Prompt interface
export interface Prompt {
  Id?: number
  id?: number
  user_id: number
  name: string
  content: string
  is_default: boolean
  created_at?: string
  updated_at?: string
}

// Get all prompts for a user
export async function getUserPrompts(userId: number): Promise<Prompt[]> {
  try {
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      },
      params: {
        where: `(user_id,eq,${userId})`,
        sort: '-is_default'
      }
    })
    
    const prompts = (response.data.list || []).map((prompt: any) => ({
      ...prompt,
      is_default: Boolean(prompt.is_default)
    }))
    return prompts
  } catch (error) {
    console.error('Error fetching user prompts:', error)
    return []
  }
}

// Get default prompt for a user
export async function getUserDefaultPrompt(userId: number): Promise<Prompt | null> {
  try {
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      },
      params: {
        where: `(user_id,eq,${userId})~and(is_default,eq,true)`
      }
    })
    const prompt = response.data.list[0] || null
    return prompt ? { ...prompt, is_default: Boolean(prompt.is_default) } : null
  } catch (error) {
    console.error('Error fetching default prompt:', error)
    return null
  }
}

// Get prompt by ID
export async function getPromptById(promptId: number): Promise<Prompt | null> {
  try {
    const response = await axios.get(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}/${promptId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    const prompt = response.data
    return prompt ? { ...prompt, is_default: Boolean(prompt.is_default) } : null
  } catch (error) {
    console.error('Error fetching prompt by ID:', error)
    return null
  }
}

// Create new prompt
export async function createPrompt(promptData: {
  userId: number
  name: string
  content: string
  isDefault?: boolean
}): Promise<Prompt | null> {
  try {
    const newPrompt = {
      user_id: promptData.userId,
      name: promptData.name,
      content: promptData.content,
      is_default: promptData.isDefault || false
    }
    
    const response = await axios.post(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}`, newPrompt, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    const prompt = response.data
    return prompt ? { ...prompt, is_default: Boolean(prompt.is_default) } : null
  } catch (error) {
    console.error('Error creating prompt:', error)
    return null
  }
}

// Update prompt
export async function updatePrompt(promptId: number, updates: Partial<Prompt>): Promise<Prompt | null> {
  try {
    const response = await axios.patch(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}/${promptId}`, updates, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    const prompt = response.data
    return prompt ? { ...prompt, is_default: Boolean(prompt.is_default) } : null
  } catch (error) {
    console.error('Error updating prompt:', error)
    return null
  }
}

// Delete prompt
export async function deletePrompt(promptId: number): Promise<boolean> {
  try {
    await axios.delete(`${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/${PROMPTS_TABLE_NAME}/${promptId}`, {
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    return true
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return false
  }
}

// Set prompt as default (unsets other defaults for the user)
export async function setDefaultPrompt(userId: number, promptId: number): Promise<boolean> {
  try {
    // First, unset all defaults for this user
    const userPrompts = await getUserPrompts(userId)
    for (const prompt of userPrompts) {
      if (prompt.is_default && (prompt.Id || prompt.id) !== promptId) {
        await updatePrompt(prompt.Id || prompt.id!, { is_default: false })
      }
    }
    
    // Then set the new default
    await updatePrompt(promptId, { is_default: true })
    return true
  } catch (error) {
    console.error('Error setting default prompt:', error)
    return false
  }
}