/**
 * Core types and interfaces for the Media Extraction Service
 */

export type SupportedPlatform = 'tiktok' | 'instagram' | 'youtube'

export type MediaType = 'video' | 'image' | 'carousel' | 'audio'

export interface AuthorInfo {
  id?: string
  username: string
  nickname?: string
  avatar?: string
  url?: string
  verified?: boolean
}

export interface MediaDownloadOption {
  quality: string // e.g. '1080p (HD No Watermark)', '720p (HD)', 'Watermarked', 'Audio (MP3)'
  url: string
  format: 'mp4' | 'mp3' | 'jpg' | 'webp'
  hasWatermark: boolean
  resolution?: string
  size?: number // size in bytes if available
  bitrate?: number
}

export interface MediaStatistics {
  views?: number
  likes?: number
  comments?: number
  shares?: number
  downloads?: number
}

export interface MusicTrack {
  id?: string
  title?: string
  author?: string
  album?: string
  playUrl?: string
  cover?: string
  duration?: number
}

export interface MediaItem {
  id?: string
  type: 'video' | 'image'
  url: string // primary direct download URL for this item
  thumbnail?: string
  width?: number
  height?: number
  qualities?: MediaDownloadOption[]
}

export interface MediaMetadata {
  id: string
  platform: SupportedPlatform
  originalUrl: string
  mediaType: MediaType
  title: string
  description?: string
  thumbnail: string
  duration: number // in seconds (0 for photos/carousels)
  author: AuthorInfo
  downloadUrl: string // primary highest quality direct stream/file (or first item for carousel)
  qualities: MediaDownloadOption[]
  items?: MediaItem[] // For multiple images / carousel items / multi-media posts
  music?: MusicTrack
  statistics?: MediaStatistics
  createdAt?: string
  width?: number
  height?: number
}

export interface ExtractOptions {
  timeout?: number // timeout in milliseconds (default: 15000)
  userAgent?: string
  preferHd?: boolean
}

export interface ExtractResult {
  success: boolean
  platform: SupportedPlatform
  data?: MediaMetadata
  error?: string
  errorCode?: string
  executionTimeMs?: number
}

export class ExtractorError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code = 'EXTRACTION_FAILED', statusCode = 400) {
    super(message)
    this.name = 'ExtractorError'
    this.code = code
    this.statusCode = statusCode
  }
}
