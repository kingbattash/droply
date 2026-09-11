/**
 * Base abstract class for platform-specific media extractors.
 */

import { ExtractOptions, ExtractorError, MediaMetadata, SupportedPlatform } from '../types'

export abstract class BaseExtractor {
  public abstract readonly platform: SupportedPlatform

  /**
   * Checks whether this extractor can handle the given URL.
   */
  public abstract canHandle(url: string): boolean

  /**
   * Extracts media metadata and high-definition download streams from the target URL.
   */
  public abstract extract(url: string, options?: ExtractOptions): Promise<MediaMetadata>

  /**
   * Safe error wrapper to normalize thrown exceptions into ExtractorError
   */
  protected handleError(err: unknown, fallbackMessage = 'Media extraction failed'): never {
    if (err instanceof ExtractorError) {
      throw err
    }

    const message = err instanceof Error ? err.message : fallbackMessage
    throw new ExtractorError(message, 'EXTRACTION_ERROR', 500)
  }
}
