/**
 * Media Extractor Service Orchestrator (Manager / Facade).
 * Provides a unified, modular entrypoint for all platform extractors with
 * automatic link resolution, platform routing, error handling, and performance metrics.
 */

import { BaseExtractor } from './base/base-extractor'
import { InstagramExtractor } from './instagram/instagram-extractor.service'
import { TikTokExtractor } from './tiktok/tiktok-extractor.service'
import {
  ExtractOptions,
  ExtractorError,
  ExtractResult,
  MediaMetadata,
  SupportedPlatform,
} from './types'
import { detectPlatform, normalizeMediaUrl } from './utils/url-parser'

export class MediaExtractorService {
  private extractors: Map<SupportedPlatform, BaseExtractor> = new Map()

  constructor() {
    // Register default platform extractors
    this.registerExtractor(new TikTokExtractor())
    this.registerExtractor(new InstagramExtractor())
  }

  /**
   * Registers a new platform extractor dynamically
   */
  public registerExtractor(extractor: BaseExtractor): this {
    this.extractors.set(extractor.platform, extractor)
    return this
  }

  /**
   * Retrieves registered extractor for a given platform
   */
  public getExtractor(platform: SupportedPlatform): BaseExtractor | undefined {
    return this.extractors.get(platform)
  }

  /**
   * Returns list of currently supported platforms
   */
  public getSupportedPlatforms(): SupportedPlatform[] {
    return Array.from(this.extractors.keys())
  }

  /**
   * Checks whether a given URL is supported
   */
  public isSupported(url: string): boolean {
    const platform = detectPlatform(url)
    return platform !== null && this.extractors.has(platform)
  }

  /**
   * Detects platform from URL string
   */
  public getPlatform(url: string): SupportedPlatform | null {
    return detectPlatform(url)
  }

  /**
   * Main extraction entry point:
   * 1. Resolves and normalizes target URL (expands short links)
   * 2. Selects matching extractor module
   * 3. Executes high-definition extraction
   * 4. Returns standardized MediaMetadata
   */
  public async extract(rawUrl: string, options: ExtractOptions = {}): Promise<MediaMetadata> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new ExtractorError('A valid URL string is required.', 'INVALID_INPUT', 400)
    }

    const startTime = Date.now()
    const { resolvedUrl, platform } = await normalizeMediaUrl(rawUrl)

    const extractor = this.getExtractor(platform)
    if (!extractor) {
      throw new ExtractorError(
        `No extractor registered for platform: '${platform}'.`,
        'UNSUPPORTED_PLATFORM',
        400
      )
    }

    try {
      const metadata = await extractor.extract(resolvedUrl, options)
      return metadata
    } catch (error: unknown) {
      if (error instanceof ExtractorError) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Extraction failed'
      throw new ExtractorError(message, 'EXTRACTION_FAILED', 500)
    }
  }

  /**
   * Safe extraction method that never throws, returning a normalized `ExtractResult` object.
   */
  public async safeExtract(rawUrl: string, options: ExtractOptions = {}): Promise<ExtractResult> {
    const startTime = Date.now()
    try {
      const platform = detectPlatform(rawUrl) || 'tiktok'
      const data = await this.extract(rawUrl, options)

      return {
        success: true,
        platform: data.platform,
        data,
        executionTimeMs: Date.now() - startTime,
      }
    } catch (err: unknown) {
      const platform = detectPlatform(rawUrl) || 'tiktok'
      const errorMsg = err instanceof Error ? err.message : 'Unknown extraction error occurred'
      const errorCode = err instanceof ExtractorError ? err.code : 'EXTRACTION_ERROR'

      return {
        success: false,
        platform,
        error: errorMsg,
        errorCode,
        executionTimeMs: Date.now() - startTime,
      }
    }
  }
}

// Global singleton instance for easy import and reuse
export const mediaExtractor = new MediaExtractorService()
