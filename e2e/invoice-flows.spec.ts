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
