import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { logChatInteraction } from '@/lib/csvLogger'

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
      studentName = 'ekta',
      language = 'hindi'
    } = body

    console.log('Chat API called with:', { message, language, transcriptLength: recentTranscript.length })

    // Create the prompt based on language
    const prompt = createPrompt(message, recentTranscript, language, studentName)
    const systemPrompt = getSystemPrompt(language)

    // Print complete prompts for debugging
    console.log('\n========== COMPLETE PROMPT TO GPT ==========')
    console.log('\n--- SYSTEM PROMPT ---')
    console.log(systemPrompt)
    console.log('\n--- USER PROMPT ---')
    console.log(prompt)
    console.log('\n========== END OF PROMPT ==========\n')

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // Using GPT-4o mini for faster and cost-effective responses
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
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

    // Log the interaction to CSV
    await logChatInteraction({
      timestamp: new Date().toISOString(),
      studentName: studentName || 'unknown',
      userQuery: message,
      transcriptContext: recentTranscript,
      isGenuine: result.is_genuine || false,
      category: result.category || 'unknown',
      confidence: result.confidence || 0,
      reason: result.reason || '',
      response: result.answer || null,
      language: language
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
    return `Previous 2 minutes of class transcript:
${transcript}

Student's question: "${query}"${name_str}

---

YOUR TASK:

1️⃣ First, classify the question type:
   • Genuine Question: Related to the subject being taught OR seeking guidance
   • Follow-up Question: Connected to previous explanation (e.g., "What is F?", "How did you get this?", "Where did this constant come from?")
   • Noise: Greetings, fillers, acknowledgments (hello, yes, okay, hmm, etc.)

2️⃣ If it's a genuine question or follow-up, provide an answer:
   • For follow-ups: Carefully analyze the transcript to understand what was just taught
   • Identify the specific concept, formula, or calculation being asked about
   • Answer in the context of that ongoing explanation

---

RESPOND IN JSON FORMAT (keys in English):

{
    "is_genuine": true/false,
    "category": "subject_doubt"/"follow_up"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "Brief reason in Hindi explaining your classification",
    "answer": "Answer here" (only for genuine/follow-up questions, otherwise null)
}

---

HOW TO WRITE THE ANSWER (only for genuine and follow-up questions):

📝 STRUCTURE (40-50 words, 5-6 lines):
   
   Line 1: ${studentName ? studentName + ' बेटा!' : 'बेटा!'}
   
   Empty line: \\n\\n
   
   Middle lines: Core explanation (for follow-ups, connect to what was just taught in transcript)
   
   Empty line: \\n\\n
   
   Last line: Formula or brief example

---

✅ DO:
   • Use simple, conversational Hindi
   • For follow-ups, reference what was just explained in the transcript
   • Insert \\n\\n at appropriate places for readability
   • Speak warmly like a caring teacher
   • Give direct, focused answers
   • Keep it concise (40-50 words maximum)

❌ DON'T:
   • No HTML tags (<b>, <i>, <br>)
   • No Markdown (**, ##, -, \`\`\`)
   • No bullet points (•, *, -)
   • Don't repeat the entire explanation, just clarify the specific doubt

---

EXAMPLES:

**Example 1 - Main Question:**
Question: "बल क्या होता है?"
Transcript: [Empty or different topic]

Answer:
"राज बेटा!\\n\\nबल का मतलब है धक्का या खिंचाव। फॉर्मूला है: बल = द्रव्यमान × त्वरण।\\n\\nजैसे 5 kg × 3 m/s² = 15 N आएगा।"

(Category: "subject_doubt")

---

**Example 2 - Follow-up Question:**
Question: "त्वरण क्या है?"
Transcript: "...बल का फॉर्मूला है F = m × a, जहाँ m द्रव्यमान है और a त्वरण है..."

Answer:
"राज बेटा!\\n\\nत्वरण यानी acceleration - यह बताता है velocity कितनी तेज़ी से बदल रही है।\\n\\nइसकी unit m/s² है, मतलब मीटर प्रति सेकंड स्क्वायर।"

(Category: "follow_up", Reason: "छात्र ने बल के फॉर्मूले में आए 'a' के बारे में पूछा")

---

**Example 3 - Follow-up Question:**
Question: "15 N कैसे आया?"
Transcript: "...देखो, अगर द्रव्यमान 5 kg है और त्वरण 3 m/s² है, तो बल = 5 × 3 = 15 Newton..."

Answer:
"राज बेटा!\\n\\n15 N आया क्योंकि हमने 5 kg को 3 m/s² से गुणा किया। F = m × a के फॉर्मूले से।\\n\\n5 × 3 = 15 Newton, बस इतना ही!"

(Category: "follow_up", Reason: "छात्र calculation के बारे में पूछ रहा है जो अभी समझाई गई")

---

**Example 4 - Follow-up Question:**
Question: "constant कहाँ से आया?"
Transcript: "...इस equation को integrate करने पर x = ½at² + C मिलता है, जहाँ C एक constant है..."

Answer:
"राज बेटा!\\n\\nConstant C integration से आता है। जब हम integrate करते हैं तो हमेशा एक constant add होता है।\\n\\nयह initial conditions से तय होता है।"

(Category: "follow_up", Reason: "integration में आए constant के बारे में doubt है")

---

**Example 5 - Noise:**
Question: "हाँ"
Transcript: "...समझ आया? ठीक है चलो अगला example देखते हैं..."

Answer: null

(Category: "noise", is_genuine: false, Reason: "सिर्फ acknowledgment है, कोई प्रश्न नहीं")

---

⚠️ CRITICAL INSTRUCTIONS:

1. **For Follow-up Questions:**
   - ALWAYS read the transcript carefully
   - Identify what concept/formula/calculation was just explained
   - Answer specifically about that part
   - Use phrases like "जो अभी हमने देखा", "इसी calculation में", "इस फॉर्मूले में"

2. **Common Follow-up Patterns:**
   - "X क्या है?" → Student asking about a term/variable just mentioned
   - "यह कैसे आया?" → Student asking about a result/number just calculated
   - "कैसे निकाला?" → Student asking about the method just used
   - "constant कहाँ से आया?" → Student asking about a constant in the formula
   - "क्यों?" → Student asking why something was done

3. **Output Format:**
   - Output ONLY valid JSON
   - Keys must be in English
   - Use \\n\\n for line breaks in answer
   - Keep answers 40-50 words maximum
   - Maintain warm, teacher-like tone in Hindi

4. **Quality Check:**
   - Is the answer directly addressing what was just taught?
   - Is it concise (40-50 words)?
   - Does it have proper \\n\\n spacing?
   - Is it in simple Hindi without formatting marks?`
  } else {
    return `CONTEXT (Last 2 minutes class teaching):
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
✅ STRUCTURE - Concise answer (5-6 lines, 35-40 words):
   • Line 1: ${studentName ? 'Hello ' + studentName + ' beta! ' : 'Beta! '}
   • Line 2: Empty line (\\n\\n)
   • Line 3: Explain core concept in 1-2 sentences
   • Line 4: Empty line (\\n\\n)
   • Line 5: Formula or brief example
   • Line 6: Final encouragement

✅ FORMATTING RULES:
   • Use \\n\\n only after important points
   • Keep total to 35-40 words
   • Direct and clear answer
   • Maintain natural teacher tone

✅ CONTENT:
   • Understand question, explain core concept briefly
   • Include formula or one short example if needed
   • Warm, concise tone
   • Natural Hinglish mix (Hindi words + English sentences)

❌ DON'T USE: HTML tags, markdown symbols (**, ##, etc.), bullet points (•, -, *)

EXAMPLE OUTPUT FORMAT:
"Hello Priya beta!\\n\\nForce = mass × acceleration. Here 5 kg × 3 m/s² = 15 N.\\n\\nSamajh aa gaya na? Question ho toh pooch lena!"

(Word count: approximately 35-40 words)

**Give output in valid JSON ONLY. Use proper line breaks (\\n\\n) in the answer.**`
  }
}
function getSystemPrompt(language: string): string {
  if (language === 'hindi') {
    return `आप मध्य प्रदेश बोर्ड कक्षा 12वीं के विशेषज्ञ शिक्षक हैं।
सीधा प्रसारण कक्षा में विद्यार्थियों के संदेह हल करते हैं।
दो कार्य करें:
(1) प्रश्न को वर्गीकृत करें (वास्तविक बनाम शोर)
(2) अगर वास्तविक है तो उचित प्रारूपित उत्तर दें उचित पंक्ति विराम (\\n\\n) के साथ

महत्वपूर्ण:
- उत्तर में उचित प्रारूपण उपयोग करें - हर प्रमुख बिंदु के बाद \\n\\n पंक्ति विराम दें।
- JSON keys ENGLISH में ही दें (is_genuine, category, confidence, reason, answer)
- केवल वैध JSON प्रारूप में प्रतिक्रिया दें।`
  } else {
    return `You are an MP Board class 12th expert teacher.
You solve students' doubts in live classes.
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