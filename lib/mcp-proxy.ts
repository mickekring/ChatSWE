// MCP Proxy Service - Routes MCP calls through mcp-remote to n8n server
import { spawn } from 'child_process'
import { MCPToolCall, MCPToolResult } from './mcp-client'
import { getMCPConfig } from './env-validation'

export interface MCPProxyConfig {
  mcpUrl: string
  authToken?: string
}

export class MCPProxy {
  private config: MCPProxyConfig
  private initialized: boolean = false

  constructor(config: MCPProxyConfig) {
    this.config = config
  }

  // Execute a tool call through mcp-remote proxy
  async executeToolCall(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      console.log('MCP Proxy executing tool:', toolCall.name, 'with args:', toolCall.arguments)

      // Create the mcp-remote command
      const args = [
        'mcp-remote',
        this.config.mcpUrl
      ]

      // Add auth header if provided
      if (this.config.authToken) {
        args.push('--header', `Authorization: Bearer ${this.config.authToken}`)
      }

      console.log('Running mcp-remote with args:', args)

      // Execute mcp-remote as a child process
      const result = await this.runMCPRemote(args, toolCall)
      
      return result
    } catch (error) {
      console.error('MCP Proxy execution failed:', error)
      return {
        content: [{
          type: 'text',
          text: `MCP Proxy Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      }
    }
  }

  private async runMCPRemote(args: string[], toolCall: MCPToolCall): Promise<MCPToolResult> {
    return new Promise((resolve) => {
      // Spawn the mcp-remote process
      const process = spawn('npx', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let resolved = false
      let initialized = false
      
      // Set timeout first
      const timeoutId = setTimeout(() => {
        if (!process.killed && !resolved) {
          console.log('Killing mcp-remote process due to timeout - no response received')
          resolved = true
          process.kill()
          resolve({
            content: [{
              type: 'text',
              text: 'MCP execution timed out - no response received from n8n server'
            }],
            isError: true
          })
        }
      }, 45000) // 45 second timeout

      // Collect output and parse responses in real-time
      process.stdout.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk
        console.log('mcp-remote stdout chunk:', chunk)
        
        // Check if we have a JSON-RPC response
        if (chunk.includes('"jsonrpc":"2.0"') && !resolved) {
          console.log('Detected JSON-RPC response in stdout')
          try {
            const response = JSON.parse(chunk.trim())
            
            // Check for initialization response
            if (!initialized && response.result && response.result.protocolVersion) {
              console.log('mcp-remote proxy initialized successfully')
              initialized = true
              
              // Now send the actual tool call
              const toolRequest = {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                  name: toolCall.name,
                  arguments: toolCall.arguments || {}
                },
                id: Date.now()
              }
              console.log('Sending tool call request after initialization:', toolRequest)
              process.stdin.write(JSON.stringify(toolRequest) + '\n')
              return
            }
            
            // Check for tool execution response
            if (initialized && response.result && response.id) {
              console.log('Parsing tool execution response')
              // We got a valid response - resolve immediately
              resolved = true
              clearTimeout(timeoutId)
              process.kill()
              
              if (response.result.content) {
                resolve({
                  content: Array.isArray(response.result.content) ? response.result.content : [response.result.content],
                  isError: false
                })
              } else {
                resolve({
                  content: [{
                    type: 'text',
                    text: typeof response.result === 'string' ? response.result : JSON.stringify(response.result)
                  }],
                  isError: false
                })
              }
              return
            }
          } catch (parseError) {
            console.error('Error parsing JSON-RPC response:', parseError)
          }
        }
      })

      process.stderr.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        console.log('mcp-remote stderr chunk:', chunk)
      })

      // Send initialization request first (required by n8n server)
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

      try {
        console.log('Sending initialization request to mcp-remote proxy')
        process.stdin.write(JSON.stringify(initRequest) + '\n')
        // Don't close stdin immediately - keep the connection open for response
      } catch (error) {
        console.error('Error writing to mcp-remote stdin:', error)
      }

      // Handle process completion (backup fallback)
      process.on('close', (code) => {
        if (resolved) return
        
        console.log('mcp-remote process closed with code:', code)
        console.log('stdout:', stdout)
        console.log('stderr:', stderr)
        
        clearTimeout(timeoutId)
        resolved = true

        if (code === 0 && stdout) {
          try {
            // Try to parse the full stdout for JSON-RPC response
            const lines = stdout.trim().split('\n')
            for (const line of lines) {
              if (line.includes('"jsonrpc":"2.0"')) {
                const response = JSON.parse(line)
                if (response.result) {
                  if (response.result.content) {
                    resolve({
                      content: Array.isArray(response.result.content) ? response.result.content : [response.result.content],
                      isError: false
                    })
                    return
                  }
                  
                  resolve({
                    content: [{
                      type: 'text',
                      text: typeof response.result === 'string' ? response.result : JSON.stringify(response.result)
                    }],
                    isError: false
                  })
                  return
                }
              }
            }
          } catch (parseError) {
            console.error('Error parsing final stdout:', parseError)
          }
        }

        // Fallback for errors
        resolve({
          content: [{
            type: 'text',
            text: `MCP execution completed with code ${code}. Output: ${stdout || stderr || 'No output'}`
          }],
          isError: code !== 0
        })
      })

      // Handle process errors
      process.on('error', (error) => {
        if (resolved) return
        
        console.error('mcp-remote process error:', error)
        resolved = true
        clearTimeout(timeoutId)
        resolve({
          content: [{
            type: 'text',
            text: `MCP Process Error: ${error.message}`
          }],
          isError: true
        })
      })
    })
  }
}

// Singleton instance
let mcpProxy: MCPProxy | null = null

export function getMCPProxy(): MCPProxy {
  if (!mcpProxy) {
    let mcpConfig
    try {
      mcpConfig = getMCPConfig()
    } catch {
      // MCP is optional, use supergateway approach for n8n server
      mcpConfig = {
        serverUrl: 'https://nodemation.labbytan.se/mcp/71780819-b168-41ba-97eb-f4c85e15f78a',
        authToken: undefined
      }
    }
    mcpProxy = new MCPProxy({
      mcpUrl: mcpConfig.serverUrl,
      authToken: mcpConfig.authToken || undefined
    })
  }
  return mcpProxy
}

export async function executeMCPToolViaProxy(toolCall: MCPToolCall): Promise<MCPToolResult> {
  const proxy = getMCPProxy()
  return await proxy.executeToolCall(toolCall)
}