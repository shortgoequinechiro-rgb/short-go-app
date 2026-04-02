import { NextRequest, NextResponse } from 'next/server'

/**
 * Security middleware — CSP headers + basic rate limiting on public API routes.
 */

// ── In-memory rate limiter (per-IP, resets on deploy) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMITS: Record<string, number> = {
  '/api/contact': 5,              // 5 submissions per hour
  '/api/owners': 20,              // 20 SMS/email sends per hour per IP
}

function isRateLimited(ip: string, path: string): boolean {
  // Find the matching rate limit key
  const limitKey = Object.keys(RATE_LIMITS).find(k => path.startsWith(k))
  if (!limitKey) return false

  const maxRequests = RATE_LIMITS[limitKey]
  const key = `${ip}:${limitKey}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > maxRequests) return true
  return false
}

// Periodic cleanup to prevent memory leaks (every 1000 requests)
let requestCount = 0
function cleanupRateLimitMap() {
  requestCount++
  if (requestCount % 1000 !== 0) return
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // ── Content Security Policy ──
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://pyuarwwhmtoflyzwblbn.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  // ── Rate limiting on API routes ──
  if (pathname.startsWith('/api/')) {
    cleanupRateLimitMap()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    if (isRateLimited(ip, pathname)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  return res
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|glb|gltf|webmanifest|json)).*)',
  ],
}
