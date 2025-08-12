import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import jwt from 'jsonwebtoken'
import { functions, executeFunction } from '@/lib/functions'
import { getMCPTools, executeMCPTool, initializeMCPClient } from '@/lib/mcp-client'
import { getBergetAIConfig, getJWTSecret } from '@/lib/env-validation'

// Function to verify JWT token
function verifyToken(authHeader: string | null): boolean {
  if (!authHeader) return false
  
  try {
    const JWT_SECRET = getJWTSecret()
    if (!JWT_SECRET) return false
    
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    jwt.verify(token, JWT_SECRET)
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model, documentChunks, mcpEnabled = true, uploadedFiles = [] } = await request.json()
    
    // Initialize OpenAI client at request time
    const bergetConfig = getBergetAIConfig()
    const openai = new OpenAI({
      apiKey: bergetConfig.apiKey,
      baseURL: bergetConfig.baseUrl
    })
    
    // Check authentication for MCP access
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = verifyToken(authHeader)
    
    // Disable MCP if user is not authenticated
    const mcpAllowed = mcpEnabled && isAuthenticated

    // Only enable function calling for Llama model (which supports it) and if MCP is allowed
    const supportsTools = model.includes('Llama') && mcpAllowed
    
    // Check if this is a multimodal request (Mistral Small with images)
    const supportsVision = model.includes('Mistral-Small') && uploadedFiles.some((file: any) => file.isImage)
    
    // Process messages for multimodal requests
    let processedMessages = messages
    if (supportsVision) {
      // Find the last user message and add images to it
      const lastUserMessageIndex = messages.findLastIndex((msg: any) => msg.role === 'user')
      if (lastUserMessageIndex !== -1) {
        const lastUserMessage = messages[lastUserMessageIndex]
        const imageFiles = uploadedFiles.filter((file: any) => file.isImage && file.imageData)
        
        if (imageFiles.length > 0) {
          // Convert to OpenAI vision format
          const content: any[] = [
            { type: 'text', text: lastUserMessage.content }
          ]
          
          // Add images
          imageFiles.forEach((file: any) => {
            content.push({
              type: 'image_url',
              image_url: {
                url: file.imageData.data,
                detail: 'high'
              }
            } as any)
          })
          
          // Update the processed messages
          processedMessages = [...messages]
          processedMessages[lastUserMessageIndex] = {
            ...lastUserMessage,
            content: content as any
          }
        }
      }
    }

    if (supportsTools) {
      try {
        // Get available tools (built-in functions + MCP tools)
        const allTools = [...functions]
        
        // Add MCP tools if available
        try {
          let mcpTools = getMCPTools()
          
          // If no MCP tools cached, try to initialize
          if (mcpTools.length === 0) {
            console.log('Initializing MCP client for chat...')
            mcpTools = await initializeMCPClient()
          }
          
          // Convert MCP tools to OpenAI function format
          const mcpFunctions = mcpTools.map(tool => ({
            name: `mcp_${tool.name}`,
            description: `[MCP Tool] ${tool.description}`,
            parameters: tool.inputSchema as any
          }))
          
          allTools.push(...mcpFunctions as any)
          // Using built-in and MCP tools
        } catch (mcpError) {
          console.warn('Failed to load MCP tools:', mcpError)
        }

        // First, try to get a response with function calling
        const initialResponse = await openai.chat.completions.create({
          model: model,
          messages: processedMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
          tools: allTools.map(func => ({
            type: "function",
            function: func
          })),
          tool_choice: "auto"
        })

        const initialMessage = initialResponse.choices[0].message

        // Check if the AI wants to call a function
        if (initialMessage.tool_calls && initialMessage.tool_calls.length > 0) {
          const toolCall = initialMessage.tool_calls[0] as any
          // Execute the function
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}')
          
          let functionResult: string
          
          // Check if this is an MCP tool
          if (functionName.startsWith('mcp_')) {
            const mcpToolName = functionName.substring(4) // Remove 'mcp_' prefix
            // Executing MCP tool
            
            try {
              const mcpResult = await executeMCPTool({
                name: mcpToolName,
                arguments: functionArgs
              })
              
              // Format MCP result for the AI
              if (mcpResult.isError) {
                functionResult = `Error executing MCP tool: ${mcpResult.content.map(c => c.text).join('\n')}`
              } else {
                functionResult = mcpResult.content.map(content => {
                  if (content.type === 'text') {
                    return content.text || ''
                  } else if (content.type === 'image') {
                    return `[Image: ${content.mimeType || 'unknown'}]`
                  } else if (content.type === 'resource') {
                    return `[Resource: ${content.mimeType || 'unknown'}]`
                  }
                  return '[Unknown content type]'
                }).join('\n')
              }
            } catch (mcpError) {
              console.error('MCP tool execution failed:', mcpError)
              functionResult = `Failed to execute MCP tool: ${mcpError}`
            }
          } else {
            // Execute built-in function
            // Executing built-in function
            functionResult = await executeFunction(functionName, functionArgs, documentChunks)
          }

          // Add function result to conversation
          const messagesWithFunction = [
            ...processedMessages,
            initialMessage,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: functionResult
            }
          ]

          // Get final response with function result
          const finalStream = await openai.chat.completions.create({
            model: model,
            messages: messagesWithFunction,
            temperature: 0.7,
            max_tokens: 2000,
            stream: true
          })

          const encoder = new TextEncoder()
          const readableStream = new ReadableStream({
            async start(controller) {
              try {
                // Send function call info first
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  content: '', 
                  function_call: { name: functionName, arguments: functionArgs }
                })}\n\n`))

                // Then stream the final response
                for await (const chunk of finalStream) {
                  const content = chunk.choices[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              } catch (error) {
                controller.error(error)
              } finally {
                controller.close()
              }
            }
          })

          return new Response(readableStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          })
        }
      } catch (toolError) {
        console.log('Function calling not supported or failed, falling back to normal streaming')
      }
    }

    // No function call needed or function calling not supported, stream normal response
    const stream = await openai.chat.completions.create({
      model: model,
      messages: processedMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true
    })

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('API route error:', error)
    
    // Check if it's a 413 request entity too large error
    if (error instanceof Error && error.message.includes('413')) {
      return NextResponse.json(
        { error: 'Request too large. Please use smaller images (under 4MB) for vision analysis.' },
        { status: 413 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}