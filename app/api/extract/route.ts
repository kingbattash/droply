import { NextResponse } from 'next/server'
import { extractMedia, getPlatformFromUrl, isSupportedMediaUrl } from '@/lib/extraction'
import { ExtractorError } from '@/services'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url = typeof body?.url === 'string' ? body.url.trim() : ''

    if (!url || !isSupportedMediaUrl(url)) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid public TikTok or Instagram URL.' },
        { status: 400 },
      )
    }

    const platform = getPlatformFromUrl(url)
    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'This platform is not supported yet.' },
        { status: 400 },
      )
    }

    const result = await extractMedia({ url, platform })
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof ExtractorError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode },
      )
    }

    const message = error instanceof Error ? error.message : 'Something went wrong while processing that link.'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
