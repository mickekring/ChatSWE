import { NextRequest, NextResponse } from 'next/server'
import { initializeMCPClient, getMCPClient, getMCPTools } from '@/lib/mcp-client'

// Cache for MCP tools (in production, consider using Redis or database)
let toolsCache: {
  tools: any[]
  lastUpdated: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// GET /api/mcp - Get available MCP tools
export async function GET(request: NextRequest) {
  console.log('MCP API called')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    // Force refresh - disconnect client and clear cache
    if (forceRefresh) {
      console.log('Force refresh requested - clearing cache and reconnecting')
      const mcpClient = getMCPClient()
      if (mcpClient) {
        mcpClient.disconnect()
      }
      toolsCache = null
      
      // Re-initialize and fetch fresh tools
      const freshTools = await initializeMCPClient()
      if (freshTools.length > 0) {
        toolsCache = {
          tools: freshTools,
          lastUpdated: Date.now()
        }
        console.log('Fresh tools fetched:', freshTools.length)
        return NextResponse.json({
          success: true,
          tools: freshTools,
          cached: false,
          lastUpdated: toolsCache.lastUpdated,
          refreshed: true
        })
      }
    }
    
    // Check cache first and return immediately if available and not expired
    const cacheExpired = toolsCache && (Date.now() - toolsCache.lastUpdated) > CACHE_DURATION
    if (!cacheExpired && toolsCache && toolsCache.tools.length > 0) {
      console.log('Returning cached MCP tools:', toolsCache.tools.length)
      return NextResponse.json({
        success: true,
        tools: toolsCache.tools,
        cached: true,
        lastUpdated: toolsCache.lastUpdated
      })
    }

    // Get any existing tools from MCP client cache
    let tools = getMCPTools()
    console.log('Current MCP client tools:', tools.length)
    
    // Return tools immediately if we have them
    if (tools.length > 0) {
      console.log('Returning MCP client cached tools:', tools.length)
      // Update main cache
      toolsCache = {
        tools,
        lastUpdated: Date.now()
      }
      
      return NextResponse.json({
        success: true,
        tools,
        cached: false,
        lastUpdated: toolsCache.lastUpdated
      })
    }

    // No tools found or cache expired - initialize to get fresh tools
    console.log('No tools available or cache expired, fetching fresh tools')
    
    try {
      const freshTools = await initializeMCPClient()
      if (freshTools.length > 0) {
        console.log('Fresh MCP tools fetched:', freshTools.length)
        toolsCache = {
          tools: freshTools,
          lastUpdated: Date.now()
        }
        return NextResponse.json({
          success: true,
          tools: freshTools,
          cached: false,
          lastUpdated: toolsCache.lastUpdated
        })
      }
    } catch (initError) {
      console.error('Failed to initialize MCP client:', initError)
    }

    // Return empty tools if all else fails
    return NextResponse.json({
      success: true,
      tools: [],
      cached: false,
      lastUpdated: Date.now(),
      message: 'No tools available'
    })
  } catch (error) {
    console.error('Failed to get MCP tools:', error)
    return NextResponse.json({
      success: true, // Still return success but with empty tools
      tools: [],
      cached: false,
      lastUpdated: Date.now(),
      error: 'Failed to fetch MCP tools'
    })
  }
}

// POST /api/mcp - Execute MCP tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, arguments: toolArgs } = body

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: 'Tool name is required' },
        { status: 400 }
      )
    }

    const mcpClient = getMCPClient()
    if (!mcpClient || !mcpClient.isConnected()) {
      return NextResponse.json(
        { success: false, error: 'MCP client not connected' },
        { status: 503 }
      )
    }

    // Execute the tool
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: toolArgs || {}
    })

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Failed to execute MCP tool:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute MCP tool',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/mcp - Clear cache and disconnect
export async function DELETE() {
  try {
    const mcpClient = getMCPClient()
    if (mcpClient) {
      mcpClient.disconnect()
    }
    
    // Clear cache
    toolsCache = null

    return NextResponse.json({
      success: true,
      message: 'MCP client disconnected and cache cleared'
    })
  } catch (error) {
    console.error('Failed to disconnect MCP client:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect MCP client',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}