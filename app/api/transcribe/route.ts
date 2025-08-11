import { NextRequest, NextResponse } from 'next/server'
import { getBergetAIConfig } from '@/lib/env-validation'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Create FormData for Berget API
    const bergetFormData = new FormData()
    bergetFormData.append('file', audioFile)
    bergetFormData.append('model', 'KBLab/kb-whisper-large')

    const bergetConfig = getBergetAIConfig()
    const response = await fetch(`${bergetConfig.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bergetConfig.apiKey}`
      },
      body: bergetFormData
    })

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`)
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })

  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    )
  }
}