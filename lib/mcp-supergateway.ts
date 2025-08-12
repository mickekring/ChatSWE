// MCP Supergateway Client - exactly mimics Claude Desktop approach
import { spawn, ChildProcess } from 'child_process'
import { MCPTool, MCPToolCall, MCPToolResult } from './mcp-client'

export class MCPSupergatewayClient {
  private serverUrl: string
  private process: ChildProcess | null = null
  private tools: MCPTool[] = []
  private initialized = false
  private sessionActive = false

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
    console.log('MCPSupergatewayClient created for:', serverUrl)
  }

  // Initialize using direct mcp-remote approach (works around supergateway bug)
  async initialize(): Promise<MCPTool[]> {
    try {
      console.log('Initializing MCP client using direct mcp-remote approach for n8n server...')
      
      // Try using mcp-remote directly instead of supergateway due to bug
      const tools = await this.discoverToolsViaMCPRemote()
      this.tools = tools
      this.initialized = true
      
      console.log('MCP client initialized successfully with', tools.length, 'tools via mcp-remote')
      return tools
    } catch (error) {
      console.error('Failed to initialize MCP client:', error)
      return []
    }
  }

  // Use mcp-remote directly to connect to n8n server (bypass supergateway bug)
  private async discoverToolsViaMCPRemote(): Promise<MCPTool[]> {
    return new Promise((resolve, reject) => {
      console.log('Using mcp-remote to discover tools from n8n server:', this.serverUrl)
      
      // Start mcp-remote process
      const args = ['mcp-remote', this.serverUrl]
      console.log('Running mcp-remote with args:', args)
      
      const process = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let responded = false
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!responded) {
          responded = true
          console.log('mcp-remote tools discovery timeout')
          process.kill()
          resolve([])
        }
      }, 15000)

      let initialized = false
      let toolsRequested = false

      // Handle stdout for responses
      process.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString().trim())
          console.log('mcp-remote response:', response)
          
          // Check for initialization response
          if (!initialized && response.result && response.result.protocolVersion) {
            console.log('mcp-remote server initialized successfully')
            initialized = true
            
            // Now request tools
            const toolsRequest = {
              jsonrpc: '2.0',
              method: 'tools/list',
              params: {},
              id: Date.now()
            }
            console.log('Sending tools/list request after initialization:', toolsRequest)
            process.stdin.write(JSON.stringify(toolsRequest) + '\n')
            toolsRequested = true
            return
          }
          
          // Check for tools response
          if (toolsRequested && response.result && response.result.tools && !responded) {
            responded = true
            clearTimeout(timeoutId)
            process.kill()
            
            const tools = response.result.tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description || 'No description available',
              inputSchema: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              }
            }))
            
            console.log('Successfully discovered tools via mcp-remote:', tools.length)
            console.log('Tool names:', tools.map(t => t.name).join(', '))
            resolve(tools)
          }
        } catch (parseError) {
          console.error('Error parsing mcp-remote response:', parseError)
        }
      })

      // Handle stderr
      process.stderr.on('data', (data) => {
        console.log('mcp-remote stderr:', data.toString())
      })

      // Handle process exit
      process.on('exit', (code) => {
        console.log('mcp-remote process exited with code:', code)
        if (!responded) {
          responded = true
          clearTimeout(timeoutId)
          resolve([])
        }
      })

      // Handle process error
      process.on('error', (error) => {
        console.error('mcp-remote process error:', error)
        if (!responded) {
          responded = true
          clearTimeout(timeoutId)
          reject(error)
        }
      })

      // Send initialize request first (required by n8n server)
      const initRequest = {
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
            name: 'berget-gpt-client',
            version: '1.0.0'
          }
        },
        id: Date.now()
      }

      console.log('Sending initialize request via mcp-remote:', initRequest)
      process.stdin.write(JSON.stringify(initRequest) + '\n')
    })
  }

  private async startSupergateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Starting supergateway with SSE connection to:', this.serverUrl)
      
      // Start supergateway exactly like Claude Desktop does
      this.process = spawn('npx', [
        '-y',
        'supergateway', 
        '--sse', 
        this.serverUrl
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let started = false
      const startTimeout = setTimeout(() => {
        if (!started) {
          started = true
          reject(new Error('Supergateway startup timeout'))
        }
      }, 10000)

      this.process.stderr?.on('data', (data) => {
        const output = data.toString()
        console.log('Supergateway stderr:', output)
        
        if (output.includes('Stdio server listening')) {
          if (!started) {
            started = true
            clearTimeout(startTimeout)
            this.sessionActive = true
            resolve()
          }
        }
      })

      this.process.on('error', (error) => {
        console.error('Supergateway process error:', error)
        if (!started) {
          started = true
          clearTimeout(startTimeout)
          reject(error)
        }
      })

      this.process.on('exit', (code) => {
        console.log('Supergateway process exited with code:', code)
        this.sessionActive = false
      })
    })
  }

  private async discoverToolsViaSupergateway(): Promise<MCPTool[]> {
    if (!this.process || !this.sessionActive) {
      throw new Error('Supergateway not active')
    }

    return new Promise((resolve) => {
      const tools: MCPTool[] = []
      let responseReceived = false
      
      // Set up response handler
      this.process!.stdout?.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString().trim())
          console.log('Supergateway tools response:', response)
          
          if (response.result && response.result.tools) {
            response.result.tools.forEach((tool: any) => {
              tools.push({
                name: tool.name,
                description: tool.description || 'No description available',
                inputSchema: tool.inputSchema || {
                  type: 'object',
                  properties: {},
                  required: []
                }
              })
            })
          }
          
          if (!responseReceived) {
            responseReceived = true
            resolve(tools)
          }
        } catch (error) {
          console.error('Error parsing supergateway response:', error)
          if (!responseReceived) {
            responseReceived = true
            resolve([])
          }
        }
      })

      // Send tools/list request
      const toolsRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now()
      }

      console.log('Sending tools/list request via supergateway:', toolsRequest)
      this.process!.stdin?.write(JSON.stringify(toolsRequest) + '\n')

      // Timeout fallback
      setTimeout(() => {
        if (!responseReceived) {
          console.log('Tools discovery timeout, returning empty array')
          responseReceived = true
          resolve([])
        }
      }, 10000)
    })
  }

  // Execute tool via mcp-remote (same approach as tool discovery)
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    return this.executeToolViaMCPRemote(toolCall)
  }

  // Execute tool using the same mcp-remote approach that works for discovery
  private async executeToolViaMCPRemote(toolCall: MCPToolCall): Promise<MCPToolResult> {
    return new Promise((resolve, reject) => {
      console.log('Using mcp-remote to execute tool:', toolCall.name, 'with args:', toolCall.arguments)
      
      // Start mcp-remote process for tool execution
      const args = ['mcp-remote', this.serverUrl]
      console.log('Running mcp-remote with args:', args)
      
      const process = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let responded = false
      let initialized = false
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!responded) {
          responded = true
          console.log('mcp-remote tool execution timeout')
          process.kill()
          resolve({
            content: [{
              type: 'text',
              text: 'Tool execution timeout'
            }],
            isError: true
          })
        }
      }, 30000)

      // Handle stdout for responses
      process.stdout.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString().trim())
          console.log('mcp-remote tool execution response:', response)
          
          // Check for initialization response
          if (!initialized && response.result && response.result.protocolVersion) {
            console.log('mcp-remote tool execution server initialized successfully')
            initialized = true
            
            // Now execute the tool
            const toolRequest = {
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: toolCall.name,
                arguments: toolCall.arguments || {}
              },
              id: Date.now()
            }
            console.log('Sending tool execution request after initialization:', toolRequest)
            process.stdin.write(JSON.stringify(toolRequest) + '\n')
            return
          }
          
          // Check for tool execution response
          if (initialized && !responded) {
            responded = true
            clearTimeout(timeoutId)
            process.kill()
            
            if (response.error) {
              resolve({
                content: [{
                  type: 'text',
                  text: `Tool execution error: ${response.error.message || 'Unknown error'}`
                }],
                isError: true
              })
            } else if (response.result) {
              if (response.result.content) {
                resolve({
                  content: Array.isArray(response.result.content) ? response.result.content : [response.result.content],
                  isError: false
                })
              } else {
                resolve({
                  content: [{
                    type: 'text',
                    text: typeof response.result === 'string' ? response.result : JSON.stringify(response.result, null, 2)
                  }],
                  isError: false
                })
              }
            } else {
              resolve({
                content: [{
                  type: 'text',
                  text: 'No result returned from tool execution'
                }],
                isError: true
              })
            }
          }
        } catch (parseError) {
          console.error('Error parsing mcp-remote tool execution response:', parseError)
        }
      })

      // Handle stderr
      process.stderr.on('data', (data) => {
        console.log('mcp-remote tool execution stderr:', data.toString())
      })

      // Handle process exit
      process.on('exit', (code) => {
        console.log('mcp-remote tool execution process exited with code:', code)
        if (!responded) {
          responded = true
          clearTimeout(timeoutId)
          resolve({
            content: [{
              type: 'text',
              text: `Tool execution failed with exit code: ${code}`
            }],
            isError: true
          })
        }
      })

      // Handle process error
      process.on('error', (error) => {
        console.error('mcp-remote tool execution process error:', error)
        if (!responded) {
          responded = true
          clearTimeout(timeoutId)
          reject(error)
        }
      })

      // Send initialize request first (required by n8n server)
      const initRequest = {
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
            name: 'berget-gpt-client',
            version: '1.0.0'
          }
        },
        id: Date.now()
      }

      console.log('Sending initialize request for tool execution via mcp-remote:', initRequest)
      process.stdin.write(JSON.stringify(initRequest) + '\n')
    })
  }

  getTools(): MCPTool[] {
    return this.tools
  }

  isConnected(): boolean {
    return this.initialized && this.sessionActive
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.sessionActive = false
    this.initialized = false
    this.tools = []
  }
}