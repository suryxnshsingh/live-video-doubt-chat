"use client"

import React, { useState } from 'react'
import { Youtube, Upload, Link2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface VideoSourceSelectorProps {
  onSelectSource: (source: { type: 'youtube' | 'local', url: string }) => void
  className?: string
}

export default function VideoSourceSelector({
  onSelectSource,
  className
}: VideoSourceSelectorProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState('')

  // Extract YouTube video ID from various URL formats
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([^&\n?#]+)$/ // Just the video ID
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  // Validate YouTube URL
  const validateYouTubeUrl = (url: string): boolean => {
    const videoId = extractYouTubeId(url)
    return !!videoId && videoId.length === 11
  }

  // Handle YouTube URL submission
  const handleYouTubeSubmit = () => {
    const trimmedUrl = youtubeUrl.trim()

    if (!trimmedUrl) {
      setError('Please enter a YouTube URL')
      return
    }

    const videoId = extractYouTubeId(trimmedUrl)

    if (!videoId) {
      setError('Invalid YouTube URL. Please enter a valid YouTube video link.')
      return
    }

    setError('')
    // Use embed URL for iframe
    onSelectSource({
      type: 'youtube',
      url: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`
    })
  }

  // Handle local file selection
  const handleLocalFile = () => {
    // For POC, use the default sample video
    onSelectSource({
      type: 'local',
      url: '/sample-lecture.mp4'
    })
  }

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setYoutubeUrl(text)
      setError('')
    } catch (err) {
      setError('Unable to paste from clipboard')
    }
  }

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      <Card>
        <CardHeader>
          <CardTitle>Select Video Source</CardTitle>
          <CardDescription>
            Choose a YouTube video or use a local file for the live learning experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* YouTube Option */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Youtube className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold">YouTube Video</h3>
              <Badge variant="outline" className="text-xs">Recommended</Badge>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
                value={youtubeUrl}
                onChange={(e) => {
                  setYoutubeUrl(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleYouTubeSubmit()
                  }
                }}
                className={cn(
                  "flex-1",
                  error && "border-red-500"
                )}
              />
              <Button
                onClick={handlePaste}
                variant="outline"
                size="icon"
                title="Paste from clipboard"
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleYouTubeSubmit}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Load Video
              </Button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Enter any YouTube video URL. The video will play without seek controls to simulate a live experience.
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Local File Option */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-5 w-5" />
              <h3 className="font-semibold">Local Video File</h3>
            </div>

            <Button
              onClick={handleLocalFile}
              variant="outline"
              className="w-full"
            >
              Use Sample Lecture Video
            </Button>

            <p className="text-xs text-muted-foreground">
              Uses the sample-lecture.mp4 file from the public folder (if available)
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">How it works:</h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• The video will play linearly without seek controls</li>
              <li>• Real-time transcription will start when you play the video</li>
              <li>• You can ask questions at any point during playback</li>
              <li>• AI will answer based on what has been covered so far</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}