"use client"

import React, { useEffect, useRef, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { TranscriptSegment } from '@/hooks/useSonioxTranscription'

interface TranscriptPanelProps {
  transcript: TranscriptSegment[]
  currentTime?: number
  className?: string
}

export default function TranscriptPanel({
  transcript,
  currentTime = 0,
  className
}: TranscriptPanelProps) {
  const rawScrollAreaRef = useRef<HTMLDivElement>(null)
  const processedScrollAreaRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  // Detect if text contains Hindi/Devanagari characters
  const containsDevanagari = (text: string) => {
    return /[\u0900-\u097F]/.test(text)
  }

  // Process transcript segments into complete sentences
  const processedTranscript = useMemo(() => {
    if (transcript.length === 0) return []

    const sentences: { text: string; startTime: number; endTime: number; isFinal: boolean }[] = []
    let currentSentence = ''
    let sentenceStartTime = 0
    let sentenceEndTime = 0
    let lastEndTime = 0

    transcript.forEach((segment, index) => {
      const text = segment.text.trim()
      if (!text) return

      // If this is the first segment of a new sentence
      if (currentSentence === '') {
        sentenceStartTime = segment.startTime
      }

      // Append the segment text with a space
      currentSentence += (currentSentence ? ' ' : '') + text
      sentenceEndTime = segment.endTime

      // Check if this segment ends a sentence (ends with punctuation or is final)
      const endsWithPunctuation = /[.!?।॥]$/.test(text)
      const isLastSegment = index === transcript.length - 1
      const hasSignificantTimeGap = index < transcript.length - 1 &&
        transcript[index + 1].startTime - segment.endTime > 2 // 2 second gap

      if (endsWithPunctuation || hasSignificantTimeGap || (isLastSegment && segment.isFinal)) {
        // Complete the sentence
        sentences.push({
          text: currentSentence,
          startTime: sentenceStartTime,
          endTime: sentenceEndTime,
          isFinal: segment.isFinal
        })
        currentSentence = ''
      }
    })

    // Add any remaining text as an incomplete sentence
    if (currentSentence) {
      sentences.push({
        text: currentSentence,
        startTime: sentenceStartTime,
        endTime: sentenceEndTime,
        isFinal: false
      })
    }

    return sentences
  }, [transcript])

  // Auto-scroll to bottom when new transcript arrives
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Scroll raw transcript
      if (rawScrollAreaRef.current) {
        const scrollContainer = rawScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
      // Scroll processed transcript
      if (processedScrollAreaRef.current) {
        const scrollContainer = processedScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }
  }, [transcript, processedTranscript])

  // Handle manual scroll to determine if auto-scroll should be disabled
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50
    shouldAutoScrollRef.current = isAtBottom
  }

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Check if a segment is currently active
  const isSegmentActive = (segment: TranscriptSegment) => {
    return currentTime >= segment.startTime && currentTime <= segment.endTime
  }

  // Get recent segments (last 20 tokens for display)
  const getRecentSegments = () => {
    // Return only the last 20 tokens to prevent UI clutter
    return transcript.slice(-20)
  }

  const recentSegments = getRecentSegments()

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">Live Transcript</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {transcript.length} tokens
          </Badge>
          {processedTranscript.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {processedTranscript.length} sentences
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Processed Transcript (Top Half) - Complete Sentences */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b bg-muted/30">
            <p className="text-sm font-medium">Complete Transcript</p>
          </div>
          <ScrollArea
            ref={processedScrollAreaRef}
            className="flex-1 p-4"
            onScrollCapture={handleScroll}
          >
            <div className="space-y-2">
              {processedTranscript.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-sm">Complete sentences will appear here...</p>
                </div>
              ) : (
                processedTranscript.map((sentence, index) => (
                  <div
                    key={`sentence-${index}`}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-300",
                      currentTime >= sentence.startTime && currentTime <= sentence.endTime
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-muted",
                      !sentence.isFinal && "border-dashed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 mt-0.5"
                      >
                        {formatTime(sentence.startTime)}
                      </Badge>
                      <p
                        className={cn(
                          "text-sm leading-relaxed flex-1",
                          containsDevanagari(sentence.text) && "hindi-text"
                        )}
                        lang={containsDevanagari(sentence.text) ? "hi" : "en"}
                      >
                        {sentence.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Raw Transcript (Bottom Half) - Individual Tokens */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b bg-muted/30">
            <p className="text-sm font-medium">Live Tokens</p>
          </div>
          <ScrollArea
            ref={rawScrollAreaRef}
            className="flex-1 p-4"
            onScrollCapture={handleScroll}
          >
            <div className="flex flex-wrap gap-1">
              {recentSegments.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 w-full">
                  <p className="text-sm">Tokens will appear here as the video plays...</p>
                </div>
              ) : (
                recentSegments.map((segment, index) => (
                  <Badge
                    key={segment.id}
                    variant={
                      isSegmentActive(segment)
                        ? "default"
                        : segment.isFinal
                          ? "secondary"
                          : "outline"
                    }
                    className={cn(
                      "text-xs px-2 py-1",
                      !segment.isFinal && "opacity-60 animate-pulse",
                      containsDevanagari(segment.text) && "hindi-text"
                    )}
                    lang={containsDevanagari(segment.text) ? "hi" : "en"}
                  >
                    {segment.text}
                  </Badge>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Auto-scroll indicator */}
      {transcript.length > 5 && (
        <div className="border-t px-4 py-2 text-center">
          <Badge
            variant={shouldAutoScrollRef.current ? "default" : "outline"}
            className="text-xs"
          >
            {shouldAutoScrollRef.current
              ? "Auto-scrolling enabled"
              : "Auto-scrolling paused (scroll to bottom to resume)"}
          </Badge>
        </div>
      )}
    </Card>
  )
}