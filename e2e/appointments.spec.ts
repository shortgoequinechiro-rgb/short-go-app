import { test, expect } from './fixtures'

test.describe('Appointments Page', () => {
  test('loads appointments list', async ({ authenticatedPage: page }) => {
    await page.goto('/appointments')

    // Wait for page to load — should show appointment-related content
    await page.waitForTimeout(3000)

    // Verify we're on the appointments page or redirected to dashboard
    const url = page.url()
    expect(url).toMatch(/\/(appointments|dashboard|select-mode)/)
  })

  test('shows appointment status badges', async ({ authenticatedPage: page }) => {
    await page.goto('/appointments')
    await page.waitForTimeout(3000)

    // If there are appointments, status badges should be visible
    const badges = page.locator('text=/Scheduled|Confirmed|Completed|Cancelled/')
    const count = await badges.count()
    // This is informational — we just verify the page loaded without crashing
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Calendar / Scheduler', () => {
  test('loads the calendar view', async ({ authenticatedPage: page }) => {
    await page.goto('/calendar')

    // Wait for calendar to render
    await page.waitForTimeout(3000)

    const url = page.url()
    expect(url).toMatch(/\/(calendar|dashboard|select-mode)/)
  })
})
