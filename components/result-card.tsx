'use client'

import { Check, Copy, Download, ExternalLink, Music2 } from 'lucide-react'
import { useState } from 'react'
import type { ExtractionResponse } from '@/lib/extraction'
import { VideoPreviewPlayer } from '@/components/video-preview-player'
import { cn } from '@/lib/utils'

export function ResultCard({ result }: { result: ExtractionResponse }) {
  const [copied, setCopied] = useState(false)
  const [selectedDownloadUrl, setSelectedDownloadUrl] = useState(result.downloadUrl)

  const selectedQualityObj = result.qualities?.find((q) => q.url === selectedDownloadUrl)
  const isAudioSelected = selectedQualityObj?.format === 'mp3' || selectedDownloadUrl.endsWith('.mp3')

  // Generate safe filename
  const cleanTitle = (result.title || 'media').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
  const ext = isAudioSelected ? 'mp3' : 'mp4'
  const filename = `${cleanTitle}.${ext}`

  // Proxy download URL to guarantee downloads work seamlessly without CORS/403 blocks in production
  const proxyDownloadUrl = `/api/proxy?url=${encodeURIComponent(selectedDownloadUrl)}&filename=${encodeURIComponent(filename)}`

  async function copyLink(urlToCopy = selectedDownloadUrl) {
    await navigator.clipboard.writeText(urlToCopy)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-[#e7e7e7] bg-[#ffffff] shadow-[0_0_2px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.14)] transition-all duration-200"
      aria-label="Extraction result"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(240px,0.85fr)_1fr]">
        {/* Preview Player Area */}
        <div className="p-4 md:border-r md:border-[#e7e7e7] bg-[#fafafa]">
          <VideoPreviewPlayer
            src={selectedDownloadUrl}
            poster={result.thumbnail}
            title={result.title}
            author={result.uploader}
            isAudio={isAudioSelected}
            className="h-full min-h-[240px] w-full border border-[#e7e7e7]"
          />
        </div>

        {/* Content & Action Controls */}
        <div className="flex flex-col justify-between gap-5 p-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded border border-[#e7e7e7] bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold capitalize text-[#17253d]">
                {result.platform}
              </span>
              <span className="text-xs text-[#616161]">
                {result.uploader} {result.duration ? `· ${result.duration}s` : ''}
              </span>
            </div>

            <h2 className="text-base font-semibold leading-[1.33] text-[#17253d]">
              {result.title}
            </h2>

            {result.music?.title && (
              <div className="flex items-center gap-1.5 text-xs text-[#616161]">
                <Music2 className="size-3.5 shrink-0 text-[#0078d4]" />
                <span className="truncate">
                  {result.music.title} {result.music.author ? `- ${result.music.author}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Qualities / Format Options */}
          {result.qualities && result.qualities.length > 1 && (
            <div className="flex flex-col gap-1.5 border-t border-[#e7e7e7] pt-3">
              <span className="text-xs font-medium text-[#616161]">Available Formats:</span>
              <div className="flex flex-wrap gap-1.5">
                {result.qualities.map((q, idx) => {
                  const isSelected = selectedDownloadUrl === q.url
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDownloadUrl(q.url)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
                        isSelected
                          ? 'border-[#0078d4] bg-[#0078d4] text-[#ffffff]'
                          : 'border-[#e7e7e7] bg-[#ffffff] text-[#616161] hover:border-[#0078d4] hover:text-[#0078d4]'
                      )}
                    >
                      {q.quality}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[#e7e7e7] pt-3">
            <a
              href={proxyDownloadUrl}
              download={filename}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0078d4] px-4 text-xs font-semibold text-[#ffffff] transition-colors duration-200 hover:bg-[#2a446f] active:bg-[#17253d]"
            >
              <Download className="mr-1.5 size-3.5" /> Download HD
            </a>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e7e7e7] bg-[#ffffff] px-3.5 text-xs font-medium text-[#17253d] transition-colors duration-200 hover:bg-[#f5f5f5]"
              onClick={() => copyLink(selectedDownloadUrl)}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 size-3.5 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 size-3.5 text-[#616161]" /> Copy link
                </>
              )}
            </button>
            <a
              href={selectedDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e7e7e7] bg-[#ffffff] text-[#616161] transition-colors duration-200 hover:bg-[#f5f5f5] hover:text-[#17253d]"
              aria-label="Open in new tab"
              title="Open stream link directly"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
