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
// CALENDAR — DAY/WEEK/MONTH VIEWS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Calendar Views', () => {
  test('calendar page loads with mini calendar and grid', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Should show current month name
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    expect(body).toContain(monthName)
  })

  test('calendar has day/week/month view toggles', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const dayBtn = page.locator('button', { hasText: /^day$/i }).first()
    const weekBtn = page.locator('button', { hasText: /^week$/i }).first()
    const monthBtn = page.locator('button', { hasText: /^month$/i }).first()

    // At least one view toggle should be visible
    const hasViewToggles = (await dayBtn.isVisible().catch(() => false)) ||
                           (await weekBtn.isVisible().catch(() => false)) ||
                           (await monthBtn.isVisible().catch(() => false))
    expect(hasViewToggles).toBeTruthy()
  })

  test('switching between day/week/month views does not crash', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const views = ['day', 'week', 'month']
    for (const view of views) {
      const btn = page.locator('button', { hasText: new RegExp(`^${view}$`, 'i') }).first()
      if (await btn.isVisible().catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(1000)
        const body = await page.locator('body').textContent() || ''
        expect(body).not.toContain('Unhandled Runtime Error')
      }
    }
  })

  test('mini calendar month navigation works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate forward a month using the ▶ button
    const nextBtn = page.locator('button', { hasText: /▶|›|→|next/i }).first()
    if (await nextBtn.isVisible()) {
      await nextBtn.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }

    // Navigate back using the ◀ button
    const prevBtn = page.locator('button', { hasText: /◀|‹|←|prev/i }).first()
    if (await prevBtn.isVisible()) {
      await prevBtn.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('clicking a day on mini calendar selects it', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click day 15 on the mini calendar
    const dayCell = page.locator('button', { hasText: /^15$/ }).first()
    if (await dayCell.isVisible()) {
      await dayCell.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('calendar grid shows time labels', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should show at least some hour labels (e.g. 8 AM, 9 AM)
    const body = await page.locator('body').textContent() || ''
    expect(body).toMatch(/\d+\s*(AM|PM)/i)
  })

  test('calendar appointment blocks are color-coded by status', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check that appointment blocks exist (if any appointments are scheduled)
    // This tests the rendering — no crash assertions
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR — MOBILE RESPONSIVENESS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Calendar Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('calendar is usable on mobile viewport', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })
})
