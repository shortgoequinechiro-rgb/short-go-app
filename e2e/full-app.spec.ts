import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'https://short-go-app.vercel.app'

// ─────────────────────────────────────────────────────────────────────────────
// 1. LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('loads with correct title and hero', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page).toHaveTitle(/stride/i, { timeout: 15000 })
    await expect(page.getByText('Your practice.')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Simplified.')).toBeVisible()
  })

  test('has navigation links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.getByRole('link', { name: /features/i }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /pricing/i }).first()).toBeVisible()
  })

  test('has CTA buttons linking to signup/login', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    const cta = page.getByRole('link', { name: /start free trial/i }).first()
    await expect(cta).toBeVisible({ timeout: 10000 })
  })

  test('displays pricing section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.getByText('$59')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('14-day free trial')).toBeVisible()
  })

  test('displays feature cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    for (const feature of ['Patient Records', 'AI SOAP Notes', 'Scheduling', 'Digital Forms']) {
      await expect(page.getByText(feature).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('has footer with login and contact links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: /login/i })).toBeVisible({ timeout: 10000 })
    await expect(footer.getByRole('link', { name: /contact/i })).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login Page', () => {
  test('renders form with all required elements', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Chiropractic Practice Management')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('sign in button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled({ timeout: 10000 })
  })

  test('sign in button enables when fields are filled', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill('test@example.com', { timeout: 10000 })
    await page.locator('input[type="password"]').fill('password123')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill('fake@example.com', { timeout: 10000 })
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.locator('.text-red-500')).toBeVisible({ timeout: 15000 })
  })

  test('has link to signup page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    const signupLink = page.getByRole('link', { name: /free trial/i })
    await expect(signupLink).toBeVisible({ timeout: 10000 })
    await expect(signupLink).toHaveAttribute('href', '/signup')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. SIGNUP PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Signup Page', () => {
  test('renders form with trial badge', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('14-day free trial')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').nth(1)).toBeVisible()
  })

  test('enables button when all fields are filled', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill('newuser@example.com', { timeout: 10000 })
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[type="password"]').nth(1).fill('password123')
    await expect(page.getByRole('button', { name: /start free trial/i })).toBeEnabled({ timeout: 10000 })
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    const loginLink = page.getByRole('link', { name: /sign in/i })
    await expect(loginLink).toBeVisible({ timeout: 10000 })
    await expect(loginLink).toHaveAttribute('href', '/login')
  })

  test('shows pricing footer text', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await expect(page.getByText('$59/month')).toBeVisible({ timeout: 10000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONTACT PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Contact Page', () => {
  test('loads without redirect', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle', timeout: 30000 })
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
    // Should be on contact or contain contact-related content
    expect(url).toContain('/contact')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. PROTECTED ROUTE REDIRECTS (unauthenticated → /login)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Protected Route Redirects', () => {
  const protectedRoutes = [
    // Equine routes
    '/dashboard',
    '/calendar',
    '/account',
    // Human practice routes
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
    '/human/calendar',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route, { timeout: 30000 })
      await expect(page).toHaveURL(/\/(login|billing)/, { timeout: 30000 })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUBLIC FEATURE PAGES (no auth required per BillingGate PUBLIC_PREFIXES)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Public Feature Pages', () => {
  test('kiosk page loads without auth', async ({ page }) => {
    await page.goto('/kiosk', { waitUntil: 'networkidle', timeout: 30000 })
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
    // Kiosk is in PUBLIC_PREFIXES — should not redirect to Vercel login
    // May show kiosk UI or a loading/error state
  })

  test('select-mode page loads without auth', async ({ page }) => {
    await page.goto('/select-mode', { waitUntil: 'networkidle', timeout: 30000 })
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
  })

  test('onboarding page loads without auth', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'networkidle', timeout: 30000 })
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
  })

  test('billing page loads without auth', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'networkidle', timeout: 30000 })
    const url = page.url()
    expect(url).not.toContain('vercel.com/login')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. AUTHENTICATED FLOW — Dashboard & Navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Authenticated Flow', () => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  test.beforeEach(async ({ page }) => {
    if (!email || !password) {
      test.skip(true, 'E2E_USER_EMAIL and E2E_USER_PASSWORD required')
      return
    }
    await page.goto('/login', { timeout: 30000 })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  })

  // ── Dashboard ──
  test('human dashboard loads with navigation links', async ({ page }) => {
    await page.goto('/human/dashboard', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: 'Human Patients' })).toBeVisible({ timeout: 10000 })

    const navLinks = [
      'Analytics', 'Superbills', 'Compliance', 'Templates', 'Recall',
      'Reviews', 'Outcomes', 'Documents', 'Invoices', 'SMS', 'Referrals', 'Online Booking',
    ]
    for (const link of navLinks) {
      await expect(page.getByRole('link', { name: link })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /new patient/i })).toBeVisible()
  })

  // ── Feature Page Loads ──
  test('analytics page loads', async ({ page }) => {
    await page.goto('/human/analytics', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /analytics/i })).toBeVisible({ timeout: 10000 })
  })

  test('superbills page loads', async ({ page }) => {
    await page.goto('/human/superbills', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /superbill/i })).toBeVisible({ timeout: 10000 })
  })

  test('compliance scan page loads with controls', async ({ page }) => {
    await page.goto('/human/compliance-scan', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /compliance/i })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /run.*scan/i })).toBeVisible()
  })

  test('SOAP templates page loads', async ({ page }) => {
    await page.goto('/human/soap-templates', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /soap.*template/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible()
  })

  test('recall settings page loads', async ({ page }) => {
    await page.goto('/human/recall-settings', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /recall/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible()
  })

  test('review settings page loads', async ({ page }) => {
    await page.goto('/human/review-settings', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /review/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /save settings/i })).toBeVisible()
  })

  test('outcome measures page loads', async ({ page }) => {
    await page.goto('/human/outcome-measures', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /outcome/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /record outcome/i })).toBeVisible()
  })

  test('documents page loads', async ({ page }) => {
    await page.goto('/human/documents', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /document/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible()
  })

  test('invoices page loads', async ({ page }) => {
    await page.goto('/human/invoices', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /invoice/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible()
  })

  test('SMS inbox page loads', async ({ page }) => {
    await page.goto('/human/sms-inbox', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /sms/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /new message/i })).toBeVisible()
  })

  test('referral sources page loads', async ({ page }) => {
    await page.goto('/human/referral-sources', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /referral/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /add source/i })).toBeVisible()
  })

  test('booking settings page loads', async ({ page }) => {
    await page.goto('/human/booking-settings', { timeout: 30000 })
    await expect(page.locator('h1', { hasText: /booking/i })).toBeVisible({ timeout: 10000 })
  })

  // ── Modal Interactions ──
  test('add patient modal opens with name fields', async ({ page }) => {
    await page.goto('/human/dashboard', { timeout: 30000 })
    await expect(page.getByRole('button', { name: /new patient/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /new patient/i }).click()
    await expect(
      page.locator('input[placeholder*="First"]').or(page.locator('label:has-text("First Name")'))
    ).toBeVisible({ timeout: 5000 })
  })

  test('compliance scan validates selection before running', async ({ page }) => {
    await page.goto('/human/compliance-scan', { timeout: 30000 })
    await expect(page.getByRole('button', { name: /run.*scan/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /run.*scan/i }).click()
    await expect(page.locator('text=Select at least')).toBeVisible({ timeout: 5000 })
  })

  test('SOAP templates create modal has SOAP fields', async ({ page }) => {
    await page.goto('/human/soap-templates', { timeout: 30000 })
    await page.getByRole('button', { name: /new template/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'New Template' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Subjective')).toBeVisible()
    await expect(page.locator('text=Objective')).toBeVisible()
    await expect(page.locator('text=Assessment')).toBeVisible()
    await expect(page.locator('text=Plan')).toBeVisible()
  })

  test('invoice create modal has line items', async ({ page }) => {
    await page.goto('/human/invoices', { timeout: 30000 })
    await page.getByRole('button', { name: /new invoice/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'New Invoice' })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[placeholder="Description"]')).toBeVisible()
    await expect(page.getByText('+ Add line item')).toBeVisible()
  })

  test('SMS new conversation modal opens', async ({ page }) => {
    await page.goto('/human/sms-inbox', { timeout: 30000 })
    await page.getByRole('button', { name: /new message/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'New Conversation' })).toBeVisible({ timeout: 5000 })
  })

  test('referral source add modal opens', async ({ page }) => {
    await page.goto('/human/referral-sources', { timeout: 30000 })
    await page.getByRole('button', { name: /add source/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'Add Referral Source' })).toBeVisible({ timeout: 5000 })
  })

  test('outcome measures record modal opens', async ({ page }) => {
    await page.goto('/human/outcome-measures', { timeout: 30000 })
    await page.getByRole('button', { name: /record outcome/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'Record Outcome Measure' })).toBeVisible({ timeout: 5000 })
  })

  test('documents upload modal opens', async ({ page }) => {
    await page.goto('/human/documents', { timeout: 30000 })
    await page.getByRole('button', { name: /upload/i }).click({ timeout: 10000 })
    await expect(page.locator('h2', { hasText: 'Upload Document' })).toBeVisible({ timeout: 5000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. API ROUTE SMOKE TESTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API Route Smoke Tests', () => {
  test('compliance scan rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/compliance-scan`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('SMS send rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/sms/send`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('recall send responds to fake practitioner', async ({ request }) => {
    const res = await request.post(`${BASE}/api/recall/send`, {
      data: { practitionerId: '00000000-0000-0000-0000-000000000000' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBeLessThan(502)
  })

  test('review request send responds to fake practitioner', async ({ request }) => {
    const res = await request.post(`${BASE}/api/review-requests/send`, {
      data: { practitionerId: '00000000-0000-0000-0000-000000000000' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBeLessThan(502)
  })

  test('invoice PDF rejects non-existent ID', async ({ request }) => {
    const res = await request.get(`${BASE}/api/invoices/00000000-0000-0000-0000-000000000000/pdf`)
    expect([401, 404, 500]).toContain(res.status())
  })

  test('generate SOAP rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/generate-soap`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('generate human SOAP rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/generate-soap-human`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('booking availability responds', async ({ request }) => {
    const res = await request.get(`${BASE}/api/booking/availability?practitionerId=00000000-0000-0000-0000-000000000000&date=2026-01-01`)
    expect(res.status()).toBeLessThan(502)
  })

  test('contact API rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/contact`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('reminders send endpoint responds', async ({ request }) => {
    const res = await request.post(`${BASE}/api/reminders/send`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBeLessThan(502)
  })

  test('reminders send-human endpoint responds', async ({ request }) => {
    const res = await request.post(`${BASE}/api/reminders/send-human`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBeLessThan(502)
  })

  test('onboarding complete rejects unauthenticated', async ({ request }) => {
    const res = await request.post(`${BASE}/api/onboarding/complete`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('superbill PDF rejects non-existent ID', async ({ request }) => {
    const res = await request.get(`${BASE}/api/superbills/00000000-0000-0000-0000-000000000000/pdf`)
    expect([401, 404, 500]).toContain(res.status())
  })

  test('portal access rejects empty request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/access`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect([400, 401, 500]).toContain(res.status())
  })

  test('SMS webhook endpoint exists', async ({ request }) => {
    const res = await request.post(`${BASE}/api/sms/webhook`, {
      data: 'From=%2B15551234567&Body=test',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    // Twilio webhooks should be accepted (200) or handled (various codes)
    expect(res.status()).toBeLessThan(502)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. CROSS-PAGE NAVIGATION (smoke test link connectivity)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cross-Page Navigation', () => {
  test('login page links to signup', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.getByRole('link', { name: /free trial/i }).click({ timeout: 10000 })
    await expect(page).toHaveURL(/\/signup/, { timeout: 15000 })
  })

  test('signup page links to login', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'networkidle', timeout: 30000 })
    await page.getByRole('link', { name: /sign in/i }).click({ timeout: 10000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('landing page footer login link works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    const footer = page.locator('footer')
    await footer.getByRole('link', { name: /login/i }).click({ timeout: 10000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})
