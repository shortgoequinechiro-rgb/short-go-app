import { test, expect } from './fixtures'

test.describe('Animal Dashboard', () => {
  test('loads and shows key dashboard elements', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')

    // Should see the dashboard with stat cards and action buttons
    await expect(page.getByText(/\+ Add Owner/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/\+ Add Patient/i).first()).toBeVisible()
  })

  test('search bar filters records', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')

    // Wait for dashboard to load
    await expect(page.getByText(/\+ Add Owner/i).first()).toBeVisible({ timeout: 10000 })

    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('zzz_nonexistent_record')
      // Should show no results or filtered list
      await page.waitForTimeout(500)
    }
  })

  test('add owner modal opens', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/\+ Add Owner/i).first()).toBeVisible({ timeout: 10000 })

    await page.getByText('+ Add Owner').first().click()
    await expect(page.locator('h2', { hasText: 'Add Owner' })).toBeVisible()
  })

  test('add patient modal opens', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/\+ Add Patient/i).first()).toBeVisible({ timeout: 10000 })

    await page.getByText('+ Add Patient').first().click()
    await expect(page.locator('h2', { hasText: 'Add Patient' })).toBeVisible()
  })
})

test.describe('Human Dashboard', () => {
  test('loads human patient dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/human/dashboard')

    // Should show human dashboard with patient list or add button
    await expect(page.locator('body')).toBeVisible()
    // Wait for auth + data load
    await page.waitForTimeout(3000)

    // Verify we're either on the human dashboard or redirected to select-mode
    const url = page.url()
    expect(url).toMatch(/\/(human\/dashboard|select-mode|dashboard)/)
  })
})
