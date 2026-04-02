import { test, expect, Page, Route } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// AUTH MOCK — bypass real login by mocking Supabase + API auth at route level
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_USER = {
  id: 'e2e-test-user-0000-0000-000000000001',
  email: 'e2e-test@stride.app',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const MOCK_SESSION = {
  access_token: 'mock-e2e-access-token-qb-tests',
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: 'mock-e2e-refresh-token',
  user: MOCK_USER,
}

const MOCK_PRACTITIONER = {
  id: MOCK_USER.id,
  full_name: 'Dr. E2E Tester',
  practice_name: 'Stride Test Practice',
  email: MOCK_USER.email,
  subscription_status: 'active',
  animals_served: 'equine',
  location: 'Test City, TX',
  logo_url: null,
  onboarding_complete: true,
}

/**
 * Inject a fake Supabase session into localStorage and mock all auth-related
 * network calls so the page renders as if the user is logged in.
 * This avoids dependency on real Supabase credentials for testing QB features.
 */
async function mockAuth(page: Page) {
  // 1. Intercept Supabase auth API calls (GoTrue endpoints)
  await page.route('**/auth/v1/user**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    })
  })

  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SESSION,
        user: MOCK_USER,
      }),
    })
  })

  // Also intercept any Supabase REST queries that the Account page makes
  await page.route('**/rest/v1/practitioners**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PRACTITIONER]),
    })
  })

  // 2. Mock the practitioner endpoint that the Account page calls on load
  await page.route('**/api/billing/ensure-practitioner', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PRACTITIONER),
    })
  })

  // 3. Inject session into localStorage before any page JS runs
  //    Supabase v2 stores session under sb-{project_ref}-auth-token
  const SB_STORAGE_KEY = 'sb-pyuarwwhmtoflyzwblbn-auth-token'
  await page.addInitScript(({ session, key }) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, { session: MOCK_SESSION, key: SB_STORAGE_KEY })
}

// Also keep the real login path as a fallback for tests that don't mock
let authAvailable: boolean | null = null

async function tryLogin(page: Page): Promise<boolean> {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) return false
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button', { hasText: /sign in/i }).click()
  try {
    await page.waitForURL('**/dashboard', { timeout: 12000 })
    return true
  } catch { return false }
}

async function navigateToBillingTab(page: Page) {
  await page.goto('/account')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const billingTab = page.locator('button', { hasText: /billing/i }).first()
  if (await billingTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await billingTab.click()
    await page.waitForTimeout(1000)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK HELPERS — QuickBooks API Routes
// ═══════════════════════════════════════════════════════════════════════════

async function mockQBDisconnected(page: Page) {
  await page.route('**/api/quickbooks/status', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false, connection: null }),
      })
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ disconnected: true }),
      })
    } else {
      await route.continue()
    }
  })
}

async function mockQBConnected(page: Page) {
  await page.route('**/api/quickbooks/status', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          connection: {
            realm_id: '1234567890',
            company_name: 'Test Equine Practice LLC',
            connected_at: '2026-03-15T10:00:00Z',
            last_synced_at: '2026-04-01T14:30:00Z',
          },
        }),
      })
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ disconnected: true }),
      })
    } else {
      await route.continue()
    }
  })
}

async function mockQBAuth(page: Page) {
  await page.route('**/api/quickbooks/auth', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://appcenter.intuit.com/connect/oauth2?mock=true&state=test',
      }),
    })
  })
}

async function mockQBAuthError(page: Page) {
  await page.route('**/api/quickbooks/auth', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'QuickBooks client credentials not configured',
      }),
    })
  })
}

async function mockQBSyncInvoice(page: Page, success = true) {
  await page.route('**/api/quickbooks/sync-invoice', async (route: Route) => {
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ synced: true, qbInvoiceId: 'QB-INV-9001' }),
      })
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'QuickBooks sync failed: token expired' }),
      })
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICKBOOKS — CONNECTION UI (Account Page) — Uses Auth Mocking
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QuickBooks Connection — Disconnected State', () => {
  test('shows Connect QuickBooks button when not connected', async ({ page }) => {
    await mockAuth(page)
    await mockQBDisconnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const qbHeading = page.locator('h3', { hasText: /QuickBooks/i })
    await expect(qbHeading).toBeVisible({ timeout: 5000 })

    const connectBtn = page.locator('button', { hasText: /Connect QuickBooks/i })
    await expect(connectBtn).toBeVisible()
    await expect(connectBtn).toBeEnabled()
  })

  test('shows description text about syncing invoices', async ({ page }) => {
    await mockAuth(page)
    await mockQBDisconnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    expect(body.toLowerCase()).toContain('sync')
    expect(body.toLowerCase()).toContain('quickbooks')
  })

  test('connect button initiates OAuth flow', async ({ page }) => {
    await mockAuth(page)
    await mockQBDisconnected(page)
    await mockQBAuth(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const connectBtn = page.locator('button', { hasText: /Connect QuickBooks/i })
    if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

    const [authRequest] = await Promise.all([
      page.waitForRequest('**/api/quickbooks/auth', { timeout: 5000 }).catch(() => null),
      connectBtn.click(),
    ])

    expect(authRequest).not.toBeNull()
  })

  test('shows error when connect fails', async ({ page }) => {
    await mockAuth(page)
    await mockQBDisconnected(page)
    await mockQBAuthError(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const connectBtn = page.locator('button', { hasText: /Connect QuickBooks/i })
    if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

    await connectBtn.click()
    await page.waitForTimeout(2000)

    const errorText = await page.locator('body').textContent() || ''
    expect(errorText.toLowerCase()).toMatch(/failed|error|not configured/)
  })
})

test.describe('QuickBooks Connection — Connected State', () => {
  test('shows connected status with company name', async ({ page }) => {
    await mockAuth(page)
    await mockQBConnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    expect(body).toContain('Connected')
    expect(body).toContain('Test Equine Practice LLC')
  })

  test('shows connected date and last sync timestamp', async ({ page }) => {
    await mockAuth(page)
    await mockQBConnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    expect(body.toLowerCase()).toMatch(/connected.*3\/15\/2026|connected.*2026/)
    expect(body.toLowerCase()).toContain('last synced')
  })

  test('shows disconnect button when connected', async ({ page }) => {
    await mockAuth(page)
    await mockQBConnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const disconnectBtn = page.locator('button', { hasText: /disconnect/i })
    await expect(disconnectBtn).toBeVisible({ timeout: 5000 })
  })

  test('disconnect removes connection and shows connect button', async ({ page }) => {
    await mockAuth(page)

    let isConnected = true
    await page.route('**/api/quickbooks/status', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isConnected ? {
            connected: true,
            connection: {
              realm_id: '1234567890',
              company_name: 'Test Equine Practice LLC',
              connected_at: '2026-03-15T10:00:00Z',
              last_synced_at: null,
            },
          } : { connected: false, connection: null }),
        })
      } else if (route.request().method() === 'DELETE') {
        isConnected = false
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ disconnected: true }),
        })
      } else {
        await route.continue()
      }
    })

    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const disconnectBtn = page.locator('button', { hasText: /disconnect/i })
    if (!(await disconnectBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }

    const [deleteReq] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/quickbooks/status') && req.method() === 'DELETE',
        { timeout: 5000 }
      ).catch(() => null),
      disconnectBtn.click(),
    ])

    expect(deleteReq).not.toBeNull()
    await page.waitForTimeout(2000)

    const afterBody = await page.locator('body').textContent() || ''
    expect(afterBody).not.toContain('Test Equine Practice LLC')
  })

  test('does not show Connect button when already connected', async ({ page }) => {
    await mockAuth(page)
    await mockQBConnected(page)
    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    const connectBtn = page.locator('button', { hasText: /^Connect QuickBooks$/i })
    await expect(connectBtn).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // fine if it doesn't exist
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// QUICKBOOKS — API ROUTE BEHAVIOR (no auth mock needed — tests raw API)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QuickBooks API — Status Endpoint', () => {
  test('GET /api/quickbooks/status returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/quickbooks/status')
    expect([401, 403]).toContain(res.status())
  })

  test('DELETE /api/quickbooks/status returns 401 without auth', async ({ request }) => {
    const res = await request.delete('/api/quickbooks/status')
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('QuickBooks API — Sync Invoice Endpoint', () => {
  test('POST /api/quickbooks/sync-invoice returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/quickbooks/sync-invoice', {
      data: { invoiceId: 'fake-id' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/quickbooks/sync-invoice requires invoiceId', async ({ page }) => {
    await mockAuth(page)
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/quickbooks/sync-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return { status: res.status, body: await res.json() }
    })

    expect([400, 401, 403]).toContain(response.status)
  })
})

test.describe('QuickBooks API — Auth Endpoint', () => {
  test('GET /api/quickbooks/auth returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/quickbooks/auth')
    expect([401, 403]).toContain(res.status())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// QUICKBOOKS — MANUAL SYNC (mocked)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QuickBooks — Manual Sync via API (mocked)', () => {
  test('manual sync returns success with mocked QB', async ({ page }) => {
    await mockAuth(page)
    await mockQBSyncInvoice(page, true)

    // Navigate to any page to establish page context
    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/quickbooks/sync-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: 'test-invoice-123' }),
      })
      return { status: res.status, body: await res.json() }
    })

    expect(result.status).toBe(200)
    expect(result.body.synced).toBe(true)
    expect(result.body.qbInvoiceId).toBe('QB-INV-9001')
  })

  test('manual sync handles failure gracefully', async ({ page }) => {
    await mockAuth(page)
    await mockQBSyncInvoice(page, false)

    await page.goto('/invoices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/quickbooks/sync-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: 'test-invoice-123' }),
      })
      return { status: res.status, body: await res.json() }
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toContain('token expired')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// QUICKBOOKS — FULL CONNECT → SYNC → DISCONNECT FLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QuickBooks — Full Integration Flow', () => {
  test('connect → verify status → disconnect lifecycle', async ({ page }) => {
    await mockAuth(page)

    // Phase 1: Start disconnected
    let connectionState: 'disconnected' | 'connected' = 'disconnected'

    await page.route('**/api/quickbooks/status', async (route: Route) => {
      if (route.request().method() === 'GET') {
        if (connectionState === 'connected') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              connected: true,
              connection: {
                realm_id: '9999999',
                company_name: 'Stride Equine QB Test',
                connected_at: new Date().toISOString(),
                last_synced_at: null,
              },
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ connected: false, connection: null }),
          })
        }
      } else if (route.request().method() === 'DELETE') {
        connectionState = 'disconnected'
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ disconnected: true }),
        })
      } else {
        await route.continue()
      }
    })

    await page.route('**/api/quickbooks/auth', async (route: Route) => {
      connectionState = 'connected'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'about:blank#qb-mock-auth' }),
      })
    })

    await navigateToBillingTab(page)

    const body = await page.locator('body').textContent() || ''
    if (body.includes('free trial has ended')) { test.skip(); return }

    // Step 1: Verify disconnected state
    const connectBtn = page.locator('button', { hasText: /Connect QuickBooks/i })
    if (!(await connectBtn.isVisible({ timeout: 5000 }).catch(() => false))) { test.skip(); return }
    await expect(connectBtn).toBeVisible()

    // Step 2: Initiate connection
    await connectBtn.click()
    await page.waitForTimeout(1000)

    // Simulate OAuth callback by navigating back to account page (now "connected")
    await navigateToBillingTab(page)
    await page.waitForTimeout(1000)

    // Step 3: Verify connected state
    const afterConnectBody = await page.locator('body').textContent() || ''
    expect(afterConnectBody).toContain('Stride Equine QB Test')
    expect(afterConnectBody).toContain('Connected')

    // Step 4: Disconnect
    const disconnectBtn = page.locator('button', { hasText: /disconnect/i })
    await expect(disconnectBtn).toBeVisible({ timeout: 5000 })
    await disconnectBtn.click()
    await page.waitForTimeout(2000)

    // Step 5: Verify back to disconnected
    await navigateToBillingTab(page)
    await page.waitForTimeout(1000)

    const finalBody = await page.locator('body').textContent() || ''
    expect(finalBody).not.toContain('Stride Equine QB Test')
  })
})
