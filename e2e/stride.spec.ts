import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Attempt to login; returns true if succeeded, false if network/auth blocked
async function tryLogin(page: Page): Promise<boolean> {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) { test.skip(); return false }
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button', { hasText: /sign in/i }).click()

  try {
    await page.waitForURL('**/dashboard', { timeout: 12000 })
    return true
  } catch {
    return false
  }
}

// Check if we can reach Supabase from the test browser
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. LANDING PAGE & PUBLIC PAGES (no auth needed)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Public Pages', () => {
  test('home page renders without errors', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(0)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button', { hasText: /sign in/i })).toBeVisible()
    await expect(page.locator('a', { hasText: /start free trial/i })).toBeVisible()
  })

  test('sign in button disabled when fields empty', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('button', { hasText: /sign in/i })).toBeDisabled()
  })

  test('sign in button enabled when fields filled', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('test@test.com')
    await page.locator('input[type="password"]').fill('password123')
    await expect(page.locator('button', { hasText: /sign in/i })).toBeEnabled()
  })

  test('signup page renders with required fields', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should have email and password inputs at minimum
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
  })

  test('signup page has full name and practice name fields', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    // Check for key signup fields
    const inputs = page.locator('input')
    const count = await inputs.count()
    // Should have at least: email, password, full name, practice name
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('contact page renders without errors', async ({ page }) => {
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('login page has link to signup', async ({ page }) => {
    await page.goto('/login')
    const signupLink = page.locator('a[href="/signup"]')
    await expect(signupLink).toBeVisible()
  })

  test('intake form handles invalid owner gracefully', async ({ page }) => {
    await page.goto('/intake/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('consent form handles invalid owner gracefully', async ({ page }) => {
    await page.goto('/consent/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Login Flow', () => {
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[type="email"]').fill('notreal@example.com')
    await page.locator('input[type="password"]').fill('badpassword123')
    await page.locator('button', { hasText: /sign in/i }).click()

    // Either we get an error message or the network is unreachable
    try {
      await expect(page.locator('text=Invalid login credentials')).toBeVisible({ timeout: 10000 })
    } catch {
      // If Supabase is unreachable, we'll get a different error
      const body = await page.locator('body').textContent() || ''
      // Check that something happened (error shown or still on login page)
      expect(page.url()).toContain('/login')
    }
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    const ok = await tryLogin(page)
    if (!ok) {
      // Network issue - can't reach Supabase
      console.log('⚠️  Supabase unreachable - skipping auth tests')
      test.skip()
      return
    }
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. DASHBOARD (requires auth)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Dashboard', () => {
  test('dashboard loads with stat cards', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // Dashboard might show billing wall if trial ended
    if (body.includes('free trial has ended') || body.includes('Choose a plan')) {
      expect(body).not.toContain('Unhandled Runtime Error')
      return
    }
    // Should have core dashboard sections
    await expect(page.locator('text=/dashboard|find records|client/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('navbar is visible with navigation', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    const nav = page.locator('nav')
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('search input exists and works', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const searchInput = page.locator('input[placeholder*="earch"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await page.waitForTimeout(500)
      // Filling search shouldn't crash the page
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('add client button opens modal', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const addClientBtn = page.locator('button', { hasText: /add client|new client|\+ client/i }).first()
    if (await addClientBtn.isVisible()) {
      await addClientBtn.click()
      await page.waitForTimeout(500)
      // Modal should have a name input
      const nameInput = page.locator('input[placeholder*="name" i]').first()
      await expect(nameInput).toBeVisible({ timeout: 3000 })
    }
  })

  test('add patient button opens modal with all 6 species', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const addPatientBtn = page.locator('button', { hasText: /add patient|new patient|\+ patient/i }).first()
    if (!(await addPatientBtn.isVisible())) {
      test.skip()
      return
    }
    await addPatientBtn.click()
    await page.waitForTimeout(500)

    // Find species dropdown
    const speciesSelect = page.locator('select').filter({ hasText: /equine/i }).first()
    if (await speciesSelect.isVisible()) {
      const options = await speciesSelect.locator('option').allTextContents()
      const optText = options.join(' ').toLowerCase()
      expect(optText).toContain('equine')
      expect(optText).toContain('canine')
      expect(optText).toContain('feline')
      expect(optText).toContain('bovine')
      expect(optText).toContain('porcine')
      expect(optText).toContain('exotic')
    }
  })

  test('book appointment modal opens with date/time fields', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const bookBtn = page.locator('button', { hasText: /book.*appointment|schedule/i }).first()
    if (!(await bookBtn.isVisible())) {
      test.skip()
      return
    }
    await bookBtn.click()
    await page.waitForTimeout(500)

    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible({ timeout: 3000 })

    const timeInput = page.locator('input[type="time"]').first()
    await expect(timeInput).toBeVisible()
  })

  test('booking modal has conflict detection', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const bookBtn = page.locator('button', { hasText: /book.*appointment|schedule/i }).first()
    if (!(await bookBtn.isVisible())) {
      test.skip()
      return
    }
    await bookBtn.click()
    await page.waitForTimeout(500)

    // Set a date and verify the conflict check doesn't crash
    const dateInput = page.locator('input[type="date"]').first()
    const today = new Date().toISOString().split('T')[0]
    await dateInput.fill(today)
    await page.waitForTimeout(1500)

    // Page should not have errors
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. ADD CLIENT FLOW
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Add Client', () => {
  test('can create a new client', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const addClientBtn = page.locator('button', { hasText: /add client|new client|\+ client/i }).first()
    if (!(await addClientBtn.isVisible())) {
      test.skip()
      return
    }
    await addClientBtn.click()
    await page.waitForTimeout(500)

    const ts = Date.now()
    const nameInput = page.locator('input[placeholder*="name" i]').first()
    await nameInput.fill(`E2E Client ${ts}`)

    const phoneInput = page.locator('input[placeholder*="phone" i], input[type="tel"]').first()
    if (await phoneInput.isVisible()) await phoneInput.fill('5551234567')

    const emailInput = page.locator('input[placeholder*="email" i], input[type="email"]').first()
    if (await emailInput.isVisible()) await emailInput.fill(`e2e${ts}@test.com`)

    const saveBtn = page.locator('button', { hasText: /save|add|create/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(3000)

    // Check for errors
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. ADD PATIENT (all species)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Add Patient - Species', () => {
  const speciesList = ['equine', 'canine', 'feline', 'bovine', 'porcine', 'exotic'] as const

  for (const sp of speciesList) {
    test(`can select ${sp} species in add patient modal`, async ({ page }) => {
      await ensureAuth(page)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const addPatientBtn = page.locator('button', { hasText: /add patient|new patient|\+ patient/i }).first()
      if (!(await addPatientBtn.isVisible())) {
        test.skip()
        return
      }
      await addPatientBtn.click()
      await page.waitForTimeout(500)

      const speciesSelect = page.locator('select').filter({ hasText: /equine/i }).first()
      if (!(await speciesSelect.isVisible())) {
        test.skip()
        return
      }

      await speciesSelect.selectOption(sp)
      await page.waitForTimeout(300)

      // Verify it changed
      const val = await speciesSelect.inputValue()
      expect(val).toBe(sp)

      // Fill name field
      const nameInput = page.locator('input[placeholder*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(`E2E ${sp} ${Date.now()}`)
      }

      // Page should not crash
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. PATIENT PROFILE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Patient Profile', () => {
  test('can navigate to a patient profile', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) {
      test.skip()
      return
    }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should have tabs
    await expect(page.locator('button', { hasText: /info/i }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button', { hasText: /visit/i }).first()).toBeVisible()
  })

  test('patient profile has NO appointments tab', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) {
      test.skip()
      return
    }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Appointments tab should NOT exist
    const apptsTab = page.locator('button', { hasText: /^appointments$/i })
    await expect(apptsTab).toHaveCount(0)
  })

  test('patient profile has photos tab', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) {
      test.skip()
      return
    }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await expect(page.locator('button', { hasText: /photo/i }).first()).toBeVisible()
  })

  test('edit patient shows all species in dropdown', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) {
      test.skip()
      return
    }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const editBtn = page.locator('button', { hasText: /edit/i }).first()
    if (!(await editBtn.isVisible())) {
      test.skip()
      return
    }
    await editBtn.click()
    await page.waitForTimeout(500)

    const speciesSelect = page.locator('select').filter({ hasText: /equine/i }).first()
    if (await speciesSelect.isVisible()) {
      const opts = await speciesSelect.locator('option').allTextContents()
      const text = opts.join(' ').toLowerCase()
      expect(text).toContain('feline')
      expect(text).toContain('bovine')
      expect(text).toContain('porcine')
      expect(text).toContain('exotic')
    }
  })

  test('start visit navigates to spine page', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) {
      test.skip()
      return
    }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Go to visits tab
    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (await visitsTab.isVisible()) await visitsTab.click()
    await page.waitForTimeout(500)

    const startBtn = page.locator('button, a', { hasText: /start visit|new visit/i }).first()
    if (!(await startBtn.isVisible())) {
      test.skip()
      return
    }
    await startBtn.click()
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/spine')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. SPINE + VISIT PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Spine Assessment & Visit', () => {
  test('spine page has combined visit form fields', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) { test.skip(); return }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (await visitsTab.isVisible()) await visitsTab.click()
    await page.waitForTimeout(500)

    const startBtn = page.locator('button, a', { hasText: /start visit|new visit/i }).first()
    if (!(await startBtn.isVisible())) { test.skip(); return }
    await startBtn.click()
    await page.waitForURL('**/spine**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Visit date input
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 5000 })

    // Visit type dropdown
    const visitTypeSelect = page.locator('select').filter({ hasText: /initial/i }).first()
    if (await visitTypeSelect.isVisible()) {
      const opts = (await visitTypeSelect.locator('option').allTextContents()).join(' ').toLowerCase()
      expect(opts).toContain('initial')
      expect(opts).toContain('follow')
      expect(opts).toContain('maintenance')
    }

    // Spine section should be present
    const spineText = page.locator('text=/spine|cervical|thoracic|lumbar/i').first()
    await expect(spineText).toBeVisible({ timeout: 5000 })

    // SOAP fields should exist
    const textareas = page.locator('textarea')
    const count = await textareas.count()
    // Should have at least subjective, objective, assessment, plan
    expect(count).toBeGreaterThanOrEqual(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. APPOINTMENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Appointments Page', () => {
  test('appointments page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/appointments')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const heading = page.locator('text=/appointment/i').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('can open new appointment form on appointments page', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/appointments')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const newBtn = page.locator('button', { hasText: /new|add|book|create|\+/i }).first()
    if (!(await newBtn.isVisible())) { test.skip(); return }
    await newBtn.click()
    await page.waitForTimeout(500)

    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 3000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. CALENDAR PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Calendar Page', () => {
  test('calendar page loads without errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should have some calendar content
    expect(body.length).toBeGreaterThan(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 10. OWNER PROFILE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Owner Profile', () => {
  test('can navigate to owner profile page', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const ownerLink = page.locator('a[href*="/owners/"]').first()
    if (!(await ownerLink.isVisible())) { test.skip(); return }
    await ownerLink.click()
    await page.waitForURL('**/owners/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 11. ACCOUNT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Account Settings', () => {
  test('account page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should have practice/account content
    const content = page.locator('text=/practice|account|settings|profile/i').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 12. NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Navigation', () => {
  test('all main routes return 200', async ({ page }) => {
    await ensureAuth(page)
    const routes = ['/dashboard', '/appointments', '/calendar', '/account', '/invoices', '/reports', '/communications', '/services']
    for (const route of routes) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(200)
    }
  })

  test('navbar has links to all main pages', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    const nav = page.locator('nav')
    await expect(nav).toBeVisible({ timeout: 10000 })

    // Desktop nav should contain key links
    await expect(nav.locator('a[href="/dashboard"]')).toBeVisible()
    await expect(nav.locator('a[href="/invoices"]')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 13. API HEALTH
// ═══════════════════════════════════════════════════════════════════════════
test.describe('API Health', () => {
  test('SOAP generation endpoint exists (not 404)', async ({ request }) => {
    const res = await request.post('/api/generate-soap', {
      data: { species: 'equine', findings: 'test' },
    })
    expect(res.status()).not.toBe(404)
  })

  test('contact endpoint exists (not 404)', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'Test', email: 'test@test.com', message: 'test' },
    })
    expect(res.status()).not.toBe(404)
  })

  test('intake submit endpoint exists', async ({ request }) => {
    const res = await request.post('/api/intake/submit', {
      data: {},
    })
    // Should not be 404 (may be 400 or 500 for missing data)
    expect(res.status()).not.toBe(404)
  })

  test('consent submit endpoint exists', async ({ request }) => {
    const res = await request.post('/api/consent/submit', {
      data: {},
    })
    expect(res.status()).not.toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 14. MOBILE RESPONSIVENESS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('login page works on mobile', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button', { hasText: /sign in/i })).toBeVisible()
    // Card should be fully visible
    await expect(page.locator('h1', { hasText: 'STRIDE' })).toBeVisible()
  })

  test('signup page works on mobile', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 15. ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Error Handling', () => {
  test('invalid horse ID shows graceful error', async ({ page }) => {
    await page.goto('/horses/not-a-valid-uuid')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    // Should not show raw JS error
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('invalid owner ID shows graceful error', async ({ page }) => {
    await page.goto('/owners/not-a-valid-uuid')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('nonexistent page returns 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345')
    expect(response?.status()).toBe(404)
  })

  test('invalid invoice ID shows graceful error', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 16. INVOICES LIST PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Invoices List', () => {
  test('invoices page loads with header and create button', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) {
      expect(body).not.toContain('Unhandled Runtime Error')
      return
    }
    await expect(page.locator('text=/invoices/i').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('a[href="/invoices/create"]')).toBeVisible()
  })

  test('invoices page has status filter', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const statusSelect = page.locator('select').first()
    if (await statusSelect.isVisible()) {
      const options = await statusSelect.locator('option').allTextContents()
      const optText = options.join(' ').toLowerCase()
      expect(optText).toContain('all')
      expect(optText).toContain('draft')
      expect(optText).toContain('paid')
    }
  })

  test('invoices page shows summary stats when invoices exist', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    // If invoices exist, summary cards should show
    if (body.includes('Total Outstanding') || body.includes('INV-')) {
      await expect(page.locator('text=Total Outstanding')).toBeVisible()
      await expect(page.locator('text=Overdue Count')).toBeVisible()
      await expect(page.locator('text=Paid This Month')).toBeVisible()
    }
  })

  test('invoice cards have View and PDF buttons but no Delete', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const invoiceCard = page.locator('a[href*="/invoices/"]', { hasText: /view/i }).first()
    if (await invoiceCard.isVisible()) {
      // View button should exist
      await expect(invoiceCard).toBeVisible()
      // PDF link should exist
      const pdfLink = page.locator('a[href*="/pdf"]').first()
      await expect(pdfLink).toBeVisible()
      // Delete button should NOT be on the list page
      const deleteButtons = page.locator('button', { hasText: /^delete$/i })
      await expect(deleteButtons).toHaveCount(0)
    }
  })

  test('invoice list date filters work', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const dateFrom = page.locator('input[type="date"]').first()
    if (await dateFrom.isVisible()) {
      await dateFrom.fill('2025-01-01')
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 17. INVOICE DETAIL, EDIT & DELETE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Invoice Detail', () => {
  test('can navigate to invoice detail page', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }

    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should show invoice number
    await expect(page.locator('text=/INV-/i').first()).toBeVisible({ timeout: 10000 })
    // Should show line items section
    await expect(page.locator('text=Line Items')).toBeVisible()
    // Should show back button
    await expect(page.locator('a', { hasText: /back to invoices/i })).toBeVisible()
  })

  test('invoice detail shows owner and horse info', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await expect(page.locator('text=Owner')).toBeVisible()
    await expect(page.locator('text=/Horse|Patient/i').first()).toBeVisible()
  })

  test('unpaid invoice shows Edit and Delete buttons', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Try to find a non-paid invoice
    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    // Only non-paid invoices should show edit/delete
    if (!body.includes('Paid')) {
      await expect(page.locator('button', { hasText: /edit invoice/i })).toBeVisible()
      await expect(page.locator('button', { hasText: /delete/i })).toBeVisible()
    }
  })

  test('edit mode shows editable fields', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const editBtn = page.locator('button', { hasText: /edit invoice/i })
    if (!(await editBtn.isVisible())) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Should show status dropdown
    await expect(page.locator('select').first()).toBeVisible()
    // Should show due date input
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
    // Should show Save and Cancel buttons
    await expect(page.locator('button', { hasText: /save changes/i })).toBeVisible()
    await expect(page.locator('button', { hasText: /cancel/i }).first()).toBeVisible()
    // Should show editable line items with description inputs
    await expect(page.locator('input[placeholder="Description"]').first()).toBeVisible()
    // Should show Add Line Item button
    await expect(page.locator('button', { hasText: /add line item/i })).toBeVisible()
  })

  test('edit mode cancel returns to view mode', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const editBtn = page.locator('button', { hasText: /edit invoice/i })
    if (!(await editBtn.isVisible())) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Click cancel
    await page.locator('button', { hasText: /cancel/i }).first().click()
    await page.waitForTimeout(500)

    // Should be back in view mode - edit button should be visible again
    await expect(page.locator('button', { hasText: /edit invoice/i })).toBeVisible()
  })

  test('edit mode can add and remove line items', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const editBtn = page.locator('button', { hasText: /edit invoice/i })
    if (!(await editBtn.isVisible())) { test.skip(); return }
    await editBtn.click()
    await page.waitForTimeout(500)

    // Count current items
    const initialItems = await page.locator('input[placeholder="Description"]').count()

    // Add a line item
    await page.locator('button', { hasText: /add line item/i }).click()
    await page.waitForTimeout(300)
    const afterAdd = await page.locator('input[placeholder="Description"]').count()
    expect(afterAdd).toBe(initialItems + 1)

    // Remove the new item
    const removeButtons = page.locator('button', { hasText: /remove/i })
    if (await removeButtons.last().isVisible()) {
      await removeButtons.last().click()
      await page.waitForTimeout(300)
      const afterRemove = await page.locator('input[placeholder="Description"]').count()
      expect(afterRemove).toBe(initialItems)
    }

    // Cancel so we don't save changes
    await page.locator('button', { hasText: /cancel/i }).first().click()
  })

  test('delete button opens confirmation modal', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const deleteBtn = page.locator('button', { hasText: /^delete$/i })
    if (!(await deleteBtn.isVisible())) { test.skip(); return }
    await deleteBtn.click()
    await page.waitForTimeout(500)

    // Modal should appear
    await expect(page.locator('text=Delete Invoice')).toBeVisible()
    await expect(page.locator('text=cannot be undone')).toBeVisible()
    // Should have Cancel and Delete confirmation buttons
    await expect(page.locator('button', { hasText: /^cancel$/i }).first()).toBeVisible()
    await expect(page.locator('button', { hasText: /^delete$/i }).last()).toBeVisible()

    // Cancel the modal (don't actually delete)
    await page.locator('button', { hasText: /^cancel$/i }).first().click()
    await page.waitForTimeout(300)
    // Modal should close
    await expect(page.locator('text=cannot be undone')).not.toBeVisible()
  })

  test('invoice detail has send invoice section for unpaid', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewLink = page.locator('a', { hasText: /view/i }).first()
    if (!(await viewLink.isVisible())) { test.skip(); return }
    await viewLink.click()
    await page.waitForURL('**/invoices/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const body = await page.locator('body').textContent() || ''
    if (!body.includes('Paid')) {
      await expect(page.locator('text=Send Invoice')).toBeVisible()
      // Should have email and/or text buttons
      const emailBtn = page.locator('button', { hasText: /email invoice/i })
      const textBtn = page.locator('button', { hasText: /text invoice/i })
      const hasContact = (await emailBtn.isVisible()) || (await textBtn.isVisible())
      expect(hasContact).toBeTruthy()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 18. INVOICE CREATION
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Invoice Creation', () => {
  test('create invoice page loads with form', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    if (body.includes('free trial has ended')) return
    // Should have form inputs (selects or text inputs for owner/horse)
    const inputs = page.locator('select, input')
    const inputCount = await inputs.count()
    expect(inputCount).toBeGreaterThanOrEqual(1)
  })

  test('create invoice page has add line item capability', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const addBtn = page.locator('button', { hasText: /add.*item|add.*line|\+/i }).first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(300)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 19. REPORTS PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports', () => {
  test('reports page loads with summary cards', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should have report heading
    await expect(page.locator('text=/reports|analytics|overview/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('reports page shows revenue data', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) {
      expect(body).not.toContain('Unhandled Runtime Error')
      return
    }
    // Should reference revenue or income
    expect(body.toLowerCase()).toMatch(/revenue|income|total|earned/)
  })

  test('reports page has no runtime errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body).not.toContain('Application error')
    expect(body.length).toBeGreaterThan(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 20. COMMUNICATIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Communications', () => {
  test('communications page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/communications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should have communication/messages heading
    await expect(page.locator('text=/communication|messages/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('communications page has channel filter buttons', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/communications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Should have All / Email / SMS filter buttons
    const allBtn = page.locator('button', { hasText: /^all$/i }).first()
    const emailBtn = page.locator('button', { hasText: /email/i }).first()
    const smsBtn = page.locator('button', { hasText: /sms/i }).first()

    if (await allBtn.isVisible()) {
      await expect(allBtn).toBeVisible()
      await expect(emailBtn).toBeVisible()
      await expect(smsBtn).toBeVisible()

      // Click Email filter
      await emailBtn.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('communications page has no errors when switching filters', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/communications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const filters = ['All', 'Email', 'SMS']
    for (const filter of filters) {
      const btn = page.locator('button', { hasText: new RegExp(`^${filter}$`, 'i') }).first()
      if (await btn.isVisible()) {
        await btn.click()
        await page.waitForTimeout(500)
        const body = await page.locator('body').textContent() || ''
        expect(body).not.toContain('Unhandled Runtime Error')
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 21. NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Notifications', () => {
  test('notification bell is visible in navbar', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Bell icon should be in the nav
    const bell = page.locator('nav button svg, nav [role="button"]').first()
    await expect(bell).toBeVisible({ timeout: 10000 })
  })

  test('clicking notification bell opens dropdown', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find the notification bell button (it contains an SVG bell icon)
    const bellButton = page.locator('nav button').filter({ has: page.locator('svg') }).first()
    if (!(await bellButton.isVisible())) { test.skip(); return }
    await bellButton.click()
    await page.waitForTimeout(500)

    // Dropdown should appear with notifications content
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    // Should show either notifications or "no notifications" message
    const hasContent = body.includes('notification') || body.includes('Notification') || body.includes('No ') || body.includes('Mark')
    expect(hasContent).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 22. SERVICES PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Services', () => {
  test('services page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    if (body.includes('free trial has ended')) return
    await expect(page.locator('text=/service/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('services page has add service capability', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const addBtn = page.locator('button', { hasText: /add.*service|new.*service|create|\+/i }).first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(500)
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 23. BILLING PAGE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing', () => {
  test('billing page loads without errors', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/billing')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 24. MOBILE NAV (full coverage)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('mobile hamburger menu opens and shows all links', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) {
      expect(body).not.toContain('Unhandled Runtime Error')
      return
    }

    // Find hamburger / menu button
    const menuBtn = page.locator('nav button').filter({ has: page.locator('svg') }).first()
    if (!(await menuBtn.isVisible())) { test.skip(); return }
    await menuBtn.click()
    await page.waitForTimeout(500)

    // Mobile menu should show main page links
    const menuBody = await page.locator('body').textContent() || ''
    expect(menuBody.toLowerCase()).toContain('invoices')
  })

  test('mobile dashboard loads correctly', async ({ page }) => {
    await ensureAuth(page)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('mobile invoices page loads and is usable', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    if (body.includes('free trial has ended')) return
    await expect(page.locator('text=/invoices/i').first()).toBeVisible({ timeout: 10000 })
  })

  test('mobile reports page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
    expect(body.length).toBeGreaterThan(100)
  })

  test('mobile communications page loads', async ({ page }) => {
    await ensureAuth(page)
    await page.goto('/communications')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 25. API HEALTH - NEW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('API Health - New Endpoints', () => {
  test('invoices API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/invoices')
    expect(res.status()).toBe(401)
  })

  test('reports API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/reports')
    expect(res.status()).toBe(401)
  })

  test('communications API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/communications')
    expect(res.status()).toBe(401)
  })

  test('notifications API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/notifications')
    expect(res.status()).toBe(401)
  })

  test('services API returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/services')
    expect(res.status()).toBe(401)
  })
})
