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
      model: 'gpt-5-mini', // Using GPT-4o mini for faster and cost-effective responses
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
    return `पिछले 2 मिनट की कक्षा:
${transcript}

छात्र का प्रश्न: "${query}"${name_str}

---

आपका काम:

1️⃣ पहले तय करें - यह क्या है?
   • असली प्रश्न (विषय से जुड़ा या मार्गदर्शन चाहिए)
   • शोर (नमस्ते, हाँ, ठीक है जैसे शब्द)

2️⃣ अगर असली प्रश्न है तो उत्तर दें

---

JSON में जवाब दें (KEYS अंग्रेजी में):

{
    "is_genuine": true/false,
    "category": "subject_doubt"/"guidance"/"noise",
    "confidence": 0.0-1.0,
    "reason": "हिंदी में छोटा कारण",
    "answer": "उत्तर यहाँ" (असली प्रश्न पर ही, नहीं तो null)
}

---

उत्तर कैसे लिखें (सिर्फ असली प्रश्नों के लिए):

📝 ढांचा (45-50 शब्द, 5-6 लाइन):
   
   पहली लाइन: ${studentName ? `${studentName} बेटा!` : 'बेटा!'}
   
   खाली लाइन: \\n\\n
   
   बीच की लाइन: मुख्य बात समझाएं
   
   खाली लाइन: \\n\\n
   
   आखिरी लाइन: सूत्र या छोटा उदाहरण

---

✅ करें:
   • आसान भाषा में समझाएं
   • ज़रूरी जगह पर \\n\\n डालें
   • शिक्षक की तरह प्यार से बोलें
   • सीधा जवाब दें

❌ न करें:
   • HTML टैग नहीं (<b>, <i>)
   • Markdown नहीं (**, ##, -)
   • Bullet points नहीं (•, *, -)

---

उदाहरण:

"राज बेटा!\\n\\nबल का मतलब है धक्का या खिंचाव। फॉर्मूला है: बल = द्रव्यमान × त्वरण।\\n\\nयहाँ 5 kg × 3 m/s² = 15 N आएगा। समझ आया?"

(शब्द: लगभग 45-50)

---
Example:-  

---

उदाहरण 1:

"राज बेटा!\\n\\nबल का मतलब है धक्का या खिंचाव। फॉर्मूला है: बल = द्रव्यमान × त्वरण।\\n\\nयहाँ 5 kg × 3 m/s² = 15 N आएगा। समझ आया?"

(शब्द: लगभग 35-40)

---

उदाहरण 2:

"Ekta बेटा!\\n\\nTransitive relation वह होता है जिसमें यदि A R B और B R C हैं, तो A R C भी होगा।\\n\\nउदाहरण: अगर 1 < 2 और 2 < 3, तो 1 < 3 भी होगा।"

(शब्द: लगभग 40-45)

---

⚠️ ध्यान दें:
- सिर्फ valid JSON में output दें
- JSON keys अंग्रेजी में (is_genuine, category, etc.)
- Answer में \\n\\n ज़रूर use करें`
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
   • Line 1: ${studentName ? `Hello ${studentName} beta! ` : 'Beta! '}
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