import { mediaExtractor } from '@/services'
import type { MediaMetadata, SupportedPlatform } from '@/services'

export type Platform = SupportedPlatform

export type ExtractionRequest = {
  url: string
  platform?: Platform
}

export type ExtractionMediaItem = {
  id?: string
  type: 'video' | 'image'
  url: string
  thumbnail?: string
  qualities?: {
    quality: string
    url: string
    format: string
    hasWatermark: boolean
  }[]
}

export type ExtractionResponse = {
  success: true
  platform: Platform
  title: string
  uploader: string
  thumbnail: string
  downloadUrl: string
  duration: number
  mediaType: 'video' | 'image' | 'carousel' | 'audio'
  items?: ExtractionMediaItem[]
  qualities?: {
    quality: string
    url: string
    format: string
    hasWatermark: boolean
  }[]
  music?: {
    title?: string
    author?: string
    playUrl?: string
  }
}

const fallbackDemoMedia = {
  tiktok: {
    title: 'Golden hour in the city',
    uploader: '@northstar.studio',
    thumbnail: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85',
    downloadUrl: 'https://cdn.coverr.co/videos/coverr-aerial-view-of-a-city-at-sunset-1575/1080p.mp4',
    duration: 18,
    mediaType: 'video' as const,
  },
  instagram: {
    title: 'A quiet place to reset (Photo Carousel)',
    uploader: '@fieldnotes.daily',
    thumbnail: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85',
    downloadUrl: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85',
    duration: 0,
    mediaType: 'carousel' as const,
    items: [
      {
        id: 'demo-1',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85',
        thumbnail: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=400&q=80',
        qualities: [{ quality: 'HD Photo 1 (JPG)', url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85', format: 'jpg', hasWatermark: false }],
      },
      {
        id: 'demo-2',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85',
        thumbnail: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=400&q=80',
        qualities: [{ quality: 'HD Photo 2 (JPG)', url: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85', format: 'jpg', hasWatermark: false }],
      },
      {
        id: 'demo-3',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=85',
        thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80',
        qualities: [{ quality: 'HD Photo 3 (JPG)', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=85', format: 'jpg', hasWatermark: false }],
      },
    ],
  },
} satisfies Record<Platform, Omit<ExtractionResponse, 'success' | 'platform'>>

export async function extractMedia({ url, platform }: ExtractionRequest): Promise<ExtractionResponse> {
  const detectedPlatform = platform || mediaExtractor.getPlatform(url) || 'tiktok'

  try {
    const metadata: MediaMetadata = await mediaExtractor.extract(url)

    const items: ExtractionMediaItem[] | undefined = metadata.items?.map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      thumbnail: item.thumbnail,
      qualities: item.qualities?.map((q) => ({
        quality: q.quality,
        url: q.url,
        format: q.format,
        hasWatermark: q.hasWatermark,
      })),
    }))

    return {
      success: true,
      platform: metadata.platform,
      title: metadata.title,
      uploader: metadata.author.username || metadata.author.nickname || `@${metadata.platform}.creator`,
      thumbnail: metadata.thumbnail || fallbackDemoMedia[detectedPlatform].thumbnail,
      downloadUrl: metadata.downloadUrl,
      duration: metadata.duration || (metadata.mediaType === 'image' || metadata.mediaType === 'carousel' ? 0 : 15),
      mediaType: metadata.mediaType,
      items,
      qualities: metadata.qualities.map((q) => ({
        quality: q.quality,
        url: q.url,
        format: q.format,
        hasWatermark: q.hasWatermark,
      })),
      music: metadata.music
        ? {
          title: metadata.music.title,
          author: metadata.music.author,
          playUrl: metadata.music.playUrl,
        }
        : undefined,
    }
  } catch (error) {
    // If it's an example / demo placeholder link, return high-quality demo response
    if (url.includes('example') || url.includes('1234567890')) {
      return {
        success: true,
        platform: detectedPlatform,
        ...fallbackDemoMedia[detectedPlatform],
      }
    }

    throw error
  }
}

export function getPlatformFromUrl(value: string): Platform | null {
  return mediaExtractor.getPlatform(value)
}

export function isSupportedMediaUrl(value: string): boolean {
  return mediaExtractor.isSupported(value)
}
