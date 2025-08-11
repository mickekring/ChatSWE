'use client'

import { useState } from 'react'
import { Plus, MessageSquare, ChevronLeft, MoreVertical, Trash2 } from 'lucide-react'
import { Conversation } from '@/lib/types'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onToggleSidebar: () => void
  onDeleteConversation?: (id: string) => void
}

export default function Sidebar({ 
  conversations, 
  currentConversationId, 
  onSelectConversation,
  onNewConversation,
  onToggleSidebar,
  onDeleteConversation 
}: SidebarProps) {
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null)
  const { t } = useTranslation()

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return t('time.now')
    if (diffInHours < 24) return t('time.hoursAgo', { hours: diffInHours })
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return t('time.daysAgo', { days: diffInDays })
    if (diffInDays < 30) return t('time.weeksAgo', { weeks: Math.floor(diffInDays / 7) })
    
    return date.toLocaleDateString()
  }

  const groupConversationsByDate = (conversations: Conversation[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    
    const todayKey = t('sidebar.today')
    const yesterdayKey = t('sidebar.yesterday')
    
    const groups: { [key: string]: Conversation[] } = {
      [todayKey]: [],
      [yesterdayKey]: [],
    }
    
    conversations.forEach(conversation => {
      const date = new Date(conversation.createdAt)
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      if (dateOnly.getTime() === today.getTime()) {
        groups[todayKey].push(conversation)
      } else if (dateOnly.getTime() === yesterday.getTime()) {
        groups[yesterdayKey].push(conversation)
      } else {
        const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        if (!groups[monthYear]) {
          groups[monthYear] = []
        }
        groups[monthYear].push(conversation)
      }
    })
    
    // Sort conversations within each group by creation time (newest first)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })
    
    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key]
      }
    })
    
    return groups
  }

  const groupedConversations = groupConversationsByDate(conversations)

  const handleDeleteConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(t('sidebar.deleteConfirm'))) {
      onDeleteConversation?.(conversationId)
    }
    setShowMenuFor(null)
  }
  
  return (
    <div className="w-80 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onNewConversation}
          className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors mr-2"
        >
          <Plus size={20} />
          <span className="font-medium">{t('sidebar.newChat')}</span>
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title={t('sidebar.collapseSidebar')}
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-4">
          {conversations.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">
              {t('sidebar.noConversations')}<br />
              <span className="text-xs">{t('sidebar.startNewChat')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedConversations).map(([groupName, groupConversations]) => (
                <div key={groupName} className="space-y-2">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-2">
                    {groupName}
                  </h3>
                  <div className="space-y-0.5">
                    {groupConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={clsx(
                          'group relative rounded-lg transition-colors',
                          currentConversationId === conversation.id
                            ? 'bg-gray-800'
                            : 'hover:bg-gray-800/50'
                        )}
                      >
                        <button
                          onClick={() => onSelectConversation(conversation.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left"
                        >
                          <MessageSquare size={14} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={clsx(
                              "text-sm font-medium truncate block leading-tight",
                              currentConversationId === conversation.id
                                ? 'text-white'
                                : 'text-gray-300'
                            )}>
                              {conversation.title}
                            </span>
                          </div>
                        </button>
                        
                        {onDeleteConversation && (
                          <div className="absolute right-1 top-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowMenuFor(showMenuFor === conversation.id ? null : conversation.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-700 rounded transition-all duration-150"
                            >
                              <MoreVertical size={14} className="text-gray-400" />
                            </button>
                            
                            {showMenuFor === conversation.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setShowMenuFor(null)}
                                />
                                <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                                  <button
                                    onClick={(e) => handleDeleteConversation(conversation.id, e)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                    {t('sidebar.delete')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}