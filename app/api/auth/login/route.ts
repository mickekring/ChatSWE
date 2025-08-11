import { NextRequest, NextResponse } from 'next/server'
import { getUserByUsername, verifyPassword } from '@/lib/nocodb'
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

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Check if user exists and verify password
    const user = await getUserByUsername(username)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    const isValidPassword = await verifyPassword(username, password)
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // NocoDB uses 'Id' (capital I) instead of 'id'
    const userId = user.Id || user.id

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: userId,
        username: user.username,
        email: user.email 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return user info and token
    const responseData = {
      success: true,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        systemPrompt: user.system_prompt,
        theme: user.theme,
        language: user.language || 'sv'
      },
      token
    }
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}