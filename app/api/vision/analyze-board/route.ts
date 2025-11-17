import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    console.log('Vision API called - analyzing board content')

    // Call GPT-4o-mini Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are analyzing a teaching video frame. The teacher is teaching MP Board Class 12 students.

⚠️ CRITICAL - FOCUS AREA:
**LOOK ONLY AT THE LEFT HALF OF THE SCREEN** - this is where the video player is located.

⚠️ IMPORTANT - WHAT TO IGNORE:
The screenshot will contain UI elements on the RIGHT SIDE like:
- Transcript panels, chat interfaces, buttons, headers
- Token counts, time stamps, navigation elements
- Any overlaid text or interface components
- Sidebars, menus, or application UI

**COMPLETELY IGNORE THE RIGHT SIDE. Focus ONLY on the LEFT HALF where the video player shows the teacher teaching.**

TASK: Extract and describe what is visible on the BOARD/TEACHING MATERIAL in the video (LEFT SIDE ONLY).

Focus on:
1. Main topic/subject being taught
2. All formulas, equations, or mathematical expressions
3. Diagrams, graphs, or visual representations
4. Key concepts, definitions, or terms written
5. Step-by-step solutions or calculations shown
6. Any text written on the blackboard/whiteboard/smart board

FORMAT YOUR RESPONSE AS:
Topic: [Main topic/chapter]

Content:
- [List all formulas, equations, text visible ON THE BOARD]
- [Include mathematical notation exactly as shown]
- [Describe any diagrams or visual elements]

Keep it concise but complete. Focus ONLY on educational content visible on the teaching board in the LEFT HALF of the screen.`
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 500
    })

    const content = response.choices[0]?.message?.content || ''

    console.log('Vision API response:', content.substring(0, 100) + '...')

    return NextResponse.json({
      description: content,
      success: true
    })

  } catch (error) {
    console.error('Error in vision API:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
