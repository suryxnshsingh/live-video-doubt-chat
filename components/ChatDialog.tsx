"use client"

import React, { useState, useEffect, useRef } from 'react'
import { X, User, Bot, Loader2, FileText, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import ChatInput from './ChatInput'
import { cn } from '@/lib/utils'
import type { TranscriptSegment } from '@/hooks/useSonioxTranscription'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  videoTimestamp?: number
}

interface ChatDialogProps {
  isOpen?: boolean
  onClose: () => void
  transcript: TranscriptSegment[]
  videoTime: number
  language?: string
  className?: string
  videoElement?: HTMLVideoElement | null
  isYouTubeVideo?: boolean
}

export default function ChatDialog({
  isOpen = true,
  onClose,
  transcript,
  videoTime,
  language = 'en',
  className,
  videoElement = null,
  isYouTubeVideo = false
}: ChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pdfContext, setPdfContext] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }, [messages])

  // Get recent transcript for context (last 2 minutes)
  const getRecentTranscript = () => {
    const recentSegments = transcript.filter(segment =>
      videoTime - segment.startTime <= 200 // 2 minutes = 120 seconds
    )
    return recentSegments.map(s => s.text).join(' ')
  }

  // Capture video frame and analyze with vision API
  const handleScanBoard = async () => {
    setIsScanning(true)

    try {
      let imageData: string

      if (isYouTubeVideo) {
        // For YouTube videos, request screen/tab capture
        console.log('Requesting screen capture for YouTube video...')

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' as any }
        })

        // Create a temporary video element to play the stream
        const tempVideo = document.createElement('video')
        tempVideo.srcObject = stream
        tempVideo.muted = true
        await tempVideo.play()

        // Wait a moment for the video to render
        await new Promise(resolve => setTimeout(resolve, 500))

        // Create canvas to capture frame
        const canvas = document.createElement('canvas')
        canvas.width = tempVideo.videoWidth
        canvas.height = tempVideo.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Could not get canvas context')
        }

        // Draw current frame to canvas
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height)

        // Convert to base64
        imageData = canvas.toDataURL('image/jpeg', 0.8)

        // Stop the stream and clean up
        stream.getTracks().forEach(track => track.stop())
        tempVideo.remove()

        console.log('Captured YouTube frame successfully')
      } else {
        // For local videos, use the video element directly
        if (!videoElement) {
          console.error('No video element available')
          return
        }

        const canvas = document.createElement('canvas')
        canvas.width = videoElement.videoWidth
        canvas.height = videoElement.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Could not get canvas context')
        }

        // Draw current video frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

        // Convert canvas to base64 image
        imageData = canvas.toDataURL('image/jpeg', 0.8)

        console.log('Captured local video frame successfully')
      }

      console.log('Sending frame to vision API...')

      // Call vision API
      const response = await fetch('/api/vision/analyze-board', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData })
      })

      if (!response.ok) {
        throw new Error('Vision API request failed')
      }

      const data = await response.json()

      // Update pdfContext with the description
      setPdfContext(data.description || '')

      console.log('Board scan completed successfully')

    } catch (error) {
      console.error('Error scanning board:', error)
      // Could add error toast notification here
    } finally {
      setIsScanning(false)
    }
  }

  // Send message to API
  const handleSendMessage = async (messageText: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      videoTimestamp: videoTime
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Get recent transcript for context
      const recentTranscript = getRecentTranscript()

      // Map language code to API format
      const apiLanguage = language === 'en' ? 'english' : language === 'hi' ? 'hindi' : 'english'

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          videoTimestamp: videoTime,
          recentTranscript,
          language: apiLanguage,
          pdfContext: pdfContext
          // No chat history - one input/output setup only
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Only add assistant message if there's a reply (genuine doubt)
      if (data.reply) {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // For non-genuine queries (greetings, noise), add a system message
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'system',
          content: "कृपया विषय से संबंधित प्रश्न पूछें। (Please ask subject-related questions.)",
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, systemMessage])
      }

    } catch (error) {
      console.error('Error sending message:', error)

      // Add error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: "Sorry, I couldn't process your question. Please try again later.",
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format video timestamp
  const formatVideoTime = (seconds?: number) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className={cn(
      "fixed right-0 top-0 h-screen w-96 bg-background border-l shadow-lg z-40 flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Ask Your Doubts</h3>
          <p className="text-sm text-muted-foreground">
            AI-powered assistance
          </p>
        </div>
        <Button
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <Card className="p-6 text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Hello! I'm here to help you with any questions about the lecture.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ask me anything related to what we're learning!
              </p>
            </Card>
          ) : (
            messages.map((message) => (
              message.role === 'system' ? (
                // System messages (for noise/greetings)
                <div key={message.id} className="flex justify-center">
                  <Badge variant="outline" className="text-xs py-2 px-4">
                    {message.content}
                  </Badge>
                </div>
              ) : (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={cn(
                    "flex flex-col gap-1 max-w-[80%]",
                    message.role === 'user' && "items-end"
                  )}>
                  <Card className={cn(
                    "p-3",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}>
                    <p
                      className={cn(
                        "text-sm whitespace-pre-wrap",
                        /[\u0900-\u097F]/.test(message.content) && "hindi-text"
                      )}
                      lang={/[\u0900-\u097F]/.test(message.content) ? "hi" : "en"}
                    >
                      {message.content}
                    </p>
                  </Card>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.videoTimestamp !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        @{formatVideoTime(message.videoTimestamp)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              )
            ))
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <Card className="p-3 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* PDF/Board Context */}
      <div className="p-4 border-t space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <label htmlFor="pdf-context">Board Context</label>
          </div>
          <Button
            onClick={handleScanBoard}
            size="sm"
            variant="outline"
            disabled={isScanning || (!isYouTubeVideo && !videoElement)}
            className="gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Camera className="h-3 w-3" />
                Scan Board
              </>
            )}
          </Button>
        </div>
        <Textarea
          id="pdf-context"
          placeholder="What's on the board? (formulas, diagrams, current topic being taught...)"
          value={pdfContext}
          onChange={(e) => setPdfContext(e.target.value)}
          className="min-h-[80px] text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Click "Scan Board" to auto-detect board content, or type manually
        </p>
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          language={language}
        />
      </div>
    </div>
  )
}