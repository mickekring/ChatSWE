'use client'

import { Message } from '@/lib/types'
import { User, Bot, Search, FileText, Zap, Globe, Mail, MessageSquare, BookOpen, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import MarkdownMessage from '@/components/MarkdownMessage'
import { useTranslation } from 'react-i18next'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  currentFunctionCall?: {name: string, args: any} | null
}

export default function MessageList({ messages, isLoading, currentFunctionCall }: MessageListProps) {
  const { t } = useTranslation()
  
  // Helper function to determine if a message is currently streaming
  const isMessageStreaming = (messageIndex: number, message: Message) => {
    const isLastMessage = messageIndex === messages.length - 1
    const isAssistantMessage = message.role === 'assistant'
    return isLoading && isLastMessage && isAssistantMessage
  }

  // Helper function to get tool icon and info
  const getToolInfo = (toolName: string) => {
    if (toolName === 'search_documents') {
      return {
        icon: FileText,
        label: t('chat.searchingDocuments'),
        color: 'orange'
      }
    } else if (toolName === 'wikipedia-api' || toolName === 'mcp_wikipedia-api') {
      return {
        icon: BookOpen,
        label: 'Searching Wikipedia',
        color: 'blue'
      }
    } else if (toolName === 'Discord' || toolName === 'mcp_Discord') {
      return {
        icon: MessageSquare,
        label: 'Sending Discord message',
        color: 'indigo'
      }
    } else if (toolName === 'Send_Email' || toolName === 'mcp_Send_Email') {
      return {
        icon: Mail,
        label: 'Sending email',
        color: 'green'
      }
    } else if (toolName === 'eduassist' || toolName === 'mcp_eduassist') {
      return {
        icon: BookOpen,
        label: 'Searching educational resources',
        color: 'purple'
      }
    } else if (toolName?.startsWith('mcp_')) {
      return {
        icon: Zap,
        label: `Using ${toolName.substring(4)}`,
        color: 'purple'
      }
    } else {
      return {
        icon: Globe,
        label: t('chat.searchingInternet'),
        color: 'green'
      }
    }
  }

  return (
    <div className="flex-1 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((message, index) => {
          const isLastAssistant = index === messages.length - 1 && message.role === 'assistant'
          const isUsingTool = isLastAssistant && currentFunctionCall
          const hasUsedTools = message.toolCalls && message.toolCalls.length > 0
          
          return (
            <div
              key={message.id}
              className={clsx(
                'flex gap-4',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot size={18} className="text-white" />
                </div>
              )}
              
              <div
                className={clsx(
                  'max-w-[70%] rounded-2xl overflow-hidden',
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : isUsingTool || hasUsedTools
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                )}
              >
                {/* Tool usage indicator at the top of assistant message */}
                {message.role === 'assistant' && (isUsingTool || hasUsedTools) && (
                  <div className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 border-b border-emerald-200 dark:border-emerald-800">
                    {isUsingTool && currentFunctionCall ? (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const toolInfo = getToolInfo(currentFunctionCall.name)
                          const Icon = toolInfo.icon
                          return (
                            <>
                              <Icon size={16} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
                              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                {toolInfo.label}
                              </span>
                              <Loader2 size={14} className="text-emerald-600 dark:text-emerald-400 animate-spin ml-auto" />
                            </>
                          )
                        })()}
                      </div>
                    ) : hasUsedTools ? (
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          Used {message.toolCalls?.length} tool{message.toolCalls?.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
                
                <div className={message.role === 'assistant' && (isUsingTool || hasUsedTools) ? 'px-4 py-3' : 'px-4 py-3'}>
                  {message.role === 'assistant' ? (
                    <MarkdownMessage 
                      content={message.content}
                      isStreaming={isMessageStreaming(index, message)}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-white" />
                </div>
              )}
            </div>
          )
        })}
        
        {/* Show typing indicator only when loading and no assistant message exists yet */}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && !currentFunctionCall && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              <Bot size={48} className="mx-auto mb-4 opacity-50" />
              <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                ChatSWE
                <img 
                  src="/favicon.png" 
                  alt="ChatSWE Logo" 
                  className="w-8 h-8"
                />
              </h1>
              <h2 className="text-xl font-semibold mb-2">{t('chat.welcomeTitle')}</h2>
              <p className="text-sm">{t('chat.welcomeSubtitle')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}