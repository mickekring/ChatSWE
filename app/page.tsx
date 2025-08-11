'use client'

import { useState, useEffect } from 'react'
import ChatInterface from '@/components/ChatInterface'
import Sidebar from '@/components/Sidebar'
import { Conversation, Message } from '@/lib/types'
import { Conversation as DBConversation, ChatMessage } from '@/lib/chat-history'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentDBConversation, setCurrentDBConversation] = useState<DBConversation | null>(null)
  const { isLoggedIn } = useAuth()

  // Load conversations from database when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      loadConversations()
    } else {
      // Clear conversations when logged out
      setConversations([])
      setCurrentConversationId(null)
      setMessages([])
      setCurrentDBConversation(null)
    }
  }, [isLoggedIn])

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const dbConversations = data.conversations
        
        // Convert database conversations to UI format
        const uiConversations: Conversation[] = dbConversations.map((conv: DBConversation) => ({
          id: (conv.Id || conv.id)!.toString(),
          title: conv.title,
          createdAt: new Date(conv.CreatedAt || ''),
          messages: new Array(conv.message_count || 0).fill(null) // Fake array for length
        }))
        
        setConversations(uiConversations)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const dbMessages = data.messages
        
        // Convert database messages to UI format
        const uiMessages: Message[] = dbMessages.map((msg: ChatMessage) => ({
          id: (msg.Id || msg.id)!.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }))
        
        setMessages(uiMessages)
        
        // Set current database conversation
        const dbConv = conversations.find(c => c.id === conversationId)
        if (dbConv) {
          setCurrentDBConversation({
            Id: parseInt(conversationId),
            user_id: 0, // Will be set by server
            title: dbConv.title,
            message_count: uiMessages.length,
            is_archived: false
          })
        }
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error)
    }
  }

  const createNewConversation = () => {
    // Clear current conversation and start fresh
    setCurrentConversationId(null)
    setCurrentDBConversation(null)
    setMessages([])
  }

  const selectConversation = (id: string) => {
    setCurrentConversationId(id)
    loadConversationMessages(id)
  }

  const updateMessages = (newMessages: Message[]) => {
    setMessages(newMessages)
    // Note: Database persistence is now handled in ChatInterface
  }

  const handleConversationChange = (conversation: DBConversation | null) => {
    setCurrentDBConversation(conversation)
    if (conversation) {
      setCurrentConversationId((conversation.Id || conversation.id)!.toString())
      // Reload conversations to show the new one
      loadConversations()
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (!isLoggedIn) return

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove from local state
        setConversations(conversations.filter(c => c.id !== conversationId))
        
        // If we deleted the current conversation, start a new one
        if (currentConversationId === conversationId) {
          createNewConversation()
        }
      } else {
        alert('Failed to delete conversation')
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      alert('Failed to delete conversation')
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      <div 
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out absolute left-0 h-full z-10`}
      >
        <Sidebar 
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={selectConversation}
          onNewConversation={createNewConversation}
          onToggleSidebar={() => setIsSidebarOpen(false)}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>
      <div className={`flex-1 flex transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'ml-80' : 'ml-0'
      } h-full`}>
        <ChatInterface 
          messages={messages}
          setMessages={updateMessages}
          onNewChat={createNewConversation}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          currentConversation={currentDBConversation}
          onConversationChange={handleConversationChange}
        />
      </div>
    </div>
  )
}