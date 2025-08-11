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

  // Discover available tools - using known tools from your Claude Desktop setup
  private async discoverTools(): Promise<MCPTool[]> {
    try {
      console.log('Using known n8n MCP tools from your Claude Desktop configuration')
      
      // These are the tools you mentioned are available in your n8n MCP server
      const knownTools = [
        {
          name: 'wikipedia-api',
          description: 'A tool for interacting with and fetching data from the Wikipedia API. The input should always be a string query.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        },
        {
          name: 'Discord',
          description: 'Send a message in Discord',
          inputSchema: {
            type: 'object',
            properties: {
              Message: { type: 'string' }
            },
            required: ['Message']
          }
        },
        {
          name: 'eduassist',
          description: 'Vid frågor om saker som rör läroplanen för svensk grundskola, ska du alltid hämta information härifrån.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        },
        {
          name: 'Send_Email',
          description: 'send email in Send Email',
          inputSchema: {
            type: 'object',
            properties: {
              To_Email: { type: 'string' },
              Subject: { type: 'string' },
              HTML: { type: 'string' }
            },
            required: ['To_Email', 'Subject', 'HTML']
          }
        }
      ]
      
      console.log('Loaded', knownTools.length, 'known n8n MCP tools')
      console.log('Tool names:', knownTools.map(t => t.name))
      
      return knownTools
    } catch (error) {
      console.error('Tool discovery error:', error)
      throw error
    }
  }

  // Execute a tool call via mcp-remote proxy to n8n server
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      console.log('MCP tool call via proxy:', toolCall.name, 'with args:', toolCall.arguments)
      
      // Execute the tool via the proxy
      const result = await executeMCPToolViaProxy(toolCall)
      
      console.log('MCP proxy result:', result)
      return result
    } catch (error) {
      console.error('Failed to call MCP tool via proxy:', error)
      return {
        content: [{ 
          type: 'text', 
          text: `Error calling MCP tool: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      }
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
      // MCP is optional, use default URL
      finalServerUrl = 'https://nodemation.labbytan.se/mcp/myfirstmcpserver'
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