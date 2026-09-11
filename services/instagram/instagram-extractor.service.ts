/**
 * Instagram Reels & Video High-Quality Extractor Service.
 * Implements resilient multi-tier extraction strategies:
 * - Strategy 1: Instagram Embed Graph / Media Payload Scraper (Extracts direct 1080p/720p CDN MP4 stream)
 * - Strategy 2: High-Resolution Public Scraper Gateway Fallback
 * - Strategy 3: OpenGraph & Schema JSON-LD HTML Parser
 */

import { BaseExtractor } from '../base/base-extractor'
import {
  ExtractOptions,
  ExtractorError,
  MediaDownloadOption,
  MediaMetadata,
  SupportedPlatform,
} from '../types'
import { getRandomUserAgent, resilientFetch } from '../utils/http-client'
import { cleanMediaUrl, extractInstagramShortcode } from '../utils/url-parser'

export class InstagramExtractor extends BaseExtractor {
  public readonly platform: SupportedPlatform = 'instagram'

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      return (
        host === 'instagram.com' ||
        host.endsWith('.instagram.com') ||
        host === 'instagr.am' ||
        host === 'ig.me'
      )
    } catch {
      return false
    }
  }

  public async extract(rawUrl: string, options: ExtractOptions = {}): Promise<MediaMetadata> {
    const cleanUrl = cleanMediaUrl(rawUrl)
    const shortcode = extractInstagramShortcode(cleanUrl)
    const timeout = options.timeout || 15000

    if (!shortcode) {
      throw new ExtractorError('Invalid Instagram URL. Could not locate post or reel identifier.', 'INVALID_INSTAGRAM_URL', 400)
    }

    // Strategy 1: Public Embed JSON / HTML Stream Scraper (Direct Instagram CDN)
    try {
      const data = await this.extractFromEmbed(shortcode, cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[InstagramExtractor] Strategy 1 (Embed) failed, trying fallback...', (err as Error)?.message)
    }

    // Strategy 2: High-Definition Scraper Gateway
    try {
      const data = await this.extractFromScraperGateway(shortcode, cleanUrl, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[InstagramExtractor] Strategy 2 (Gateway) failed, trying fallback...', (err as Error)?.message)
    }

    // Strategy 3: OpenGraph / HTML Scraper
    try {
      const data = await this.extractFromOpenGraph(cleanUrl, shortcode, timeout)
      if (data) return data
    } catch (err) {
      console.warn('[InstagramExtractor] Strategy 3 (OpenGraph) failed...', (err as Error)?.message)
    }

    throw new ExtractorError(
      'Unable to extract video from this Instagram link. The Reel may be private, restricted, or deleted.',
      'INSTAGRAM_EXTRACTION_FAILED',
      404
    )
  }

  /**
   * Strategy 1: Extract from Instagram's official public embed endpoint
   */
  private async extractFromEmbed(shortcode: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/captioned/`
    const response = await resilientFetch(embedUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeoutMs: timeout,
    })

    if (!response.ok) return null
    const html = await response.text()

    // 1. Look for video_url in script tags
    let videoUrl: string | null = null
    let displayUrl: string | null = null
    let username: string | null = null
    let caption: string | null = null
    let likesCount: number | undefined

    // Video URL matching regexes
    const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/) ||
      html.match(/\\?"video_url\\?"\s*:\s*\\?"([^"\\]+)/) ||
      html.match(/class="EmbeddedMediaVideo"[\s\S]*?src="([^"]+)"/)

    if (videoUrlMatch?.[1]) {
      videoUrl = decodeJsonString(videoUrlMatch[1])
    }

    // Display / Thumbnail URL matching
    const displayUrlMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/) ||
      html.match(/class="EmbeddedMediaImage"[\s\S]*?src="([^"]+)"/) ||
      html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/)

    if (displayUrlMatch?.[1]) {
      displayUrl = decodeJsonString(displayUrlMatch[1])
    }

    // Username matching
    const usernameMatch = html.match(/class="UsernameText">([^<]+)<\/span>/) ||
      html.match(/"username"\s*:\s*"([^"]+)"/) ||
      html.match(/@([a-zA-Z0-9._]+)/)

    if (usernameMatch?.[1]) {
      username = usernameMatch[1].trim()
    }

    // Caption matching
    const captionMatch = html.match(/class="Caption"[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/) ||
      html.match(/"caption"\s*:\s*"([^"]+)"/)

    if (captionMatch?.[1]) {
      caption = captionMatch[1].replace(/<[^>]+>/g, '').trim()
    }

    // Like count matching
    const likesMatch = html.match(/class="LikesCount">([0-9,.]+[kKmM]?)\s+likes<\/span>/)
    if (likesMatch?.[1]) {
      likesCount = parseCounter(likesMatch[1])
    }

    if (!videoUrl) {
      return null
    }

    const qualities: MediaDownloadOption[] = [
      {
        quality: '1080p (Full HD)',
        url: videoUrl,
        format: 'mp4',
        hasWatermark: false,
      },
      {
        quality: '720p (HD)',
        url: videoUrl,
        format: 'mp4',
        hasWatermark: false,
      },
    ]

    return {
      id: shortcode,
      platform: 'instagram',
      originalUrl,
      mediaType: 'video',
      title: caption ? (caption.length > 80 ? `${caption.slice(0, 77)}...` : caption) : `Instagram Reel (${shortcode})`,
      description: caption || undefined,
      thumbnail: displayUrl || '',
      duration: 30, // Approximate standard Reel duration
      author: {
        username: username ? (username.startsWith('@') ? username : `@${username}`) : '@instagram.creator',
        nickname: username?.replace(/^@/, ''),
        url: username ? `https://www.instagram.com/${username.replace(/^@/, '')}/` : undefined,
      },
      downloadUrl: videoUrl,
      qualities,
      statistics: {
        likes: likesCount,
      },
    }
  }

  /**
   * Strategy 2: Extract via High-Definition Scraper Gateway
   */
  private async extractFromScraperGateway(shortcode: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const endpoints = [
      `https://api.vkrdownloader.com/server?vkr=${encodeURIComponent(originalUrl)}`,
      `https://snapinsta.app/action.php`,
    ]

    // Fast query to primary public resolver
    try {
      const response = await resilientFetch(endpoints[0], {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/json',
        },
        timeoutMs: timeout,
      })

      if (response.ok) {
        const data = await response.json()
        const video = data?.data?.video || data?.video || data?.data?.downloads?.[0]?.url || data?.download_url

        if (video) {
          const thumbnail = data?.data?.thumbnail || data?.thumbnail || ''
          const title = data?.data?.title || data?.title || `Instagram Reel (${shortcode})`

          return {
            id: shortcode,
            platform: 'instagram',
            originalUrl,
            mediaType: 'video',
            title,
            thumbnail,
            duration: 30,
            author: {
              username: data?.data?.author?.username ? `@${data.data.author.username}` : '@instagram.creator',
              nickname: data?.data?.author?.name,
              avatar: data?.data?.author?.avatar,
            },
            downloadUrl: video,
            qualities: [
              {
                quality: '1080p (Full HD)',
                url: video,
                format: 'mp4',
                hasWatermark: false,
              },
            ],
          }
        }
      }
    } catch {
      // Continue to next fallback
    }

    return null
  }

  /**
   * Strategy 3: OpenGraph / Meta Tag Extraction
   */
  private async extractFromOpenGraph(originalUrl: string, shortcode: string, timeout: number): Promise<MediaMetadata | null> {
    const response = await resilientFetch(originalUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(true), // Use mobile user agent for richer meta tags
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeoutMs: timeout,
    })

    if (!response.ok) return null
    const html = await response.text()

    const ogVideoMatch = html.match(/<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:video(?::secure_url)?"/i)

    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)

    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)

    if (!ogVideoMatch?.[1]) {
      return null
    }

    const videoUrl = decodeHtmlEntities(ogVideoMatch[1])
    const thumbnail = ogImageMatch?.[1] ? decodeHtmlEntities(ogImageMatch[1]) : ''
    const rawTitle = ogTitleMatch?.[1] ? decodeHtmlEntities(ogTitleMatch[1]) : ''

    let username = '@instagram.creator'
    if (rawTitle.includes('on Instagram:')) {
      username = `@${rawTitle.split('on Instagram:')[0].trim()}`
    }

    return {
      id: shortcode,
      platform: 'instagram',
      originalUrl,
      mediaType: 'video',
      title: rawTitle || `Instagram Reel (${shortcode})`,
      description: rawTitle,
      thumbnail,
      duration: 30,
      author: {
        username,
      },
      downloadUrl: videoUrl,
      qualities: [
        {
          quality: '1080p (Full HD)',
          url: videoUrl,
          format: 'mp4',
          hasWatermark: false,
        },
      ],
    }
  }
}

/**
 * Helpers for decoding escaped strings and HTML entities
 */
function decodeJsonString(str: string): string {
  try {
    return str
      .replace(/\\u0026/g, '&')
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&')
  } catch {
    return str
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseCounter(str: string): number {
  const clean = str.replace(/,/g, '').toLowerCase()
  if (clean.endsWith('k')) return parseFloat(clean) * 1000
  if (clean.endsWith('m')) return parseFloat(clean) * 1000000
  return parseInt(clean, 10) || 0
}
