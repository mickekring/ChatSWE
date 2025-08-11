'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

interface AuthContextType {
  isLoggedIn: boolean
  username: string | null
  firstName: string | null
  lastName: string | null
  systemPrompt: string | null
  userId: string | null
  language: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateProfile: (firstName: string, lastName: string, email?: string) => Promise<boolean>
  updateSystemPrompt: (systemPrompt: string) => Promise<boolean>
  updateLanguage: (language: string) => Promise<boolean>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)

  // Load saved session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('userData')
    
    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setToken(savedToken)
        setIsLoggedIn(true)
        setUserId(userData.id)
        setUsername(userData.username)
        setFirstName(userData.firstName)
        setLastName(userData.lastName)
        setSystemPrompt(userData.systemPrompt)
        setLanguage(userData.language || 'sv')
      } catch (error) {
        console.error('Failed to load saved session:', error)
        localStorage.removeItem('authToken')
        localStorage.removeItem('userData')
      }
    }
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Save to state
        setIsLoggedIn(true)
        setUserId(data.user.id)
        setUsername(data.user.username)
        setFirstName(data.user.firstName || '')
        setLastName(data.user.lastName || '')
        setSystemPrompt(data.user.systemPrompt || '')
        setLanguage(data.user.language || 'sv')
        setToken(data.token)
        
        // Save to localStorage
        localStorage.setItem('authToken', data.token)
        localStorage.setItem('userData', JSON.stringify(data.user))
        
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    setIsLoggedIn(false)
    setUsername(null)
    setFirstName(null)
    setLastName(null)
    setSystemPrompt(null)
    setUserId(null)
    setToken(null)
    setLanguage(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('userData')
  }

  const updateProfile = async (firstName: string, lastName: string, email?: string) => {
    if (!token || !userId) return false
    
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, firstName, lastName, email })
      })
      
      if (response.ok) {
        setFirstName(firstName)
        setLastName(lastName)
        
        // Update localStorage
        const savedUser = localStorage.getItem('userData')
        if (savedUser) {
          const userData = JSON.parse(savedUser)
          userData.firstName = firstName
          userData.lastName = lastName
          if (email) userData.email = email
          localStorage.setItem('userData', JSON.stringify(userData))
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Update profile error:', error)
      return false
    }
  }

  const updateSystemPrompt = async (prompt: string) => {
    if (!token || !userId) return false
    
    try {
      const response = await fetch('/api/auth/update-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, systemPrompt: prompt })
      })
      
      if (response.ok) {
        setSystemPrompt(prompt)
        
        // Update localStorage
        const savedUser = localStorage.getItem('userData')
        if (savedUser) {
          const userData = JSON.parse(savedUser)
          userData.systemPrompt = prompt
          localStorage.setItem('userData', JSON.stringify(userData))
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Update system prompt error:', error)
      return false
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }
    
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      
      if (response.ok) {
        return { success: true }
      } else {
        const data = await response.json()
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Change password error:', error)
      return { success: false, error: 'Failed to change password' }
    }
  }

  const updateLanguage = async (language: string) => {
    if (!token || !userId) {
      // For anonymous users, just update localStorage
      localStorage.setItem('i18nextLng', language)
      return true
    }
    
    try {
      const response = await fetch('/api/auth/update-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, language })
      })
      
      if (response.ok) {
        setLanguage(language)
        localStorage.setItem('i18nextLng', language)
        
        // Update localStorage
        const savedUser = localStorage.getItem('userData')
        if (savedUser) {
          const userData = JSON.parse(savedUser)
          userData.language = language
          localStorage.setItem('userData', JSON.stringify(userData))
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Update language error:', error)
      return false
    }
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, username, firstName, lastName, systemPrompt, userId, language, login, logout, updateProfile, updateSystemPrompt, updateLanguage, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}