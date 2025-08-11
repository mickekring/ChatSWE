import { NextRequest, NextResponse } from 'next/server'
import { updateMessage, deleteMessage } from '@/lib/chat-history'
import jwt from 'jsonwebtoken'
import { getJWTSecret } from '@/lib/env-validation'

// Update message
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { content, metadata } = await request.json()
    const { id } = await params
    const messageId = parseInt(id)
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const jwtSecret = getJWTSecret()
    jwt.verify(token, jwtSecret) as any
    
    const message = await updateMessage(messageId, {
      content,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    })
    
    if (!message) {
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message
    })
    
  } catch (error) {
    console.error('Update message error:', error)
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    )
  }
}

// Delete message
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { conversationId } = await request.json()
    const { id } = await params
    const messageId = parseInt(id)
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const jwtSecret = getJWTSecret()
    jwt.verify(token, jwtSecret) as any
    
    const success = await deleteMessage(messageId, conversationId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true
    })
    
  } catch (error) {
    console.error('Delete message error:', error)
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}