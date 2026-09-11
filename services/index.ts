/**
 * Media Extraction Service Module
 * Comprehensive modular toolkit for extracting TikTok and Instagram videos in HD.
 */

export * from './types'
export * from './base/base-extractor'
export * from './tiktok'
export * from './instagram'
export * from './utils/http-client'
export * from './utils/url-parser'
export * from './media-extractor.service'

import { mediaExtractor } from './media-extractor.service'
import { ExtractOptions, MediaMetadata } from './types'

/**
 * Convenience helper function to extract high definition media directly.
 */
export async function extractMedia(url: string, options?: ExtractOptions): Promise<MediaMetadata> {
  return mediaExtractor.extract(url, options)
}

/**
 * Convenience helper function to safely extract media with full result status.
 */
export async function safeExtractMedia(url: string, options?: ExtractOptions) {
  return mediaExtractor.safeExtract(url, options)
}
