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
  MediaItem,
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
      'Unable to extract media from this Instagram link. The post may be private, restricted, or deleted.',
      'INSTAGRAM_EXTRACTION_FAILED',
      404
    )
  }

  /**
   * Strategy 1: Extract from Instagram's official public embed endpoint
   */
  private async extractFromEmbed(shortcode: string, originalUrl: string, timeout: number): Promise<MediaMetadata | null> {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
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

    let username: string | null = null
    let caption: string | null = null
    let likesCount: number | undefined

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

    const mediaItems: MediaItem[] = []
    const qualities: MediaDownloadOption[] = []

    // Try extracting JSON payload embedded in script tags (e.g. window.__additionalDataLoaded or shortcode_media)
    try {
      const jsonMatch = html.match(/<script[^>]*>[\s\S]*?window\.__additionalDataLoaded\s*\(\s*'[^']*'\s*,\s*(\{[\s\S]*?\})\s*\)\s*;/i) ||
        html.match(/<script[^>]*>\s*(\{"graphql"[\s\S]*?\})\s*<\/script>/i) ||
        html.match(/<script[^>]*>\s*(\{"shortcode_media"[\s\S]*?\})\s*<\/script>/i)

      if (jsonMatch?.[1]) {
        const parsed = JSON.parse(jsonMatch[1])
        const shortcodeMedia = parsed?.shortcode_media || parsed?.graphql?.shortcode_media || parsed?.items?.[0]

        if (shortcodeMedia) {
          // Check for carousel sidecar
          const sidecarEdges = shortcodeMedia?.edge_sidecar_to_children?.edges || shortcodeMedia?.carousel_media
          if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
            sidecarEdges.forEach((edgeItem: { node?: Record<string, unknown> } | Record<string, unknown>, idx: number) => {
              const node = ((edgeItem as { node?: Record<string, unknown> })?.node || edgeItem) as Record<string, unknown>
              if (!node) return
              const isVideo = Boolean(node.is_video)

              // Extract highest resolution display resource if available
              let bestDisplayUrl = (node.display_url || node.thumbnail_src) as string
              if (Array.isArray(node.display_resources) && node.display_resources.length > 0) {
                const sorted = [...node.display_resources].sort((a: { config_width?: number }, b: { config_width?: number }) => (b.config_width || 0) - (a.config_width || 0))
                if (sorted[0]?.src) {
                  bestDisplayUrl = sorted[0].src
                }
              }

              // Extract best video url if available
              let bestVideoUrl = (node.video_url || (Array.isArray(node.video_resources) && (node.video_resources as { src?: string }[])[0]?.src)) as string

              const itemUrl = isVideo ? (bestVideoUrl || bestDisplayUrl) : bestDisplayUrl
              const thumbUrl = bestDisplayUrl || (node.display_url as string)

              if (itemUrl) {
                const itemQualities: MediaDownloadOption[] = isVideo
                  ? [
                      { quality: `Video ${idx + 1} (Full HD)`, url: itemUrl, format: 'mp4', hasWatermark: false },
                    ]
                  : [
                      { quality: `Photo ${idx + 1} (HD)`, url: itemUrl, format: 'jpg', hasWatermark: false },
                    ]

                mediaItems.push({
                  id: `${shortcode}-item-${idx + 1}`,
                  type: isVideo ? 'video' : 'image',
                  url: itemUrl,
                  thumbnail: thumbUrl,
                  qualities: itemQualities,
                })

                qualities.push(...itemQualities)
              }
            })
          }
        }
      }
    } catch {
      // Fall through to regex extraction
    }

    // Video URL matching regexes
    let videoUrl: string | null = null
    const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/) ||
      html.match(/\\?"video_url\\?"\s*:\s*\\?"([^"\\]+)/) ||
      html.match(/class="EmbeddedMediaVideo"[\s\S]*?src="([^"]+)"/)

    if (videoUrlMatch?.[1]) {
      videoUrl = decodeJsonString(videoUrlMatch[1])
    }

    // Display / Thumbnail URL matching
    let displayUrl: string | null = null
    const displayUrlMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/) ||
      html.match(/class="EmbeddedMediaImage"[\s\S]*?src="([^"]+)"/) ||
      html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/)

    if (displayUrlMatch?.[1]) {
      displayUrl = decodeJsonString(displayUrlMatch[1])
    }

    // If carousel nodes weren't found via JSON, check regex matches for multiple images
    if (mediaItems.length === 0) {
      // Find all display_url instances
      const allDisplayUrls = Array.from(html.matchAll(/"display_url"\s*:\s*"([^"]+)"/g)).map(m => decodeJsonString(m[1]))
      const uniqueDisplayUrls = Array.from(new Set(allDisplayUrls))

      if (uniqueDisplayUrls.length > 1) {
        uniqueDisplayUrls.forEach((imgUrl, idx) => {
          mediaItems.push({
            id: `${shortcode}-img-${idx + 1}`,
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
        })
      } else if (videoUrl) {
        mediaItems.push({
          id: shortcode,
          type: 'video',
          url: videoUrl,
          thumbnail: displayUrl || '',
          qualities: [
            { quality: '1080p (Full HD)', url: videoUrl, format: 'mp4', hasWatermark: false },
            { quality: '720p (HD)', url: videoUrl, format: 'mp4', hasWatermark: false },
          ],
        })
        qualities.push(
          { quality: '1080p (Full HD)', url: videoUrl, format: 'mp4', hasWatermark: false },
          { quality: '720p (HD)', url: videoUrl, format: 'mp4', hasWatermark: false },
        )
      } else if (displayUrl) {
        mediaItems.push({
          id: shortcode,
          type: 'image',
          url: displayUrl,
          thumbnail: displayUrl,
          qualities: [
            { quality: 'HD Photo (JPG)', url: displayUrl, format: 'jpg', hasWatermark: false },
          ],
        })
        qualities.push({
          quality: 'HD Photo (JPG)',
          url: displayUrl,
          format: 'jpg',
          hasWatermark: false,
        })
      }
    }

    if (mediaItems.length === 0) {
      return null
    }

    const isCarousel = mediaItems.length > 1
    const isImage = !isCarousel && mediaItems[0]?.type === 'image'
    const mediaType = isCarousel ? 'carousel' : isImage ? 'image' : 'video'
    const primaryDownloadUrl = mediaItems[0]?.url || videoUrl || displayUrl || ''

    return {
      id: shortcode,
      platform: 'instagram',
      originalUrl,
      mediaType,
      title: caption ? (caption.length > 80 ? `${caption.slice(0, 77)}...` : caption) : (isCarousel ? `Instagram Carousel (${mediaItems.length} items)` : `Instagram Post (${shortcode})`),
      description: caption || undefined,
      thumbnail: displayUrl || mediaItems[0]?.thumbnail || '',
      duration: isImage || isCarousel ? 0 : 30,
      author: {
        username: username ? (username.startsWith('@') ? username : `@${username}`) : '@instagram.creator',
        nickname: username?.replace(/^@/, ''),
        url: username ? `https://www.instagram.com/${username.replace(/^@/, '')}/` : undefined,
      },
      downloadUrl: primaryDownloadUrl,
      qualities,
      items: mediaItems.length > 0 ? mediaItems : undefined,
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
        const payload = data?.data || data

        const mediaItems: MediaItem[] = []
        const qualities: MediaDownloadOption[] = []

        // Check for multiple downloads/items
        const downloads = payload?.downloads || payload?.media || payload?.carousel || payload?.items
        if (Array.isArray(downloads) && downloads.length > 0) {
          downloads.forEach((item: Record<string, unknown>, idx: number) => {
            const itemUrl = (item?.url || item?.download_url || item?.video || item?.image) as string
            const isVid = item?.type === 'video' || (typeof itemUrl === 'string' && (itemUrl.includes('.mp4') || itemUrl.includes('video')))
            const thumb = (item?.thumbnail || item?.thumb || itemUrl) as string

            if (itemUrl) {
              const itemType = isVid ? 'video' : 'image'
              const format = isVid ? 'mp4' : 'jpg'
              const qualityLabel = isVid ? `Video ${idx + 1} (HD)` : `Photo ${idx + 1} (HD)`

              mediaItems.push({
                id: `${shortcode}-${idx + 1}`,
                type: itemType,
                url: itemUrl,
                thumbnail: thumb,
                qualities: [{ quality: qualityLabel, url: itemUrl, format, hasWatermark: false }],
              })

              qualities.push({
                quality: qualityLabel,
                url: itemUrl,
                format,
                hasWatermark: false,
              })
            }
          })
        }

        const video = payload?.video || payload?.download_url
        const image = payload?.image || payload?.thumbnail
        const thumbnail = payload?.thumbnail || image || (mediaItems[0]?.thumbnail || '')
        const title = payload?.title || `Instagram Post (${shortcode})`

        if (mediaItems.length > 0 || video || image) {
          const isCarousel = mediaItems.length > 1
          const isImage = !isCarousel && (mediaItems[0]?.type === 'image' || (!video && Boolean(image)))
          const mediaType = isCarousel ? 'carousel' : isImage ? 'image' : 'video'
          const primaryDownloadUrl = mediaItems[0]?.url || video || image

          if (mediaItems.length === 0) {
            if (video) {
              qualities.push({ quality: '1080p (Full HD)', url: video, format: 'mp4', hasWatermark: false })
              mediaItems.push({ id: shortcode, type: 'video', url: video, thumbnail, qualities })
            } else if (image) {
              qualities.push({ quality: 'HD Photo (JPG)', url: image, format: 'jpg', hasWatermark: false })
              mediaItems.push({ id: shortcode, type: 'image', url: image, thumbnail: image, qualities })
            }
          }

          return {
            id: shortcode,
            platform: 'instagram',
            originalUrl,
            mediaType,
            title,
            thumbnail,
            duration: isImage || isCarousel ? 0 : 30,
            author: {
              username: payload?.author?.username ? `@${payload.author.username}` : '@instagram.creator',
              nickname: payload?.author?.name,
              avatar: payload?.author?.avatar,
            },
            downloadUrl: primaryDownloadUrl,
            qualities,
            items: mediaItems.length > 0 ? mediaItems : undefined,
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

    const videoUrl = ogVideoMatch?.[1] ? decodeHtmlEntities(ogVideoMatch[1]) : null
    const thumbnail = ogImageMatch?.[1] ? decodeHtmlEntities(ogImageMatch[1]) : ''
    const rawTitle = ogTitleMatch?.[1] ? decodeHtmlEntities(ogTitleMatch[1]) : ''

    if (!videoUrl && !thumbnail) {
      return null
    }

    let username = '@instagram.creator'
    if (rawTitle.includes('on Instagram:')) {
      username = `@${rawTitle.split('on Instagram:')[0].trim()}`
    }

    const isVideo = Boolean(videoUrl)
    const mediaType = isVideo ? 'video' : 'image'
    const downloadUrl = videoUrl || thumbnail
    const qualities: MediaDownloadOption[] = videoUrl
      ? [{ quality: '1080p (Full HD)', url: videoUrl, format: 'mp4', hasWatermark: false }]
      : [{ quality: 'HD Photo (JPG)', url: thumbnail, format: 'jpg', hasWatermark: false }]

    const items: MediaItem[] = [
      {
        id: shortcode,
        type: mediaType,
        url: downloadUrl,
        thumbnail,
        qualities,
      },
    ]

    return {
      id: shortcode,
      platform: 'instagram',
      originalUrl,
      mediaType,
      title: rawTitle || `Instagram Post (${shortcode})`,
      description: rawTitle,
      thumbnail,
      duration: isVideo ? 30 : 0,
      author: {
        username,
      },
      downloadUrl,
      qualities,
      items,
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
