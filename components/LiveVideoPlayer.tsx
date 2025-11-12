"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LiveVideoPlayerProps {
  src: string
  onTimeUpdate?: (currentTime: number) => void
  onPlay?: () => void
  onPause?: () => void
  onVideoReady?: (videoElement: HTMLVideoElement) => void
  className?: string
}

export default function LiveVideoPlayer({
  src,
  onTimeUpdate,
  onPlay,
  onPause,
  onVideoReady,
  className
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const lastValidTimeRef = useRef(0)

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle play/pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return

    try {
      if (isPlaying) {
        videoRef.current.pause()
        onPause?.()
      } else {
        await videoRef.current.play()
        setHasStarted(true)
        onPlay?.()
      }
      setIsPlaying(!isPlaying)
    } catch (error) {
      console.error('Error toggling play/pause:', error)
    }
  }, [isPlaying, onPlay, onPause])

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return

    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  // Handle seek
  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration === 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration

    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
    lastValidTimeRef.current = newTime
    onTimeUpdate?.(newTime)
  }, [duration, onTimeUpdate])

  // Enable seeking - allow user to scrub through video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime
      lastValidTimeRef.current = currentTime
      setCurrentTime(currentTime)
      onTimeUpdate?.(currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      onVideoReady?.(video)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onTimeUpdate, onVideoReady])

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn("relative bg-black rounded-lg overflow-hidden", className)}>
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        playsInline
      />

      {/* Custom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Progress Bar (seekable) */}
        <div className="mb-4">
          <div
            className="relative h-1 bg-gray-600 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
            onClick={handleSeek}
          >
            <div
              className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-300 pointer-events-none"
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

          {/* Video Badge */}
          <Badge
            variant="secondary"
            className="bg-white/20 text-white"
          >
            Local Video
          </Badge>
        </div>

        {/* Start Message */}
        {!hasStarted && (
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