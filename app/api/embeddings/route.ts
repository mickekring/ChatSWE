import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getBergetAIConfig } from '@/lib/env-validation'

export async function POST(request: NextRequest) {
  try {
    const { texts } = await request.json()

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: 'Invalid texts provided' }, { status: 400 })
    }

    if (texts.length === 0) {
      return NextResponse.json({ error: 'No texts provided' }, { status: 400 })
    }

    // Initialize OpenAI client at request time
    const bergetConfig = getBergetAIConfig()
    const openai = new OpenAI({
      apiKey: bergetConfig.apiKey,
      baseURL: bergetConfig.baseUrl
    })

    console.log('Creating embeddings for', texts.length, 'texts using Berget AI')
    console.log('Text lengths:', texts.map(t => t.length))

    // Create embeddings using OpenAI text-embedding-3-small
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    })

    console.log('Berget AI embeddings created successfully')
    const embeddings = response.data.map((item: any) => item.embedding)

    return NextResponse.json({
      embeddings,
      model: 'text-embedding-3-small',
      dimensions: 1536
    })

  } catch (error) {
    console.error('Berget AI embeddings API error:', error)
    return NextResponse.json(
      { error: 'Failed to create embeddings with Berget AI' },
      { status: 500 }
    )
  }
}