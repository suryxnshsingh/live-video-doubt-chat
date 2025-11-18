// Test script for classifier flow
const testCases = [
  {
    name: 'Test 1: Subject-based question (should call expensive model)',
    payload: {
      message: 'Newton ka second law kya hai?',
      language: 'hindi',
      studentName: 'Raj',
      pdfContext: 'Newton\'s Laws of Motion - Second Law: F = ma',
      recentTranscript: 'Aaj hum Newton ke laws padhenge. Pehla law inertia ke baare mein tha.'
    }
  },
  {
    name: 'Test 2: Guidance question (should skip expensive model)',
    payload: {
      message: '20 kaise aaya?',
      language: 'hindi',
      studentName: 'Priya',
      pdfContext: 'Distance formula: s = ut + ½at²',
      recentTranscript: 'Maan lo u = 0, a = 10 m/s², t = 2 seconds, toh s = 0 + ½×10×4 = 20 meters'
    }
  },
  {
    name: 'Test 3: Noise/Acknowledgment (should skip expensive model)',
    payload: {
      message: 'haan sir',
      language: 'hindi',
      studentName: 'Amit',
      pdfContext: 'Quadratic Equations',
      recentTranscript: 'Toh ab hum discriminant samjhenge...'
    }
  }
]

async function runTests() {
  console.log('🧪 Starting Classifier Tests...\n')

  for (const test of testCases) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`📝 ${test.name}`)
    console.log(`${'='.repeat(70)}`)
    console.log(`Question: "${test.payload.message}"`)

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.payload)
      })

      const data = await response.json()

      console.log('\n✅ Response:')
      console.log(`   Category: ${data.classification.category}`)
      console.log(`   Is Genuine: ${data.classification.is_genuine}`)
      console.log(`   Confidence: ${data.classification.confidence}`)
      console.log(`   Reason: ${data.classification.reason}`)
      console.log(`   Reply: ${data.reply ? data.reply.substring(0, 80) + '...' : 'null'}`)

      // Verify expected behavior
      if (test.name.includes('Subject-based') && data.classification.category !== 'subject_based') {
        console.log('   ⚠️  WARNING: Expected subject_based but got', data.classification.category)
      }
      if (test.name.includes('Guidance') && data.classification.category !== 'guidance') {
        console.log('   ⚠️  WARNING: Expected guidance but got', data.classification.category)
      }
      if (test.name.includes('Noise') && data.classification.category !== 'noise') {
        console.log('   ⚠️  WARNING: Expected noise but got', data.classification.category)
      }

    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`)
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log('✅ All tests completed!')
  console.log(`${'='.repeat(70)}\n`)
}

runTests().catch(console.error)
