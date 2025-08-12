// MCP (Model Context Protocol) Client for n8n integration
// Handles communication with n8n MCP server via direct POST requests

// Import EventSource properly for both client and server (optional for streaming)
let EventSource: any
if (typeof window !== 'undefined') {
  EventSource = window.EventSource
} else {
  const EventSourceModule = require('eventsource')
  EventSource = EventSourceModule.EventSource
}

// Import proxy service for tool execution
import { executeMCPToolViaProxy } from './mcp-proxy'
import { getMCPConfig } from './env-validation'
import { MCPSupergatewayClient } from './mcp-supergateway'

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, any>
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

class MCPClient {
  private baseUrl: string
  private sseUrl: string
  private tools: MCPTool[] = []
  private connected: boolean = false
  private eventSource: EventSource | null = null
  private supergatewayClient: MCPSupergatewayClient | null = null

  constructor(serverUrl: string) {
    // Extract base URL and SSE URL
    if (serverUrl.endsWith('/sse')) {
      this.sseUrl = serverUrl
      this.baseUrl = serverUrl.replace('/sse', '')
    } else {
      this.baseUrl = serverUrl
      this.sseUrl = serverUrl + '/sse'
    }
    
    console.log('MCP Client configured:')
    console.log('Base URL:', this.baseUrl)
    console.log('SSE URL:', this.sseUrl)
  }

  // Initialize connection and discover tools
  async initialize(): Promise<MCPTool[]> {
    try {
      console.log('Initializing MCP client...')
      console.log('Timestamp:', new Date().toISOString())
      
      // Check if this is an n8n server that needs supergateway
      if (this.baseUrl.includes('nodemation.labbytan.se')) {
        console.log('Detected n8n MCP server - using supergateway approach (like Claude Desktop)')
        return await this.initializeWithSupergateway()
      }
      
      // Fallback to original HTTP approach for other servers
      console.log('Using direct HTTP approach for non-n8n server')
      
      // Optional: Connect to SSE for streaming (not required for basic functionality)
      this.connectSSE()
      
      // Discover tools via POST request to base endpoint
      const tools = await this.discoverTools()
      this.tools = tools
      this.connected = true
      
      console.log('MCP Client initialized successfully')
      console.log('Connected:', this.connected)
      console.log('Tools count:', tools.length)
      console.log('Tool names:', tools.map(t => t.name).join(', '))
      return tools
    } catch (error) {
      console.error('Failed to initialize MCP client:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      this.connected = false
      return []
    }
  }

  // Initialize using supergateway (same as Claude Desktop)
  private async initializeWithSupergateway(): Promise<MCPTool[]> {
    try {
      console.log('Initializing with supergateway for n8n server:', this.baseUrl)
      
      this.supergatewayClient = new MCPSupergatewayClient(this.baseUrl)
      const tools = await this.supergatewayClient.initialize()
      
      this.tools = tools
      this.connected = this.supergatewayClient.isConnected()
      
      console.log('Supergateway MCP client initialized:', this.connected)
      console.log('Tools discovered:', tools.length)
      console.log('Tool names:', tools.map(t => t.name).join(', '))
      
      return tools
    } catch (error) {
      console.error('Failed to initialize with supergateway:', error)
      return []
    }
  }

  // Optional SSE connection for streaming responses during tool execution
  private connectSSE(): void {
    try {
      console.log('Connecting to SSE endpoint:', this.sseUrl)
      this.eventSource = new EventSource(this.sseUrl)
      
      if (this.eventSource) {
        this.eventSource.onopen = () => {
          console.log('SSE connection opened')
        }
        
        this.eventSource.onmessage = (event) => {
          console.log('SSE message:', event.data)
          // Handle streaming responses here if needed during tool execution
        }
        
        this.eventSource.onerror = (error) => {
          console.error('SSE error:', error)
          // SSE errors are not critical for basic functionality
        }
      }
    } catch (error) {
      console.error('Failed to connect SSE (non-critical):', error)
      // SSE connection failure is not critical
    }
  }

  // Discover available tools using supergateway SSE approach (same as Claude Desktop)
  private async discoverTools(): Promise<MCPTool[]> {
    try {
      console.log('Discovering tools using supergateway SSE approach for n8n server:', this.baseUrl)
      
      // Helper function to parse SSE response
      const parseSSEResponse = (text: string): any => {
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            return JSON.parse(line.substring(6))
          }
        }
        throw new Error('No data found in SSE response')
      }

      // Try to get tools directly first (n8n might not require separate initialization)
      console.log('Attempting direct tools/list request...')
      try {
        const directToolsResponse = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: Date.now()
          })
        })

        if (directToolsResponse.ok) {
          const directToolsText = await directToolsResponse.text()
          console.log('Direct tools response:', directToolsText)
          
          const directToolsData = parseSSEResponse(directToolsText)
          
          if (directToolsData.result && directToolsData.result.tools) {
            const tools = directToolsData.result.tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description || 'No description available',
              inputSchema: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              }
            }))
            
            console.log('Successfully discovered', tools.length, 'tools directly')
            console.log('Tool names:', tools.map((t: MCPTool) => t.name).join(', '))
            return tools
          } else if (directToolsData.error && directToolsData.error.message.includes('not initialized')) {
            console.log('Server requires initialization, proceeding with full handshake...')
          }
        }
      } catch (error) {
        console.log('Direct tools request failed, trying with initialization:', error)
      }

      // If direct approach failed, try with initialization
      console.log('Initializing MCP server...')
      const initResponse = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              prompts: {},
              resources: {}
            },
            clientInfo: {
              name: 'n8n-chat-client',
              version: '1.0.0'
            }
          },
          id: Date.now()
        })
      })

      if (!initResponse.ok) {
        console.error('Failed to initialize MCP server:', initResponse.status, initResponse.statusText)
        throw new Error(`Server initialization failed: ${initResponse.status}`)
      }

      const initText = await initResponse.text()
      console.log('Raw init response:', initText)
      const initData = parseSSEResponse(initText)
      console.log('MCP server initialized:', initData)

      // n8n MCP Server doesn't maintain session between requests
      // Check if tools are declared in the capabilities from initialization
      if (initData.result && initData.result.capabilities && initData.result.capabilities.tools) {
        const toolsCapabilities = initData.result.capabilities.tools
        console.log('Tools capabilities from init:', toolsCapabilities)
        
        // If tools are defined in capabilities, try to extract them
        if (Object.keys(toolsCapabilities).length > 0) {
          console.log('Found tools in capabilities:', Object.keys(toolsCapabilities))
          // Convert capabilities to tool definitions
          const tools = Object.keys(toolsCapabilities).map(toolName => ({
            name: toolName,
            description: toolsCapabilities[toolName]?.description || 'No description available',
            inputSchema: toolsCapabilities[toolName]?.inputSchema || {
              type: 'object',
              properties: {},
              required: []
            }
          }))
          
          console.log('Extracted tools from capabilities:', tools)
          return tools
        }
      }

      // Try separate tools/list request (might fail due to stateless nature)
      console.log('No tools in capabilities, trying separate tools/list request...')
      try {
        const toolsResponse = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: Date.now()
          })
        })

        if (toolsResponse.ok) {
          const toolsText = await toolsResponse.text()
          console.log('Raw tools response:', toolsText)
          const toolsData = parseSSEResponse(toolsText)
          console.log('Tools response:', toolsData)
          
          // Process tools data (keep the existing logic)
          if (toolsData.result && toolsData.result.tools) {
            const tools = toolsData.result.tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description || 'No description available',
              inputSchema: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              }
            }))
            
            console.log('Successfully discovered', tools.length, 'tools from separate request')
            return tools
          }
        } else {
          console.log('Separate tools/list request failed:', toolsResponse.status, toolsResponse.statusText)
        }
      } catch (separateError) {
        console.log('Separate tools/list request failed:', separateError)
      }

      // If we get here, no tools were found
      console.warn('No tools discovered from n8n MCP server')
      console.warn('This likely means either:')
      console.warn('1. No tools are configured in the n8n MCP workflow')
      console.warn('2. The n8n server requires persistent connections (not stateless HTTP)')
      return []
    } catch (error) {
      console.error('Tool discovery error:', error)
      console.error('Failed to dynamically discover tools from n8n MCP server')
      
      // Don't throw - return empty array so the app doesn't break
      return []
    }
  }

  // Execute a tool call - use supergateway for n8n servers, fallback to proxy
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      console.log('MCP tool call:', toolCall.name, 'with args:', toolCall.arguments)
      
      // Use supergateway client if available (for n8n servers)
      if (this.supergatewayClient && this.supergatewayClient.isConnected()) {
        console.log('Using supergateway for tool execution')
        return await this.supergatewayClient.callTool(toolCall)
      }
      
      // Try direct HTTP execution for non-n8n servers
      try {
        const result = await this.executeToolDirectly(toolCall)
        if (result && !result.isError) {
          console.log('Direct MCP tool execution successful')
          return result
        }
      } catch (directError) {
        console.log('Direct tool execution failed, trying proxy:', directError)
      }
      
      // Fallback to mcp-remote proxy
      console.log('Using mcp-remote proxy for tool execution')
      const result = await executeMCPToolViaProxy(toolCall)
      
      console.log('MCP proxy result:', result)
      return result
    } catch (error) {
      console.error('Failed to call MCP tool:', error)
      return {
        content: [{ 
          type: 'text', 
          text: `Error calling MCP tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      }
    }
  }

  // Execute tool directly via HTTP (handles n8n's SSE format)
  private async executeToolDirectly(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      console.log('Executing tool directly via HTTP:', toolCall.name)
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolCall.name,
            arguments: toolCall.arguments || {}
          },
          id: Date.now()
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseText = await response.text()
      console.log('Direct tool execution response:', responseText)

      // Parse SSE response
      const lines = responseText.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6))
          
          if (data.error) {
            return {
              content: [{ 
                type: 'text', 
                text: `Tool execution error: ${data.error.message || 'Unknown error'}` 
              }],
              isError: true
            }
          }
          
          if (data.result) {
            // Convert n8n result format to MCP format
            return {
              content: [{ 
                type: 'text', 
                text: typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)
              }],
              isError: false
            }
          }
        }
      }
      
      throw new Error('No valid data found in SSE response')
    } catch (error) {
      console.error('Direct tool execution failed:', error)
      throw error
    }
  }

  // Get available tools
  getTools(): MCPTool[] {
    return this.tools
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected
  }

  // Disconnect from the MCP server
  disconnect(): void {
    if (this.supergatewayClient) {
      this.supergatewayClient.disconnect()
      this.supergatewayClient = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.connected = false
    this.tools = []
  }
}

// Global MCP client instance
let mcpClient: MCPClient | null = null

// Initialize MCP client with URL from environment variables
export async function initializeMCPClient(
  serverUrl?: string
): Promise<MCPTool[]> {
  // Use provided URL or get from environment with fallback
  let finalServerUrl = serverUrl
  if (!finalServerUrl) {
    try {
      finalServerUrl = getMCPConfig().serverUrl
    } catch {
      // MCP is optional, use new n8n MCP server URL  
      finalServerUrl = 'https://nodemation.labbytan.se/mcp/71780819-b168-41ba-97eb-f4c85e15f78a'
    }
  }
  console.log('initializeMCPClient called with URL:', finalServerUrl)
  
  // Always create a new client to ensure fresh initialization
  mcpClient = new MCPClient(finalServerUrl)
  
  return await mcpClient.initialize()
}

// Get MCP client instance
export function getMCPClient(): MCPClient | null {
  return mcpClient
}

// Execute MCP tool
export async function executeMCPTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
  if (!mcpClient) {
    throw new Error('MCP client not initialized')
  }
  
  return await mcpClient.callTool(toolCall)
}

// Get available MCP tools
export function getMCPTools(): MCPTool[] {
  return mcpClient?.getTools() || []
}