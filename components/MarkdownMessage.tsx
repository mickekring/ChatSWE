'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { useState } from 'react'

interface MarkdownMessageProps {
  content: string
  isStreaming?: boolean
  className?: string
}


export default function MarkdownMessage({ content, isStreaming = false, className = "" }: MarkdownMessageProps) {
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set())
  const [showThinking, setShowThinking] = useState(false)
  
  // Parse GPT-OSS reasoning pattern
  const parseReasoningContent = (text: string) => {
    const analysisPattern = /^analysis([\s\S]*?)assistantfinal([\s\S]*)$/
    const match = text.match(analysisPattern)
    
    if (match) {
      return {
        hasReasoning: true,
        thinking: match[1].trim(),
        finalAnswer: match[2].trim()
      }
    }
    
    return {
      hasReasoning: false,
      thinking: '',
      finalAnswer: text
    }
  }
  
  // Safe streaming markdown processor
  const processSafeStreamingMarkdown = (text: string) => {
    // Check for incomplete code blocks
    const codeBlockPattern = /```/g
    const codeBlocks = text.match(codeBlockPattern)
    const hasIncompleteCodeBlock = codeBlocks && codeBlocks.length % 2 !== 0
    
    // Check for incomplete bold/italic
    const boldPattern = /\*\*/g
    const italicPattern = /(?<!\*)\*(?!\*)/g
    const boldMatches = text.match(boldPattern)
    const hasIncompleteBold = boldMatches && boldMatches.length % 2 !== 0
    
    // Check for incomplete links/images
    const hasIncompleteLink = /\[([^\]]*?)$/.test(text) || /\[([^\]]*?)\]\([^)]*?$/.test(text)
    const hasIncompleteImage = /!\[([^\]]*?)$/.test(text) || /!\[([^\]]*?)\]\([^)]*?$/.test(text)
    
    // Check for incomplete lists (line starts with - or * or number but no content yet)
    const lastLine = text.split('\n').pop() || ''
    const hasIncompleteList = /^[\s]*[-*+][\s]*$/.test(lastLine) || /^[\s]*\d+\.[\s]*$/.test(lastLine)
    
    // Check for incomplete headers (line ends with #)
    const hasIncompleteHeader = /^#{1,6}\s*$/.test(lastLine)
    
    // Check for incomplete tables
    const hasIncompleteTable = /\|[^|\n]*$/.test(text) && !/\|[^|\n]*\|/.test(text.split('\n').pop() || '')
    
    if (hasIncompleteCodeBlock) {
      // Find the last incomplete code block and render everything before it as markdown
      const lastCodeBlockIndex = text.lastIndexOf('```')
      const safeContent = text.substring(0, lastCodeBlockIndex)
      const unsafeContent = text.substring(lastCodeBlockIndex)
      return { safeContent, unsafeContent, hasUnsafe: true }
    }
    
    if (hasIncompleteBold || hasIncompleteLink || hasIncompleteImage || hasIncompleteList || 
        hasIncompleteHeader || hasIncompleteTable) {
      // For inline issues, only treat the last line as unsafe if it has issues
      const lines = text.split('\n')
      const lastLineIndex = lines.length - 1
      const safeLines = lines.slice(0, lastLineIndex)
      const unsafeLine = lines[lastLineIndex]
      
      return { 
        safeContent: safeLines.join('\n'), 
        unsafeContent: unsafeLine ? '\n' + unsafeLine : '',
        hasUnsafe: true 
      }
    }
    
    return { safeContent: text, unsafeContent: '', hasUnsafe: false }
  }

  const copyToClipboard = async (code: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedBlocks(prev => new Set(prev).add(blockId))
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const newSet = new Set(prev)
          newSet.delete(blockId)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // Component for rendering code blocks (multi-line)
  const PreBlock = ({ children, ...props }: any) => {
    // Extract the code element from pre
    const codeElement = children?.props || children
    const className = codeElement?.className || ''
    const match = /language-(\w+)/.exec(className)
    const language = match ? match[1] : ''
    
    // Recursively extract text content from children
    const extractText = (node: any): string => {
      if (typeof node === 'string') {
        return node
      }
      if (typeof node === 'number') {
        return String(node)
      }
      if (Array.isArray(node)) {
        return node.map(extractText).join('')
      }
      if (node?.props?.children) {
        return extractText(node.props.children)
      }
      if (node?.props?.value) {
        return String(node.props.value)
      }
      if (node?.children) {
        return extractText(node.children)
      }
      return ''
    }
    
    let code = extractText(codeElement?.children || codeElement)
    code = code.replace(/\n$/, '')
    
    const blockId = `${code.slice(0, 50)}-${Date.now()}`
    const isCopied = copiedBlocks.has(blockId)

    return (
      <div className="relative group my-4">
        <div className="absolute right-3 top-3 z-10">
          <button
            onClick={() => copyToClipboard(code, blockId)}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
            title="Copy code"
          >
            {isCopied ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} />
            )}
          </button>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={language || 'text'}
          PreTag="div"
          className="rounded-lg !mt-0 !mb-0"
          showLineNumbers={code.split('\n').length > 10}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  }

  // Component for inline code
  const CodeInline = ({ children, className }: any) => {
    // Check if this is actually a code block (has language class)
    const hasLanguage = className && /language-/.test(className)
    
    // If it has a language, it's meant to be a block, let pre handle it
    if (hasLanguage) {
      return <code className={className}>{children}</code>
    }
    
    // Otherwise render as inline code
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-red-500 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    )
  }

  // Handle streaming with safe markdown rendering
  if (isStreaming) {
    const parsedContent = parseReasoningContent(content)
    const contentToProcess = parsedContent.hasReasoning ? parsedContent.finalAnswer : content
    const { safeContent, unsafeContent, hasUnsafe } = processSafeStreamingMarkdown(contentToProcess)
    
    if (parsedContent.hasReasoning) {
      return (
        <div className={`text-gray-900 dark:text-gray-100 max-w-none ${className}`}>
          {/* Show thinking section if we have reasoning */}
          <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <Brain size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reasoning Process
              </span>
              {showThinking ? (
                <ChevronDown size={16} className="text-gray-500 ml-auto" />
              ) : (
                <ChevronRight size={16} className="text-gray-500 ml-auto" />
              )}
            </button>
            
            {showThinking && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-25 dark:bg-gray-900/50">
                <div className="prose prose-gray dark:prose-invert max-w-none prose-sm">
                  <ReactMarkdown
                    rehypePlugins={[rehypeHighlight]}
                    skipHtml={true}
                    components={{
                      pre: PreBlock,
                      code: CodeInline
                    }}
                  >
                    {parsedContent.thinking}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
          
          {/* Streaming final answer */}
          {safeContent && (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                skipHtml={true}
                components={{
                  pre: PreBlock,
                  code: CodeInline
                }}
              >
                {safeContent}
              </ReactMarkdown>
            </div>
          )}
          {unsafeContent && (
            <span className="whitespace-pre-wrap break-words font-mono text-sm opacity-70">
              {unsafeContent}
            </span>
          )}
        </div>
      )
    }
    
    // Regular streaming without reasoning
    return (
      <div className={`text-gray-900 dark:text-gray-100 max-w-none ${className}`}>
        {safeContent && (
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              skipHtml={true}
              components={{
                pre: PreBlock,
                code: CodeInline
              }}
            >
              {safeContent}
            </ReactMarkdown>
          </div>
        )}
        {unsafeContent && (
          <span className="whitespace-pre-wrap break-words font-mono text-sm opacity-70">
            {unsafeContent}
          </span>
        )}
      </div>
    )
  }

  // When complete, render as markdown
  const parsedContent = parseReasoningContent(content)
  
  if (parsedContent.hasReasoning) {
    return (
      <div className={`text-gray-900 dark:text-gray-100 max-w-none ${className}`}>
        {/* Collapsible Thinking Section */}
        <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Brain size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reasoning Process
            </span>
            {showThinking ? (
              <ChevronDown size={16} className="text-gray-500 ml-auto" />
            ) : (
              <ChevronRight size={16} className="text-gray-500 ml-auto" />
            )}
          </button>
          
          {showThinking && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-25 dark:bg-gray-900/50">
              <div className="prose prose-gray dark:prose-invert max-w-none prose-sm">
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight]}
                  skipHtml={true}
                  components={{
                    pre: PreBlock,
                    code: CodeInline
                  }}
                >
                  {parsedContent.thinking}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        
        {/* Final Answer */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            skipHtml={true}
            components={{
              pre: PreBlock,
              code: CodeInline
            }}
          >
            {parsedContent.finalAnswer}
          </ReactMarkdown>
        </div>
      </div>
    )
  }
  
  // Regular content without reasoning
  return (
    <div className={`text-gray-900 dark:text-gray-100 max-w-none prose prose-gray dark:prose-invert ${className}`}>
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        skipHtml={true}
        components={{
          pre: PreBlock,
          code: CodeInline
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}