'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Paperclip, ChevronDown, ChevronRight, Plus, LogIn, User, LogOut, Settings, MessageCircle, Search, Lock } from 'lucide-react'
import { Message, Model, UploadedFile, DocumentChunk } from '@/lib/types'
import MessageList from '@/components/MessageList'
import ModelSelector from '@/components/ModelSelector'
import PromptSelector from '@/components/PromptSelector'
import LanguageSelector from '@/components/LanguageSelector'
import LoginModal from '@/components/LoginModal'
import AccountModal from '@/components/AccountModal'
import SystemPromptModal from '@/components/SystemPromptModal'
import FileUpload from '@/components/FileUpload'
import { streamMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useAudioRecorder } from '@/lib/useAudioRecorder'
import { chunkText } from '@/lib/document-utils'
import { Prompt } from '@/lib/prompts'
import { Conversation as DBConversation, ChatMessage, generateConversationTitle } from '@/lib/chat-history'
import { useTranslation } from 'react-i18next'

interface ChatInterfaceProps {
  messages: Message[]
  setMessages: (messages: Message[]) => void
  onNewChat: () => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  currentConversation: DBConversation | null
  onConversationChange: (conversation: DBConversation | null) => void
}

// Models will be defined inside the component to use translations

export default function ChatInterface({ messages, setMessages, onNewChat, isSidebarOpen, onToggleSidebar, currentConversation, onConversationChange }: ChatInterfaceProps) {
  const { t } = useTranslation()
  
  const models: Model[] = [
    { 
      id: 'openai/gpt-oss-120b', 
      name: 'GPT-OSS 120B', 
      description: t('chat.models.gptOss'),
      capabilities: ['chat']
    },
    { 
      id: 'meta-llama/Llama-3.3-70B-Instruct', 
      name: 'Llama 3.3 70B', 
      description: t('chat.models.llama'),
      capabilities: ['chat', 'internetSearch', 'fileUpload', 'mcpTools']
    },
    { 
      id: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503', 
      name: 'Mistral Small 3.1 24B', 
      description: t('chat.models.mistralSmall'),
      capabilities: ['chat', 'vision']
    },
    { 
      id: 'mistralai/Devstral-Small-2505', 
      name: 'Devstral Small', 
      description: t('chat.models.devstral'),
      capabilities: ['chat']
    }
  ]

  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState<Model>(models[1])
  const [mcpCheckInProgress, setMcpCheckInProgress] = useState(false)
  const [mcpDiscoveredTools, setMcpDiscoveredTools] = useState<string[]>([])
  const [mcpEnabled, setMcpEnabled] = useState(() => {
    // Load MCP preference from localStorage, default to true
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mcpEnabled')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [sessionPrompts, setSessionPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false)
  const [currentFunctionCall, setCurrentFunctionCall] = useState<{name: string, args: any} | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [documentChunks, setDocumentChunks] = useState<DocumentChunk[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showUploadArea, setShowUploadArea] = useState(true)
  const [mcpToolsAvailable, setMcpToolsAvailable] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { isLoggedIn, username, firstName, lastName, systemPrompt, logout } = useAuth()
  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder()

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : username

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Chat persistence functions
  const createNewConversation = async (firstMessage: string): Promise<DBConversation | null> => {
    if (!isLoggedIn) return null

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return null

      // Generate title using Llama 3.3
      let title = 'New Chat'
      try {
        const titleResponse = await fetch('/api/generate-title', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: firstMessage }]
          })
        })
        
        if (titleResponse.ok) {
          const data = await titleResponse.json()
          title = data.title
        }
      } catch (error) {
        console.error('Failed to generate title:', error)
        // Fallback to simple title generation
        title = generateConversationTitle(firstMessage)
      }

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          modelUsed: selectedModel.name,
          promptUsed: selectedPrompt?.name || 'Default'
        })
      })

      if (response.ok) {
        const data = await response.json()
        return data.conversation
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
    return null
  }

  const saveMessage = async (conversationId: number, role: 'user' | 'assistant', content: string, metadata?: any): Promise<void> => {
    if (!isLoggedIn) return

    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId,
          role,
          content,
          modelUsed: selectedModel.name,
          promptUsed: selectedPrompt?.name || 'Default',
          metadata
        })
      })
    } catch (error) {
      console.error('Error saving message:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isLoggedIn) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    // Handle conversation creation and message persistence
    let conversationToUse = currentConversation
    
    try {
      // Create new conversation if this is the first message
      if (isLoggedIn && !currentConversation && messages.length === 0) {
        conversationToUse = await createNewConversation(userMessage.content)
        if (conversationToUse) {
          onConversationChange(conversationToUse)
        }
      }

      // Save user message to database
      if (isLoggedIn && conversationToUse) {
        await saveMessage(conversationToUse.Id || conversationToUse.id!, 'user', userMessage.content)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      
      console.log('Sending', documentChunks.length, 'document chunks to API')
      let fullContent = ''
      // Use selected prompt content, fallback to old system prompt, then undefined
      const promptToUse = selectedPrompt?.content || systemPrompt || undefined
      const stream = streamMessage(updatedMessages, selectedModel.id, promptToUse, (name, args) => {
        setCurrentFunctionCall({ name, args })
      }, documentChunks, mcpEnabled && isLoggedIn, uploadedFiles)
      
      for await (const chunk of stream) {
        fullContent += chunk
        assistantMessage.content = fullContent
        setMessages([...updatedMessages, assistantMessage])
      }
      
      // Save assistant message to database
      if (isLoggedIn && conversationToUse && fullContent) {
        await saveMessage(conversationToUse.Id || conversationToUse.id!, 'assistant', fullContent)
        
        // Update title if this is the first exchange (2 messages: user + assistant)
        if (messages.length === 0 && conversationToUse.title === 'New Chat') {
          try {
            const titleResponse = await fetch('/api/generate-title', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messages: [
                  { role: 'user', content: userMessage.content },
                  { role: 'assistant', content: fullContent.slice(0, 500) }
                ]
              })
            })
            
            if (titleResponse.ok) {
              const data = await titleResponse.json()
              // Update conversation title in database
              const token = localStorage.getItem('authToken')
              if (token) {
                await fetch(`/api/conversations/${conversationToUse.Id || conversationToUse.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ title: data.title })
                })
                // Update local conversation object
                conversationToUse.title = data.title
                onConversationChange({ ...conversationToUse })
              }
            }
          } catch (error) {
            console.error('Failed to update title:', error)
          }
        }
      }
      
      setCurrentFunctionCall(null)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages([...updatedMessages, errorMessage])
      
      // Save error message to database
      if (isLoggedIn && conversationToUse) {
        await saveMessage(conversationToUse.Id || conversationToUse.id!, 'assistant', errorMessage.content)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleVoiceClick = async () => {
    if (!isLoggedIn) return
    
    if (isRecording) {
      // Stop recording and transcribe
      try {
        const transcribedText = await stopRecording()
        setInput(transcribedText)
        
        // Auto-submit the transcribed text
        if (transcribedText.trim()) {
          const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: transcribedText.trim(),
            timestamp: new Date()
          }

          const updatedMessages = [...messages, userMessage]
          setMessages(updatedMessages)
          setInput('')
          setIsLoading(true)

          // Handle conversation creation and message persistence for voice input
          let conversationToUse = currentConversation
          
          try {
            // Create new conversation if this is the first message
            if (isLoggedIn && !currentConversation && messages.length === 0) {
              conversationToUse = await createNewConversation(userMessage.content)
              if (conversationToUse) {
                onConversationChange(conversationToUse)
              }
            }

            // Save user message to database
            if (isLoggedIn && conversationToUse) {
              await saveMessage(conversationToUse.Id || conversationToUse.id!, 'user', userMessage.content)
            }

            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: '',
              timestamp: new Date()
            }
            
            let fullContent = ''
            // Use selected prompt content, fallback to old system prompt, then undefined
            const promptToUse = selectedPrompt?.content || systemPrompt || undefined
            const stream = streamMessage(updatedMessages, selectedModel.id, promptToUse, (name, args) => {
              setCurrentFunctionCall({ name, args })
            }, documentChunks, mcpEnabled && isLoggedIn, uploadedFiles)
            
            for await (const chunk of stream) {
              fullContent += chunk
              assistantMessage.content = fullContent
              setMessages([...updatedMessages, assistantMessage])
            }
            
            // Save assistant message to database
            if (isLoggedIn && conversationToUse && fullContent) {
              await saveMessage(conversationToUse.Id || conversationToUse.id!, 'assistant', fullContent)
            }
            
            setCurrentFunctionCall(null)
          } catch (error) {
            console.error('Error sending message:', error)
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.',
              timestamp: new Date()
            }
            setMessages([...updatedMessages, errorMessage])
            
            // Save error message to database
            if (isLoggedIn && conversationToUse) {
              await saveMessage(conversationToUse.Id || conversationToUse.id!, 'assistant', errorMessage.content)
            }
          } finally {
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error('Error transcribing audio:', error)
      }
    } else {
      // Start recording
      try {
        await startRecording()
      } catch (error) {
        console.error('Error starting recording:', error)
        alert('Could not access microphone. Please check permissions.')
      }
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      onNewChat()
      // Reset to default model and clear selections when starting new chat
      setSelectedModel(models[1]) // Default to Llama 3.3 70B
      setSelectedPrompt(null)
      // Clear files when starting new chat
      setUploadedFiles([])
      setDocumentChunks([])
      setShowFileUpload(false)
      setShowUploadArea(true) // Reset upload area visibility
    }
  }, [])

  // Check MCP tool availability when component mounts or model changes
  useEffect(() => {
    const checkMCPTools = async () => {
      // Only check MCP for Llama model, if MCP is enabled, and if user is logged in
      if (!selectedModel.id.includes('Llama') || !mcpEnabled || !isLoggedIn) {
        console.log('MCP not available for model:', selectedModel.id, 'or disabled')
        setMcpToolsAvailable(false)
        setMcpCheckInProgress(false)
        setMcpDiscoveredTools([])
        return
      }

      console.log('Checking MCP tools for Llama model...')
      setMcpCheckInProgress(true)
      let retries = 0
      const maxRetries = 3
      
      while (retries < maxRetries) {
        try {
          const response = await fetch('/api/mcp?refresh=' + (retries > 0))
          if (response.ok) {
            const data = await response.json()
            console.log(`MCP API response (attempt ${retries + 1}):`, data)
            const hasTools = data.success && data.tools && data.tools.length > 0
            
            if (hasTools) {
              console.log('MCP tools available:', data.tools.length, 'tools')
              const toolNames = data.tools.map((tool: any) => tool.name)
              setMcpDiscoveredTools(toolNames)
              setMcpToolsAvailable(true)
              setMcpCheckInProgress(false)
              return
            } else if (retries < maxRetries - 1) {
              console.log('No tools yet, retrying in 1 second...')
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        } catch (error) {
          console.log(`MCP check failed (attempt ${retries + 1}):`, error)
        }
        retries++
      }
      
      console.log('MCP tools not available after', maxRetries, 'attempts')
      setMcpToolsAvailable(false)
      setMcpCheckInProgress(false)
      setMcpDiscoveredTools([])
    }
    
    checkMCPTools()
  }, [selectedModel, mcpEnabled, isLoggedIn])

  // Restore conversation context (model and system prompt) when loading a conversation
  useEffect(() => {
    const restoreConversationContext = async () => {
      if (!currentConversation) {
        console.log('No current conversation to restore')
        return
      }

      const conversationId = currentConversation.Id || currentConversation.id
      console.log('Restoring conversation context:', {
        id: conversationId,
        model_used: currentConversation.model_used,
        prompt_used: currentConversation.prompt_used ? 'Present' : 'Missing'
      })

      // Restore model selection
      if (currentConversation.model_used) {
        // Try to find by ID first, then by name (for backward compatibility)
        let savedModel = models.find(m => m.id === currentConversation.model_used)
        if (!savedModel) {
          savedModel = models.find(m => m.name === currentConversation.model_used)
        }
        
        console.log('Model restoration:', {
          model_used: currentConversation.model_used,
          savedModel: savedModel ? savedModel.name : 'Not found',
          searchedByName: !models.find(m => m.id === currentConversation.model_used),
          availableModelIds: models.map(m => m.id),
          availableModelNames: models.map(m => m.name)
        })
        if (savedModel) {
          console.log('Setting model to:', savedModel.name)
          setSelectedModel(savedModel)
        } else {
          console.log('Model not found:', currentConversation.model_used)
        }
      } else {
        console.log('No model_used found in conversation')
      }

      // Restore system prompt selection (only if we have a prompt to restore)
      if (currentConversation.prompt_used && isLoggedIn) {
        try {
          const token = localStorage.getItem('authToken')
          if (token) {
            console.log('Fetching prompts to restore system prompt...')
            const response = await fetch('/api/prompts', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (response.ok) {
              const data = await response.json()
              const prompts = data.prompts || []
              
              console.log('Prompt restoration debug:', {
                promptsCount: prompts.length,
                promptToMatch: currentConversation.prompt_used,
                availablePrompts: prompts.map((p: Prompt) => ({
                  id: p.id,
                  name: p.name
                }))
              })
              
              // Find prompt by name (since database stores prompt names, not content)
              const savedPrompt = prompts.find((p: Prompt) => 
                p.name === currentConversation.prompt_used
              )
              
              if (savedPrompt) {
                console.log('Found and restoring saved prompt by name:', savedPrompt.name)
                setSelectedPrompt(savedPrompt)
              } else {
                console.log('Prompt not found by name, trying content match...')
                // Fallback: Try to find by content match (for legacy conversations)
                const contentMatch = prompts.find((p: Prompt) => 
                  p.content === currentConversation.prompt_used || 
                  (currentConversation.prompt_used && p.content.trim() === currentConversation.prompt_used.trim())
                )
                
                if (contentMatch) {
                  console.log('Found prompt by content match:', contentMatch.name)
                  setSelectedPrompt(contentMatch)
                } else {
                  // Last resort: create temporary prompt with the stored content
                  console.log('Creating temporary prompt - no match found')
                  const tempPrompt: Prompt = {
                    id: Date.now(),
                    user_id: 0,
                    name: `Restored: ${currentConversation.prompt_used}`,
                    content: currentConversation.prompt_used,
                    is_default: false,
                    created_at: new Date().toISOString()
                  }
                  setSelectedPrompt(tempPrompt)
                  // Also add to session prompts so it appears in the list
                  setSessionPrompts(prev => {
                    const exists = prev.find(p => p.content === tempPrompt.content)
                    if (!exists) {
                      return [tempPrompt, ...prev]
                    }
                    return prev
                  })
                }
              }
            }
          }
        } catch (error) {
          console.error('Error restoring system prompt:', error)
        }
      }
    }

    // Only restore if we have a conversation and are logged in
    if (currentConversation && isLoggedIn) {
      restoreConversationContext()
    }
  }, [currentConversation?.Id || currentConversation?.id, isLoggedIn])

  // Toggle MCP enabled/disabled or refresh tools
  const handleMcpToggle = async () => {
    // Only allow MCP toggle if user is logged in
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    
    // If MCP is already enabled and tools are available, force refresh
    if (mcpEnabled && mcpToolsAvailable) {
      console.log('Force refreshing MCP tools...')
      setMcpCheckInProgress(true)
      setMcpToolsAvailable(false)
      setMcpDiscoveredTools([])
      
      try {
        const response = await fetch('/api/mcp?refresh=true')
        if (response.ok) {
          const data = await response.json()
          console.log('MCP refresh response:', data)
          if (data.success && data.tools && data.tools.length > 0) {
            const toolNames = data.tools.map((tool: any) => tool.name)
            setMcpDiscoveredTools(toolNames)
            setMcpToolsAvailable(true)
          }
        }
      } catch (error) {
        console.error('Failed to refresh MCP tools:', error)
      } finally {
        setMcpCheckInProgress(false)
      }
      return
    }
    
    // Otherwise toggle MCP on/off
    const newEnabled = !mcpEnabled
    setMcpEnabled(newEnabled)
    // Save preference to localStorage
    localStorage.setItem('mcpEnabled', newEnabled.toString())
  }

  // Process files when they change
  const handleFilesChange = async (files: UploadedFile[]) => {
    setUploadedFiles(files)
    setIsProcessingFiles(true)

    try {
      if (files.length === 0) {
        setDocumentChunks([])
        return
      }

      console.log('Processing', files.length, 'files')
      
      // Separate text files (PDFs, TXT) from image files
      const textFiles = files.filter(file => !file.isImage)
      const imageFiles = files.filter(file => file.isImage)
      
      console.log('Text files for embeddings:', textFiles.length)
      console.log('Image files for vision:', imageFiles.length)
      
      // Create chunks only from text files
      const allChunks: DocumentChunk[] = []
      for (const file of textFiles) {
        console.log(`Text file: ${file.name}, Content length: ${file.content.length}`)
        console.log(`First 200 chars: ${file.content.substring(0, 200)}...`)
        const fileChunks = chunkText(file.content, file.name)
        console.log(`Created ${fileChunks.length} chunks for ${file.name}`)
        fileChunks.forEach((chunk, i) => {
          console.log(`Chunk ${i}: ${chunk.content.length} chars - ${chunk.content.substring(0, 100)}...`)
        })
        allChunks.push(...fileChunks)
      }

      console.log('Created', allChunks.length, 'chunks from text files')

      if (allChunks.length > 0) {
        // Get embeddings only for text chunks
        const texts = allChunks.map(chunk => chunk.content)
        const response = await fetch('/api/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texts })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('Embeddings API response:', result)
          const embeddings = result.embeddings || result.data?.map((item: any) => item.embedding)
          console.log('Generated', embeddings?.length, 'embeddings')
          console.log('First embedding dimensions:', embeddings?.[0]?.length)
          // Add embeddings to chunks
          const chunksWithEmbeddings = allChunks.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index]
          }))
          setDocumentChunks(chunksWithEmbeddings)
          console.log('Text documents are ready for chat!')
        } else {
          console.error('Failed to generate embeddings:', response.status)
        }
      } else {
        setDocumentChunks([])
      }
      
      // Images don't need embeddings - they work directly with vision API
      if (imageFiles.length > 0) {
        console.log('Images are ready for vision analysis!')
      }
      
    } catch (error) {
      console.error('Error processing files:', error)
    } finally {
      setIsProcessingFiles(false)
      // Auto-close upload area (but keep file list visible) after processing
      if (files.length > 0) {
        setShowUploadArea(false)
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 h-screen">
      <div className="px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={t('sidebar.expandSidebar')}
            >
              <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
          {!isSidebarOpen && (
            <button
              onClick={onNewChat}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={t('sidebar.newChat')}
            >
              <Plus size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <ModelSelector 
              models={models}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
            {selectedModel.id.includes('Llama') && (
              <button
                onClick={handleMcpToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all hover:scale-105 ${
                  !isLoggedIn
                    ? 'bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-75'
                    : !mcpEnabled
                    ? 'bg-gray-100 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800'
                    : mcpToolsAvailable 
                    ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                    : mcpCheckInProgress
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
                    : 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                }`}
                title={
                  !isLoggedIn
                    ? "MCP requires login - Click to log in"
                    : !mcpEnabled
                    ? "MCP disabled - Click to enable"
                    : mcpCheckInProgress
                    ? "Connecting to MCP server..."
                    : mcpToolsAvailable && mcpDiscoveredTools.length > 0
                    ? `MCP tools available: ${mcpDiscoveredTools.join(', ')} (Click to refresh)`
                    : "MCP connection failed - Click to retry"
                }
              >
                <span className={`w-2 h-2 rounded-full ${
                  !isLoggedIn
                    ? 'bg-gray-500'
                    : !mcpEnabled
                    ? 'bg-gray-500'
                    : mcpToolsAvailable 
                    ? 'bg-purple-500' 
                    : mcpCheckInProgress
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}></span>
                <span className={`text-sm font-medium ${
                  !isLoggedIn
                    ? 'text-gray-700 dark:text-gray-300'
                    : !mcpEnabled
                    ? 'text-gray-700 dark:text-gray-300'
                    : mcpToolsAvailable 
                    ? 'text-purple-700 dark:text-purple-300' 
                    : mcpCheckInProgress
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>MCP</span>
                {!isLoggedIn && <Lock className="w-3 h-3 ml-1" />}
              </button>
            )}
          </div>
          <PromptSelector
            selectedPrompt={selectedPrompt}
            onSelectPrompt={setSelectedPrompt}
            onManagePrompts={() => setShowSystemPromptModal(true)}
            sessionPrompts={sessionPrompts}
            onUpdateSessionPrompts={setSessionPrompts}
          />
          <LanguageSelector />
        </div>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <User size={20} className="text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{displayName}</span>
              </button>
              
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-30">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowAccountModal(true)
                          setShowProfileMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left rounded-lg transition-colors"
                      >
                        <User size={16} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('auth.account')}</span>
                      </button>
                      <button 
                        onClick={() => {
                          setShowSystemPromptModal(true)
                          setShowProfileMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left rounded-lg transition-colors"
                      >
                        <MessageCircle size={16} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('auth.managePrompts')}</span>
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left rounded-lg transition-colors">
                        <Settings size={16} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('auth.preferences')}</span>
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          logout()
                          setShowProfileMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left rounded-lg transition-colors"
                      >
                        <LogOut size={16} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t('auth.signOut')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <LogIn size={18} />
              <span className="text-sm font-medium">{t('auth.signIn')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList messages={messages} isLoading={isLoading} currentFunctionCall={currentFunctionCall} />
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 flex-shrink-0">
        {isLoggedIn ? (
          <>
            {showFileUpload && (
              <div className="max-w-4xl mx-auto mb-4">
                <FileUpload 
                  files={uploadedFiles}
                  onFilesChange={handleFilesChange}
                  isProcessing={isProcessingFiles}
                  documentsReady={documentChunks.length > 0}
                  selectedModelId={selectedModel.id}
                  showUploadArea={showUploadArea}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-900 rounded-2xl p-2 mb-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowFileUpload(!showFileUpload)
                    if (!showFileUpload) {
                      setShowUploadArea(true) // Show upload area when opening file upload
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    uploadedFiles.length > 0 
                      ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                  title={
                    uploadedFiles.length > 0 
                      ? `${t('chat.filesUploaded', { count: uploadedFiles.length })}${uploadedFiles.some(f => f.isImage) && selectedModel.id.includes('Mistral-Small') ? ' - Images will be analyzed by AI' : ''}` 
                      : t('chat.uploadFiles')
                  }
                >
                  <Paperclip size={20} className={`${uploadedFiles.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </button>
                
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.placeholder')}
                  className="flex-1 bg-transparent resize-none outline-none py-2 px-2 max-h-[200px] text-gray-900 dark:text-gray-100 placeholder-gray-500"
                  rows={1}
                />
                
                <button
                  type="button"
                  onClick={handleVoiceClick}
                  disabled={isTranscribing}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                      : isTranscribing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                  title={isRecording ? t('chat.stopRecording') : isTranscribing ? t('chat.transcribing') : t('chat.startVoiceRecording')}
                >
                  <Mic size={20} className={`${
                    isRecording 
                      ? 'text-white' 
                      : isTranscribing 
                      ? 'text-gray-300' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </button>
                
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <Send size={20} className="" />
                </button>
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
{t('chat.poweredBy')}
              </div>
            </form>
          </>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <LogIn size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('auth.loginRequired')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('auth.loginRequiredDescription')}
                </p>
              </div>
              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <LogIn size={20} />
                {t('auth.signIn')}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
      
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />
      
      <SystemPromptModal
        isOpen={showSystemPromptModal}
        onClose={() => setShowSystemPromptModal(false)}
        sessionPrompts={sessionPrompts}
        onUpdateSessionPrompts={setSessionPrompts}
      />
      
    </div>
  )
}