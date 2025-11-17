import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en' // Default to English

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Map language to Whisper language codes
    const getWhisperLanguageCode = (lang: string) => {
      switch (lang) {
        case 'hi':
          return 'hi' // Hindi
        case 'hinglish':
        case 'en':
        default:
          return 'en' // English (Whisper handles Hinglish better with 'en')
      }
    }

    // Map language to appropriate prompt
    const getPrompt = (lang: string) => {
      switch (lang) {
        case 'hi':
          return 'This is a student asking a question in a live class in Hindi.'
        case 'hinglish':
          return 'This is a student asking a question in a live class. They may speak in a mix of Hindi and English (Hinglish).'
        case 'en':
        default:
          return 'This is a student asking a question in a live class in English.'
      }
    }

    // Convert File to proper format for OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: getWhisperLanguageCode(language),
      prompt: getPrompt(language)
    })

    return NextResponse.json({
      text: transcription.text
    })

  } catch (error) {
    console.error('Error transcribing audio:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}