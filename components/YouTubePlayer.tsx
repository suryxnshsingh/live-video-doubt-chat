"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface YouTubePlayerProps {
  videoUrl: string
  onTimeUpdate?: (currentTime: number) => void
  onPlay?: () => void
  onPause?: () => void
  onReady?: () => void
  className?: string
}

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YouTubePlayer({
  videoUrl,
  onTimeUpdate,
  onPlay,
  onPause,
  onReady,
  className
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  // Extract video ID from embed URL
  const getVideoId = (url: string) => {
    const match = url.match(/embed\/([^?]+)/)
    return match ? match[1] : ''
  }

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Load YouTube IFrame API
  useEffect(() => {
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      initializePlayer()
      return
    }

    // Load the IFrame API
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // Set up the callback
    window.onYouTubeIframeAPIReady = () => {
      initializePlayer()
    }

    return () => {
      // Cleanup
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
      }
    }
  }, [videoUrl])

  // Initialize YouTube player
  const initializePlayer = () => {
    if (!containerRef.current) return

    const videoId = getVideoId(videoUrl)
    if (!videoId) return

    // Create player
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId: videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0, // Hide YouTube controls
        disablekb: 1, // Disable keyboard controls
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3, // Hide annotations
        cc_load_policy: 0, // Hide closed captions by default
        playsinline: 1,
        origin: window.location.origin
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handleStateChange
      }
    })
  }

  // Handle player ready
  const handlePlayerReady = (event: any) => {
    setIsReady(true)
    setDuration(event.target.getDuration())
    onReady?.()
  }

  // Handle state change
  const handleStateChange = (event: any) => {
    const playerState = event.data

    if (playerState === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true)
      setHasStarted(true)

      // Start time update interval
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
      }

      timeUpdateInterval.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = playerRef.current.getCurrentTime()
          setCurrentTime(time)
          onTimeUpdate?.(time)
        }
      }, 100) // Update every 100ms

      onPlay?.()
    } else if (playerState === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false)

      // Clear time update interval
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
        timeUpdateInterval.current = null
      }

      onPause?.()
    } else if (playerState === window.YT.PlayerState.ENDED) {
      setIsPlaying(false)
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current)
        timeUpdateInterval.current = null
      }
    }
  }

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (!playerRef.current || !isReady) return

    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }, [isPlaying, isReady])

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (!playerRef.current || !isReady) return

    if (isMuted) {
      playerRef.current.unMute()
      setIsMuted(false)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
    }
  }, [isMuted, isReady])

  // Seek to time
  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !isReady || duration === 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration

    playerRef.current.seekTo(newTime, true)
    setCurrentTime(newTime)
    onTimeUpdate?.(newTime)
  }, [isReady, duration, onTimeUpdate])

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn("relative bg-black rounded-lg overflow-hidden", className)}>
      {/* YouTube Player Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Loading State */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-white animate-spin mb-4 mx-auto" />
            <p className="text-white">Loading YouTube video...</p>
          </div>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Progress Bar (seekable) */}
        <div className="mb-4">
          <div
            className="relative h-1 bg-gray-600 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
            onClick={handleSeek}
          >
            <div
              className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-100 pointer-events-none"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <Button
              onClick={togglePlayPause}
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20"
              disabled={!isReady}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            {/* Volume Button */}
            <Button
              onClick={toggleMute}
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/20"
              disabled={!isReady}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>

            {/* Time Display */}
            <span className="text-white text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* YouTube Badge */}
          <Badge
            variant="secondary"
            className="bg-white/20 text-white"
          >
            <Youtube className="h-3 w-3 mr-1" />
            YouTube
          </Badge>
        </div>

        {/* Start Message */}
        {!hasStarted && isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center">
              <Play className="h-16 w-16 text-white mb-2 mx-auto" />
              <p className="text-white text-lg">Click play to start the video</p>
              <p className="text-white/70 text-sm mt-2">You can seek to any point in the video</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Add YouTube icon to lucide-react icons if not available
const Youtube = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
)