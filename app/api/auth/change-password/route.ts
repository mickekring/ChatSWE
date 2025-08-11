import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, verifyPassword, updatePassword } from '@/lib/nocodb'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export async function POST(request: NextRequest) {
  try {
    // Check if JWT_SECRET is configured
    if (!JWT_SECRET) {
      console.error('JWT_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      )
    }

    // Verify the JWT token
    const token = authHeader.slice(7)
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      )
    }

    // Verify current password
    const username = decoded.username
    const isValidPassword = await verifyPassword(username, currentPassword)
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Update password
    const userId = decoded.userId
    const success = await updatePassword(userId, newPassword)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}