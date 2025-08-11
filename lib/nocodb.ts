import axios from 'axios'
import bcrypt from 'bcryptjs'

// NocoDB configuration
const NOCODB_API_URL = process.env.NOCODB_API_URL || 'https://nocodb.labbytan.se'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NOCODB_BASE_NAME = process.env.NOCODB_BASE_NAME || 'BergetGPT'
const USERS_TABLE_NAME = 'users'

// Create axios instance with default config
const nocodb = axios.create({
  baseURL: `${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}`,
  headers: {
    'xc-token': NOCODB_API_TOKEN,
    'Content-Type': 'application/json'
  }
})

// User interface
export interface User {
  id?: string
  username: string
  password_hash?: string
  email?: string
  first_name?: string
  last_name?: string
  system_prompt?: string
  theme?: string
  language?: string
  created_at?: Date
  updated_at?: Date
}

// Get all users
export async function getUsers(): Promise<User[]> {
  try {
    const response = await nocodb.get(`/${USERS_TABLE_NAME}`)
    return response.data.list
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

// Get user by username
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const response = await nocodb.get(`/${USERS_TABLE_NAME}`, {
      params: {
        where: `(username,eq,${username})`
      }
    })
    return response.data.list[0] || null
  } catch (error) {
    console.error('Error fetching user by username:', error)
    return null
  }
}

// Create new user
export async function createUser(userData: {
  username: string
  password: string
  email?: string
  first_name?: string
  last_name?: string
}): Promise<User | null> {
  try {
    // Hash the password
    const password_hash = await bcrypt.hash(userData.password, 10)
    
    const newUser = {
      username: userData.username,
      password_hash,
      email: userData.email || '',
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      system_prompt: '',
      theme: 'light',
      language: 'sv',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const response = await nocodb.post(`/${USERS_TABLE_NAME}`, newUser)
    return response.data
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

// Verify user password
export async function verifyPassword(username: string, password: string): Promise<boolean> {
  try {
    const user = await getUserByUsername(username)
    if (!user || !user.password_hash) return false
    
    return await bcrypt.compare(password, user.password_hash)
  } catch (error) {
    console.error('Error verifying password:', error)
    return false
  }
}

// Update user
export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  try {
    // Remove password_hash from updates if present (shouldn't be updated directly)
    const { password_hash, ...safeUpdates } = updates
    
    const updateData = {
      ...safeUpdates,
      updated_at: new Date().toISOString()
    }
    
    const response = await nocodb.patch(`/${USERS_TABLE_NAME}/${userId}`, updateData)
    return response.data
  } catch (error) {
    console.error('Error updating user:', error)
    return null
  }
}

// Update user password
export async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const password_hash = await bcrypt.hash(newPassword, 10)
    
    await nocodb.patch(`/${USERS_TABLE_NAME}/${userId}`, {
      password_hash,
      updated_at: new Date().toISOString()
    })
    return true
  } catch (error) {
    console.error('Error updating password:', error)
    return false
  }
}

// Update user preferences
export async function updateUserPreferences(
  userId: string, 
  preferences: {
    system_prompt?: string
    theme?: string
    language?: string
  }
): Promise<User | null> {
  return updateUser(userId, preferences)
}

// Delete user
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await nocodb.delete(`/${USERS_TABLE_NAME}/${userId}`)
    return true
  } catch (error) {
    console.error('Error deleting user:', error)
    return false
  }
}