import { ArrowRight, Download, ExternalLink, Globe, Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Downloader } from '@/components/downloader'

const capabilities = [
  {
    icon: Zap,
    title: 'Instant Extraction',
    description: 'Direct CDN stream extraction delivering clean 1080p Full HD video files without server compression.',
  },
  {
    icon: Sparkles,
    title: 'Original High Quality',
    description: 'Preserves the creator original bitrate, resolution, dynamic cover art, and isolated audio streams.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Privacy',
    description: 'No accounts, sign-ins, or telemetry required. Processes public social links strictly on demand.',
  },
]

export default function Page() {
  return (
    <div className="min-h-screen bg-[#ffffff] text-[#17253d] antialiased">
      {/* Microsoft Fluent Top Navigation */}
      <header className="border-b border-[#e7e7e7] bg-[#ffffff]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <a href="#" className="flex items-center gap-2 font-medium tracking-tight text-[#17253d]">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#17253d] text-[#ffffff]">
                <Download className="size-4" />
              </span>
              <span className="text-base font-semibold">Droply</span>
            </a>
            <span className="hidden text-xs text-[#616161] sm:inline">|</span>
            <span className="hidden text-xs text-[#616161] sm:inline">Media Extractor for TikTok & Instagram</span>
          </div>

          <nav className="flex items-center gap-6 text-xs text-[#616161]">
            <a href="#capabilities" className="transition-colors duration-200 hover:text-[#0078d4]">Capabilities</a>
            <a href="#guidelines" className="transition-colors duration-200 hover:text-[#0078d4]">Terms & Safety</a>
            <span className="rounded-full border border-[#e7e7e7] bg-[#f5f5f5] px-2.5 py-0.5 text-[11px] font-medium text-[#17253d]">
              Fluent v1.0
            </span>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Display Hero Section */}
        <section className="mb-10 text-center">
          <h1 className="text-[28px] sm:text-[40px] font-medium leading-[1.2] tracking-[-1px] text-[#17253d]">
            Extract TikTok & Instagram in High Definition
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] sm:text-[14px] leading-[1.45] tracking-[-0.48px] text-[#616161]">
            Enter a public TikTok video or Instagram Reel URL to extract high-definition video files, audio tracks, and previews instantly.
          </p>
        </section>

        {/* Downloader Utility Component */}
        <section className="mx-auto max-w-2xl">
          <Downloader />
        </section>

        {/* Fluent Capabilities Section */}
        <section id="capabilities" className="mt-16 pt-6">
          <div className="mb-6">
            <h2 className="text-[24px] font-medium leading-[1.33] tracking-[-0.6px] text-[#17253d]">
              System Capabilities
            </h2>
            <p className="mt-1 text-[13px] leading-[1.45] tracking-[-0.48px] text-[#616161]">
              Engineered with resilient multi-tier extraction algorithms and fast fallback routing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {capabilities.map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-2.5 rounded-lg border border-[#e7e7e7] bg-[#ffffff] p-5 shadow-[0_0_2px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.14)] transition-colors duration-200"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#0078d4]">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#17253d]">{item.title}</h3>
                  <p className="text-xs leading-[1.45] text-[#616161]">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="guidelines" className="border-t border-[#e7e7e7] bg-[#f9fafb] mt-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-[#616161] sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#17253d]">Droply</span>
            <span>· Built on Microsoft Fluent Design System</span>
          </div>
          <span>Public media extraction only. Please respect creator intellectual property.</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
