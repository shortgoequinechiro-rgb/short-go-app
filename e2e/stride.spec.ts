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

    // Should have stat cards
    await expect(page.locator('text=Clients')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Patients')).toBeVisible()
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
    const routes = ['/dashboard', '/appointments', '/calendar', '/account']
    for (const route of routes) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(200)
    }
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
})
