"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

// Note: SonioxClient is dynamically imported to avoid SSR issues with window object

export interface TranscriptSegment {
  id: string
  text: string
  startTime: number
  endTime: number
  isFinal: boolean
  confidence: number
}

interface UseSonioxTranscriptionProps {
  apiKey?: string
  language?: string
}

export function useSonioxTranscription({
  apiKey,
  language = 'en'
}: UseSonioxTranscriptionProps = {}) {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sonioxClientRef = useRef<any | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start transcription from video element
  const startTranscription = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!apiKey) {
      // For POC, we'll simulate transcription
      console.warn('No Soniox API key provided. Using simulated transcription.')
      simulateTranscription(videoElement)
      return
    }

    try {
      setError(null)
      setIsTranscribing(true)

      // Capture audio stream from video
      const stream = (videoElement as any).captureStream()
      if (!stream) {
        throw new Error('Unable to capture stream from video element')
      }

      streamRef.current = stream

      // Dynamically import and create Soniox client
      const { SonioxClient } = await import('@soniox/speech-to-text-web')
      sonioxClientRef.current = new SonioxClient({
        apiKey: apiKey,
        bufferQueueSize: 1000,
        onStarted: () => {
          console.log('Soniox transcription started')
          setIsConnected(true)
        },
        onFinished: () => {
          console.log('Soniox transcription finished')
          setIsConnected(false)
          setIsTranscribing(false)
        },
        onPartialResult: (result: any) => {
          // Handle partial results
          if (result.tokens && result.tokens.length > 0) {
            setTranscript(prev => {
              // Keep all previous final tokens
              const existingFinals = prev.filter(s => s.isFinal)

              // Process only the new tokens from this result
              const incomingTokens: TranscriptSegment[] = result.tokens.map((token: any) => ({
                id: `segment-${token.start_ms}-${token.end_ms}-${token.is_final ? 'f' : 'p'}`,
                text: (token.text || '').trim().normalize('NFC'), // Normalize to composed form for proper Devanagari rendering
                startTime: (token.start_ms || 0) / 1000,
                endTime: (token.end_ms || 0) / 1000,
                isFinal: token.is_final || false,
                confidence: token.confidence || 0.0
              }))

              // Separate final and provisional tokens from incoming
              const incomingFinals = incomingTokens.filter((t: TranscriptSegment) => t.isFinal && t.text.length > 0)
              const incomingProvisional = incomingTokens.filter((t: TranscriptSegment) => !t.isFinal && t.text.length > 0)

              // Deduplicate final tokens
              const allFinals = [...existingFinals]
              incomingFinals.forEach(newFinal => {
                // Check if this final token already exists
                const isDuplicate = allFinals.some(existing =>
                  existing.text === newFinal.text &&
                  Math.abs(existing.startTime - newFinal.startTime) < 0.5
                )
                if (!isDuplicate) {
                  allFinals.push(newFinal)
                }
              })

              // Add provisional tokens (they will be replaced by finals later)
              const combined = [...allFinals, ...incomingProvisional]

              // Sort by start time
              return combined.sort((a, b) => a.startTime - b.startTime)
            })
          }
        },
        onError: (status: any, message: string, errorCode?: number) => {
          console.error('Soniox error:', status, message, errorCode)
          setError(`Soniox error: ${message}`)
          setIsTranscribing(false)
          setIsConnected(false)
        }
      })

      // Configure for Hindi with Devanagari script (not Urdu)
      const languageConfig = {
        languageCode: 'hi-IN',
        // Strong hints for Devanagari script
        hints: [
          'हिंदी देवनागरी',
          'देवनागरी लिपि',
          'Hindi Devanagari script',
          'not Urdu',
          'not Arabic script'
        ],
        enableAutomaticPunctuation: true,
        // Try to force better Hindi recognition
        enableSeparateRecognitionPerChannel: false
      }

      // Start transcription with custom stream - using v3 model for better Hindi support
      await sonioxClientRef.current.start({
        model: 'stt-rt-v3',
        stream: stream,
        includeNonfinal: true,
        speechContext: languageConfig
      })

    } catch (error) {
      console.error('Error starting transcription:', error)
      setError(error instanceof Error ? error.message : 'Failed to start transcription')
      setIsTranscribing(false)
    }
  }, [apiKey, language])

  // Start transcription from tab audio (for YouTube)
  const startTabAudioTranscription = useCallback(async () => {
    if (!apiKey) {
      // For POC, simulate transcription
      console.warn('No Soniox API key provided. Using simulated transcription for YouTube.')
      simulateYouTubeTranscription()
      return
    }

    try {
      setError(null)
      setIsTranscribing(true)

      // Request screen/tab capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
        video: {
          width: 1,
          height: 1,
        } as MediaTrackConstraints // Minimal video to get audio
      })

      // Stop video track immediately (we only need audio)
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.stop()
      }

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        throw new Error('No audio track available. Please share a tab with audio.')
      }

      streamRef.current = stream

      // Dynamically import and create Soniox client for tab audio
      const { SonioxClient } = await import('@soniox/speech-to-text-web')
      sonioxClientRef.current = new SonioxClient({
        apiKey: apiKey,
        bufferQueueSize: 1000,
        onStarted: () => {
          console.log('Soniox transcription started for tab audio')
          setIsConnected(true)
        },
        onFinished: () => {
          console.log('Soniox transcription finished')
          setIsConnected(false)
          setIsTranscribing(false)
        },
        onPartialResult: (result: any) => {
          // Handle partial results
          if (result.tokens && result.tokens.length > 0) {
            setTranscript(prev => {
              // Keep all previous final tokens
              const existingFinals = prev.filter(s => s.isFinal)

              // Process only the new tokens from this result
              const incomingTokens: TranscriptSegment[] = result.tokens.map((token: any) => ({
                id: `segment-${token.start_ms}-${token.end_ms}-${token.is_final ? 'f' : 'p'}`,
                text: (token.text || '').trim().normalize('NFC'), // Normalize to composed form for proper Devanagari rendering
                startTime: (token.start_ms || 0) / 1000,
                endTime: (token.end_ms || 0) / 1000,
                isFinal: token.is_final || false,
                confidence: token.confidence || 0.0
              }))

              // Separate final and provisional tokens from incoming
              const incomingFinals = incomingTokens.filter((t: TranscriptSegment) => t.isFinal && t.text.length > 0)
              const incomingProvisional = incomingTokens.filter((t: TranscriptSegment) => !t.isFinal && t.text.length > 0)

              // Deduplicate final tokens
              const allFinals = [...existingFinals]
              incomingFinals.forEach(newFinal => {
                // Check if this final token already exists
                const isDuplicate = allFinals.some(existing =>
                  existing.text === newFinal.text &&
                  Math.abs(existing.startTime - newFinal.startTime) < 0.5
                )
                if (!isDuplicate) {
                  allFinals.push(newFinal)
                }
              })

              // Add provisional tokens (they will be replaced by finals later)
              const combined = [...allFinals, ...incomingProvisional]

              // Sort by start time
              return combined.sort((a, b) => a.startTime - b.startTime)
            })
          }
        },
        onError: (status: any, message: string, errorCode?: number) => {
          console.error('Soniox error:', status, message, errorCode)
          setError(`Soniox error: ${message}`)
          setIsTranscribing(false)
          setIsConnected(false)
        }
      })

      // Configure for Hindi with Devanagari script (not Urdu)
      const languageConfig = {
        languageCode: 'hi-IN',
        // Strong hints for Devanagari script
        hints: [
          'हिंदी देवनागरी',
          'देवनागरी लिपि',
          'Hindi Devanagari script',
          'not Urdu',
          'not Arabic script'
        ],
        enableAutomaticPunctuation: true,
        // Try to force better Hindi recognition
        enableSeparateRecognitionPerChannel: false
      }

      // Start transcription with tab audio stream
      await sonioxClientRef.current.start({
        model: 'stt-rt-v3',
        stream: stream,
        includeNonfinal: true,
        speechContext: languageConfig
      })

    } catch (error) {
      console.error('Error starting tab audio transcription:', error)
      if (error instanceof Error && error.message.includes('Permission denied')) {
        setError('Please allow screen/tab sharing to enable transcription')
      } else {
        setError(error instanceof Error ? error.message : 'Failed to start transcription')
      }
      setIsTranscribing(false)
    }
  }, [apiKey, language])

  // Simulate transcription for POC when no API key is provided
  const simulateTranscription = useCallback((videoElement: HTMLVideoElement) => {
    setIsTranscribing(true)
    setIsConnected(true)

    // Sample transcript data
    const sampleTranscripts = [
      "नमस्ते विद्यार्थियों! आज हम न्यूटन का द्वितीय गति नियम पढ़ेंगे।",
      "सूत्र है F = ma. F का मतलब बल, m का मतलब द्रव्यमान, और a का मतलब त्वरण।",
      "पहले समझते हैं कि ये नियम क्या कहता है।",
      "जब हम किसी वस्तु पर बल लगाते हैं, तो उस वस्तु में त्वरण उत्पन्न होता है।",
      "और ये त्वरण तीन चीज़ों पर निर्भर करता है।",
      "कितना बल लगाया, वस्तु का द्रव्यमान कितना है, और किस दिशा में बल लगाया।",
      "ध्यान दें, F, m और a - ये तीनों vector quantities हैं।",
      "मतलब इनकी दिशा भी important है।",
      "अगर force same है, तो F = ma से, a = F/m।",
      "मतलब त्वरण द्रव्यमान के inverse proportional है।"
    ]

    let segmentIndex = 0
    simulationIntervalRef.current = setInterval(() => {
      if (!videoElement.paused && segmentIndex < sampleTranscripts.length) {
        const currentTime = videoElement.currentTime
        const segment: TranscriptSegment = {
          id: `segment-${Date.now()}-${segmentIndex}`,
          text: sampleTranscripts[segmentIndex],
          startTime: currentTime,
          endTime: currentTime + 3,
          isFinal: true,
          confidence: 0.95
        }

        setTranscript(prev => [...prev, segment])
        segmentIndex++
      } else if (segmentIndex >= sampleTranscripts.length) {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current)
          simulationIntervalRef.current = null
        }
      }
    }, 3000) // Add new segment every 3 seconds
  }, [])

  // Simulate YouTube transcription
  const simulateYouTubeTranscription = useCallback(() => {
    setIsTranscribing(true)
    setIsConnected(true)

    // Sample transcript data for YouTube simulation
    const sampleTranscripts = [
      "Welcome to this educational video on physics fundamentals.",
      "Today we'll explore Newton's laws of motion.",
      "Let's start with the first law - the law of inertia.",
      "An object at rest stays at rest unless acted upon by an external force.",
      "The second law relates force, mass, and acceleration.",
      "F equals ma - force equals mass times acceleration.",
      "This fundamental equation helps us understand motion.",
      "Finally, the third law states that every action has an equal and opposite reaction.",
      "These three laws form the foundation of classical mechanics.",
      "Understanding them is crucial for physics students."
    ]

    let segmentIndex = 0
    let currentTime = 0

    simulationIntervalRef.current = setInterval(() => {
      if (segmentIndex < sampleTranscripts.length) {
        const segment: TranscriptSegment = {
          id: `segment-yt-${Date.now()}-${segmentIndex}`,
          text: sampleTranscripts[segmentIndex],
          startTime: currentTime,
          endTime: currentTime + 3,
          isFinal: true,
          confidence: 0.95
        }

        setTranscript(prev => [...prev, segment])
        segmentIndex++
        currentTime += 3
      } else {
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current)
          simulationIntervalRef.current = null
        }
      }
    }, 3000) // Add new segment every 3 seconds
  }, [])


  // Stop transcription
  const stopTranscription = useCallback(() => {
    // Clear simulation interval if running
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = null
    }

    // Stop Soniox client if running
    if (sonioxClientRef.current) {
      try {
        sonioxClientRef.current.stop()
      } catch (error) {
        console.error('Error stopping Soniox client:', error)
      }
      sonioxClientRef.current = null
    }

    // Stop media stream if active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setIsTranscribing(false)
    setIsConnected(false)
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  // Get recent transcript (last N seconds)
  const getRecentTranscript = useCallback((seconds: number) => {
    const now = Date.now() / 1000
    return transcript.filter(segment =>
      (now - segment.startTime) <= seconds
    )
  }, [transcript])

  // Get transcript text as string
  const getTranscriptText = useCallback((segments?: TranscriptSegment[]) => {
    const segs = segments || transcript
    return segs.map(s => s.text).join(' ')
  }, [transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription()
    }
  }, [stopTranscription])

  return {
    transcript,
    isConnected,
    isTranscribing,
    error,
    startTranscription,
    startTabAudioTranscription,
    stopTranscription,
    clearTranscript,
    getRecentTranscript,
    getTranscriptText
  }
}