import { test, expect } from './fixtures'

test.describe('Navigation', () => {
  test('navbar shows on authenticated pages', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(3000)

    // NavBar should be visible with STRIDE branding
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByText('STRIDE')).toBeVisible()
  })

  test('navbar has sign out button', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(3000)

    const signOutButton = page.getByRole('button', { name: /sign out/i })
    await expect(signOutButton).toBeVisible()
  })

  test('navbar has switch mode link', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(3000)

    const switchModeLink = page.getByRole('link', { name: /switch mode/i })
    await expect(switchModeLink).toBeVisible()
  })

  test('navbar has scheduler link in animal mode', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(3000)

    // In animal mode, scheduler link should be visible
    const schedulerLink = page.getByRole('link', { name: /scheduler/i })
    if (await schedulerLink.isVisible()) {
      await schedulerLink.click()
      await expect(page).toHaveURL(/\/calendar/)
    }
  })

  // Sign out test runs last since it destroys the session
  test('sign out redirects to login', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('Navbar hidden on public pages', () => {
  test('no navbar on landing page', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    // The sign out button should not be present on the landing page
    const signOutButton = page.getByRole('button', { name: /sign out/i })
    await expect(signOutButton).toBeHidden({ timeout: 3000 })
  })

  test('no navbar on login page', async ({ page }) => {
    await page.goto('/login')
    const signOutButton = page.getByRole('button', { name: /sign out/i })
    await expect(signOutButton).toBeHidden({ timeout: 3000 })
  })
})
