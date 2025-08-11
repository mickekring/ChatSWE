import { NextRequest, NextResponse } from 'next/server'
import { getUsers, createUser } from '@/lib/nocodb'

export async function GET(request: NextRequest) {
  try {
    // Test fetching users
    const users = await getUsers()
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount: users.length,
      users: users.map(u => ({ username: u.username, email: u.email }))
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to database'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create a test user (you can delete this later)
    const testUser = await createUser({
      username: 'micke',
      password: 'kring',
      email: 'micke@example.com',
      first_name: 'Micke',
      last_name: 'Kring'
    })
    
    return NextResponse.json({
      success: true,
      message: 'Test user created',
      user: testUser
    })
  } catch (error) {
    console.error('User creation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create user'
    }, { status: 500 })
  }
}