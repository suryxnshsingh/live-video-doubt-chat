"use client"

import { useState, useCallback, useRef } from 'react'
import LiveVideoPlayer from '@/components/LiveVideoPlayer'
import YouTubePlayer from '@/components/YouTubePlayer'
import VideoSourceSelector from '@/components/VideoSourceSelector'
import TranscriptPanel from '@/components/TranscriptPanel'
import AskButton from '@/components/AskButton'
import ChatDialog from '@/components/ChatDialog'
import { useSonioxTranscription } from '@/hooks/useSonioxTranscription'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoSource, setVideoSource] = useState<{ type: 'youtube' | 'local', url: string } | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  // Initialize Soniox transcription
  // Note: Add your Soniox API key in environment variables
  const {
    transcript,
    isTranscribing,
    startTranscription,
    startTabAudioTranscription,
    stopTranscription,
    clearTranscript,
    error: transcriptionError
  } = useSonioxTranscription({
    apiKey: process.env.NEXT_PUBLIC_SONIOX_API_KEY,
    language: 'hi' // Hindi
  })

  // Handle video source selection
  const handleSelectVideoSource = (source: { type: 'youtube' | 'local', url: string }) => {
    // Clear any existing transcript
    clearTranscript()
    setVideoSource(source)
    // Reset states
    setCurrentVideoTime(0)
    setIsVideoPlaying(false)
  }

  // Handle back to source selection
  const handleBackToSelection = () => {
    if (isTranscribing) {
      stopTranscription()
    }
    clearTranscript()
    setVideoSource(null)
    setCurrentVideoTime(0)
    setIsVideoPlaying(false)
    setIsChatOpen(false)
  }

  // Handle video ready
  const handleVideoReady = useCallback((videoElement: HTMLVideoElement) => {
    videoElementRef.current = videoElement
    console.log('Video element ready')
  }, [])

  // Handle video play
  const handleVideoPlay = useCallback(async () => {
    setIsVideoPlaying(true)
    if (!isTranscribing) {
      try {
        if (videoSource?.type === 'youtube') {
          // For YouTube, we need to capture tab audio
          await startTabAudioTranscription()
          console.log('Started tab audio transcription for YouTube')
        } else if (videoElementRef.current) {
          // For local video, capture from video element
          await startTranscription(videoElementRef.current)
          console.log('Started transcription for local video')
        }
      } catch (error) {
        console.error('Failed to start transcription:', error)
      }
    }
  }, [isTranscribing, startTranscription, startTabAudioTranscription, videoSource])

  // Handle video pause
  const handleVideoPause = useCallback(() => {
    setIsVideoPlaying(false)
    if (isTranscribing) {
      stopTranscription()
      console.log('Stopped transcription')
    }
  }, [isTranscribing, stopTranscription])

  // Handle video time update
  const handleVideoTimeUpdate = useCallback((time: number) => {
    setCurrentVideoTime(time)
  }, [])

  return (
    <main className="flex h-screen bg-background">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isChatOpen ? 'mr-96' : ''
      }`}>
        {/* Header */}
        <header className="border-b p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Live Video Learning Platform</h1>
              <p className="text-muted-foreground">
                Real-time transcription with AI-powered assistance
              </p>
            </div>
            {videoSource && (
              <Button
                onClick={handleBackToSelection}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Change Video
              </Button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 overflow-auto">
          {!videoSource ? (
            // Video Source Selection
            <div className="h-full flex items-center justify-center">
              <VideoSourceSelector onSelectSource={handleSelectVideoSource} />
            </div>
          ) : (
            // Video and Transcript Area
            <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-4">
              {/* Video Section */}
              <div className="flex-1 lg:flex-[2]">
                {videoSource.type === 'youtube' ? (
                  <YouTubePlayer
                    videoUrl={videoSource.url}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onReady={() => console.log('YouTube player ready')}
                    className="h-full"
                  />
                ) : (
                  <LiveVideoPlayer
                    src={videoSource.url}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onVideoReady={handleVideoReady}
                    className="h-full"
                  />
                )}

                {/* Transcription Status */}
                {transcriptionError && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
                    Transcription Error: {transcriptionError}
                  </div>
                )}
                {isTranscribing && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-sm">
                    Live transcription active...
                  </div>
                )}
                {videoSource.type === 'youtube' && !isTranscribing && isVideoPlaying && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded text-sm">
                    Note: For YouTube videos, please share your browser tab audio when prompted for transcription to work.
                  </div>
                )}
              </div>

              {/* Transcript Section */}
              <div className="flex-1 lg:flex-[1] h-[400px] lg:h-full">
                <TranscriptPanel
                  transcript={transcript}
                  currentTime={currentVideoTime}
                  className="h-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Dialog (fixed position on right) */}
      {videoSource && (
        <ChatDialog
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          transcript={transcript}
          videoTime={currentVideoTime}
        />
      )}

      {/* Floating Ask Button */}
      {videoSource && !isChatOpen && (
        <AskButton onClick={() => setIsChatOpen(true)} />
      )}
    </main>
  )
}