import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Interface for chat request
interface ChatRequest {
  message: string
  videoTimestamp?: number
  recentTranscript?: string
  studentName?: string
  language?: 'hindi' | 'english'
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const {
      message,
      videoTimestamp = 0,
      recentTranscript = '',
      studentName = null,
      language = 'hindi'
    } = body

    console.log('Chat API called with:', { message, language, transcriptLength: recentTranscript.length })

    // Create the prompt based on language
    const prompt = createPrompt(message, recentTranscript, language, studentName)
    const systemPrompt = getSystemPrompt(language)

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-4o mini for faster and cost-effective responses
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 600
    })

    const content = completion.choices[0]?.message?.content || ''

    // Parse the JSON response
    const result = extractJsonResponse(content)

    console.log('OpenAI Classification:', {
      is_genuine: result.is_genuine,
      category: result.category,
      confidence: result.confidence,
      reason: result.reason,
      hasAnswer: !!result.answer
    })

    // Only respond if it's a genuine doubt
    if (result.is_genuine) {
      return NextResponse.json({
        reply: result.answer || 'कृपया अपना प्रश्न स्पष्ट करें।',
        classification: {
          is_genuine: result.is_genuine,
          category: result.category,
          confidence: result.confidence,
          reason: result.reason
        }
      })
    } else {
      // For noise/greetings, don't respond or give a brief acknowledgment
      return NextResponse.json({
        reply: null,
        classification: {
          is_genuine: false,
          category: result.category || 'noise',
          confidence: result.confidence || 0,
          reason: result.reason || 'Not a subject-related question'
        }
      })
    }

  } catch (error) {
    console.error('Error in chat API:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        error: 'Failed to process your request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function createPrompt(
  query: string,
  transcript: string,
  language: string,
  studentName: string | null
): string {
  const name_str = studentName ? `\nStudent: ${studentName}` : ''

  if (language === 'hindi') {
    return `संदर्भ (Last 5 minutes class teaching):
${transcript}

छात्र का प्रश्न: "${query}"${name_str}

कार्य: दो चीजें करें -
1. क्या यह genuine doubt है? (subject doubt/guidance) या noise है? (greetings/random/single words)
2. अगर genuine है तो उत्तर दें proper formatting के साथ

JSON FORMAT में output:
{
    "is_genuine": true/false,
    "category": "subject_doubt"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "brief reason in Hindi",
    "answer": "properly formatted answer with line breaks" (only if genuine, else null)
}

Answer Guidelines (केवल genuine doubts के लिए):
✅ STRUCTURE - इस format में answer दें:
   • Line 1: ${studentName ? `Arre ${studentName} बेटा! ` : 'बेटा! '}warm greeting
   • Line 2: Empty line (\\n\\n for separation)
   • Line 3-4: Main explanation या concept
   • Line 5: Empty line
   • Line 6-7: Formula या calculation (अगर applicable हो)
   • Line 8: Empty line
   • Line 9-10: Example with numbers
   • Line 11: Empty line
   • Line 12: Class reference या final point

✅ FORMATTING RULES:
   • हर major point के बाद \\n\\n (double line break) use करें
   • Formulas को separate line में लिखें
   • Examples को clearly separate करें
   • 5-7 sentences total, well-organized
   • Natural teacher tone maintain करें

✅ CONTENT:
   • Class context reference: "याद है हमने क्लास में..."
   • Working example with actual numbers
   • Formula clearly visible
   • Warm, encouraging tone

❌ DON'T USE: HTML tags, markdown symbols (**, ##, etc.), bullet points (•, -, *)

**Output केवल valid JSON में दें। Answer में proper line breaks (\\n\\n) जरूर use करें।**`
  } else {
    return `CONTEXT (Last 5 minutes class teaching):
${transcript}

Student Query: "${query}"${name_str}

TASK: Do TWO things -
1. Is this genuine doubt? (subject/guidance) or noise? (greetings/random/single words)
2. If genuine, give properly formatted answer in Hinglish

JSON FORMAT output:
{
    "is_genuine": true/false,
    "category": "subject_doubt"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "brief reason in English",
    "answer": "properly formatted answer with line breaks" (only if genuine, else null)
}

Answer Guidelines (only for genuine doubts):
✅ STRUCTURE - Answer in this format:
   • Line 1: ${studentName ? `Arre ${studentName} beta! ` : 'Beta! '}warm greeting
   • Line 2: Empty line (\\n\\n for separation)
   • Line 3-4: Main explanation/concept
   • Line 5: Empty line
   • Line 6-7: Formula/calculation (if applicable)
   • Line 8: Empty line
   • Line 9-10: Example with numbers
   • Line 11: Empty line
   • Line 12: Class reference or final point

✅ FORMATTING RULES:
   • Use \\n\\n (double line break) after each major point
   • Write formulas on separate lines
   • Clearly separate examples
   • 5-7 sentences total, well-organized
   • Maintain natural teacher tone

✅ CONTENT:
   • Natural Hinglish mix (Hindi words + English sentences)
   • Class context reference: "Yaad hai class mein humne..."
   • Working example with actual numbers
   • Formula clearly visible
   • Warm, encouraging tone

❌ DON'T USE: HTML tags, markdown symbols (**, ##, etc.), bullet points (•, -, *)

**Give output in valid JSON ONLY. Use proper line breaks (\\n\\n) in the answer.**`
  }
}

function getSystemPrompt(language: string): string {
  if (language === 'hindi') {
    return `आप MP Board कक्षा 12वीं के expert teacher हैं।
Live class में students के doubts solve करते हैं।
यह one-shot Q&A है - हर question independent है, कोई conversation history नहीं।
दो कार्य करें:
(1) query को classify करें (genuine vs noise)
(2) अगर genuine है तो properly formatted answer दें with proper line breaks (\\n\\n)

IMPORTANT: Answer में proper formatting use करें - हर major point के बाद \\n\\n line break दें।
केवल valid JSON format में respond करें।`
  } else {
    return `You are an MP Board class 12th expert teacher.
You solve students' doubts in live classes.
This is one-shot Q&A - each question is independent, no conversation history.
Do two tasks:
(1) classify the query (genuine vs noise)
(2) if genuine, give properly formatted answer in Hinglish with proper line breaks (\\n\\n)

IMPORTANT: Use proper formatting in answer - add \\n\\n line breaks after each major point.
Respond ONLY in valid JSON format.`
  }
}

function extractJsonResponse(content: string): any {
  try {
    // Remove markdown code blocks if present
    let cleanContent = content.trim()

    if (cleanContent.startsWith('```')) {
      const lines = cleanContent.split('\n')
      const jsonLines = []
      let inJson = false

      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          inJson = !inJson
          continue
        }
        if (inJson || (line.trim().startsWith('{') || jsonLines.length > 0)) {
          jsonLines.push(line)
          if (line.trim().endsWith('}') && line.split('}').length >= line.split('{').length) {
            break
          }
        }
      }
      cleanContent = jsonLines.join('\n')
    }

    return JSON.parse(cleanContent)
  } catch (error) {
    // Fallback: try to find JSON in the string
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}') + 1

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(content.substring(start, end))
      } catch {
        // Return default response if parsing fails
        return {
          is_genuine: false,
          category: 'error',
          confidence: 0,
          reason: 'Failed to parse response',
          answer: null
        }
      }
    }

    return {
      is_genuine: false,
      category: 'error',
      confidence: 0,
      reason: 'Failed to parse response',
      answer: null
    }
  }
}