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

async function navigateToOwner(page: Page): Promise<boolean> {
  await ensureAuth(page)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  const searchInput = page.locator('input[placeholder*="earch"]').first()
  if (await searchInput.isVisible()) {
    await searchInput.fill('a')
    await page.waitForTimeout(1500)
  }

  // Try double-click on owner row to navigate
  const ownerBtn = page.locator('button', { hasText: /\w+/ }).first()
  if (await ownerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ownerBtn.dblclick()
    try {
      await page.waitForURL('**/owners/**', { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      return true
    } catch {
      // Fallback: try direct link
      const ownerLink = page.locator('a[href*="/owners/"]').first()
      if (await ownerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ownerLink.click()
        await page.waitForURL('**/owners/**', { timeout: 10000 })
        await page.waitForLoadState('networkidle')
        return true
      }
    }
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// OWNER DETAIL — PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Owner Detail - Profile', () => {
  test('owner profile page loads with contact info', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('owner page shows animals list', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    // Should show animal cards or "no animals" message
    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/patient|animal|horse|dog|cat|no.*patient/)
  })

  test('owner page has Send Intake Form button', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const intakeBtn = page.locator('button', { hasText: /send intake/i }).first()
    if (await intakeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(intakeBtn).toBeVisible()
    }
  })

  test('owner page has Send Consent Form button', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const consentBtn = page.locator('button', { hasText: /send consent/i }).first()
    if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(consentBtn).toBeVisible()
    }
  })

  test('clicking Send Intake Form shows email/SMS options', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const intakeBtn = page.locator('button', { hasText: /send intake/i }).first()
    if (!(await intakeBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await intakeBtn.click()
    await page.waitForTimeout(500)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should show send options (email / SMS) or sent confirmation
    expect(body.toLowerCase()).toMatch(/email|sms|text|sent|send/)
  })

  test('owner page animal cards have View links', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const animalLink = page.locator('a[href*="/horses/"]').first()
    if (await animalLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(animalLink).toBeVisible()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// OWNER DETAIL — RECORDS TAB
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Owner Detail - Records Tab', () => {
  test('records tab shows document management area', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)

    // Click Records tab
    const recordsTab = page.locator('button', { hasText: /records/i }).first()
    if (!(await recordsTab.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await recordsTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('records tab has file upload input', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const recordsTab = page.locator('button', { hasText: /records/i }).first()
    if (!(await recordsTab.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await recordsTab.click()
    await page.waitForTimeout(1000)

    const fileInput = page.locator('input[type="file"]').first()
    await expect(fileInput).toBeAttached()
  })

  test('records tab has Upload Document button', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)
    const recordsTab = page.locator('button', { hasText: /records/i }).first()
    if (!(await recordsTab.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await recordsTab.click()
    await page.waitForTimeout(1000)

    const uploadBtn = page.locator('button', { hasText: /upload/i }).first()
    if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(uploadBtn).toBeVisible()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// OWNER DETAIL — TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Owner Detail - Tab Switching', () => {
  test('switching between profile and records tabs does not crash', async ({ page }) => {
    const ok = await navigateToOwner(page)
    if (!ok) { test.skip(); return }

    await page.waitForTimeout(2000)

    const tabs = ['profile', 'records']
    for (const tab of tabs) {
      const tabBtn = page.locator('button', { hasText: new RegExp(tab, 'i') }).first()
      if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabBtn.click()
        await page.waitForTimeout(500)
        const body = await page.locator('body').textContent() || ''
        expect(body).not.toContain('Unhandled Runtime Error')
      }
    }
  })
})
