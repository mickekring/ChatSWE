'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, MessageCircle, Plus, Check } from 'lucide-react'
import { Prompt } from '@/lib/prompts'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

interface PromptSelectorProps {
  selectedPrompt: Prompt | null
  onSelectPrompt: (prompt: Prompt) => void
  onManagePrompts: () => void
  sessionPrompts?: Prompt[]
  onUpdateSessionPrompts?: (prompts: Prompt[]) => void
}

export default function PromptSelector({ selectedPrompt, onSelectPrompt, onManagePrompts, sessionPrompts, onUpdateSessionPrompts }: PromptSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const { isLoggedIn } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (isLoggedIn) {
      fetchPrompts()
    } else {
      // For anonymous users, use session prompts or create a default one
      if (sessionPrompts && sessionPrompts.length > 0) {
        setPrompts(sessionPrompts)
      } else {
        const defaultSessionPrompt: Prompt = {
          id: 'session-default',
          user_id: 0,
          name: t('prompts.defaultPrompt'),
          content: 'You are a helpful AI assistant. Be concise and accurate in your responses.',
          is_default: true
        }
        setPrompts([defaultSessionPrompt])
        onUpdateSessionPrompts?.([defaultSessionPrompt])
        if (!selectedPrompt) {
          onSelectPrompt(defaultSessionPrompt)
        }
      }
    }
  }, [isLoggedIn, sessionPrompts])

  const fetchPrompts = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/prompts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts)
        
        // Set default prompt if none selected
        if (!selectedPrompt && data.prompts.length > 0) {
          const defaultPrompt = data.prompts.find((p: Prompt) => p.is_default) || data.prompts[0]
          onSelectPrompt(defaultPrompt)
        }
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {selectedPrompt?.name || t('prompts.selectPrompt')}
        </span>
        <ChevronDown size={16} className={clsx(
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
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-20">
            <div className="p-2">
              {prompts.map((prompt) => {
                const promptId = prompt.Id || prompt.id
                const selectedId = selectedPrompt?.Id || selectedPrompt?.id
                const isSelected = selectedPrompt !== null && selectedId === promptId
                return (
                  <button
                    key={prompt.Id || prompt.id}
                    onClick={() => {
                      onSelectPrompt(prompt)
                      setIsOpen(false)
                    }}
                    className={clsx(
                      'w-full flex items-start gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{prompt.name}</span>
                        {prompt.is_default && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                            {t('prompts.default')}
                          </span>
                        )}
                      </div>
                      {prompt.content && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {prompt.content.substring(0, 60)}...
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    )}
                  </button>
                )
              })}
              
              <div className="border-t dark:border-gray-700 my-2"></div>
              
              <button
                onClick={() => {
                  onManagePrompts()
                  setIsOpen(false)
                }}
                className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <Plus size={20} className="text-gray-600 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{t('prompts.managePrompts')}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('prompts.managePromptsDescription')}</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}