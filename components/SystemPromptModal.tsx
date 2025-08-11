'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Edit, Trash2, Check, Star } from 'lucide-react'
import { Prompt } from '@/lib/prompts'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'

interface SystemPromptModalProps {
  isOpen: boolean
  onClose: () => void
  sessionPrompts?: Prompt[]
  onUpdateSessionPrompts?: (prompts: Prompt[]) => void
}

export default function SystemPromptModal({ isOpen, onClose, sessionPrompts, onUpdateSessionPrompts }: SystemPromptModalProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [formData, setFormData] = useState({ name: '', content: '' })
  const { isLoggedIn } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (isOpen) {
      fetchPrompts()
    }
  }, [isOpen])

  const fetchPrompts = async () => {
    if (!isLoggedIn) {
      // For anonymous users, use session prompts
      setPrompts(sessionPrompts || [])
      return
    }

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
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      alert(t('prompts.fillBothFields'))
      return
    }

    if (!isLoggedIn) {
      // For anonymous users, create session prompt
      const newPrompt: Prompt = {
        id: Date.now(),
        user_id: 0,
        name: formData.name.trim(),
        content: formData.content.trim(),
        is_default: prompts.length === 0 // First prompt becomes default
      }
      const updatedPrompts = [...prompts, newPrompt]
      setPrompts(updatedPrompts)
      onUpdateSessionPrompts?.(updatedPrompts)
      setFormData({ name: '', content: '' })
      setIsCreating(false)
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          content: formData.content.trim(),
          isDefault: prompts.length === 0 // First prompt becomes default
        })
      })

      if (response.ok) {
        setFormData({ name: '', content: '' })
        setIsCreating(false)
        fetchPrompts()
      } else {
        alert(t('prompts.createFailed'))
      }
    } catch (error) {
      console.error('Error creating prompt:', error)
      alert('Failed to create prompt')
    }
  }

  const handleUpdate = async (promptId: number | string) => {
    if (!formData.name.trim() || !formData.content.trim()) {
      alert(t('prompts.fillBothFields'))
      return
    }

    if (!isLoggedIn) {
      // For anonymous users, update session prompt
      const updatedPrompts = prompts.map(prompt => {
        const id = prompt.Id || prompt.id
        if (id === promptId) {
          return {
            ...prompt,
            name: formData.name.trim(),
            content: formData.content.trim()
          }
        }
        return prompt
      })
      setPrompts(updatedPrompts)
      onUpdateSessionPrompts?.(updatedPrompts)
      setFormData({ name: '', content: '' })
      setEditingId(null)
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          content: formData.content.trim()
        })
      })

      if (response.ok) {
        setFormData({ name: '', content: '' })
        setEditingId(null)
        fetchPrompts()
      } else {
        alert(t('prompts.updateFailed'))
      }
    } catch (error) {
      console.error('Error updating prompt:', error)
      alert('Failed to update prompt')
    }
  }

  const handleDelete = async (promptId: number | string) => {
    if (!confirm(t('prompts.deleteConfirm'))) return

    if (!isLoggedIn) {
      // For anonymous users, delete session prompt
      const updatedPrompts = prompts.filter(prompt => {
        const id = prompt.Id || prompt.id
        return id !== promptId
      })
      setPrompts(updatedPrompts)
      onUpdateSessionPrompts?.(updatedPrompts)
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        fetchPrompts()
      } else {
        alert(t('prompts.deleteFailed'))
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('Failed to delete prompt')
    }
  }

  const handleSetDefault = async (promptId: number | string) => {
    if (!isLoggedIn) {
      // For anonymous users, set session prompt as default
      const updatedPrompts = prompts.map(prompt => {
        const id = prompt.Id || prompt.id
        return {
          ...prompt,
          is_default: id === promptId
        }
      })
      setPrompts(updatedPrompts)
      onUpdateSessionPrompts?.(updatedPrompts)
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isDefault: true
        })
      })

      if (response.ok) {
        fetchPrompts()
      } else {
        alert(t('prompts.setDefaultFailed'))
      }
    } catch (error) {
      console.error('Error setting default prompt:', error)
      alert('Failed to set default prompt')
    }
  }

  const startEdit = (prompt: Prompt) => {
    setEditingId(prompt.Id || prompt.id || null)
    setFormData({ name: prompt.name, content: prompt.content })
    setIsCreating(false)
  }

  const startCreate = () => {
    setIsCreating(true)
    setEditingId(null)
    setFormData({ name: '', content: '' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ name: '', content: '' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('prompts.managePrompts')}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('prompts.managePromptsDescription')}
              </p>
              <button
                onClick={startCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Plus size={16} />
                {t('prompts.newPrompt')}
              </button>
            </div>

            {/* Create/Edit Form */}
            {(isCreating || editingId !== null) && (
              <div className="mb-6 p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                  {isCreating ? t('prompts.createNewPrompt') : t('prompts.editPrompt')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('prompts.name')}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('prompts.namePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('prompts.content')}
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder={t('prompts.contentPlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={isCreating ? handleCreate : () => handleUpdate(editingId!)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      {isCreating ? t('prompts.create') : t('prompts.saveChanges')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {t('auth.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Prompts List */}
            <div className="space-y-4">
              {prompts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">{t('prompts.noPrompts')}</p>
                </div>
              ) : (
                prompts.map((prompt) => (
                  <div
                    key={prompt.Id || prompt.id}
                    className="p-4 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            {prompt.name}
                          </h3>
                          {prompt.is_default && (
                            <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                              <Star size={12} />
                              {t('prompts.default')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {prompt.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!prompt.is_default && (
                          <button
                            onClick={() => handleSetDefault(prompt.Id || prompt.id!)}
                            className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title={t('prompts.setAsDefault')}
                          >
                            <Star size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(prompt)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('prompts.edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(prompt.Id || prompt.id!)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('prompts.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}