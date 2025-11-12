"use client"

import React, { useState, useEffect, useRef } from 'react'
import { X, User, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  className?: string
}

export default function ChatDialog({
  isOpen = true,
  onClose,
  transcript,
  videoTime,
  className
}: ChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }, [messages])

  // Get recent transcript for context (last 5 minutes)
  const getRecentTranscript = () => {
    const recentSegments = transcript.filter(segment =>
      videoTime - segment.startTime <= 300 // 5 minutes = 300 seconds
    )
    return recentSegments.map(s => s.text).join(' ')
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

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          videoTimestamp: videoTime,
          recentTranscript
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

      {/* Input */}
      <div className="p-4 border-t">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}