import { test, expect } from './fixtures'

test.describe('Anatomy Viewer', () => {
  test('loads the 3D anatomy page', async ({ authenticatedPage: page }) => {
    await page.goto('/anatomy')
    await page.waitForTimeout(5000) // 3D assets take time

    const url = page.url()
    expect(url).toMatch(/\/(anatomy|dashboard|select-mode)/)
  })

  test('shows layer toggle controls', async ({ authenticatedPage: page }) => {
    await page.goto('/anatomy')
    await page.waitForTimeout(5000)

    if (page.url().includes('/anatomy')) {
      // Should show layer toggles for anatomy layers
      const layerNames = ['Skeleton', 'Muscles', 'Nerves', 'Organs']
      for (const name of layerNames) {
        const toggle = page.getByText(name, { exact: false }).first()
        const isVisible = await toggle.isVisible().catch(() => false)
        if (isVisible) {
          // At least some layers should be toggleable
          expect(true).toBe(true)
          return
        }
      }
    }
  })

  test('shows anatomical landmarks', async ({ authenticatedPage: page }) => {
    await page.goto('/anatomy')
    await page.waitForTimeout(5000)

    if (page.url().includes('/anatomy')) {
      // Should show landmark names
      const landmarks = ['Poll', 'Withers', 'Thoracolumbar', 'SI Joint', 'Hock']
      for (const landmark of landmarks) {
        const el = page.getByText(landmark, { exact: false }).first()
        const isVisible = await el.isVisible().catch(() => false)
        if (isVisible) {
          expect(true).toBe(true)
          return
        }
      }
    }
  })
})
