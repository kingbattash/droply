'use client'

import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Loader2,
  Music2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import type { ExtractionResponse } from '@/lib/extraction'
import { VideoPreviewPlayer } from '@/components/video-preview-player'
import { cn } from '@/lib/utils'

export function ResultCard({ result }: { result: ExtractionResponse }) {
  const items = result.items && result.items.length > 0
    ? result.items
    : [
        {
          id: 'primary',
          type: result.mediaType === 'image' ? ('image' as const) : ('video' as const),
          url: result.downloadUrl,
          thumbnail: result.thumbnail,
          qualities: result.qualities,
        },
      ]

  const isMultiContent = items.length > 1
  const [activeIndex, setActiveIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState('')

  const activeItem = items[activeIndex] || items[0]
  const [selectedDownloadUrl, setSelectedDownloadUrl] = useState(activeItem.url)

  // Whenever active item changes, update default selected URL
  useEffect(() => {
    setSelectedDownloadUrl(activeItem.url)
  }, [activeIndex, activeItem])

  const currentItemQualities = activeItem.qualities && activeItem.qualities.length > 0
    ? activeItem.qualities
    : result.qualities || []

  const selectedQualityObj = currentItemQualities.find((q) => q.url === selectedDownloadUrl)
  const isAudioSelected = selectedQualityObj?.format === 'mp3' || selectedDownloadUrl.endsWith('.mp3')
  const isImageCurrent = activeItem.type === 'image' && !isAudioSelected

  // Generate safe filename
  const cleanTitle = (result.title || 'media').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 35)
  const ext = isAudioSelected ? 'mp3' : isImageCurrent ? 'jpg' : 'mp4'
  const filename = isMultiContent
    ? `${cleanTitle}_item_${activeIndex + 1}.${ext}`
    : `${cleanTitle}.${ext}`

  const proxyDownloadUrl = `/api/proxy?url=${encodeURIComponent(selectedDownloadUrl)}&filename=${encodeURIComponent(filename)}`

  async function copyLink(urlToCopy = selectedDownloadUrl) {
    await navigator.clipboard.writeText(urlToCopy)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function handlePrev() {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
  }

  function handleNext() {
    setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
  }

  // Handle batch ZIP download of all media items in this post
  async function downloadAllZip() {
    if (isZipping) return
    setIsZipping(true)
    setZipProgress(`1/${items.length}`)

    try {
      const zip = new JSZip()
      const folder = zip.folder(cleanTitle) || zip

      for (let i = 0; i < items.length; i++) {
        setZipProgress(`${i + 1}/${items.length}`)
        const item = items[i]
        const itemExt = item.type === 'image' ? 'jpg' : 'mp4'
        const itemFilename = `${cleanTitle}_${i + 1}.${itemExt}`
        const proxiedItemUrl = `/api/proxy?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(itemFilename)}`

        const resp = await fetch(proxiedItemUrl)
        if (!resp.ok) throw new Error(`Failed to fetch item ${i + 1}`)
        const blob = await resp.blob()
        folder.file(itemFilename, blob)
      }

      // If there's an audio track, include it as well
      if (result.music?.playUrl) {
        try {
          const audioResp = await fetch(`/api/proxy?url=${encodeURIComponent(result.music.playUrl)}&filename=${encodeURIComponent(`${cleanTitle}_audio.mp3`)}`)
          if (audioResp.ok) {
            const audioBlob = await audioResp.blob()
            folder.file(`${cleanTitle}_audio.mp3`, audioBlob)
          }
        } catch {
          // Continue if audio fails
        }
      }

      setZipProgress('Compressing...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)

      const a = document.createElement('a')
      a.href = zipUrl
      a.download = `${cleanTitle}_all_media.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(zipUrl)
    } catch (err) {
      console.error('ZIP download error:', err)
      alert('Could not package all items into a ZIP. You can still download each item individually.')
    } finally {
      setIsZipping(false)
      setZipProgress('')
    }
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-[#ffffff] shadow-[0_0_2px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-200"
      aria-label="Extraction result"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(280px,0.95fr)_1fr]">
        {/* Preview Area */}
        <div className="relative flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#e7e7e7] bg-[#f9fafb] p-4">
          <div className="relative flex min-h-[260px] max-h-[420px] w-full items-center justify-center overflow-hidden rounded-lg border border-[#e7e7e7] bg-black">
            {activeItem.type === 'video' ? (
              <VideoPreviewPlayer
                key={activeItem.url}
                src={activeItem.url}
                poster={activeItem.thumbnail || result.thumbnail}
                title={`${result.title} - Item ${activeIndex + 1}`}
                author={result.uploader}
                isAudio={isAudioSelected}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="relative flex size-full items-center justify-center bg-black/95">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeItem.url}
                  alt={`${result.title} - slide ${activeIndex + 1}`}
                  className="max-h-[380px] w-full object-contain transition-opacity duration-200"
                  loading="eager"
                />
                <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <ImageIcon className="size-3" /> Photo
                </div>
              </div>
            )}

            {/* Carousel Navigation Arrows Overlay */}
            {isMultiContent && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-black/90 active:scale-95 z-10"
                  aria-label="Previous media item"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-black/90 active:scale-95 z-10"
                  aria-label="Next media item"
                >
                  <ChevronRight className="size-4" />
                </button>

                {/* Counter Pill */}
                <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm z-10">
                  {activeIndex + 1} / {items.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail Slider for Multi-Item Posts */}
          {isMultiContent && (
            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#616161]">
                <span>Gallery Items ({items.length})</span>
                <span>Select item to view</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                {items.map((item, idx) => {
                  const isSelected = activeIndex === idx
                  return (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        'group relative flex size-14 shrink-0 overflow-hidden rounded-md border-2 transition-all',
                        isSelected
                          ? 'border-[#0078d4] ring-2 ring-[#0078d4]/30'
                          : 'border-transparent opacity-70 hover:opacity-100 hover:border-[#616161]'
                      )}
                      aria-label={`View slide ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail || item.url}
                        alt={`Thumb ${idx + 1}`}
                        className="size-full object-cover"
                      />
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                        {item.type === 'video' ? <Film className="size-2.5" /> : idx + 1}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Content Details & Action Controls */}
        <div className="flex flex-col justify-between gap-5 p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded border border-[#e7e7e7] bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold capitalize text-[#17253d]">
                {result.platform}
              </span>

              {isMultiContent ? (
                <span className="inline-flex items-center gap-1 rounded bg-[#0078d4]/10 px-2 py-0.5 text-xs font-semibold text-[#0078d4]">
                  <Sparkles className="size-3" /> Carousel ({items.length} {items.length === 1 ? 'item' : 'items'})
                </span>
              ) : (
                <span className="inline-flex items-center rounded border border-[#e7e7e7] bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium capitalize text-[#616161]">
                  {result.mediaType}
                </span>
              )}

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
          {currentItemQualities.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-[#e7e7e7] pt-3">
              <span className="text-xs font-medium text-[#616161]">
                Available Formats {isMultiContent ? `(Item ${activeIndex + 1})` : ''}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentItemQualities.map((q, idx) => {
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
            {/* Main Single Download */}
            <a
              href={proxyDownloadUrl}
              download={filename}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0078d4] px-4 text-xs font-semibold text-[#ffffff] transition-colors duration-200 hover:bg-[#2a446f] active:bg-[#17253d]"
            >
              <Download className="mr-1.5 size-3.5" />
              {isImageCurrent
                ? isMultiContent
                  ? `Download Photo ${activeIndex + 1}`
                  : 'Download HD Photo'
                : isMultiContent
                  ? `Download Video ${activeIndex + 1}`
                  : 'Download HD'}
            </a>

            {/* Batch Download All for Carousels */}
            {isMultiContent && (
              <button
                type="button"
                onClick={downloadAllZip}
                disabled={isZipping}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#0078d4] bg-[#0078d4]/10 px-3.5 text-xs font-semibold text-[#0078d4] transition-colors duration-200 hover:bg-[#0078d4] hover:text-[#ffffff] disabled:opacity-60"
                title="Download all media items packaged in a ZIP archive"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    {zipProgress ? `Packaging ${zipProgress}` : 'Packaging ZIP...'}
                  </>
                ) : (
                  <>
                    <Archive className="mr-1.5 size-3.5" />
                    Download All ({items.length} ZIP)
                  </>
                )}
              </button>
            )}

            {/* Copy Link */}
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e7e7e7] bg-[#ffffff] px-3 text-xs font-medium text-[#17253d] transition-colors duration-200 hover:bg-[#f5f5f5]"
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

            {/* Open direct tab */}
            <a
              href={selectedDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e7e7e7] bg-[#ffffff] text-[#616161] transition-colors duration-200 hover:bg-[#f5f5f5] hover:text-[#17253d]"
              aria-label="Open in new tab"
              title="Open direct media stream link"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

