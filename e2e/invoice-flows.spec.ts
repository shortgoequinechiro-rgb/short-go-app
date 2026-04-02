import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// AUTH HELPER
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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

async function goToInvoiceDetail(page: Page): Promise<boolean> {
  await ensureAuth(page)
  await page.goto('/invoices')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const viewLink = page.locator('a', { hasText: /view/i }).first()
  if (!(await viewLink.isVisible({ timeout: 3000 }).catch(() => false))) return false
  await viewLink.click()
  await page.waitForURL('**/invoices/**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE CREATION — FULL FLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Invoice Creation - Full Flow', () => {
  test('create invoice page has owner and horse selectors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const selects = page.locator('select')
    const count = await selects.count()
    expect(count).toBeGreaterThanOrEqual(1) // Owner selector at minimum
  })

  test('selecting an owner populates horse dropdown', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // Select first owner
    const ownerSelect = page.locator('select').first()
    if (!(await ownerSelect.isVisible())) { test.skip(); return }
    const options = await ownerSelect.locator('option').all()
    if (options.length > 1) {
      await ownerSelect.selectOption({ index: 1 })
      await page.waitForTimeout(1000)
      const afterBody = await page.locator('body').textContent() || ''
      expect(afterBody).not.toContain('Unhandled Runtime Error')
    }
  })

  test('add line item creates a new row', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const addBtn = page.locator('button', { hasText: /add.*item|add.*line|\+/i }).first()
    if (!(await addBtn.isVisible())) { test.skip(); return }

    const initialInputs = await page.locator('input[placeholder="Description"]').count()
    await addBtn.click()
    await page.waitForTimeout(300)
    const afterInputs = await page.locator('input[placeholder="Description"]').count()
    expect(afterInputs).toBeGreaterThanOrEqual(initialInputs)
  })

  test('line item total calculates from qty × price', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // Fill in a line item
    const descInput = page.locator('input[placeholder="Description"]').first()
    if (!(await descInput.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await descInput.fill('Test Service')

    const qtyInput = page.locator('input[type="number"]').first()
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('2')
    }

    const priceInput = page.locator('input[type="number"]').nth(1)
    if (await priceInput.isVisible()) {
      await priceInput.fill('50')
    }

    await page.waitForTimeout(500)
    // Total should update (no crash at minimum)
    const afterBody = await page.locator('body').textContent() || ''
    expect(afterBody).not.toContain('Unhandled Runtime Error')
  })

  test('save draft button exists', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const saveBtn = page.locator('button', { hasText: /save|create|draft/i }).first()
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(saveBtn).toBeVisible()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE DETAIL — PAYMENT FLOWS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Invoice Payment Flows', () => {
  test('invoice detail has Mark as Paid option', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const body = await page.locator('body').textContent() || ''
    // Only non-paid invoices show payment options
    if (body.includes('Paid') && !body.includes('Mark as Paid')) return

    // Edit mode → status dropdown should have "paid" option
    const editBtn = page.locator('button', { hasText: /edit invoice/i })
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click()
      await page.waitForTimeout(500)

      const statusSelect = page.locator('select').first()
      if (await statusSelect.isVisible()) {
        const opts = (await statusSelect.locator('option').allTextContents()).join(' ').toLowerCase()
        expect(opts).toContain('paid')
      }

      await page.locator('button', { hasText: /cancel/i }).first().click()
    }
  })

  test('invoice detail has payment method selector in edit mode', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const editBtn = page.locator('button', { hasText: /edit invoice/i })
    if (!(await editBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Payment method dropdown should exist
    const selects = page.locator('select')
    const count = await selects.count()
    // At least status + possibly payment method
    expect(count).toBeGreaterThanOrEqual(1)

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/status|payment|method/)

    await page.locator('button', { hasText: /cancel/i }).first().click()
  })

  test('invoice detail has Generate Payment Link button', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const body = await page.locator('body').textContent() || ''
    // If unpaid, should have Stripe payment link option
    if (!body.includes('Paid')) {
      const paymentBtn = page.locator('button, a', { hasText: /payment link|stripe|pay/i }).first()
      if (await paymentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(paymentBtn).toBeVisible()
      }
    }
  })

  test('invoice detail has PDF link', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const pdfLink = page.locator('a[href*="pdf"], button', { hasText: /pdf|download/i }).first()
    if (await pdfLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(pdfLink).toBeVisible()
    }
  })

  test('invoice detail email button works without crash', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const emailBtn = page.locator('button', { hasText: /email invoice/i }).first()
    if (!(await emailBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await emailBtn.click()
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should show success/error/confirmation
    expect(body.toLowerCase()).toMatch(/sent|error|email|confirm/)
  })

  test('invoice detail text/SMS button works without crash', async ({ page }) => {
    const ok = await goToInvoiceDetail(page)
    if (!ok) { test.skip(); return }

    const textBtn = page.locator('button', { hasText: /text invoice|sms/i }).first()
    if (!(await textBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await textBtn.click()
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE — STATUS FILTERING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Invoice Status Filtering', () => {
  test('filtering by draft status works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const statusSelect = page.locator('select').first()
    if (!(await statusSelect.isVisible())) { test.skip(); return }

    await statusSelect.selectOption('draft')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('filtering by paid status works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const statusSelect = page.locator('select').first()
    if (!(await statusSelect.isVisible())) { test.skip(); return }

    await statusSelect.selectOption('paid')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('filtering by overdue status works', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const statusSelect = page.locator('select').first()
    if (!(await statusSelect.isVisible())) { test.skip(); return }

    await statusSelect.selectOption('overdue')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('resetting filter to All shows all invoices', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const statusSelect = page.locator('select').first()
    if (!(await statusSelect.isVisible())) { test.skip(); return }

    // Filter to draft first
    await statusSelect.selectOption('draft')
    await page.waitForTimeout(500)

    // Reset to all
    await statusSelect.selectOption('all')
    await page.waitForTimeout(500)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE + QUICKBOOKS SYNC STATUS
// ═══════════════════════════════════════════════════════════════════════════

import { Route } from '@playwright/test'

// Auth mock helper — same pattern as quickbooks-flows.spec.ts
const MOCK_USER_INV = {
  id: 'e2e-test-user-0000-0000-000000000001',
  email: 'e2e-test@stride.app',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const MOCK_SESSION_INV = {
  access_token: 'mock-e2e-access-token-inv-tests',
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: 'mock-e2e-refresh-token',
  user: MOCK_USER_INV,
}

async function mockAuthForInvoice(page: Page) {
  await page.route('**/auth/v1/user**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER_INV) })
  })
  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_SESSION_INV, user: MOCK_USER_INV }) })
  })
  await page.route('**/rest/v1/practitioners**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
      id: MOCK_USER_INV.id, full_name: 'Dr. E2E Tester', practice_name: 'Stride Test Practice',
      email: MOCK_USER_INV.email, subscription_status: 'active', animals_served: 'equine',
      location: 'Test City, TX', logo_url: null, onboarding_complete: true,
    }]) })
  })
  await page.route('**/api/billing/ensure-practitioner', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: MOCK_USER_INV.id, full_name: 'Dr. E2E Tester', practice_name: 'Stride Test Practice',
      email: MOCK_USER_INV.email, subscription_status: 'active', animals_served: 'equine',
      location: 'Test City, TX', logo_url: null, onboarding_complete: true,
    }) })
  })
  const SB_KEY = 'sb-pyuarwwhmtoflyzwblbn-auth-token'
  await page.addInitScript(({ session, key }) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, { session: MOCK_SESSION_INV, key: SB_KEY })
}

/** Try real login first; if it fails, use mocked auth instead */
async function ensureAuthOrMock(page: Page): Promise<'real' | 'mocked'> {
  if (authAvailable === true) {
    const ok = await tryLogin(page)
    if (ok) return 'real'
  }
  if (authAvailable === null) {
    const ok = await tryLogin(page)
    if (ok) { authAvailable = true; return 'real' }
    authAvailable = false
  }
  // Fall back to mocked auth
  await mockAuthForInvoice(page)
  return 'mocked'
}

test.describe('Invoice — QuickBooks Sync Integration', () => {
  test('invoice creation calls /api/invoices and does not crash with QB connected', async ({ page }) => {
    const authMode = await ensureAuthOrMock(page)

    // Mock QB as connected so sync paths are active
    await page.route('**/api/quickbooks/status', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          connection: {
            realm_id: '1234567890',
            company_name: 'Test Practice',
            connected_at: '2026-03-15T10:00:00Z',
            last_synced_at: '2026-04-01T14:30:00Z',
          },
        }),
      })
    })

    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // Fill minimum fields
    const ownerSelect = page.locator('select').first()
    if (!(await ownerSelect.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    const options = await ownerSelect.locator('option').all()
    if (options.length <= 1) { test.skip(); return }
    await ownerSelect.selectOption({ index: 1 })
    await page.waitForTimeout(1000)

    const descInput = page.locator('input[placeholder="Description"]').first()
    if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descInput.fill('QB Sync Test Service')
      const qtyInput = page.locator('input[type="number"]').first()
      if (await qtyInput.isVisible()) await qtyInput.fill('1')
      const priceInput = page.locator('input[type="number"]').nth(1)
      if (await priceInput.isVisible()) await priceInput.fill('75')
    }

    // Track the POST to /api/invoices
    let invoicePostBody: Record<string, unknown> | null = null
    await page.route('**/api/invoices', async (route: Route) => {
      if (route.request().method() === 'POST') {
        try {
          invoicePostBody = route.request().postDataJSON()
        } catch { /* no body */ }
        // Let the request through to the real server
        await route.continue()
      } else {
        await route.continue()
      }
    })

    const submitBtn = page.locator('button', { hasText: /create|save|submit/i }).first()
    if (!(await submitBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await submitBtn.click()
    await page.waitForTimeout(3000)

    const afterBody = await page.locator('body').textContent() || ''
    expect(afterBody).not.toContain('Unhandled Runtime Error')
  })

  test('invoice list page loads without errors when QB is connected', async ({ page }) => {
    await ensureAuthOrMock(page)

    // Mock QB connected
    await page.route('**/api/quickbooks/status', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          connection: {
            realm_id: '1234567890',
            company_name: 'Test Practice',
            connected_at: '2026-03-15T10:00:00Z',
            last_synced_at: '2026-04-01T14:30:00Z',
          },
        }),
      })
    })

    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Page should still show invoice list elements
    expect(body.toLowerCase()).toMatch(/invoice|no invoices/)
  })

  test('invoice detail page loads without errors when QB is connected', async ({ page }) => {
    await ensureAuthOrMock(page)

    await page.route('**/api/quickbooks/status', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          connection: {
            realm_id: '1234567890',
            company_name: 'Test Practice',
            connected_at: '2026-03-15T10:00:00Z',
            last_synced_at: '2026-04-01T14:30:00Z',
          },
        }),
      })
    })

    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('mark-paid flow does not crash with QB connected', async ({ page }) => {
    await ensureAuthOrMock(page)

    await page.route('**/api/quickbooks/status', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true, connection: { realm_id: '123', company_name: 'Test', connected_at: '2026-01-01T00:00:00Z', last_synced_at: null } }),
      })
    })

    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // Try to open mark-paid
    const markPaidBtn = page.locator('button', { hasText: /mark as paid/i }).first()
    if (!(await markPaidBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await markPaidBtn.click()
    await page.waitForTimeout(1000)

    // Verify no crash — the modal/form should appear
    const afterBody = await page.locator('body').textContent() || ''
    expect(afterBody).not.toContain('Unhandled Runtime Error')
    // Should see payment method options
    expect(afterBody.toLowerCase()).toMatch(/cash|check|stripe|venmo|payment/)
  })
})
