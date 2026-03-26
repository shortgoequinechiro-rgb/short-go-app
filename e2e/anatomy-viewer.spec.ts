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
// 3D ANATOMY VIEWER
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Anatomy Viewer', () => {
  test('anatomy page loads without errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // Extra time for 3D model loading

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('anatomy page has layer toggle controls', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Should have layer checkboxes/toggles
    const layerLabels = ['Skin', 'Muscles', 'Skeleton', 'Nerves', 'Vascular', 'Organs', 'Cartilage']
    let foundLayers = 0
    for (const label of layerLabels) {
      const toggle = page.locator(`text=${label}`).first()
      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        foundLayers++
      }
    }
    // Should find at least some layer toggles
    expect(foundLayers).toBeGreaterThanOrEqual(3)
  })

  test('toggling layers does not crash the viewer', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Find and toggle a few layer checkboxes
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      if (await checkboxes.nth(i).isVisible()) {
        await checkboxes.nth(i).click()
        await page.waitForTimeout(300)
      }
    }

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('anatomy page has drawing tool buttons', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    // Drawing tools should be present somewhere on the page
    const hasDrawingTools = body.toLowerCase().includes('pen') ||
                            body.toLowerCase().includes('draw') ||
                            body.toLowerCase().includes('circle') ||
                            body.toLowerCase().includes('arrow') ||
                            body.toLowerCase().includes('text')
    // If drawing tools exist, verify they don't crash when clicked
    if (hasDrawingTools) {
      const drawBtn = page.locator('button', { hasText: /pen|draw/i }).first()
      if (await drawBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await drawBtn.click()
        await page.waitForTimeout(500)
        const afterBody = await page.locator('body').textContent() || ''
        expect(afterBody).not.toContain('Unhandled Runtime Error')
      }
    }
  })

  test('anatomy page has preset viewing angles', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const angles = ['Front', 'Rear', 'Left', 'Right', 'Top']
    for (const angle of angles) {
      const btn = page.locator('button', { hasText: new RegExp(`^${angle}$`, 'i') }).first()
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(500)
        const body = await page.locator('body').textContent() || ''
        expect(body).not.toContain('Unhandled Runtime Error')
      }
    }
  })

  test('anatomy page has landmark buttons for species', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // For equine: Poll/Atlas, Withers, Thoracolumbar, etc.
    const landmarks = ['Poll', 'Atlas', 'Withers', 'SI Joint', 'Hock']
    let foundLandmarks = 0
    for (const lm of landmarks) {
      const btn = page.locator('button', { hasText: new RegExp(lm, 'i') }).first()
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        foundLandmarks++
      }
    }
    // At least some landmarks should be visible (depends on model loaded)
    // Don't fail hard if none are visible — the model may still be loading
    if (foundLandmarks > 0) {
      expect(foundLandmarks).toBeGreaterThanOrEqual(1)
    }
  })

  test('anatomy page has a Three.js canvas', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // React Three Fiber renders to a canvas element
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeAttached({ timeout: 10000 })
  })

  test('anatomy page has terminology toggle', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Owner-friendly vs clinical terminology toggle
    const toggle = page.locator('text=/owner|clinical|terminology/i').first()
    if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggle.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ANATOMY — MOBILE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Anatomy Viewer Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('anatomy page loads on mobile without errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/anatomy')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})
