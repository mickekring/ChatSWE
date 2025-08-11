import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getBergetAIConfig } from '@/lib/env-validation'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    // Initialize OpenAI client at request time
    const bergetConfig = getBergetAIConfig()
    const openai = new OpenAI({
      apiKey: bergetConfig.apiKey,
      baseURL: bergetConfig.baseUrl
    })

    // Create a concise summary of the conversation for title generation
    const conversationSummary = messages
      .slice(0, 4) // Use first 4 messages max
      .map((m: any) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n')

    const response = await openai.chat.completions.create({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [
        {
          role: 'system',
          content: 'Generate a very short, descriptive title (3-6 words) for this conversation. The title should capture the main topic or question. Respond with ONLY the title, no quotes, no punctuation at the end.'
        },
        {
          role: 'user',
          content: conversationSummary
        }
      ],
      temperature: 0.7,
      max_tokens: 20
    })

    const title = response.choices[0].message.content?.trim() || 'New Chat'
    
    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    )
  }
}