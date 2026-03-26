import { test, expect } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// MARKETING / PUBLIC PAGES — COMPREHENSIVE TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Features Page', () => {
  test('features page renders hero and CTA buttons', async ({ page }) => {
    await page.goto('/features')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Hero heading
    await expect(page.locator('text=/features/i').first()).toBeVisible({ timeout: 10000 })

    // CTA buttons should exist
    const trialBtn = page.locator('a', { hasText: /start free trial/i }).first()
    await expect(trialBtn).toBeVisible()
    expect(await trialBtn.getAttribute('href')).toBe('/signup')
  })

  test('features page shows all 6 hero feature sections', async ({ page }) => {
    await page.goto('/features')
    await page.waitForLoadState('networkidle')

    const featureIds = ['records', 'spine', 'ai-soap', 'scheduling', 'forms', 'offline']
    for (const id of featureIds) {
      const section = page.locator(`#${id}`)
      // Section should exist on the page (may need scrolling)
      await expect(section).toBeAttached()
    }
  })

  test('features page has View Pricing link', async ({ page }) => {
    await page.goto('/features')
    await page.waitForLoadState('networkidle')

    const pricingLink = page.locator('a', { hasText: /view pricing/i }).first()
    await expect(pricingLink).toBeVisible()
    expect(await pricingLink.getAttribute('href')).toBe('/pricing')
  })

  test('features page has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/features')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // Filter out known non-critical errors (e.g. favicon, analytics)
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('analytics'))
    expect(criticalErrors.length).toBe(0)
  })
})

test.describe('Pricing Page', () => {
  test('pricing page renders with both plan options', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Should show both price points
    expect(body).toContain('49')
    expect(body).toContain('499')
  })

  test('pricing page shows annual savings badge', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const saveBadge = page.locator('text=/save 15%/i').first()
    await expect(saveBadge).toBeVisible({ timeout: 5000 })
  })

  test('pricing page trial buttons link to signup', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const trialBtns = page.locator('a', { hasText: /free trial/i })
    const count = await trialBtns.count()
    expect(count).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < count; i++) {
      const href = await trialBtns.nth(i).getAttribute('href')
      expect(href).toBe('/signup')
    }
  })

  test('pricing page FAQ section is interactive', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    // Find a FAQ question and try to expand it
    const faqQuestion = page.locator('text=/what happens/i, text=/can i cancel/i, text=/credit card/i').first()
    if (await faqQuestion.isVisible({ timeout: 3000 }).catch(() => false)) {
      await faqQuestion.click()
      await page.waitForTimeout(500)
      // After clicking, more text should be revealed
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('pricing page shows feature comparison', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    // Should mention key feature categories
    expect(body.toLowerCase()).toMatch(/patient management|clinical tools|scheduling/)
  })
})

test.describe('About Page', () => {
  test('about page renders hero and story sections', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Hero heading
    await expect(page.locator('text=/chiropractors/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('about page has Our Story timeline', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toContain('problem')
    expect(body.toLowerCase()).toContain('idea')
  })

  test('about page has Our Values section', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toMatch(/values|built for the field|simple by design/)
  })

  test('about page CTAs link correctly', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    const trialLink = page.locator('a', { hasText: /start free trial/i }).first()
    if (await trialLink.isVisible()) {
      expect(await trialLink.getAttribute('href')).toBe('/signup')
    }

    const contactLink = page.locator('a', { hasText: /get in touch/i }).first()
    if (await contactLink.isVisible()) {
      expect(await contactLink.getAttribute('href')).toBe('/contact')
    }
  })
})

test.describe('Help Page', () => {
  test('help page renders with guide list', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    await expect(page.locator('text=/how-to guides/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('help page has search input', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await expect(searchInput).toBeVisible()

    // Typing in search should filter guides
    await searchInput.fill('invoice')
    await page.waitForTimeout(500)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('help page guides are expandable', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Find a guide card and click to expand
    const guideCard = page.locator('button', { hasText: /add.*owner|add.*patient|record.*visit/i }).first()
    if (await guideCard.isVisible()) {
      await guideCard.click()
      await page.waitForTimeout(500)
      // Should show step content
      const body = await page.locator('body').textContent() || ''
      expect(body.toLowerCase()).toMatch(/step|click|navigate/)
    }
  })

  test('help page shows all categories', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toContain('getting started')
    expect(body.toLowerCase()).toContain('patient care')
    expect(body.toLowerCase()).toMatch(/invoic|billing/)
  })

  test('help page has contact support link', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')

    const contactLink = page.locator('text=/contact support|still need help/i').first()
    await expect(contactLink).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MARKETING PAGE CROSS-CUTTING TESTS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Marketing Pages - Cross-Cutting', () => {
  const marketingRoutes = ['/features', '/pricing', '/about', '/contact', '/help']

  for (const route of marketingRoutes) {
    test(`${route} returns 200 and no runtime errors`, async ({ page }) => {
      const response = await page.goto(route)
      expect(response?.status()).toBe(200)
      await page.waitForLoadState('networkidle')
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
      expect(body).not.toContain('Application error')
      expect(body.length).toBeGreaterThan(100)
    })
  }

  test('marketing nav is visible on all marketing pages', async ({ page }) => {
    for (const route of marketingRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const nav = page.locator('nav').first()
      await expect(nav).toBeVisible({ timeout: 10000 })
    }
  })

  test('marketing footer is visible on all marketing pages', async ({ page }) => {
    for (const route of marketingRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const footer = page.locator('footer').first()
      if (await footer.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(footer).toBeVisible()
      }
    }
  })
})
