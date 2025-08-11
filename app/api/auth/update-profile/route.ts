import { NextRequest, NextResponse } from 'next/server'
import { updateUser } from '@/lib/nocodb'
import jwt from 'jsonwebtoken'
import { getJWTSecret } from '@/lib/env-validation'

export async function POST(request: NextRequest) {
  try {
    const { userId, firstName, lastName, email } = await request.json()
    console.log('Update profile API: Request data', { userId, firstName, lastName, email })
    
    // Verify the token from headers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Update profile API: Missing or invalid auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    console.log('Update profile API: Token received, length:', token.length)
    
    try {
      const jwtSecret = getJWTSecret()
      const decoded = jwt.verify(token, jwtSecret) as any
      console.log('Update profile API: JWT decoded:', decoded)
      
      // Ensure the user is updating their own profile (convert both to strings for comparison)
      if (String(decoded.userId) !== String(userId)) {
        console.log('User ID mismatch:', { decoded: decoded.userId, provided: userId, decodedType: typeof decoded.userId, providedType: typeof userId })
        return NextResponse.json({ error: 'Unauthorized - User ID mismatch' }, { status: 401 })
      }
      console.log('Update profile API: User authorization successful')
    } catch (error) {
      console.log('Update profile API: JWT verification failed:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    // Update user in database
    const updateData: any = {
      first_name: firstName,
      last_name: lastName
    }
    
    // Only update email if provided
    if (email) {
      updateData.email = email
    }
    
    const updatedUser = await updateUser(userId, updateData)
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      user: updatedUser
    })
    
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}