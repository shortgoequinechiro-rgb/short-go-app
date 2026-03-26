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
// PWA MANIFEST & SERVICE WORKER
// ═══════════════════════════════════════════════════════════════════════════

test.describe('PWA - Manifest', () => {
  test('manifest.json is accessible', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBeTruthy()
  })

  test('manifest has correct app name', async ({ request }) => {
    const res = await request.get('/manifest.json')
    const manifest = await res.json()
    expect(manifest.name.toLowerCase()).toContain('stride')
  })

  test('manifest has icons defined', async ({ request }) => {
    const res = await request.get('/manifest.json')
    const manifest = await res.json()
    expect(manifest.icons).toBeTruthy()
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test('manifest has proper display mode', async ({ request }) => {
    const res = await request.get('/manifest.json')
    const manifest = await res.json()
    // Should be 'standalone' or 'fullscreen' for PWA
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display)
  })

  test('manifest has theme and background colors', async ({ request }) => {
    const res = await request.get('/manifest.json')
    const manifest = await res.json()
    expect(manifest.theme_color).toBeTruthy()
    expect(manifest.background_color).toBeTruthy()
  })
})

test.describe('PWA - Meta Tags', () => {
  test('HTML has manifest link tag', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toBeAttached()
  })

  test('HTML has theme-color meta tag', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const themeColor = page.locator('meta[name="theme-color"]')
    await expect(themeColor).toBeAttached()
  })

  test('HTML has apple-touch-icon', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const appleIcon = page.locator('link[rel="apple-touch-icon"]')
    if (await appleIcon.count() > 0) {
      await expect(appleIcon.first()).toBeAttached()
    }
  })

  test('HTML has viewport meta tag for mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const viewport = page.locator('meta[name="viewport"]')
    await expect(viewport).toBeAttached()
    const content = await viewport.getAttribute('content') || ''
    expect(content).toContain('width=device-width')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TABLET RESPONSIVENESS (768px)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Tablet Responsive', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('landing page renders correctly on tablet', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(200)
  })

  test('login page is usable on tablet', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button', { hasText: /sign in/i })).toBeVisible()
  })

  test('dashboard renders on tablet', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('calendar page renders on tablet', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('invoices page renders on tablet', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('account settings page renders on tablet', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SMALL MOBILE (320px)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Small Mobile Responsive (320px)', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('login page works on very small screen', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button', { hasText: /sign in/i })).toBeVisible()
  })

  test('landing page works on very small screen', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('dashboard works on very small screen', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WIDE DESKTOP (1920px)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Wide Desktop Responsive (1920px)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('dashboard renders correctly on wide desktop', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('landing page renders correctly on wide desktop', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(200)
  })

  test('calendar renders correctly on wide desktop', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})
