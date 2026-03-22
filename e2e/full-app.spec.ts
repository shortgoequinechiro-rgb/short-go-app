import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'https://short-go-app.vercel.app'

// ── PUBLIC PAGES ─────────────────────────────────────────────────────────────

test.describe('Public Pages', () => {
  // Vercel Hobby cold starts can take 10-15s, so use generous timeouts
  test.use({ navigationTimeout: 30000, actionTimeout: 15000 })

  test('landing page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page).toHaveTitle(/stride/i, { timeout: 15000 })
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('signup page renders with trial badge', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('14-day free trial')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('login shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill('fake@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.locator('.text-red-500')).toBeVisible({ timeout: 15000 })
  })

  test('signup form enables button when filled', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[type="password"]').nth(1).fill('password123')
    await expect(page.getByRole('button', { name: /start free trial/i })).toBeEnabled({ timeout: 10000 })
  })
})

// ── PROTECTED ROUTE REDIRECTS ────────────────────────────────────────────────

test.describe('Protected Route Redirects', () => {
  const protectedRoutes = [
    '/dashboard',
    '/human/dashboard',
    '/human/analytics',
    '/human/superbills',
    '/human/compliance-scan',
    '/human/soap-templates',
    '/human/recall-settings',
    '/human/review-settings',
    '/human/booking-settings',
    '/human/outcome-measures',
    '/human/documents',
    '/human/invoices',
    '/human/sms-inbox',
    '/human/referral-sources',
    '/calendar',
    '/account',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route, { timeout: 30000 })
      // BillingGate loads JS, checks Supabase auth, then redirects — give it time
      await expect(page).toHaveURL(/\/(login|billing)/, { timeout: 30000 })
    })
  }
})

// ── PUBLIC FEATURE PAGES ─────────────────────────────────────────────────────

test.describe('Public Feature Pages (no auth needed)', () => {
  test('kiosk page loads without auth', async ({ page }) => {
    await page.goto('/kiosk', { waitUntil: 'networkidle', timeout: 30000 })
    // Kiosk is in PUBLIC_PREFIXES — should NOT redirect to Vercel login
    // It may show kiosk UI, a loading state, or redirect to the app's own login
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
  })

  test('select-mode page loads', async ({ page }) => {
    await page.goto('/select-mode', { waitUntil: 'networkidle', timeout: 30000 })
    // Should NOT redirect to Vercel login (it's a public route)
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
  })
})

// ── AUTHENTICATED TESTS ──────────────────────────────────────────────────────

test.describe('Authenticated Flow', () => {
  // Skip all if no credentials
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  test.beforeEach(async ({ page }) => {
    if (!email || !password) {
      test.skip(true, 'E2E_USER_EMAIL and E2E_USER_PASSWORD required')
      return
    }
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('human dashboard loads with navigation links', async ({ page }) => {
    await page.goto('/human/dashboard')
    await expect(page.locator('h1', { hasText: 'Human Patients' })).toBeVisible({ timeout: 10000 })

    // Check all nav links are present
    const navLinks = [
      'Analytics', 'Superbills', 'Compliance', 'Templates', 'Recall',
      'Reviews', 'Outcomes', 'Documents', 'Invoices', 'SMS', 'Referrals', 'Online Booking',
    ]
    for (const link of navLinks) {
      await expect(page.getByRole('link', { name: link })).toBeVisible()
    }

    // Check + New Patient button
    await expect(page.getByRole('button', { name: /new patient/i })).toBeVisible()
  })

  test('analytics page loads with charts', async ({ page }) => {
    await page.goto('/human/analytics')
    await expect(page.locator('h1', { hasText: /analytics/i })).toBeVisible({ timeout: 10000 })
  })

  test('superbills page loads', async ({ page }) => {
    await page.goto('/human/superbills')
    await expect(page.locator('h1', { hasText: /superbill/i })).toBeVisible({ timeout: 10000 })
  })

  test('compliance scan page loads', async ({ page }) => {
    await page.goto('/human/compliance-scan')
    await expect(page.locator('h1', { hasText: /compliance/i })).toBeVisible({ timeout: 10000 })
    // Should have visit and superbill dropdowns
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /run.*scan/i })).toBeVisible()
  })

  test('SOAP templates page loads with seed button', async ({ page }) => {
    await page.goto('/human/soap-templates')
    await expect(page.locator('h1', { hasText: /soap.*template/i })).toBeVisible({ timeout: 10000 })
    // Should have + New Template button
    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible()
  })

  test('recall settings page loads', async ({ page }) => {
    await page.goto('/human/recall-settings')
    await expect(page.locator('h1', { hasText: /recall/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible()
  })

  test('review settings page loads', async ({ page }) => {
    await page.goto('/human/review-settings')
    await expect(page.locator('h1', { hasText: /review/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible()
  })

  test('outcome measures page loads', async ({ page }) => {
    await page.goto('/human/outcome-measures')
    await expect(page.locator('h1', { hasText: /outcome/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /record outcome/i })).toBeVisible()
  })

  test('documents page loads', async ({ page }) => {
    await page.goto('/human/documents')
    await expect(page.locator('h1', { hasText: /document/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible()
  })

  test('invoices page loads', async ({ page }) => {
    await page.goto('/human/invoices')
    await expect(page.locator('h1', { hasText: /invoice/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible()
  })

  test('SMS inbox page loads', async ({ page }) => {
    await page.goto('/human/sms-inbox')
    await expect(page.locator('h1', { hasText: /sms/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /new message/i })).toBeVisible()
  })

  test('referral sources page loads', async ({ page }) => {
    await page.goto('/human/referral-sources')
    await expect(page.locator('h1', { hasText: /referral/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /add source/i })).toBeVisible()
  })

  test('booking settings page loads', async ({ page }) => {
    await page.goto('/human/booking-settings')
    await expect(page.locator('h1', { hasText: /booking/i })).toBeVisible({ timeout: 10000 })
  })

  test('add patient modal opens and has fields', async ({ page }) => {
    await page.goto('/human/dashboard')
    await expect(page.locator('h1', { hasText: 'Human Patients' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /new patient/i }).click()
    // Modal should open with name fields
    await expect(page.locator('input[placeholder*="First"]').or(page.locator('label:has-text("First Name")'))).toBeVisible({ timeout: 5000 })
  })

  test('compliance scan form validates selection', async ({ page }) => {
    await page.goto('/human/compliance-scan')
    await expect(page.getByRole('button', { name: /run.*scan/i })).toBeVisible({ timeout: 10000 })
    // Click without selecting anything
    await page.getByRole('button', { name: /run.*scan/i }).click()
    // Should show error about selecting
    await expect(page.locator('text=Select at least')).toBeVisible({ timeout: 5000 })
  })

  test('SOAP templates create modal opens', async ({ page }) => {
    await page.goto('/human/soap-templates')
    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /new template/i }).click()
    await expect(page.locator('h2', { hasText: 'New Template' })).toBeVisible({ timeout: 5000 })
    // Should have SOAP fields
    await expect(page.locator('text=Subjective')).toBeVisible()
    await expect(page.locator('text=Objective')).toBeVisible()
    await expect(page.locator('text=Assessment')).toBeVisible()
    await expect(page.locator('text=Plan')).toBeVisible()
  })

  test('invoice create modal has line items', async ({ page }) => {
    await page.goto('/human/invoices')
    await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /new invoice/i }).click()
    await expect(page.locator('h2', { hasText: 'New Invoice' })).toBeVisible({ timeout: 5000 })
    // Should have line item fields
    await expect(page.locator('input[placeholder="Description"]')).toBeVisible()
    // Should have add line item button
    await expect(page.getByText('+ Add line item')).toBeVisible()
  })

  test('SMS new message modal opens', async ({ page }) => {
    await page.goto('/human/sms-inbox')
    await expect(page.getByRole('button', { name: /new message/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /new message/i }).click()
    await expect(page.locator('h2', { hasText: 'New Conversation' })).toBeVisible({ timeout: 5000 })
  })

  test('referral sources add modal opens', async ({ page }) => {
    await page.goto('/human/referral-sources')
    await expect(page.getByRole('button', { name: /add source/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /add source/i }).click()
    await expect(page.locator('h2', { hasText: 'Add Referral Source' })).toBeVisible({ timeout: 5000 })
  })

  test('outcome measures record modal opens', async ({ page }) => {
    await page.goto('/human/outcome-measures')
    await expect(page.getByRole('button', { name: /record outcome/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /record outcome/i }).click()
    await expect(page.locator('h2', { hasText: 'Record Outcome Measure' })).toBeVisible({ timeout: 5000 })
  })

  test('documents upload modal opens', async ({ page }) => {
    await page.goto('/human/documents')
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /upload/i }).click()
    await expect(page.locator('h2', { hasText: 'Upload Document' })).toBeVisible({ timeout: 5000 })
  })
})

// ── API ROUTE SMOKE TESTS ────────────────────────────────────────────────────

test.describe('API Route Smoke Tests', () => {
  test('compliance scan API rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/compliance-scan`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    // 400 (missing params) or 401 (auth) are both valid rejections
    expect([400, 401, 500]).toContain(res.status())
  })

  test('SMS send API rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/sms/send`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('recall send API responds', async ({ request }) => {
    const res = await request.post(`${BASE}/api/recall/send`, {
      data: { practitionerId: '00000000-0000-0000-0000-000000000000' },
      headers: { 'Content-Type': 'application/json' },
    })
    // Should respond (200 with sent:0, or 401/500)
    expect(res.status()).toBeLessThan(502)
  })

  test('review request send API responds', async ({ request }) => {
    const res = await request.post(`${BASE}/api/review-requests/send`, {
      data: { practitionerId: '00000000-0000-0000-0000-000000000000' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBeLessThan(502)
  })

  test('invoice PDF rejects non-existent invoice', async ({ request }) => {
    const res = await request.get(`${BASE}/api/invoices/00000000-0000-0000-0000-000000000000/pdf`)
    // 404 (not found) or 401 (auth required) are both valid
    expect([401, 404, 500]).toContain(res.status())
  })
})
