import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')
  const filename = searchParams.get('filename') || 'download.mp4'

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing media URL parameter' }, { status: 400 })
  }

  try {
    const parsed = new URL(targetUrl)
    // Only allow http/https URLs
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 })
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Encoding': 'identity',
      },
    })

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: `Upstream CDN error (${response.status})` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    }

    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    return new Response(response.body as unknown as BodyInit, {
      status: 200,
      headers,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy stream error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
