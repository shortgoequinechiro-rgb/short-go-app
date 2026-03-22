import { test as base, expect, type Page } from '@playwright/test'

/**
 * Authenticated test fixture.
 *
 * Uses Supabase email/password login to establish a real session.
 * Set E2E_USER_EMAIL and E2E_USER_PASSWORD env vars to use a test account.
 *
 * If credentials are not set, tests using this fixture will be skipped.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD

    if (!email || !password) {
      base.skip(true, 'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set')
      return
    }

    // Go to login page and authenticate
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect away from login (to select-mode or dashboard)
    // Retry with a longer timeout and check for error messages
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    } catch {
      // If login failed (rate limit, network issue), check for error and retry once
      const errorVisible = await page.locator('.text-red-500').isVisible().catch(() => false)
      if (errorVisible) {
        // Wait a bit for rate limit to clear, then retry
        await page.waitForTimeout(3000)
        await page.locator('input[type="email"]').fill(email)
        await page.locator('input[type="password"]').fill(password)
        await page.getByRole('button', { name: /sign in/i }).click()
        await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
      } else {
        throw new Error('Login failed — stuck on login page with no error message')
      }
    }

    await use(page)
  },
})

export { expect }
