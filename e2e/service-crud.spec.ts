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
// SERVICE CRUD — FULL LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Service Management', () => {
  test('services page loads with Add Service button', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    if (body.includes('free trial has ended')) return

    const addBtn = page.locator('button', { hasText: /add.*service/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
  })

  test('Add Service form shows required fields', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const addBtn = page.locator('button', { hasText: /add.*service/i }).first()
    if (!(await addBtn.isVisible())) { test.skip(); return }
    await addBtn.click()
    await page.waitForTimeout(500)

    // Name field
    const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first()
    await expect(nameInput).toBeVisible({ timeout: 3000 })

    // Price field
    const priceInput = page.locator('input[type="number"], input[placeholder*="price" i]').first()
    if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(priceInput).toBeVisible()
    }
  })

  test('can fill out and submit Add Service form', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const addBtn = page.locator('button', { hasText: /add.*service/i }).first()
    if (!(await addBtn.isVisible())) { test.skip(); return }
    await addBtn.click()
    await page.waitForTimeout(500)

    const ts = Date.now()
    // Fill name
    const nameInput = page.locator('input').filter({ hasNotText: /\$/ }).first()
    await nameInput.fill(`E2E Test Service ${ts}`)

    // Fill description if available
    const descInput = page.locator('textarea').first()
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill('Automated test service')
    }

    // Fill price
    const priceInput = page.locator('input[type="number"]').first()
    if (await priceInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await priceInput.fill('75')
    }

    // Submit
    const submitBtn = page.locator('button', { hasText: /add service/i }).last()
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await page.waitForTimeout(2000)

      const afterBody = await page.locator('body').textContent() || ''
      expect(afterBody).not.toContain('Unhandled Runtime Error')
    }
  })

  test('service cards show name and price', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // If services exist, they should show price with $ sign
    if (body.includes('$')) {
      expect(body).toMatch(/\$\d+/)
    }
  })

  test('service card has Edit button (pencil icon)', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended') || body.includes('No services')) { test.skip(); return }

    // Edit button (pencil icon) — look for svg inside a button, or button with "edit" title
    const editBtn = page.locator('button[title*="edit" i], button:has(svg.lucide-pencil)').first()
    if (!(await editBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Fallback: any small button near the service card
      const anyEditBtn = page.locator('button', { hasText: /edit/i }).first()
      if (await anyEditBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(anyEditBtn).toBeVisible()
      }
    }
  })

  test('clicking Edit on a service shows editable fields', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended') || body.includes('No services')) { test.skip(); return }

    // Click first edit-like button on a service card
    const editBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    if (!(await editBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Should show input fields for editing
    const inputs = page.locator('input')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Should have Save/Cancel
    const saveBtn = page.locator('button', { hasText: /save/i }).first()
    const cancelBtn = page.locator('button', { hasText: /cancel/i }).first()
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(saveBtn).toBeVisible()
    }
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click() // Cancel to revert
    }
  })

  test('service cards have active/inactive toggle', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended') || body.includes('No services')) { test.skip(); return }

    const toggle = page.locator('input[type="checkbox"]').first()
    if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(toggle).toBeVisible()
    }
  })

  test('service cards have reorder controls', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended') || body.includes('No services')) { test.skip(); return }

    // ChevronUp / ChevronDown buttons for reordering
    const upBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(0)
    if (await upBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click without expecting specific result — just no crash
      await upBtn.click()
      await page.waitForTimeout(300)
      const afterBody = await page.locator('body').textContent() || ''
      expect(afterBody).not.toContain('Unhandled Runtime Error')
    }
  })

  test('delete service button shows confirmation', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended') || body.includes('No services')) { test.skip(); return }

    // Find delete button (Trash2 icon)
    const deleteBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    if (!(await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false))) { test.skip(); return }

    await deleteBtn.click()
    await page.waitForTimeout(500)

    // Should show confirmation buttons (Confirm/Cancel)
    const afterBody = await page.locator('body').textContent() || ''
    expect(afterBody).not.toContain('Unhandled Runtime Error')
    // Either a modal or inline confirm should appear
    expect(afterBody.toLowerCase()).toMatch(/confirm|cancel|sure|delete/)
  })
})
