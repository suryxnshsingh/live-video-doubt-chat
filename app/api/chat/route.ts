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
  pdfContext?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const {
      message,
      videoTimestamp = 0,
      recentTranscript = '',
      studentName = 'ekta',
      language = 'hindi',
      pdfContext = ''
    } = body

    console.log('Chat API called with:', { message, language, transcriptLength: recentTranscript.length, pdfContextLength: pdfContext.length })

    // Create the prompt based on language
    const prompt = createPrompt(message, recentTranscript, language, studentName, pdfContext)
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
  studentName: string | null,
  pdfContext: string = ''
): string {
  // Create combined prompt for single API call with PROPER FORMATTING
  const name_str = studentName ? `\nStudent: ${studentName}` : ''

  if (language === 'hindi') {
    // PASTE YOUR COMPLETE HINDI PROMPT HERE
    return `PDF Context (Current topic being taught):
${pdfContext}

---

Previous 2 minutes of class transcript:
${transcript}

Student's question: "${query}"${name_str}

---

YOUR TASK:

1️⃣ **UNDERSTAND THE COMPLETE CONTEXT:**
   - PDF Context: What topic/concept is in the teaching material?
   - Transcript: What was just explained in the last 2 minutes?
   - Student Question: What are they asking about?
   - **Combine both PDF and transcript to understand the full picture**

2️⃣ **CLASSIFY THE QUESTION:**
   • Genuine Question (subject_doubt): New question about the PDF topic OR seeking guidance
   • Follow-up Question (follow_up): Connected to what was JUST explained in transcript (asking about a variable, number, step, or formula just mentioned)
   • Noise: Greetings, fillers, acknowledgments (hello, yes, okay, hmm, etc.)

3️⃣ **PROVIDE CONTEXT-AWARE ANSWER:**
   - Use PDF context to understand the main topic
   - Use transcript to see what was just taught
   - Answer based on BOTH contexts combined

---

---

HOW TO WRITE THE ANSWER (only for genuine and follow-up questions):

📝 STRUCTURE (40-50 words, 5-6 lines):

   Line 1: {student_greeting}

   Empty line: \\n\\n

   Middle lines: Core explanation (use PDF context for topic, transcript for specific details)

   Empty line: \\n\\n

   Last line: Formula or example (from PDF or transcript)

---

✅ DO:
   • Read BOTH PDF context and transcript carefully
   • Use PDF context to understand the main topic
   • Use transcript to see what was just explained
   • For follow-ups, reference the specific part from transcript
   • Use simple, conversational Hindi
   • Keep it concise (40-50 words maximum)
   • Speak warmly like a caring teacher

❌ DON'T:
   • Don't ignore either PDF or transcript context
   • Don't give answers unrelated to the PDF topic
   • No HTML tags (<b>, <i>, <br>)
   • No Markdown (**, ##, -)
   • No bullet points (•, *, -)

---

CONTEXT-AWARE EXAMPLES:

**Example 1 - Using Both Contexts:**
PDF Context: "Newton's Laws of Motion - Second Law: F = ma"
Transcript: "तो बच्चों, अगर mass 10 kg है और acceleration 2 m/s² है, तो force कितना होगा? देखो, F = m × a = 10 × 2 = 20 N"
Question: "acceleration क्या है?"

Answer:
"राज बेटा!\\n\\nAcceleration यानी त्वरण - यह बताता है velocity कितनी तेज़ी से बदल रही है। अभी हमने 2 m/s² लिया था।\\n\\nUnit है m/s², मतलब मीटर प्रति सेकंड स्क्वायर।"

(Category: "follow_up", Reason: "छात्र ने अभी समझाए गए formula में a (acceleration) के बारे में पूछा")

---

**Example 2 - PDF Topic, Transcript Details:**
PDF Context: "Quadratic Equations: ax² + bx + c = 0, Solution: x = (-b ± √(b²-4ac))/2a"
Transcript: "इस formula में b² - 4ac को discriminant कहते हैं। जैसे x² + 5x + 6 = 0 में, b² - 4ac = 25 - 24 = 1"
Question: "discriminant कहाँ से आया?"

Answer:
"राज बेटा!\\n\\nDiscriminant quadratic formula का part है - यह b² - 4ac होता है। Root के अंदर वाला part।\\n\\nइससे roots की nature पता चलती है।"

(Category: "follow_up", Reason: "छात्र ने अभी बताए गए discriminant के बारे में पूछा, PDF में quadratic formula है")

---

**Example 3 - Follow-up on Calculation:**
PDF Context: "Distance formula: s = ut + ½at²"
Transcript: "मान लो u = 0, a = 10 m/s², t = 2 seconds, तो s = 0 + ½×10×4 = 20 meters"
Question: "20 कैसे आया?"

Answer:
"राज बेटा!\\n\\n20 meters इसलिए आया क्योंकि ½×10×4 = 20। हमने s = ½at² formula use किया।\\n\\n½ × 10 × 4 = 5 × 4 = 20 meters।"

(Category: "follow_up", Reason: "छात्र ने अभी की गई calculation (20 meters) के बारे में पूछा")

---

**Example 4 - Noise:**
Question: "हाँ"
Answer: null
(Category: "noise", is_genuine: false, Reason: "सिर्फ acknowledgment है, कोई प्रश्न नहीं")

---

⚠️ CRITICAL INSTRUCTIONS:

1. **Context Analysis (MOST IMPORTANT):**
   - Step 1: Read PDF context - What is the main topic/formula/concept?
   - Step 2: Read transcript - What was just explained in last 2 minutes?
   - Step 3: Read student question - What are they asking?
   - Step 4: Determine if it's about something just mentioned (follow-up) or new question

2. **For Follow-up Questions:**
   - These ask about something JUST mentioned in the transcript
   - Look for specific variables, numbers, steps, or terms from transcript
   - Answer using both PDF (for main concept) and transcript (for specific detail)
   - Use phrases: "जो अभी हमने देखा", "इसी example में", "अभी हमने"

3. **Common Follow-up Patterns:**
   - "X क्या है?" → If X was just mentioned in transcript = follow_up
   - "यह कैसे आया?" → Asking about a calculation/result just shown = follow_up
   - "कैसे निकाला?" → Asking about method just used = follow_up
   - "number कहाँ से?" → Asking about specific number just calculated = follow_up
   - "constant/variable कहाँ से?" → If just mentioned in transcript = follow_up

4. **Output Format:**
   - Output ONLY valid JSON
   - Keys in English, answer in Hindi
   - Use \\n\\n for line breaks in answer
   - Keep answers 40-50 words maximum
   - Maintain warm, teacher-like tone

5. **Quality Check:**
   - Did you read both PDF context and transcript?
   - Is your answer relevant to the PDF topic?
   - For follow-ups, did you reference what was just taught?
   - Is it 40-50 words with proper \\n\\n spacing?
   - Is it in simple Hindi without formatting marks?

RESPOND IN JSON FORMAT (keys in English):

{
    "is_genuine": true/false,
    "category": "subject_doubt"/"follow_up"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "Brief reason in Hindi",
    "answer": "Answer here" (only for genuine/follow-up questions, otherwise null)
}`
  } else {
    // PASTE YOUR COMPLETE ENGLISH/HINGLISH PROMPT HERE
    return `PDF Context (Current topic being taught):
${pdfContext}

---

Previous 2 minutes of class transcript:
${transcript}

Student's question: "${query}"${name_str}

---

TASK: Classify and respond

JSON OUTPUT:
{{
    "is_genuine": true/false,
    "category": "subject_doubt"/"follow_up"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "brief reason in English",
    "answer": "formatted answer with line breaks" (only if genuine, else null)
}}

ANSWER GUIDELINES (35-40 words):
✅ Structure: Greeting + \\n\\n + Explanation + \\n\\n + Formula/Example
✅ Use \\n\\n for line breaks
✅ Natural Hinglish tone
❌ No HTML, markdown, or bullet points

Example: "{'Hello ' + student_name + ' beta!' if student_name else 'Beta!'}\\n\\nForce = mass × acceleration. Here 5 kg × 3 m/s² = 15 N.\\n\\nSamajh aa gaya?"

Output ONLY valid JSON.`
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