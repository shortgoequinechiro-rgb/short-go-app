import { test, expect } from '@playwright/test'

test.describe('Onboarding Page', () => {
  test('redirects unauthenticated users to signup', async ({ page }) => {
    await page.goto('/onboarding')
    // Should redirect to signup since user is not logged in
    await expect(page).toHaveURL(/\/(signup|login)/, { timeout: 10000 })
  })
})

test.describe('Select Mode Page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/select-mode')
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('Public Pages', () => {
  test('landing page loads without auth', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Stride/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('contact page loads without auth', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('body')).toBeVisible()
    // Should not redirect to login
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/contact')
  })
})
