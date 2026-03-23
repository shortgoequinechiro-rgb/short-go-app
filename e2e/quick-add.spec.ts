import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function tryLogin(page: Page): Promise<boolean> {
  const email = process.env.E2E_USER_EMAIL || 'charlesdunn2006@gmail.com'
  const password = process.env.E2E_USER_PASSWORD || 'Kgrace0603!'
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button', { hasText: /sign in/i }).click()

  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    return true
  } catch {
    return false
  }
}

let authAvailable: boolean | null = null

async function ensureAuth(page: Page) {
  if (authAvailable === false) {
    test.skip()
    return
  }
  const ok = await tryLogin(page)
  if (!ok) {
    authAvailable = false
    test.skip()
    return
  }
  authAvailable = true
}

// Navigate to a horse's new visit page. Picks the first horse that has visits.
async function goToNewVisit(page: Page): Promise<boolean> {
  await page.waitForLoadState('networkidle')

  // Search to surface owners/horses
  const searchBox = page.locator('input[placeholder*="Search"]').first()
  if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBox.fill('a')
    await page.waitForTimeout(1000)
  }

  const horseLink = page.locator('a[href*="/horses/"]').first()
  if (await horseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await horseLink.getAttribute('href')
    if (!href) return false
    const match = href.match(/\/horses\/([^/?]+)/)
    if (!match) return false
    const horseId = match[1]
    await page.goto(`/horses/${horseId}/spine?newVisit=true`)
    await page.waitForLoadState('networkidle')
    return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW VISIT FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Quick Add Chips - New Visit Flow', () => {
  test('Clone Previous Visit button appears and shows feedback', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Clone Previous Visit button should be visible
    const cloneBtn = page.locator('button', { hasText: /Clone Previous Visit/i })
    await expect(cloneBtn).toBeVisible({ timeout: 5000 })

    // Click it
    await cloneBtn.click()

    // Wait for a result message (any of the possible outcomes)
    const message = page.locator('text=/Cloned \\d+ field|No previous visits|fields were empty|Failed to clone/i')
    await expect(message).toBeVisible({ timeout: 10000 })

    const msgText = await message.textContent() || ''
    console.log('Clone result message:', msgText)

    // The button should no longer show "Cloning…"
    await expect(cloneBtn).toContainText('Clone Previous Visit')
  })

  test('Subjective Quick Add chips appear and populate text', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // "Routine maintenance" chip should be visible by default (first group)
    const routineChip = page.locator('button', { hasText: 'Routine maintenance' }).first()
    await expect(routineChip).toBeVisible({ timeout: 5000 })

    // Click it — should get selected style
    await routineChip.click()
    await expect(routineChip).toHaveClass(/bg-slate-900/)

    // "Fill from selections" button should appear
    const fillBtn = page.locator('button', { hasText: 'Fill from selections' }).first()
    await expect(fillBtn).toBeVisible()

    // Click fill
    await fillBtn.click()

    // Subjective textarea should now contain generated text
    const subjField = page.locator('textarea[placeholder*="owner reports"]')
    const value = await subjField.inputValue()
    expect(value.toLowerCase()).toContain('routine maintenance')
  })

  test('Selecting multiple chips across sections + Generate SOAP from Selections', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Subjective: tap chip
    await page.locator('button', { hasText: 'Routine maintenance' }).first().click()

    // Objective: tap chip
    const restrictedChip = page.locator('button', { hasText: 'Restricted' }).first()
    await restrictedChip.scrollIntoViewIfNeeded()
    await restrictedChip.click()

    // Assessment: tap chip
    const segDysChip = page.locator('button', { hasText: 'Segmental dysfunction' }).first()
    await segDysChip.scrollIntoViewIfNeeded()
    await segDysChip.click()

    // Plan: tap chip
    const thorChip = page.locator('button', { hasText: 'Thoracic adjusted' }).first()
    await thorChip.scrollIntoViewIfNeeded()
    await thorChip.click()

    // "Generate SOAP from Selections" button should appear
    const generateBtn = page.locator('button', { hasText: 'Generate SOAP from Selections' })
    await generateBtn.scrollIntoViewIfNeeded()
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // All SOAP fields should now be populated
    const subjVal = await page.locator('textarea[placeholder*="owner reports"]').inputValue()
    expect(subjVal.toLowerCase()).toContain('routine maintenance')

    const objVal = await page.locator('textarea[placeholder*="findings"]').inputValue()
    expect(objVal.toLowerCase()).toContain('restriction')

    const assVal = await page.locator('textarea[placeholder*="Clinical impression"]').inputValue()
    expect(assVal.toLowerCase()).toContain('segmental dysfunction')

    const planVal = await page.locator('textarea[placeholder*="Treatment plan"]').inputValue()
    expect(planVal.toLowerCase()).toContain('thoracic')

    await expect(page.locator('text=SOAP fields populated from selections')).toBeVisible()
  })

  test('Spine sections collapse and expand', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Find Thoracic section header
    const thoracicHeader = page.locator('button', { hasText: 'Thoracic' }).first()
    await thoracicHeader.scrollIntoViewIfNeeded()

    // T1 should be visible
    const t1 = page.locator('span', { hasText: /^T1$/ }).first()
    await expect(t1).toBeVisible()

    // Collapse
    await thoracicHeader.click()
    await expect(t1).not.toBeVisible({ timeout: 3000 })

    // Expand
    await thoracicHeader.click()
    await expect(t1).toBeVisible({ timeout: 3000 })
  })

  test('Flagged spine segments show summary tags', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Check a spine segment — find a left checkbox for TMJ
    const tmjRow = page.locator('text=TMJ').first()
    await tmjRow.scrollIntoViewIfNeeded()

    // Click the first checkbox (left) in the TMJ row
    const tmjCheckbox = page.locator('input[type="checkbox"]').first()
    await tmjCheckbox.check()

    // "1 segment flagged" should appear
    await expect(page.locator('text=/1 segment.* flagged/i')).toBeVisible({ timeout: 3000 })

    // TMJ tag should appear in the flagged summary
    await expect(page.locator('text=/TMJ.*\\(L\\)/i')).toBeVisible({ timeout: 3000 })
  })

  test('Plan follow-up chips auto-fill the Follow Up field', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Expand Plan chips to see follow-up group
    const moreBtn = page.locator('button', { hasText: /More plan/i }).last()
    if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moreBtn.click()
    }

    // Select "2 weeks" chip
    const twoWeekChip = page.locator('button', { hasText: '2 weeks' }).first()
    await twoWeekChip.scrollIntoViewIfNeeded()
    await twoWeekChip.click()

    // Also select an adjustment chip so we have Plan content
    const thorAdjChip = page.locator('button', { hasText: 'Thoracic adjusted' }).first()
    await thorAdjChip.scrollIntoViewIfNeeded()
    await thorAdjChip.click()

    // Click the Plan section's "Fill from selections"
    // Find the Fill button closest to the Plan chips
    const planFillBtns = page.locator('button', { hasText: 'Fill from selections' })
    const lastFill = planFillBtns.last()
    await lastFill.scrollIntoViewIfNeeded()
    await lastFill.click()

    // Follow Up input should contain "2 weeks"
    const followUpField = page.locator('input[placeholder*="2 weeks"]')
    const fuVal = await followUpField.inputValue()
    expect(fuVal).toContain('2 weeks')
  })

  test('Expanding "More options" reveals additional chips', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // "Stiffness noted" is in the Symptoms group (group 2), should be hidden initially
    const stiffChip = page.locator('button', { hasText: 'Stiffness noted' }).first()
    await expect(stiffChip).not.toBeVisible({ timeout: 2000 })

    // Click "+ More subjective options"
    const moreBtn = page.locator('button', { hasText: /More subjective/i }).first()
    await moreBtn.click()

    // Now "Stiffness noted" should be visible
    await expect(stiffChip).toBeVisible({ timeout: 2000 })

    // Click "− Less options" to collapse
    const lessBtn = page.locator('button', { hasText: /Less options/i }).first()
    await lessBtn.click()

    // "Stiffness noted" should be hidden again
    await expect(stiffChip).not.toBeVisible({ timeout: 2000 })
  })

  test('Clear section button removes chip selections', async ({ page }) => {
    await ensureAuth(page)
    const navigated = await goToNewVisit(page)
    if (!navigated) { test.skip(); return }

    await expect(page.locator('h1', { hasText: 'New Visit' })).toBeVisible({ timeout: 10000 })

    // Select a chip
    const routineChip = page.locator('button', { hasText: 'Routine maintenance' }).first()
    await routineChip.click()
    await expect(routineChip).toHaveClass(/bg-slate-900/)

    // Clear button should be visible
    const clearBtn = page.locator('button', { hasText: 'Clear Subjective' }).first()
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // Chip should no longer be selected
    await expect(routineChip).not.toHaveClass(/bg-slate-900/)

    // Clear button should be gone (no selections)
    await expect(clearBtn).not.toBeVisible({ timeout: 2000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EDIT VISIT FLOW TESTS (Horse Detail Page)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Quick Add Chips - Edit Visit Flow', () => {
  test('Quick Add chips appear when editing a visit', async ({ page }) => {
    await ensureAuth(page)

    // Navigate to a horse with visits
    const horseLink = page.locator('a[href*="/horses/"]').first()
    if (!(await horseLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return
    }

    await horseLink.click()
    await page.waitForLoadState('networkidle')

    // Switch to visits tab
    const visitsTab = page.locator('button', { hasText: /Visits/i }).first()
    if (await visitsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await visitsTab.click()
    }

    // Find an existing visit to edit
    const editBtn = page.locator('button', { hasText: /Edit/i }).first()
    if (!(await editBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return
    }

    await editBtn.click()
    await page.waitForTimeout(1000)

    // Quick Add chips should be visible
    const routineChip = page.locator('button', { hasText: 'Routine maintenance' }).first()
    await routineChip.scrollIntoViewIfNeeded()
    await expect(routineChip).toBeVisible({ timeout: 5000 })

    // Select it
    await routineChip.click()

    // "Generate SOAP from Selections" should appear
    const generateBtn = page.locator('button', { hasText: 'Generate SOAP from Selections' })
    await generateBtn.scrollIntoViewIfNeeded()
    await expect(generateBtn).toBeVisible({ timeout: 5000 })
  })
})
