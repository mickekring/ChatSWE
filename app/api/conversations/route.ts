import { NextRequest, NextResponse } from 'next/server'
import { getUserConversations, createConversation } from '@/lib/chat-history'
import jwt from 'jsonwebtoken'
import { getJWTSecret } from '@/lib/env-validation'

// Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const jwtSecret = getJWTSecret()
    const decoded = jwt.verify(token, jwtSecret) as any
    
    const conversations = await getUserConversations(decoded.userId)
    
    return NextResponse.json({
      success: true,
      conversations
    })
    
  } catch (error) {
    console.error('Get conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    )
  }
}

// Create new conversation
export async function POST(request: NextRequest) {
  try {
    const { title, modelUsed, promptUsed } = await request.json()
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const jwtSecret = getJWTSecret()
    const decoded = jwt.verify(token, jwtSecret) as any
    
    const conversation = await createConversation({
      userId: decoded.userId,
      title,
      modelUsed,
      promptUsed
    })
    
    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      conversation
    })
    
  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}