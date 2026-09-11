/**
 * URL parsing, sanitization, and ID extraction for TikTok and Instagram.
 */

import { SupportedPlatform } from '../types'
import { resolveFinalUrl } from './http-client'

/**
 * Strips tracking parameters (like igsh, tt_from, utm_*, etc.) from media URLs
 */
export function cleanMediaUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim())
    // Keep only essential parameters, strip known analytics and referrer noise
    const paramsToDrop = [
      'igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
      'utm_content', 'share_app_id', 'share_item_id', 'social_share_type',
      'tt_from', 'sender_device', 'sender_web_id', 'is_from_webapp',
      'share_author_id', 'preview_pb', '_r', 'fbclid'
    ]

    for (const p of paramsToDrop) {
      url.searchParams.delete(p)
    }

    return url.toString()
  } catch {
    return rawUrl.trim()
  }
}

/**
 * Identifies the platform of a given URL
 */
export function detectPlatform(urlStr: string): SupportedPlatform | null {
  try {
    const url = new URL(urlStr.trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')

    if (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'v.douyin.com'
    ) {
      return 'tiktok'
    }

    if (
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'instagr.am' ||
      host === 'ig.me'
    ) {
      return 'instagram'
    }

    return null
  } catch {
    return null
  }
}

/**
 * Checks whether a URL is a valid short link that requires expanding (e.g. vm.tiktok.com, vt.tiktok.com, ig.me)
 */
export function isShortenedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const host = url.hostname.toLowerCase()
    return (
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com' ||
      host === 't.tiktok.com' ||
      host === 'ig.me' ||
      url.pathname.startsWith('/t/')
    )
  } catch {
    return false
  }
}

/**
 * Extracts TikTok Video ID from a standard TikTok URL
 */
export function extractTikTokId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    // Matches /@username/video/1234567890123456789 or /v/1234567890123456789 or /embed/v2/1234567890123456789
    const match = url.pathname.match(/\/(?:video|v|embed\/v2)\/(\d+)/i)
    if (match?.[1]) {
      return match[1]
    }

    // Direct number at end of pathname
    const fallbackMatch = url.pathname.match(/\/(\d{15,22})/i)
    if (fallbackMatch?.[1]) {
      return fallbackMatch[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extracts Instagram Reel / Post shortcode from URL
 */
export function extractInstagramShortcode(urlStr: string): string | null {
  try {
    const url = new URL(urlStr)
    // Matches /reel/CODE/, /reels/CODE/, /p/CODE/, /share/reel/CODE/, /tv/CODE/
    const match = url.pathname.match(/\/(?:reel|reels|p|share\/reel|tv)\/([A-Za-z0-9_-]+)/i)
    if (match?.[1]) {
      return match[1]
    }
    return null
  } catch {
    return null
  }
}

/**
 * Normalizes and resolves short links to standard full URLs
 */
export async function normalizeMediaUrl(rawUrl: string): Promise<{ resolvedUrl: string; platform: SupportedPlatform }> {
  const cleaned = cleanMediaUrl(rawUrl)
  let platform = detectPlatform(cleaned)

  if (!platform) {
    throw new Error('Unsupported URL. Please provide a valid TikTok or Instagram link.')
  }

  let finalUrl = cleaned
  if (isShortenedUrl(cleaned)) {
    finalUrl = await resolveFinalUrl(cleaned)
    // Re-detect platform in case of cross-redirects
    const detected = detectPlatform(finalUrl)
    if (detected) {
      platform = detected
    }
  }

  return {
    resolvedUrl: finalUrl,
    platform,
  }
}
