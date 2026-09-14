/**
 * TikTok High-Quality Video and Audio Extractor Service.
 * Implements resilient multi-strategy extraction:
 * - Strategy 1: TikWM High-Definition API (HD 1080p, No Watermark, Music stream)
 * - Strategy 2: TikLyDown REST Extractor fallback
 * - Strategy 3: Direct TikTok Web / Hydration / OEmbed parsing
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
import { cleanMediaUrl, extractTikTokId } from '../utils/url-parser'

export class TikTokExtractor extends BaseExtractor {
  public readonly platform: SupportedPlatform = 'tiktok'

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      return (
        host === 'tiktok.com' ||
        host.endsWith('.tiktok.com') ||
        host === 'v.douyin.com'
      )
    } catch {
      return false
    }
  }

  public async extract(rawUrl: string, options: ExtractOptions = {}): Promise<MediaMetadata> {
    const cleanUrl = cleanMediaUrl(rawUrl)
    const timeout = options.timeout || 15000

    // Strategy 1: TikWM HD API (Provides original 1080p HD no watermark stream)
    try {
      const data = await this.extractFromTikWm(cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[TikTokExtractor] Strategy 1 (TikWM) failed, attempting fallback...', (err as Error)?.message)
    }

    // Strategy 2: TikLyDown HD API
    try {
      const data = await this.extractFromTikLy(cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[TikTokExtractor] Strategy 2 (TikLyDown) failed, attempting fallback...', (err as Error)?.message)
    }

    // Strategy 3: Direct Web / OEmbed Scraper
    try {
      const data = await this.extractFromDirectScrape(cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[TikTokExtractor] Strategy 3 (DirectScrape) failed...', (err as Error)?.message)
    }

    throw new ExtractorError(
      'Unable to extract high-definition video from this TikTok URL. The post may be private, deleted, or region-locked.',
      'TIKTOK_EXTRACTION_FAILED',
      404
    )
  }

  /**
   * Strategy 1: TikWM High Definition API
   */
  private async extractFromTikWm(targetUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const apiUrl = 'https://www.tikwm.com/api/'
    const formData = new URLSearchParams()
    formData.append('url', targetUrl)
    formData.append('count', '12')
    formData.append('cursor', '0')
    formData.append('web', '1')
    formData.append('hd', '1') // Request 1080p Full HD stream

    const response = await resilientFetch(apiUrl, {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': 'https://www.tikwm.com',
        'Referer': 'https://www.tikwm.com/',
      },
      timeoutMs: timeout,
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    if (payload?.code !== 0 || !payload?.data) {
      return null
    }

    const d = payload.data
    const id = d.id || extractTikTokId(targetUrl) || String(Date.now())

    // Base host for TikWM links if relative
    const baseUrl = 'https://www.tikwm.com'
    const formatUrl = (path?: string) => {
      if (!path) return ''
      return path.startsWith('http') ? path : `${baseUrl}${path}`
    }

    const qualities: MediaDownloadOption[] = []
    const mediaItems: MediaItem[] = []

    // Check for photo mode / multi-image slideshow
    const images: string[] = Array.isArray(d.images) ? d.images : []
    if (images.length > 0) {
      images.forEach((imgUrl: string, idx: number) => {
        const fullImgUrl = formatUrl(imgUrl)
        if (fullImgUrl) {
          mediaItems.push({
            id: `${id}-img-${idx + 1}`,
            type: 'image',
            url: fullImgUrl,
            thumbnail: fullImgUrl,
            qualities: [
              {
                quality: `HD Photo ${idx + 1} (JPG)`,
                url: fullImgUrl,
                format: 'jpg',
                hasWatermark: false,
              },
            ],
          })
          // Also add each photo to qualities list
          qualities.push({
            quality: `Photo ${idx + 1} (HD)`,
            url: fullImgUrl,
            format: 'jpg',
            hasWatermark: false,
          })
        }
      })
    }

    // 1080p HD No Watermark (Highest priority)
    if (d.hdplay) {
      qualities.push({
        quality: '1080p (Full HD - No Watermark)',
        url: formatUrl(d.hdplay),
        format: 'mp4',
        hasWatermark: false,
        size: d.hd_size,
      })
    }

    // Standard HD No Watermark
    if (d.play) {
      qualities.push({
        quality: '720p (HD - No Watermark)',
        url: formatUrl(d.play),
        format: 'mp4',
        hasWatermark: false,
        size: d.size,
      })
    }

    // Watermarked Video
    if (d.wmplay) {
      qualities.push({
        quality: 'With Watermark',
        url: formatUrl(d.wmplay),
        format: 'mp4',
        hasWatermark: true,
        size: d.wm_size,
      })
    }

    // MP3 Audio stream
    if (d.music) {
      qualities.push({
        quality: 'Audio (MP3)',
        url: formatUrl(d.music),
        format: 'mp3',
        hasWatermark: false,
      })
    }

    // Determine primary download URL & media type
    const isCarousel = mediaItems.length > 1
    const isSingleImage = mediaItems.length === 1
    const bestVideoUrl = formatUrl(d.hdplay || d.play || d.wmplay)

    const primaryDownloadUrl = isCarousel || isSingleImage
      ? (mediaItems[0]?.url || bestVideoUrl)
      : bestVideoUrl

    if (!primaryDownloadUrl) return null

    const mediaType = isCarousel ? 'carousel' : isSingleImage ? 'image' : 'video'

    // If it's a single video, also populate items with the single video item
    if (mediaItems.length === 0 && bestVideoUrl) {
      mediaItems.push({
        id,
        type: 'video',
        url: bestVideoUrl,
        thumbnail: formatUrl(d.cover || d.origin_cover),
        qualities,
      })
    }

    return {
      id,
      platform: 'tiktok',
      originalUrl: targetUrl,
      mediaType,
      title: d.title || (isCarousel ? `TikTok Photo Carousel (${images.length} Photos)` : 'TikTok Video'),
      description: d.title,
      thumbnail: formatUrl(d.cover || d.origin_cover || images[0]),
      duration: Number(d.duration) || 0,
      author: {
        id: d.author?.id,
        username: d.author?.unique_id ? `@${d.author.unique_id}` : '@tiktok.creator',
        nickname: d.author?.nickname,
        avatar: formatUrl(d.author?.avatar),
      },
      downloadUrl: primaryDownloadUrl,
      qualities,
      items: mediaItems.length > 0 ? mediaItems : undefined,
      music: d.music_info
        ? {
            id: d.music_info.id,
            title: d.music_info.title,
            author: d.music_info.author,
            playUrl: formatUrl(d.music_info.play),
            duration: d.music_info.duration,
          }
        : undefined,
      statistics: {
        views: d.play_count,
        likes: d.digg_count,
        comments: d.comment_count,
        shares: d.share_count,
        downloads: d.download_count,
      },
    }
  }

  /**
   * Strategy 2: TikLyDown REST Extractor fallback
   */
  private async extractFromTikLy(targetUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const endpoint = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(targetUrl)}`
    const response = await resilientFetch(endpoint, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json',
      },
      timeoutMs: timeout,
    })

    if (!response.ok) return null
    const json = await response.json()
    const d = json?.data || json

    const rawImages = d?.images || d?.photos || []
    const hasImages = Array.isArray(rawImages) && rawImages.length > 0

    if (!d || (!d.video && !d.video_hd && !d.video_watermark && !d.url && !hasImages)) {
      return null
    }

    const qualities: MediaDownloadOption[] = []
    const mediaItems: MediaItem[] = []
    const id = d.id || extractTikTokId(targetUrl) || String(Date.now())

    if (hasImages) {
      rawImages.forEach((img: unknown, idx: number) => {
        const imgUrl = typeof img === 'string' ? img : (img as { url?: string; display_url?: string })?.url || (img as { display_url?: string })?.display_url
        if (imgUrl) {
          mediaItems.push({
            id: `${id}-img-${idx + 1}`,
            type: 'image',
            url: imgUrl,
            thumbnail: imgUrl,
            qualities: [
              {
                quality: `HD Photo ${idx + 1} (JPG)`,
                url: imgUrl,
                format: 'jpg',
                hasWatermark: false,
              },
            ],
          })
          qualities.push({
            quality: `Photo ${idx + 1} (HD)`,
            url: imgUrl,
            format: 'jpg',
            hasWatermark: false,
          })
        }
      })
    }

    const hdUrl = d.video_hd || d.video?.hd || d.video
    const sdUrl = d.video || d.url
    const wmUrl = d.video_watermark || d.video_wm

    if (hdUrl) {
      qualities.push({
        quality: '1080p (Full HD - No Watermark)',
        url: hdUrl,
        format: 'mp4',
        hasWatermark: false,
      })
    }

    if (sdUrl && sdUrl !== hdUrl) {
      qualities.push({
        quality: '720p (HD - No Watermark)',
        url: sdUrl,
        format: 'mp4',
        hasWatermark: false,
      })
    }

    if (wmUrl) {
      qualities.push({
        quality: 'With Watermark',
        url: wmUrl,
        format: 'mp4',
        hasWatermark: true,
      })
    }

    if (d.music || d.audio) {
      qualities.push({
        quality: 'Audio (MP3)',
        url: d.music || d.audio,
        format: 'mp3',
        hasWatermark: false,
      })
    }

    const isCarousel = mediaItems.length > 1
    const isSingleImage = mediaItems.length === 1
    const downloadUrl = (hasImages && mediaItems[0]?.url) || hdUrl || sdUrl || wmUrl
    if (!downloadUrl) return null

    const mediaType = isCarousel ? 'carousel' : isSingleImage ? 'image' : 'video'

    return {
      id,
      platform: 'tiktok',
      originalUrl: targetUrl,
      mediaType,
      title: d.title || d.desc || (isCarousel ? `TikTok Photo Carousel (${mediaItems.length} Photos)` : 'TikTok Video'),
      description: d.desc || d.title,
      thumbnail: d.cover || d.thumbnail || d.dynamic_cover || (mediaItems[0]?.thumbnail || ''),
      duration: Number(d.duration) || 0,
      author: {
        username: d.author?.unique_id ? `@${d.author.unique_id}` : (d.author?.name ? `@${d.author.name}` : '@tiktok.creator'),
        nickname: d.author?.nickname || d.author?.name,
        avatar: d.author?.avatar || d.author?.avatar_thumb,
      },
      downloadUrl,
      qualities,
      items: mediaItems.length > 0 ? mediaItems : undefined,
      statistics: {
        likes: d.stats?.likeCount,
        views: d.stats?.playCount,
        comments: d.stats?.commentCount,
        shares: d.stats?.shareCount,
      },
    }
  }

  /**
   * Strategy 3: Direct TikTok Web / OEmbed Metadata Scraper
   */
  private async extractFromDirectScrape(targetUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`
    const response = await resilientFetch(oembedUrl, {
      headers: { 'User-Agent': getRandomUserAgent() },
      timeoutMs: timeout,
    })

    if (!response.ok) return null
    const oembed = await response.json()

    if (!oembed || !oembed.title) return null

    const videoId = extractTikTokId(targetUrl) || String(Date.now())

    return {
      id: videoId,
      platform: 'tiktok',
      originalUrl: targetUrl,
      mediaType: 'video',
      title: oembed.title || 'TikTok Video',
      description: oembed.title,
      thumbnail: oembed.thumbnail_url || '',
      duration: 15,
      author: {
        username: oembed.author_unique_id ? `@${oembed.author_unique_id}` : (oembed.author_name ? `@${oembed.author_name}` : '@tiktok.creator'),
        nickname: oembed.author_name,
        url: oembed.author_url,
      },
      downloadUrl: oembed.thumbnail_url || targetUrl,
      qualities: [
        {
          quality: 'Original Stream',
          url: oembed.thumbnail_url || targetUrl,
          format: 'mp4',
          hasWatermark: false,
        },
      ],
    }
  }
}
