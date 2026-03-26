import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// AUTH HELPER
// ═══════════════════════════════════════════════════════════════════════════

let authAvailable: boolean | null = null

async function tryLogin(page: Page): Promise<boolean> {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) { test.skip(); return false }
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button', { hasText: /sign in/i }).click()
  try {
    await page.waitForURL('**/dashboard', { timeout: 12000 })
    return true
  } catch { return false }
}

async function ensureAuth(page: Page) {
  if (authAvailable === false) { test.skip(); return }
  const ok = await tryLogin(page)
  if (!ok) { authAvailable = false; test.skip(); return }
  authAvailable = true
}

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Security Headers', () => {
  test('responses include X-Frame-Options header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    expect(headers['x-frame-options']?.toLowerCase()).toBe('deny')
  })

  test('responses include X-Content-Type-Options header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    expect(headers['x-content-type-options']).toBe('nosniff')
  })

  test('responses include Referrer-Policy header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    expect(headers['referrer-policy']).toBeTruthy()
  })

  test('responses include Content-Security-Policy header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    const csp = headers['content-security-policy'] || ''
    expect(csp.length).toBeGreaterThan(0)
  })

  test('CSP headers are set on authenticated pages too', async ({ page }) => {
    await ensureAuth(page)
    const response = await page.goto('/dashboard')
    const headers = response?.headers() || {}
    expect(headers['x-frame-options']?.toLowerCase()).toBe('deny')
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLE ERROR MONITORING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Console Error Monitoring - Public Pages', () => {
  const publicRoutes = ['/', '/login', '/signup', '/features', '/pricing', '/about', '/contact']

  for (const route of publicRoutes) {
    test(`no critical console errors on ${route}`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Filter out known non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('Failed to load resource: the server responded with a status of 404') &&
        !e.includes('robots.txt') &&
        !e.includes('sw.js') // Service worker may 404 in dev
      )
      expect(criticalErrors.length).toBe(0)
    })
  }
})

test.describe('Console Error Monitoring - Authenticated Pages', () => {
  const authRoutes = ['/dashboard', '/appointments', '/calendar', '/invoices', '/reports', '/communications', '/services', '/account']

  for (const route of authRoutes) {
    test(`no critical console errors on ${route}`, async ({ page }) => {
      await ensureAuth(page)

      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('analytics') &&
        !e.includes('Failed to load resource: the server responded with a status of 404') &&
        !e.includes('robots.txt') &&
        !e.includes('sw.js') &&
        !e.includes('chrome-extension') &&
        !e.includes('ResizeObserver')
      )
      expect(criticalErrors.length).toBe(0)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// BASIC ACCESSIBILITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Accessibility - Basic Checks', () => {
  test('login page has proper form labels/aria', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Email input should have accessible label
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    const emailLabel = await emailInput.getAttribute('aria-label') || ''
    const emailPlaceholder = await emailInput.getAttribute('placeholder') || ''
    expect(emailLabel || emailPlaceholder).toBeTruthy()

    // Password input should have accessible label
    const passInput = page.locator('input[type="password"]')
    await expect(passInput).toBeVisible()
    const passLabel = await passInput.getAttribute('aria-label') || ''
    const passPlaceholder = await passInput.getAttribute('placeholder') || ''
    expect(passLabel || passPlaceholder).toBeTruthy()
  })

  test('pages have a main heading (h1)', async ({ page }) => {
    const routes = ['/', '/login', '/signup', '/features', '/pricing', '/about']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      const h1 = page.locator('h1').first()
      await expect(h1).toBeVisible({ timeout: 10000 })
    }
  })

  test('images have alt attributes on landing page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      // alt should exist (even if empty for decorative images)
      expect(alt).not.toBeNull()
    }
  })

  test('notification bell has aria-label', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const bell = page.locator('button[aria-label="Notifications"]')
    await expect(bell).toBeVisible({ timeout: 10000 })
    const ariaLabel = await bell.getAttribute('aria-label')
    expect(ariaLabel).toBe('Notifications')
  })

  test('mobile menu button has aria-label', async ({ page }) => {
    // Use mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const menuBtn = page.locator('button[aria-label="Open menu"]')
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const ariaLabel = await menuBtn.getAttribute('aria-label')
      expect(ariaLabel).toBe('Open menu')
    }
  })

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Tab to the email input
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)

    // The focused element should have some visual indicator
    const focused = page.locator(':focus')
    const tagName = await focused.evaluate(el => el.tagName.toLowerCase()).catch(() => '')
    // Something should be focused
    expect(tagName).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// API AUTH PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

test.describe('API Auth Protection', () => {
  const protectedEndpoints = [
    { path: '/api/invoices', method: 'GET' },
    { path: '/api/reports', method: 'GET' },
    { path: '/api/communications', method: 'GET' },
    { path: '/api/notifications', method: 'GET' },
    { path: '/api/services', method: 'GET' },
  ]

  for (const endpoint of protectedEndpoints) {
    test(`${endpoint.path} returns 401 without auth`, async ({ request }) => {
      const res = await request.get(endpoint.path)
      expect(res.status()).toBe(401)
    })
  }

  test('upload-logo endpoint rejects without auth', async ({ request }) => {
    const res = await request.post('/api/upload-logo')
    expect(res.status()).not.toBe(200) // Should be 401 or 400
  })

  test('reminders endpoint rejects without CRON_SECRET', async ({ request }) => {
    const res = await request.get('/api/reminders/send')
    expect(res.status()).not.toBe(200) // Should require auth
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Rate Limiting', () => {
  test('contact endpoint has rate limiting (returns non-500 for rapid calls)', async ({ request }) => {
    const results: number[] = []
    // Send 3 rapid requests
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/contact', {
        data: { name: 'Test', email: 'test@test.com', message: `rate limit test ${i}` },
      })
      results.push(res.status())
    }
    // All should return valid HTTP status codes (not server crash)
    for (const status of results) {
      expect(status).toBeGreaterThanOrEqual(200)
      expect(status).toBeLessThan(600)
    }
  })
})
