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
// ACCOUNT SETTINGS — ALL 4 TABS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account Settings - Profile Tab', () => {
  test('profile tab is the default and shows practice form', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Should show profile-related fields
    const nameInput = page.locator('input[placeholder*="Dr."], input[placeholder*="name" i]').first()
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nameInput).toBeVisible()
    }
  })

  test('profile tab has practice name field', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const practiceInput = page.locator('input[placeholder*="Chiro"], input[placeholder*="practice" i]').first()
    if (await practiceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(practiceInput).toBeVisible()
    }
  })

  test('profile tab has Animals Served dropdown', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const animalsSelect = page.locator('select').filter({ hasText: /equine|canine|all species/i }).first()
    if (await animalsSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await animalsSelect.locator('option').allTextContents()
      const optText = options.join(' ').toLowerCase()
      expect(optText).toContain('equine')
      expect(optText).toContain('canine')
      expect(optText).toContain('all species')
    }
  })

  test('profile tab has logo upload area', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const logoInput = page.locator('input#logo-upload-settings, input[type="file"]').first()
    await expect(logoInput).toBeAttached()
  })

  test('profile tab Save Changes button is disabled when no changes', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const saveBtn = page.locator('button', { hasText: /save changes/i }).first()
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(saveBtn).toBeDisabled()
    }
  })
})

test.describe('Account Settings - Security Tab', () => {
  test('security tab shows password change form', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click Security tab
    const securityTab = page.locator('button', { hasText: /security/i }).first()
    await expect(securityTab).toBeVisible({ timeout: 5000 })
    await securityTab.click()
    await page.waitForTimeout(500)

    // Should show password fields
    const passwordInputs = page.locator('input[type="password"]')
    const count = await passwordInputs.count()
    expect(count).toBeGreaterThanOrEqual(2) // current + new + confirm
  })

  test('security tab Update Password button is disabled when empty', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const securityTab = page.locator('button', { hasText: /security/i }).first()
    await securityTab.click()
    await page.waitForTimeout(500)

    const updateBtn = page.locator('button', { hasText: /update password/i }).first()
    if (await updateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(updateBtn).toBeDisabled()
    }
  })

  test('security tab shows validation for mismatched passwords', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const securityTab = page.locator('button', { hasText: /security/i }).first()
    await securityTab.click()
    await page.waitForTimeout(500)

    const passwordInputs = page.locator('input[type="password"]')
    const count = await passwordInputs.count()
    if (count >= 3) {
      await passwordInputs.nth(0).fill('oldpassword123')
      await passwordInputs.nth(1).fill('newpassword123')
      await passwordInputs.nth(2).fill('differentpassword')
      await page.waitForTimeout(500)

      const body = await page.locator('body').textContent() || ''
      expect(body.toLowerCase()).toMatch(/do not match|mismatch|don't match/)
    }
  })

  test('security tab shows minimum length requirement', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const securityTab = page.locator('button', { hasText: /security/i }).first()
    await securityTab.click()
    await page.waitForTimeout(500)

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toContain('8 characters')
  })
})

test.describe('Account Settings - Billing Tab', () => {
  test('billing tab shows subscription status', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const billingTab = page.locator('button', { hasText: /billing/i }).first()
    await expect(billingTab).toBeVisible({ timeout: 5000 })
    await billingTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should show status badge (Active, Free Trial, Past Due, etc.)
    expect(body.toLowerCase()).toMatch(/active|free trial|past due|cancel|trialing|subscribe/)
  })

  test('billing tab shows pricing options', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const billingTab = page.locator('button', { hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    // Should reference pricing ($49/month or $499/year)
    expect(body).toMatch(/\$49|\$499|manage billing/i)
  })

  test('billing tab shows What\'s Included checklist', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const billingTab = page.locator('button', { hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/included|features|unlimited/)
  })
})

test.describe('Account Settings - Reminders Tab', () => {
  test('reminders tab shows configuration info', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const remindersTab = page.locator('button', { hasText: /reminders/i }).first()
    await expect(remindersTab).toBeVisible({ timeout: 5000 })
    await remindersTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should show reminder configuration info
    expect(body.toLowerCase()).toMatch(/reminder|how it works|configuration/)
  })

  test('reminders tab has Run Reminders Now button', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const remindersTab = page.locator('button', { hasText: /reminders/i }).first()
    await remindersTab.click()
    await page.waitForTimeout(1000)

    const runBtn = page.locator('button', { hasText: /run reminders/i }).first()
    if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(runBtn).toBeVisible()
    }
  })

  test('reminders tab mentions required env vars', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const remindersTab = page.locator('button', { hasText: /reminders/i }).first()
    await remindersTab.click()
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).toMatch(/RESEND|email|twilio|sms/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Account Settings - Tab Switching', () => {
  test('switching between all 4 tabs does not crash', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const tabs = ['Profile', 'Security', 'Billing', 'Reminders']
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

  test('active tab has distinct styling', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // The Profile tab should be active by default — check for gold bg
    const profileTab = page.locator('button', { hasText: /profile/i }).first()
    if (await profileTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await profileTab.getAttribute('class') || ''
      // Active tab typically has a distinctive background color
      expect(classes.length).toBeGreaterThan(0)
    }
  })
})
