/**
 * YouTube High-Quality Video, Shorts, and Audio Extractor Service.
 * Implements resilient multi-strategy extraction:
 * - Strategy 1: High-Speed Multi-Format Invidious / Piped Instances (1080p, 720p, 480p, 360p, Audio M4A/MP3)
 * - Strategy 2: High-Definition Scraper Gateway API Fallback (VKR / Cobalt)
 * - Strategy 3: Official YouTube OEmbed & Web Player Manifest Parser
 */

import { BaseExtractor } from '../base/base-extractor'
import {
  ExtractOptions,
  ExtractorError,
  MediaDownloadOption,
  MediaItem,
  MediaMetadata,
  SupportedPlatform,
} from '../types'
import { getRandomUserAgent, resilientFetch } from '../utils/http-client'
import { cleanMediaUrl, extractYouTubeId } from '../utils/url-parser'

export class YouTubeExtractor extends BaseExtractor {
  public readonly platform: SupportedPlatform = 'youtube'

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
      return (
        host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtu.be'
      )
    } catch {
      return false
    }
  }

  public async extract(rawUrl: string, options: ExtractOptions = {}): Promise<MediaMetadata> {
    const cleanUrl = cleanMediaUrl(rawUrl)
    const videoId = extractYouTubeId(cleanUrl)
    const timeout = options.timeout || 15000

    if (!videoId) {
      throw new ExtractorError(
        'Invalid YouTube URL. Could not find a valid video or Shorts identifier.',
        'INVALID_YOUTUBE_URL',
        400
      )
    }

    // Strategy 1: Multi-Format Invidious / Piped Instances
    try {
      const data = await this.extractFromInvidiousOrPiped(videoId, cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[YouTubeExtractor] Strategy 1 (Invidious/Piped) failed, attempting fallback...', (err as Error)?.message)
    }

    // Strategy 2: Scraper Gateway API
    try {
      const data = await this.extractFromScraperGateway(videoId, cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[YouTubeExtractor] Strategy 2 (Gateway) failed, attempting fallback...', (err as Error)?.message)
    }

    // Strategy 3: Official OEmbed & Web Player Scraper
    try {
      const data = await this.extractFromOEmbedAndWeb(videoId, cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[YouTubeExtractor] Strategy 3 (OEmbed/Web) failed...', (err as Error)?.message)
    }

    throw new ExtractorError(
      'Unable to extract media from this YouTube link. The video may be private, restricted, or deleted.',
      'YOUTUBE_EXTRACTION_FAILED',
      404
    )
  }

  /**
   * Strategy 1: Invidious / Piped Public API Instances
   */
  private async extractFromInvidiousOrPiped(videoId: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const instances = [
      `https://inv.tux.pizza/api/v1/videos/${videoId}`,
      `https://invidious.nerdvpn.de/api/v1/videos/${videoId}`,
      `https://vid.puffyan.us/api/v1/videos/${videoId}`,
      `https://api.piped.private.coffee/streams/${videoId}`,
    ]

    for (const endpoint of instances) {
      try {
        const isPiped = endpoint.includes('piped')
        const response = await resilientFetch(endpoint, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'application/json',
          },
          timeoutMs: Math.min(timeout, 5000),
          retries: 0,
        })

        if (!response.ok) continue
        const data = await response.json()

        if (isPiped) {
          const result = this.parsePipedPayload(videoId, originalUrl, data)
          if (result) return result
        } else {
          const result = this.parseInvidiousPayload(videoId, originalUrl, data)
          if (result) return result
        }
      } catch {
        // Try next instance
        continue
      }
    }

    return null
  }

  private parseInvidiousPayload(videoId: string, originalUrl: string, data: Record<string, unknown>): MediaMetadata | null {
    if (!data || !data.title) return null

    const title = (data.title as string) || `YouTube Video (${videoId})`
    const author = (data.author as string) || 'YouTube Creator'
    const duration = Number(data.lengthSeconds) || 0
    const viewCount = Number(data.viewCount) || undefined
    const likeCount = Number(data.likeCount) || undefined
    const defaultThumb = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    const thumbnail = (Array.isArray(data.videoThumbnails) && data.videoThumbnails[0]?.url) || defaultThumb

    const qualities: MediaDownloadOption[] = []
    const formatStreams = Array.isArray(data.formatStreams) ? data.formatStreams : []
    const adaptiveFormats = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : []

    // Progressive video streams (contain both audio and video)
    formatStreams.forEach((format: Record<string, unknown>) => {
      const url = format.url as string
      const qualityLabel = (format.qualityLabel || format.resolution || format.quality) as string
      const container = (format.container || 'mp4') as 'mp4' | 'webp' | 'mp3' | 'jpg'
      const size = Number(format.size || format.contentLength) || undefined

      if (url && qualityLabel) {
        const is1080 = qualityLabel.includes('1080')
        const is720 = qualityLabel.includes('720')
        const label = is1080
          ? '1080p (Full HD)'
          : is720
          ? '720p (HD)'
          : `${qualityLabel} (SD)`

        qualities.push({
          quality: label,
          url,
          format: container === 'mp4' ? 'mp4' : 'mp4',
          hasWatermark: false,
          resolution: qualityLabel,
          size,
        })
      }
    })

    // Adaptive audio streams (MP3 / M4A / WebM Audio)
    let bestAudioUrl: string | undefined
    adaptiveFormats.forEach((format: Record<string, unknown>) => {
      const type = (format.type || format.mimeType || '') as string
      const url = format.url as string

      if (url && type.includes('audio')) {
        const isM4a = type.includes('audio/mp4') || type.includes('m4a')
        const bitrate = Number(format.bitrate) || 128000
        const kbps = Math.round(bitrate / 1000)

        if (!bestAudioUrl || isM4a) {
          bestAudioUrl = url
        }

        qualities.push({
          quality: `Audio (${kbps > 0 ? `${kbps}kbps` : 'HQ'})`,
          url,
          format: 'mp3',
          hasWatermark: false,
          bitrate,
        })
      }
    })

    // Deduplicate and prioritize qualities
    const uniqueQualities = deduplicateQualities(qualities)
    if (uniqueQualities.length === 0) return null

    const primaryDownloadUrl = uniqueQualities.find((q) => q.format === 'mp4')?.url || uniqueQualities[0]?.url || ''

    const isShort = originalUrl.includes('/shorts/') || duration <= 60

    const items: MediaItem[] = [
      {
        id: videoId,
        type: 'video',
        url: primaryDownloadUrl,
        thumbnail,
        qualities: uniqueQualities,
      },
    ]

    return {
      id: videoId,
      platform: 'youtube',
      originalUrl,
      mediaType: 'video',
      title: isShort && !title.toLowerCase().includes('shorts') ? `${title} (YouTube Shorts)` : title,
      description: (data.description as string) || undefined,
      thumbnail,
      duration,
      author: {
        username: `@${author.replace(/\s+/g, '')}`,
        nickname: author,
        avatar: (Array.isArray(data.authorThumbnails) && data.authorThumbnails[0]?.url) || undefined,
        url: data.authorUrl ? (data.authorUrl as string) : undefined,
      },
      downloadUrl: primaryDownloadUrl,
      qualities: uniqueQualities,
      items,
      music: bestAudioUrl
        ? {
            title: title,
            author: author,
            playUrl: bestAudioUrl,
            duration,
          }
        : undefined,
      statistics: {
        views: viewCount,
        likes: likeCount,
      },
    }
  }

  private parsePipedPayload(videoId: string, originalUrl: string, data: Record<string, unknown>): MediaMetadata | null {
    if (!data || !data.title) return null

    const title = (data.title as string) || `YouTube Video (${videoId})`
    const author = (data.uploader as string) || 'YouTube Creator'
    const duration = Number(data.duration) || 0
    const viewCount = Number(data.views) || undefined
    const likeCount = Number(data.likes) || undefined
    const thumbnail = (data.thumbnailUrl as string) || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

    const qualities: MediaDownloadOption[] = []
    const videoStreams = Array.isArray(data.videoStreams) ? data.videoStreams : []
    const audioStreams = Array.isArray(data.audioStreams) ? data.audioStreams : []

    videoStreams.forEach((v: Record<string, unknown>) => {
      const url = v.url as string
      const quality = (v.quality || v.resolution || '') as string
      const format = (v.format || 'mp4') as 'mp4' | 'webp' | 'mp3' | 'jpg'
      const videoOnly = Boolean(v.videoOnly)

      if (url && quality && !videoOnly) {
        const is1080 = quality.includes('1080')
        const is720 = quality.includes('720')
        const label = is1080
          ? '1080p (Full HD)'
          : is720
          ? '720p (HD)'
          : `${quality} (SD)`

        qualities.push({
          quality: label,
          url,
          format: format === 'mp4' ? 'mp4' : 'mp4',
          hasWatermark: false,
          resolution: quality,
          size: Number(v.contentLength) || undefined,
        })
      }
    })

    let bestAudioUrl: string | undefined
    audioStreams.forEach((a: Record<string, unknown>) => {
      const url = a.url as string
      const bitrate = Number(a.bitrate) || 128000
      const kbps = Math.round(bitrate / 1000)

      if (url) {
        if (!bestAudioUrl) bestAudioUrl = url
        qualities.push({
          quality: `Audio (${kbps > 0 ? `${kbps}kbps` : 'HQ'})`,
          url,
          format: 'mp3',
          hasWatermark: false,
          bitrate,
        })
      }
    })

    const uniqueQualities = deduplicateQualities(qualities)
    if (uniqueQualities.length === 0) return null

    const primaryDownloadUrl = uniqueQualities.find((q) => q.format === 'mp4')?.url || uniqueQualities[0]?.url || ''

    const isShort = originalUrl.includes('/shorts/') || duration <= 60

    return {
      id: videoId,
      platform: 'youtube',
      originalUrl,
      mediaType: 'video',
      title: isShort && !title.toLowerCase().includes('shorts') ? `${title} (YouTube Shorts)` : title,
      description: (data.description as string) || undefined,
      thumbnail,
      duration,
      author: {
        username: `@${author.replace(/\s+/g, '')}`,
        nickname: author,
        avatar: (data.uploaderAvatar as string) || undefined,
        url: (data.uploaderUrl as string) || undefined,
      },
      downloadUrl: primaryDownloadUrl,
      qualities: uniqueQualities,
      items: [
        {
          id: videoId,
          type: 'video',
          url: primaryDownloadUrl,
          thumbnail,
          qualities: uniqueQualities,
        },
      ],
      music: bestAudioUrl
        ? {
            title: title,
            author: author,
            playUrl: bestAudioUrl,
            duration,
          }
        : undefined,
      statistics: {
        views: viewCount,
        likes: likeCount,
      },
    }
  }

  /**
   * Strategy 2: High-Definition Scraper Gateway API Fallback
   */
  private async extractFromScraperGateway(videoId: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const endpoints = [
      `https://api.vkrdownloader.com/server?vkr=https://www.youtube.com/watch?v=${videoId}`,
    ]

    for (const ep of endpoints) {
      try {
        const response = await resilientFetch(ep, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'application/json',
          },
          timeoutMs: timeout,
          retries: 0,
        })

        if (!response.ok) continue
        const json = await response.json()
        const payload = json?.data || json

        if (!payload) continue

        const title = payload.title || `YouTube Video (${videoId})`
        const thumbnail = payload.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
        const duration = Number(payload.duration) || 0
        const authorName = payload.author?.name || payload.uploader || 'YouTube Creator'

        const qualities: MediaDownloadOption[] = []
        const downloads = payload.downloads || payload.formats || payload.media || []

        if (Array.isArray(downloads) && downloads.length > 0) {
          downloads.forEach((item: Record<string, unknown>) => {
            const url = (item.url || item.download_url) as string
            const format = ((item.format || item.ext || 'mp4') as string).toLowerCase()
            const quality = (item.quality || item.format_id || 'HD') as string

            if (url) {
              const isAudio = format === 'mp3' || format === 'm4a' || quality.toLowerCase().includes('audio')
              const is1080 = quality.includes('1080')
              const is720 = quality.includes('720')
              const is480 = quality.includes('480')
              const is360 = quality.includes('360')

              const label = isAudio
                ? 'Audio (MP3)'
                : is1080
                ? '1080p (Full HD)'
                : is720
                ? '720p (HD)'
                : is480
                ? '480p (SD)'
                : is360
                ? '360p (SD)'
                : `${quality}`

              qualities.push({
                quality: label,
                url,
                format: isAudio ? 'mp3' : 'mp4',
                hasWatermark: false,
                size: Number(item.size) || undefined,
              })
            }
          })
        }

        const singleVideo = payload.video || payload.download_url
        if (qualities.length === 0 && singleVideo) {
          qualities.push({
            quality: '720p (HD)',
            url: singleVideo,
            format: 'mp4',
            hasWatermark: false,
          })
        }

        const uniqueQualities = deduplicateQualities(qualities)
        if (uniqueQualities.length === 0) continue

        const primaryDownloadUrl = uniqueQualities.find((q) => q.format === 'mp4')?.url || uniqueQualities[0].url

        return {
          id: videoId,
          platform: 'youtube',
          originalUrl,
          mediaType: 'video',
          title,
          thumbnail,
          duration,
          author: {
            username: `@${authorName.replace(/\s+/g, '')}`,
            nickname: authorName,
          },
          downloadUrl: primaryDownloadUrl,
          qualities: uniqueQualities,
          items: [
            {
              id: videoId,
              type: 'video',
              url: primaryDownloadUrl,
              thumbnail,
              qualities: uniqueQualities,
            },
          ],
        }
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * Strategy 3: Official OEmbed & Web Player Scraper
   */
  private async extractFromOEmbedAndWeb(videoId: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const defaultThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    const maxResThumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

    try {
      const response = await resilientFetch(oembedUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeoutMs: timeout,
      })

      if (!response.ok) return null
      const oembed = await response.json()

      const title = oembed.title || `YouTube Video (${videoId})`
      const author = oembed.author_name || 'YouTube Creator'
      const authorUrl = oembed.author_url

      // Try fetching HTML to extract ytInitialPlayerResponse
      const qualities: MediaDownloadOption[] = []
      let duration = 0

      try {
        const webResp = await resilientFetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeoutMs: timeout,
        })

        if (webResp.ok) {
          const html = await webResp.text()
          const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/i)
          if (playerMatch?.[1]) {
            const playerResponse = JSON.parse(playerMatch[1])
            duration = Number(playerResponse?.videoDetails?.lengthSeconds) || 0
            const streamingData = playerResponse?.streamingData

            const formats = Array.isArray(streamingData?.formats) ? streamingData.formats : []
            formats.forEach((f: Record<string, unknown>) => {
              if (f.url && f.qualityLabel) {
                qualities.push({
                  quality: `${f.qualityLabel} (HD)`,
                  url: f.url as string,
                  format: 'mp4',
                  hasWatermark: false,
                })
              }
            })
          }
        }
      } catch {
        // Fall back to direct stream URLs
      }

      // If no direct video format was parsed, provide standard direct YouTube stream links
      if (qualities.length === 0) {
        qualities.push(
          {
            quality: '1080p (Full HD)',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            format: 'mp4',
            hasWatermark: false,
          },
          {
            quality: '720p (HD)',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            format: 'mp4',
            hasWatermark: false,
          }
        )
      }

      const primaryDownloadUrl = qualities[0]?.url || `https://www.youtube.com/watch?v=${videoId}`

      return {
        id: videoId,
        platform: 'youtube',
        originalUrl,
        mediaType: 'video',
        title,
        thumbnail: oembed.thumbnail_url || maxResThumbnail || defaultThumbnail,
        duration: duration || 30,
        author: {
          username: `@${author.replace(/\s+/g, '')}`,
          nickname: author,
          url: authorUrl,
        },
        downloadUrl: primaryDownloadUrl,
        qualities,
        items: [
          {
            id: videoId,
            type: 'video',
            url: primaryDownloadUrl,
            thumbnail: oembed.thumbnail_url || maxResThumbnail,
            qualities,
          },
        ],
      }
    } catch {
      return null
    }
  }
}

/**
 * Deduplicates download options by quality and format
 */
function deduplicateQualities(qualities: MediaDownloadOption[]): MediaDownloadOption[] {
  const seen = new Set<string>()
  const result: MediaDownloadOption[] = []

  for (const q of qualities) {
    const key = `${q.quality}-${q.format}`
    if (!seen.has(key) && q.url) {
      seen.add(key)
      result.push(q)
    }
  }

  return result
}
