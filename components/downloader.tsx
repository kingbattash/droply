'use client'

import { FormEvent, useMemo, useState } from 'react'
import { ArrowRight, Link2, Loader2, TriangleAlert, X } from 'lucide-react'
import type { ExtractionResponse, Platform } from '@/lib/extraction'
import { ResultCard } from '@/components/result-card'

export function Downloader() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<ExtractionResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const platform = useMemo<Platform | null>(() => {
    if (url.includes('tiktok.com')) return 'tiktok'
    if (url.includes('instagram.com')) return 'instagram'
    return null
  }, [url])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to process this URL.')
      setResult(data)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to process this URL.')
    } finally {
      setLoading(false)
    }
  }

  function clearInput() {
    setUrl('')
    setError('')
    setResult(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Microsoft Fluent Form Control */}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="media-url-input"
            className="text-[13px] font-medium text-[#17253d]"
          >
            Post, Video, or Carousel URL
          </label>
          <span className="text-[11px] text-[#616161]">
            Public TikTok or Instagram link (Videos, Photos & Carousels)
          </span>
        </div>

        {/* Input Box & Action Button Row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex min-w-0 flex-1 items-center rounded-lg border border-[#e7e7e7] bg-[#ffffff] transition-all duration-200 hover:border-[#616161] focus-within:border-[#0078d4] focus-within:ring-2 focus-within:ring-[#0078d4] focus-within:ring-offset-2">
            <span className="pl-3.5 pr-2 text-[#616161]">
              <Link2 className="size-4" />
            </span>

            <input
              id="media-url-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste Instagram post/reel or TikTok video/photo slideshow link..."
              className="h-11 min-w-0 flex-1 bg-transparent pr-2 text-[13px] text-[#17253d] placeholder:text-[#616161]/70 focus:outline-none"
              type="url"
              required
              aria-describedby="media-url-helper"
            />

            {/* Platform Badge */}
            {platform && (
              <span className="mr-2 inline-flex items-center rounded border border-[#e7e7e7] bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium capitalize text-[#17253d]">
                {platform}
              </span>
            )}

            {/* Clear Button */}
            {url && (
              <button
                type="button"
                onClick={clearInput}
                className="mr-2 rounded p-1 text-[#616161] hover:bg-[#f5f5f5] hover:text-[#17253d]"
                aria-label="Clear input"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Microsoft Fluent Surface Blue Primary Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center justify-center rounded-lg bg-[#0078d4] px-6 text-[13px] font-semibold text-[#ffffff] transition-colors duration-200 hover:bg-[#2a446f] active:bg-[#17253d] disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Extracting...
              </>
            ) : (
              <>
                Extract HD <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </button>
        </div>

        <p id="media-url-helper" className="text-[11px] text-[#616161]">
          Paste any public post URL to extract HD media, photo carousels, original bitrates, and isolated audio streams.
        </p>
      </form>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[#d13438]/30 bg-[#fdf2f2] p-3 text-xs text-[#d13438]"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#d13438]" />
          <p>{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && <ResultCard result={result} />}
    </div>
  )
}
