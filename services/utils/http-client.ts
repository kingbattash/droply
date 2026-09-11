/**
 * Robust HTTP client utility with User-Agent rotation, IP spoofing, timeout handling, and redirect support.
 * Optimized specifically for Vercel Serverless Functions and anti-bot/WAF bypass.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
]

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  retries?: number
  followRedirects?: boolean
}

/**
 * Returns a random realistic browser User-Agent
 */
export function getRandomUserAgent(isMobile = false): string {
  if (isMobile) {
    return USER_AGENTS[2] // Mobile Safari
  }
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Generates a random realistic residential IP for X-Forwarded-For header to bypass datacenter IP filters
 */
function getRandomIp(): string {
  const octet1 = Math.floor(Math.random() * (220 - 24)) + 24
  const octet2 = Math.floor(Math.random() * 255)
  const octet3 = Math.floor(Math.random() * 255)
  const octet4 = Math.floor(Math.random() * 254) + 1
  return `${octet1}.${octet2}.${octet3}.${octet4}`
}

/**
 * Fetch wrapper with built-in timeout, anti-bot headers, and fast retry logic for serverless
 */
export async function resilientFetch(url: string, options: RequestOptions = {}): Promise<Response> {
  const {
    timeoutMs = 7000, // Kept fast (7s) so multi-strategy fallback completes within Vercel's execution window
    retries = 1,
    headers = {},
    ...fetchOptions
  } = options

  const clientIp = getRandomIp()
  const defaultHeaders: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'X-Forwarded-For': clientIp,
    'X-Real-IP': clientIp,
    'Upgrade-Insecure-Requests': '1',
  }

  const mergedHeaders = {
    ...defaultHeaders,
    ...(headers as Record<string, string>),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal,
      })

      clearTimeout(timer)
      return response
    } catch (err: unknown) {
      clearTimeout(timer)
      const isAbort = (err as Error)?.name === 'AbortError'
      lastError = new Error(
        isAbort ? `Timeout after ${timeoutMs}ms for ${url}` : (err as Error)?.message || 'Fetch failed'
      )

      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 300))
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`)
}

/**
 * Resolves redirects and returns the final destination URL.
 */
export async function resolveFinalUrl(initialUrl: string, timeoutMs = 6000): Promise<string> {
  try {
    const response = await resilientFetch(initialUrl, {
      method: 'HEAD',
      redirect: 'follow',
      timeoutMs,
      retries: 1,
    })
    return response.url || initialUrl
  } catch {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(initialUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'X-Forwarded-For': getRandomIp(),
        },
      })
      clearTimeout(timer)
      return res.url || initialUrl
    } catch {
      return initialUrl
    }
  }
}
