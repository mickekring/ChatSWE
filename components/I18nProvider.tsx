'use client'

import { useEffect, useState } from 'react'
import i18n from '../lib/i18n'
import { useAuth } from '@/lib/auth-context'

interface I18nProviderProps {
  children: React.ReactNode
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Safely get auth context (may be undefined during SSR)
  let authData
  try {
    authData = useAuth()
  } catch (error) {
    authData = { language: null, isLoggedIn: false }
  }
  
  const { language, isLoggedIn } = authData

  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Prioritize user's saved language preference if logged in
        let languageToUse = 'sv' // default
        
        if (isLoggedIn && language) {
          languageToUse = language
        } else {
          const savedLang = localStorage.getItem('i18nextLng')
          if (savedLang && ['sv', 'en', 'uk'].includes(savedLang)) {
            languageToUse = savedLang
          }
        }
        
        await i18n.changeLanguage(languageToUse)
        localStorage.setItem('i18nextLng', languageToUse)
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize language:', error)
        setIsInitialized(true)
      }
    }

    if (i18n.isInitialized) {
      initializeLanguage()
    } else {
      i18n.on('initialized', initializeLanguage)
    }

    return () => {
      i18n.off('initialized', initializeLanguage)
    }
  }, [isLoggedIn, language])

  if (!isInitialized) {
    return <div>Loading...</div>
  }

  return <>{children}</>
}