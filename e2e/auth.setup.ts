import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '..', '.auth', 'user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL || 'charlesdunn2006@gmail.com'
  const password = process.env.E2E_USER_PASSWORD || 'Kgrace0603!'

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button', { hasText: /sign in/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await expect(page).toHaveURL(/\/dashboard/)

  // Save auth state
  await page.context().storageState({ path: authFile })
})
