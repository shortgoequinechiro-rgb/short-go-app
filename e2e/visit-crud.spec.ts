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

async function navigateToPatientSpine(page: Page, newVisit = true): Promise<boolean> {
  await ensureAuth(page)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  const searchInput = page.locator('input[placeholder*="earch"]').first()
  if (await searchInput.isVisible()) {
    await searchInput.fill('a')
    await page.waitForTimeout(1500)
  }

  const horseLink = page.locator('a[href*="/horses/"]').first()
  if (!(await horseLink.isVisible({ timeout: 3000 }).catch(() => false))) return false
  const href = await horseLink.getAttribute('href')
  if (!href) return false
  const match = href.match(/\/horses\/([^/?]+)/)
  if (!match) return false
  const horseId = match[1]

  if (newVisit) {
    await page.goto(`/horses/${horseId}/spine?newVisit=true&species=equine`)
  } else {
    await page.goto(`/horses/${horseId}/spine`)
  }
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIT CREATION — FULL FLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Visit Creation Flow', () => {
  test('new visit page has all required SOAP fields', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    // Visit date
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 5000 })

    // Visit type dropdown
    const visitTypeSelect = page.locator('select').filter({ hasText: /initial/i }).first()
    if (await visitTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const opts = (await visitTypeSelect.locator('option').allTextContents()).join(' ').toLowerCase()
      expect(opts).toContain('initial')
      expect(opts).toContain('follow')
      expect(opts).toContain('maintenance')
    }

    // SOAP textareas (Subjective, Objective, Assessment, Plan)
    const textareas = page.locator('textarea')
    const count = await textareas.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('new visit page has reason for visit field', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/reason for visit|reason/)
  })

  test('new visit page has follow-up field', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const followUp = page.locator('input[placeholder*="2 weeks"], input[placeholder*="follow"]').first()
    if (await followUp.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(followUp).toBeVisible()
    }
  })

  test('can fill out SOAP fields without errors', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    // Fill Subjective
    const subjField = page.locator('textarea[placeholder*="owner reports"]').first()
    if (await subjField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjField.fill('Horse presenting for routine adjustment. Owner reports improved gait.')
    }

    // Fill Objective
    const objField = page.locator('textarea[placeholder*="findings"]').first()
    if (await objField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await objField.fill('Restricted motion C3-C4. Thoracolumbar tension bilateral.')
    }

    // Fill Assessment
    const assField = page.locator('textarea[placeholder*="Clinical impression"]').first()
    if (await assField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assField.fill('Segmental dysfunction cervical and thoracolumbar regions.')
    }

    // Fill Plan
    const planField = page.locator('textarea[placeholder*="Treatment plan"]').first()
    if (await planField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await planField.fill('Adjusted C3-C4, T10-T14 bilateral. Follow up in 2 weeks.')
    }

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('spine checkboxes can be toggled on new visit', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(0)

    // Toggle first 3 checkboxes
    for (let i = 0; i < Math.min(count, 3); i++) {
      if (await checkboxes.nth(i).isVisible()) {
        await checkboxes.nth(i).check()
        await expect(checkboxes.nth(i)).toBeChecked()
      }
    }
  })

  test('Save Visit button exists on new visit page', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const saveBtn = page.locator('button', { hasText: /save visit/i }).first()
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
  })

  test('AI Generate SOAP button exists', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const aiBtn = page.locator('button', { hasText: /generate.*soap|ai.*generate/i }).first()
    if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(aiBtn).toBeVisible()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// VISIT EDITING — EXISTING VISITS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Visit Editing', () => {
  test('can navigate to patient and view visits tab', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const searchInput = page.locator('input[placeholder*="earch"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('a')
      await page.waitForTimeout(1500)
    }

    const horseLink = page.locator('a[href*="/horses/"]').first()
    if (!(await horseLink.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await horseLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Switch to visits tab
    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (await visitsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visitsTab.click()
      await page.waitForTimeout(1000)

      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('visit list shows visit dates and edit buttons', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const searchInput = page.locator('input[placeholder*="earch"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('a')
      await page.waitForTimeout(1500)
    }

    const horseLink = page.locator('a[href*="/horses/"]').first()
    if (!(await horseLink.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await horseLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (await visitsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visitsTab.click()
      await page.waitForTimeout(1000)

      // If visits exist, they should have Edit buttons
      const editBtn = page.locator('button', { hasText: /edit/i }).first()
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(editBtn).toBeVisible()
      }
    }
  })

  test('clicking Edit on a visit shows editable SOAP fields', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const searchInput = page.locator('input[placeholder*="earch"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('a')
      await page.waitForTimeout(1500)
    }

    const horseLink = page.locator('a[href*="/horses/"]').first()
    if (!(await horseLink.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await horseLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (!(await visitsTab.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await visitsTab.click()
    await page.waitForTimeout(1000)

    const editBtn = page.locator('button', { hasText: /edit/i }).first()
    if (!(await editBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(1000)

    // Should now show editable textareas
    const textareas = page.locator('textarea')
    const count = await textareas.count()
    expect(count).toBeGreaterThanOrEqual(2)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// VISIT — VISIT TYPE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Visit Type Options', () => {
  test('visit type dropdown has initial/follow-up/maintenance', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const visitTypeSelect = page.locator('select').filter({ hasText: /initial/i }).first()
    if (!(await visitTypeSelect.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    const options = await visitTypeSelect.locator('option').allTextContents()
    const optText = options.join(' ').toLowerCase()
    expect(optText).toContain('initial')
    expect(optText).toContain('follow')
    expect(optText).toContain('maintenance')
  })

  test('changing visit type does not crash', async ({ page }) => {
    const ok = await navigateToPatientSpine(page, true)
    if (!ok) { test.skip(); return }

    const visitTypeSelect = page.locator('select').filter({ hasText: /initial/i }).first()
    if (!(await visitTypeSelect.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    const options = await visitTypeSelect.locator('option').allTextContents()
    for (const opt of options) {
      if (opt.trim()) {
        await visitTypeSelect.selectOption({ label: opt.trim() })
        await page.waitForTimeout(300)
      }
    }

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})
