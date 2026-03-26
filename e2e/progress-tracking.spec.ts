import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// AUTH + NAVIGATION HELPERS
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

async function getFirstHorseId(page: Page): Promise<string | null> {
  await ensureAuth(page)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // Search for any horse
  const searchInput = page.locator('input[placeholder*="earch"]').first()
  if (await searchInput.isVisible()) {
    await searchInput.fill('a')
    await page.waitForTimeout(1500)
  }

  const horseLink = page.locator('a[href*="/horses/"]').first()
  if (await horseLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    const href = await horseLink.getAttribute('href')
    if (href) {
      const match = href.match(/\/horses\/([^/?]+)/)
      return match ? match[1] : null
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKING PAGE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Progress Tracking', () => {
  test('progress page loads without errors', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('progress page has Progress Tracker heading', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await expect(page.locator('text=/progress/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('progress page has heatmap/timeline/visits view toggles', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // Should show view toggle options
    expect(body.toLowerCase()).toMatch(/heatmap|timeline|visits/)
  })

  test('switching between heatmap/timeline/visits views does not crash', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const views = ['heatmap', 'timeline', 'visits']
    for (const view of views) {
      const btn = page.locator('button', { hasText: new RegExp(view, 'i') }).first()
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(1000)
        const body = await page.locator('body').textContent() || ''
        expect(body).not.toContain('Unhandled Runtime Error')
      }
    }
  })

  test('progress page has summary cards', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // Should show summary metrics
    expect(body.toLowerCase()).toMatch(/assessment|segment|flagged|improved|total/)
  })

  test('heatmap view shows spine sections', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Select heatmap view
    const heatmapBtn = page.locator('button', { hasText: /heatmap/i }).first()
    if (await heatmapBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await heatmapBtn.click()
      await page.waitForTimeout(1000)

      const body = await page.locator('body').textContent() || ''
      // Should show spine section labels
      expect(body.toLowerCase()).toMatch(/cranial|cervical|thoracic|lumbar|sacral|pelvic/)
    }
  })

  test('heatmap view has color legend', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const heatmapBtn = page.locator('button', { hasText: /heatmap/i }).first()
    if (await heatmapBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await heatmapBtn.click()
      await page.waitForTimeout(1000)

      const body = await page.locator('body').textContent() || ''
      // Should show legend terms
      expect(body.toLowerCase()).toMatch(/never|rare|occasional|frequent|persistent/)
    }
  })

  test('progress page has back button to patient profile', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const backLink = page.locator(`a[href*="/horses/${horseId}"]`).first()
    await expect(backLink).toBeVisible({ timeout: 5000 })
  })

  test('visits view shows visit cards with dates', async ({ page }) => {
    const horseId = await getFirstHorseId(page)
    if (!horseId) { test.skip(); return }

    await page.goto(`/horses/${horseId}/progress`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const visitsBtn = page.locator('button', { hasText: /visits/i }).first()
    if (await visitsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visitsBtn.click()
      await page.waitForTimeout(1000)

      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
      // Should either show visit data or "no visits" message
      expect(body.toLowerCase()).toMatch(/visit|no.*recorded|no.*visits/)
    }
  })

  test('invalid horse ID on progress page shows graceful error', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/horses/00000000-0000-0000-0000-000000000000/progress')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})
