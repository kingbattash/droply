'use client'

import {
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface VideoPreviewPlayerProps {
  src: string
  poster?: string
  title?: string
  author?: string
  isAudio?: boolean
  className?: string
}

export function VideoPreviewPlayer({
  src,
  poster,
  title,
  author,
  isAudio = false,
  className,
}: VideoPreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLooping, setIsLooping] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0)
      setIsLoading(false)
    }
    const handleWaiting = () => setIsLoading(true)
    const handlePlaying = () => {
      setIsLoading(false)
      setIsPlaying(true)
    }
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      if (!isLooping) setIsPlaying(false)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [isLooping, src])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load()
    }
  }, [src])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch((e) => console.warn('Play prevented:', e))
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2]
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length
    const nextSpeed = speeds[nextIdx]
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed
      setPlaybackRate(nextSpeed)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-black',
        className
      )}
    >
      <div className="relative flex h-full min-h-[260px] w-full items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          loop={isLooping}
          muted={isMuted}
          className="size-full max-h-[380px] object-contain"
          onClick={togglePlay}
        />

        {/* Audio Mode Preview */}
        {isAudio && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 p-6">
            <div className="flex size-14 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <Music className="size-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-100">{title || 'Audio Stream'}</p>
              <p className="text-xs text-zinc-400">{author || 'Audio format'}</p>
            </div>
          </div>
        )}

        {/* Center Play/Pause Trigger */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video"
            className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 transition-transform hover:scale-105 active:scale-95"
          >
            <Play className="ml-0.5 size-5 fill-white" />
          </button>
        )}

        {/* Buffering Indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="size-7 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
          </div>
        )}

        {/* Clean Controls Bar */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-6 text-white transition-opacity group-hover:opacity-100">
          {/* Progress Bar */}
          <div className="relative flex items-center">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Seek time"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="rounded p-1 text-zinc-200 hover:text-white"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="rounded p-1 text-zinc-200 hover:text-white"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-3.5" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1 w-12 cursor-pointer accent-white"
                  aria-label="Volume"
                />
              </div>

              <span className="font-mono text-[11px] text-zinc-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                className={cn(
                  'rounded p-1 text-xs',
                  isLooping ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                )}
                title="Loop"
              >
                <Repeat className="size-3" />
              </button>

              <button
                type="button"
                onClick={cycleSpeed}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 hover:text-white"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded p-1 text-zinc-200 hover:text-white"
                aria-label="Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
