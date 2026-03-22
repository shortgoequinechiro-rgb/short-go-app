import { test, expect } from '@playwright/test'

test.describe('Signup Page', () => {
  test('renders the signup form with all fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    // Confirm password field (second password input)
    await expect(page.locator('input[type="password"]').nth(1)).toBeVisible()
    await expect(page.getByRole('button', { name: /start free trial/i })).toBeVisible()
  })

  test('shows 14-day free trial badge', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('14-day free trial')).toBeVisible()
  })

  test('button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('button', { name: /start free trial/i })).toBeDisabled()
  })

  test('button enables when all fields are filled', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[type="password"]').nth(1).fill('password123')
    await expect(page.getByRole('button', { name: /start free trial/i })).toBeEnabled()
  })

  test('has link to sign in page', async ({ page }) => {
    await page.goto('/signup')
    const signInLink = page.getByRole('link', { name: /sign in/i })
    await expect(signInLink).toBeVisible()
    await expect(signInLink).toHaveAttribute('href', '/login')
  })
})

test.describe('Login Page', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  test('button enables when email and password are filled', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').fill('password123')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('fake@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Should show an error message and stay on login page
    await expect(page.locator('.text-red-500')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('has link to signup page', async ({ page }) => {
    await page.goto('/login')
    const trialLink = page.getByRole('link', { name: /start free trial/i })
    await expect(trialLink).toBeVisible()
    await expect(trialLink).toHaveAttribute('href', '/signup')
  })
})

test.describe('Protected Route Redirects', () => {
  const protectedRoutes = [
    '/dashboard',
    '/calendar',
    '/appointments',
    '/account',
    '/billing',
    '/anatomy',
    '/human/dashboard',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  }
})
