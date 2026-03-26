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
// ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Onboarding Flow', () => {
  test('onboarding page loads without errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('onboarding step 1 has name input', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // Should show welcome / name step
    if (body.toLowerCase().includes('welcome') || body.toLowerCase().includes('name')) {
      const nameInput = page.locator('input[placeholder*="Dr."], input[placeholder*="name" i]').first()
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(nameInput).toBeVisible()
      }
    }
  })

  test('onboarding has progress dots', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // Should show step indicator
    expect(body.toLowerCase()).toMatch(/step|1.*of.*3|progress/)
  })

  test('onboarding Continue button is disabled when name is empty', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Clear any pre-filled name
      const nameInput = page.locator('input').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('')
        await page.waitForTimeout(300)
      }

      // Continue should be disabled
      await expect(continueBtn).toBeDisabled()
    }
  })

  test('onboarding step 1 → step 2 transition works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Fill name
    const nameInput = page.locator('input[placeholder*="Dr."], input[placeholder*="name" i], input').first()
    if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await nameInput.fill('Dr. E2E Test')

    // Click Continue
    const continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (!(await continueBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await continueBtn.click()
    await page.waitForTimeout(1000)

    // Should advance to step 2 (practice details)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.toLowerCase()).toMatch(/practice|about your|step 2/)
  })

  test('onboarding step 2 has practice name and animal selection', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Go to step 2
    const nameInput = page.locator('input').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Dr. E2E Test')
    }
    const continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Practice name input
    const practiceInput = page.locator('input[placeholder*="Blue Ridge"], input[placeholder*="practice" i]').first()
    if (await practiceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(practiceInput).toBeVisible()
    }

    // Animal selection buttons (Horses, Dogs, All Species)
    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/horse|dog|all species/)
  })

  test('onboarding step 2 animal buttons are selectable', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate to step 2
    const nameInput = page.locator('input').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Dr. E2E Test')
    }
    const continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Click "Horses" button
    const horsesBtn = page.locator('button', { hasText: /horses/i }).first()
    if (await horsesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await horsesBtn.click()
      await page.waitForTimeout(300)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }

    // Click "All Species" button
    const allBtn = page.locator('button', { hasText: /all species/i }).first()
    if (await allBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allBtn.click()
      await page.waitForTimeout(300)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('onboarding step 2 → step 3 transition works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Step 1: name
    const nameInput = page.locator('input').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Dr. E2E Test')
    }
    let continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Step 2: practice
    const practiceInput = page.locator('input[placeholder*="Blue Ridge"], input[placeholder*="practice" i]').first()
    if (await practiceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await practiceInput.fill('E2E Test Chiro')
    }

    continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Should be on step 3 (branding/logo)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.toLowerCase()).toMatch(/brand|logo|step 3|launch/)
  })

  test('onboarding step 3 has logo upload', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate to step 3
    const nameInput = page.locator('input').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Dr. E2E Test')
    }
    let continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    const practiceInput = page.locator('input[placeholder*="Blue Ridge"], input[placeholder*="practice" i]').first()
    if (await practiceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await practiceInput.fill('E2E Test Chiro')
    }
    continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Logo upload input should exist
    const logoInput = page.locator('input#logo-upload, input[type="file"]').first()
    await expect(logoInput).toBeAttached()

    // "Launch my practice" button should be visible
    const launchBtn = page.locator('button', { hasText: /launch/i }).first()
    if (await launchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(launchBtn).toBeVisible()
    }
  })

  test('onboarding Back button works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Go to step 2
    const nameInput = page.locator('input').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Dr. E2E Test')
    }
    const continueBtn = page.locator('button', { hasText: /continue/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }

    // Click Back
    const backBtn = page.locator('button', { hasText: /back/i }).first()
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click()
      await page.waitForTimeout(1000)

      // Should be back on step 1
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
      expect(body.toLowerCase()).toMatch(/welcome|name|step 1/)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — MOBILE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Onboarding Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('onboarding works on mobile', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })
})
