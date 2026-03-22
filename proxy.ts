import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh the session — this keeps auth tokens alive
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
    || request.nextUrl.pathname.startsWith('/calendar')
    || request.nextUrl.pathname.startsWith('/appointments')
    || request.nextUrl.pathname.startsWith('/horses')
    || request.nextUrl.pathname.startsWith('/owners')
    || request.nextUrl.pathname.startsWith('/account')
    || request.nextUrl.pathname.startsWith('/billing')
    || request.nextUrl.pathname.startsWith('/anatomy')
    || request.nextUrl.pathname.startsWith('/human')
    || request.nextUrl.pathname.startsWith('/select-mode')

  if (!user && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = request.nextUrl.pathname === '/login'
    || request.nextUrl.pathname === '/signup'

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap, robots
     * - Public assets
     * - API routes (they handle their own auth)
     * - Public form pages (intake, consent, confirmed)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|icons/|api/|intake|consent|confirmed|contact|landing).*)',
  ],
}
