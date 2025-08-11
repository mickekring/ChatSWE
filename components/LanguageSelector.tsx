'use client'

import { useState } from 'react'
import { ChevronDown, Globe, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { clsx } from 'clsx'

interface Language {
  code: string
  name: string
  flag: string
}

const languages: Language[] = [
  { code: 'sv', name: 'Svenska', flag: 'SV' },
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'uk', name: 'Українська', flag: 'UK' },
]

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const { i18n, t } = useTranslation()
  const { updateLanguage } = useAuth()

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0]

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode)
      
      // Save to user profile if logged in, otherwise just localStorage
      await updateLanguage(languageCode)
      
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to change language:', error)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title={currentLanguage.name}
      >
        <Globe size={16} className="text-gray-600 dark:text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          {currentLanguage.flag}
        </span>
        <ChevronDown size={14} className={clsx(
          'text-gray-600 dark:text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-20">
            <div className="p-2">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    i18n.language === language.code
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-6 rounded flex items-center justify-center text-xs font-bold',
                    i18n.language === language.code
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  )}>
                    {language.flag}
                  </div>
                  <span className="font-medium">
                    {language.name}
                  </span>
                  {i18n.language === language.code && (
                    <Check size={20} className="ml-auto text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}