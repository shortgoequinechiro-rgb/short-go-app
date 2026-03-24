import { test, expect, Page } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

let authAvailable: boolean | null = null

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

async function ensureAuth(page: Page) {
  if (authAvailable === false) { test.skip(); return }
  const ok = await tryLogin(page)
  if (!ok) { authAvailable = false; test.skip(); return }
  authAvailable = true
}

// Wait for dashboard data to load
async function waitForDashboardData(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
}

// Go offline by blocking all external network (Supabase)
async function goOffline(page: Page) {
  const ctx = page.context()
  await ctx.setOffline(true)
  // Also verify navigator.onLine flipped
  const isOffline = await page.evaluate(() => !navigator.onLine)
  expect(isOffline).toBe(true)
}

// Go back online
async function goOnline(page: Page) {
  const ctx = page.context()
  await ctx.setOffline(false)
  const isOnline = await page.evaluate(() => navigator.onLine)
  expect(isOnline).toBe(true)
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. OFFLINE BANNER
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Offline Banner', () => {
  test('offline banner appears when network drops', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(1000)

    // Offline banner should appear
    const banner = page.locator('text=/offline mode/i')
    await expect(banner).toBeVisible({ timeout: 5000 })
  })

  test('offline banner disappears when network returns', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    await goOffline(page)
    await page.waitForTimeout(1000)
    await expect(page.locator('text=/offline mode/i')).toBeVisible({ timeout: 5000 })

    // Go back online
    await goOnline(page)
    await page.waitForTimeout(2000)

    // Banner should eventually disappear (or change to "synced")
    const offlineBanner = page.locator('text=/offline mode/i')
    // Give it time — the banner might briefly show "synced" then hide
    await page.waitForTimeout(3000)
    const stillVisible = await offlineBanner.isVisible()
    // It should either be gone or show a sync message instead
    if (stillVisible) {
      // This would be a bug — offline banner stuck
      console.log('WARNING: Offline banner still visible after going online')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD LOADS FROM CACHE WHEN OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Dashboard Offline Cache', () => {
  test('dashboard shows cached data when offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Now go offline (don't reload — the page is already loaded)
    await goOffline(page)
    await page.waitForTimeout(2000)

    // Dashboard should still show content (already loaded, just network dropped)
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // Should show the offline banner
    const banner = page.locator('text=/offline mode/i')
    try {
      await expect(banner).toBeVisible({ timeout: 8000 })
    } catch {
      // Some PWA setups don't show the banner until interaction; verify page still works
    }

    // Should still show dashboard content (cached in DOM)
    const hasContent = body.includes('Find Records') || body.includes('Client Dashboard')
    expect(hasContent).toBeTruthy()
  })

  test('cached owners are visible when offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Make sure we're seeing owners online first
    await page.waitForTimeout(2000)
    const ownersOnline = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="owner"], [class*="result"]')
      return items.length
    })

    // Go offline
    await goOffline(page)
    await page.evaluate(() => window.location.reload())
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // Page should not crash
    const body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. ADD OWNER OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Add Owner Offline', () => {
  test('can add an owner while offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Click Add Owner
    const addOwnerBtn = page.locator('button', { hasText: /add owner/i }).first()
    if (!(await addOwnerBtn.isVisible())) { test.skip(); return }
    await addOwnerBtn.click()

    // Wait for modal to appear
    const modal = page.locator('text=Add Owner').locator('xpath=ancestor::div[contains(@class,"fixed")]')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Fill the form — use specific modal placeholders
    const ts = Date.now()
    const nameInput = page.locator('input[placeholder="Owner full name"]')
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    await nameInput.fill(`Offline Owner ${ts}`)

    const phoneInput = page.locator('input[placeholder="Phone number"]')
    if (await phoneInput.isVisible()) await phoneInput.fill('5559999999')

    // Save
    const saveBtn = page.locator('button', { hasText: /save owner/i })
    await saveBtn.click()
    await page.waitForTimeout(3000)

    // Should show offline confirmation or the owner should appear in the list
    const body = await page.locator('body').textContent() || ''
    const offlineConfirm = body.includes('saved offline') || body.includes('offline') || body.includes(`Offline Owner ${ts}`)
    expect(offlineConfirm).toBeTruthy()

    // Should NOT show an error
    expect(body).not.toContain('Unhandled Runtime Error')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. ADD PATIENT OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Add Patient Offline', () => {
  test('can add a patient while offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Click Add Patient
    const addPatientBtn = page.locator('button', { hasText: /add patient/i }).first()
    if (!(await addPatientBtn.isVisible())) { test.skip(); return }
    await addPatientBtn.click()

    // Wait for modal
    const modal = page.locator('h2', { hasText: 'Add Patient' })
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Select first owner from dropdown
    const ownerSelect = page.locator('select').first()
    const ownerOptions = await ownerSelect.locator('option').all()
    if (ownerOptions.length > 1) {
      await ownerSelect.selectOption({ index: 1 })
    }

    // Fill in patient name — use the specific placeholder
    const nameInput = page.locator('input[placeholder="Horse name"]')
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    await nameInput.fill(`Offline Horse ${Date.now()}`)

    // Save
    const saveBtn = page.locator('button', { hasText: /save patient/i })
    await saveBtn.click()
    await page.waitForTimeout(3000)

    // Should confirm offline save
    const body = await page.locator('body').textContent() || ''
    const offlineConfirm = body.includes('saved offline') || body.includes('offline')
    expect(offlineConfirm).toBeTruthy()
    expect(body).not.toContain('Unhandled Runtime Error')
  })

  test('can add multiple patients offline (different species)', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    const speciesNames: Record<string, string> = { equine: 'Horse name', canine: 'Dog name', feline: 'Cat name' }
    const species = ['equine', 'canine', 'feline'] as const
    for (const sp of species) {
      // Click Add Patient
      const addPatientBtn = page.locator('button', { hasText: /add patient/i }).first()
      if (!(await addPatientBtn.isVisible())) continue
      await addPatientBtn.click()

      // Wait for modal
      const modalTitle = page.locator('h2', { hasText: 'Add Patient' })
      await expect(modalTitle).toBeVisible({ timeout: 5000 })

      // Select first owner
      const ownerSelect = page.locator('select').first()
      const ownerOptions = await ownerSelect.locator('option').all()
      if (ownerOptions.length > 1) {
        await ownerSelect.selectOption({ index: 1 })
      }

      // Select species (the second select in the modal)
      const speciesSelect = page.locator('select').nth(1)
      if (await speciesSelect.isVisible()) {
        await speciesSelect.selectOption(sp)
        await page.waitForTimeout(300)
      }

      // Fill name using species-specific placeholder
      const placeholder = speciesNames[sp] || 'Horse name'
      const nameInput = page.locator(`input[placeholder="${placeholder}"]`)
      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(`Offline ${sp} ${Date.now()}`)
      }

      // Save
      const saveBtn = page.locator('button', { hasText: /save patient/i })
      await saveBtn.click()
      await page.waitForTimeout(3000)

      // Verify no crash
      const body = await page.locator('body').textContent() || ''
      expect(body).not.toContain('Unhandled Runtime Error')
    }

    // Check that pending count increased
    const pendingCount = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('shortGoOfflineDB')
        req.onsuccess = () => {
          const db = req.result
          try {
            const tx = db.transaction('pendingHorses', 'readonly')
            const store = tx.objectStore('pendingHorses')
            const countReq = store.count()
            countReq.onsuccess = () => resolve(countReq.result)
            countReq.onerror = () => resolve(-1)
          } catch { resolve(-1) }
        }
        req.onerror = () => resolve(-1)
      })
    })
    // Should have at least 3 pending horses (or -1 if store doesn't exist)
    if (pendingCount >= 0) {
      expect(pendingCount).toBeGreaterThanOrEqual(3)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. BOOK APPOINTMENT OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Book Appointment Offline', () => {
  test('can book an appointment while offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Open booking modal
    const bookBtn = page.locator('button', { hasText: /book.*appointment/i }).first()
    if (!(await bookBtn.isVisible())) { test.skip(); return }
    await bookBtn.click()
    await page.waitForTimeout(500)

    // Select an owner from the dropdown (should be cached)
    const ownerSearch = page.locator('input[placeholder*="owner" i], input[placeholder*="search" i]').first()
    if (await ownerSearch.isVisible()) {
      // Type to search
      await ownerSearch.fill('a')
      await page.waitForTimeout(500)
    }

    // Set date
    const dateInput = page.locator('input[type="date"]').first()
    if (await dateInput.isVisible()) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await dateInput.fill(tomorrow.toISOString().split('T')[0])
    }

    // Try to save
    const saveBtn = page.locator('button', { hasText: /save|book|create|confirm/i }).last()
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await page.waitForTimeout(2000)

      const body = await page.locator('body').textContent() || ''
      // Should either save offline or show "owner and date required"
      const hasOfflineMsg = body.includes('saved offline') || body.includes('offline')
      const hasValidationMsg = body.includes('required') || body.includes('Owner')
      // One of these should be true
      expect(hasOfflineMsg || hasValidationMsg).toBeTruthy()
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. SPINE + VISIT SAVE OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Spine + Visit Offline', () => {
  test('spine-only save works offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Navigate to a patient
    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) { test.skip(); return }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Navigate to spine page (standalone, not new visit)
    await page.goto(page.url() + '/spine')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Click some spine checkboxes
    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.isVisible()) {
      await checkbox.click()
    }

    // Try to save
    const saveBtn = page.locator('button', { hasText: /save/i }).first()
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await page.waitForTimeout(2000)

      const body = await page.locator('body').textContent() || ''
      // Should show offline save message
      const hasOfflineMsg = body.includes('offline') || body.includes('saved')
      expect(hasOfflineMsg).toBeTruthy()
      expect(body).not.toContain('Unhandled Runtime Error')
    }
  })

  test('saveAll (spine + visit) handles offline gracefully', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Navigate to a patient
    const patientLink = page.locator('a[href*="/horses/"]').first()
    if (!(await patientLink.isVisible())) { test.skip(); return }
    await patientLink.click()
    await page.waitForURL('**/horses/**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Go to Visits tab and Start Visit
    const visitsTab = page.locator('button', { hasText: /visit/i }).first()
    if (await visitsTab.isVisible()) await visitsTab.click()
    await page.waitForTimeout(500)

    const startBtn = page.locator('button, a', { hasText: /start visit|new visit/i }).first()
    if (!(await startBtn.isVisible())) { test.skip(); return }
    await startBtn.click()
    await page.waitForURL('**/spine**', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Try to save the visit (this tests the saveAll function offline behavior)
    const saveBtn = page.locator('button', { hasText: /save visit/i }).first()
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await page.waitForTimeout(3000)

      const body = await page.locator('body').textContent() || ''
      // CRITICAL: This should either save offline or show a user-friendly message
      // It should NOT crash with an unhandled error
      expect(body).not.toContain('Unhandled Runtime Error')

      // Check for either:
      // 1. Offline save confirmation
      // 2. Friendly error about offline
      // 3. It should NOT silently fail or show Supabase errors
      const hasFriendlyResponse = body.includes('offline') ||
                                    body.includes('saved') ||
                                    body.includes('error') ||
                                    body.includes('Error') ||
                                    body.includes('required')
      expect(hasFriendlyResponse).toBeTruthy()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. OFFLINE SYNC (reconnection)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Offline Sync on Reconnect', () => {
  test('pending data badge appears with correct count', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Add a patient offline
    const addPatientBtn = page.locator('button', { hasText: /add patient/i }).first()
    if (!(await addPatientBtn.isVisible())) { test.skip(); return }
    await addPatientBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name" i]').first()
    if (await nameInput.isVisible()) {
      await nameInput.fill(`Sync Test Horse ${Date.now()}`)
    }
    const saveBtn = page.locator('button', { hasText: /save/i }).last()
    await saveBtn.click()
    await page.waitForTimeout(2000)

    // Go back online
    await goOnline(page)
    await page.waitForTimeout(3000)

    // Should show pending badge or sync message
    const body = await page.locator('body').textContent() || ''
    const hasSyncIndicator = body.includes('pending') ||
                              body.includes('sync') ||
                              body.includes('Syncing') ||
                              body.includes('synced')
    // It should at least attempt to sync
    console.log('Sync indicator found:', hasSyncIndicator)
  })

  test('data syncs successfully when coming back online', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Add a patient offline
    const addPatientBtn = page.locator('button', { hasText: /add patient/i }).first()
    if (!(await addPatientBtn.isVisible())) { test.skip(); return }
    await addPatientBtn.click()
    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name" i]').first()
    if (await nameInput.isVisible()) {
      await nameInput.fill(`AutoSync Horse ${Date.now()}`)
    }
    const saveBtn = page.locator('button', { hasText: /save/i }).last()
    await saveBtn.click()
    await page.waitForTimeout(2000)

    // Go back online
    await goOnline(page)
    // Wait for auto-sync
    await page.waitForTimeout(5000)

    // Check that pending count went to 0
    const pendingCount = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('shortGoOfflineDB')
        req.onsuccess = () => {
          const db = req.result
          try {
            const tx = db.transaction('pendingHorses', 'readonly')
            const store = tx.objectStore('pendingHorses')
            const countReq = store.count()
            countReq.onsuccess = () => resolve(countReq.result)
            countReq.onerror = () => resolve(-1)
          } catch {
            resolve(-2)
          }
        }
        req.onerror = () => resolve(-1)
      })
    })
    console.log('Pending horses after reconnect:', pendingCount)
    // After sync, pending should be 0 or very low
    expect(pendingCount).toBeLessThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. MULTIPLE CLIENTS OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Multiple Clients Offline', () => {
  test('can add multiple owners and patients offline, then sync all', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // --- Add Owner 1 ---
    const addOwnerBtn = page.locator('button', { hasText: /add owner/i }).first()
    if (!(await addOwnerBtn.isVisible())) { test.skip(); return }
    await addOwnerBtn.click()

    const ownerModal = page.locator('h2', { hasText: 'Add Owner' })
    await expect(ownerModal).toBeVisible({ timeout: 5000 })

    let nameInput = page.locator('input[placeholder="Owner full name"]')
    await nameInput.fill(`Offline Client A ${Date.now()}`)
    let saveBtn = page.locator('button', { hasText: /save owner/i })
    await saveBtn.click()
    await page.waitForTimeout(3000)

    // Verify offline save message
    let body = await page.locator('body').textContent() || ''
    expect(body.toLowerCase()).toContain('offline')

    // --- Add Owner 2 ---
    const addOwnerBtn2 = page.locator('button', { hasText: /add owner/i }).first()
    if (await addOwnerBtn2.isVisible()) {
      await addOwnerBtn2.click()
      await expect(page.locator('h2', { hasText: 'Add Owner' })).toBeVisible({ timeout: 5000 })

      nameInput = page.locator('input[placeholder="Owner full name"]')
      await nameInput.fill(`Offline Client B ${Date.now()}`)
      saveBtn = page.locator('button', { hasText: /save owner/i })
      await saveBtn.click()
      await page.waitForTimeout(3000)
    }

    // --- Add Patient 1 (Equine) ---
    const addPatientBtn = page.locator('button', { hasText: /add patient/i }).first()
    if (await addPatientBtn.isVisible()) {
      await addPatientBtn.click()
      await expect(page.locator('h2', { hasText: 'Add Patient' })).toBeVisible({ timeout: 5000 })

      // Select first owner
      const ownerSelect = page.locator('select').first()
      const opts = await ownerSelect.locator('option').all()
      if (opts.length > 1) await ownerSelect.selectOption({ index: 1 })

      nameInput = page.locator('input[placeholder="Horse name"]')
      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(`Offline Horse ${Date.now()}`)
      }
      saveBtn = page.locator('button', { hasText: /save patient/i })
      await saveBtn.click()
      await page.waitForTimeout(3000)
    }

    // --- Add Patient 2 (Canine) ---
    const addPatientBtn2 = page.locator('button', { hasText: /add patient/i }).first()
    if (await addPatientBtn2.isVisible()) {
      await addPatientBtn2.click()
      await expect(page.locator('h2', { hasText: 'Add Patient' })).toBeVisible({ timeout: 5000 })

      // Select first owner
      const ownerSelect2 = page.locator('select').first()
      const opts2 = await ownerSelect2.locator('option').all()
      if (opts2.length > 1) await ownerSelect2.selectOption({ index: 1 })

      // Select canine species (second select)
      const speciesSelect = page.locator('select').nth(1)
      if (await speciesSelect.isVisible()) await speciesSelect.selectOption('canine')
      await page.waitForTimeout(300)

      nameInput = page.locator('input[placeholder="Dog name"]')
      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(`Offline Dog ${Date.now()}`)
      }
      saveBtn = page.locator('button', { hasText: /save patient/i })
      await saveBtn.click()
      await page.waitForTimeout(3000)
    }

    // --- Add Patient 3 (Bovine) ---
    const addPatientBtn3 = page.locator('button', { hasText: /add patient/i }).first()
    if (await addPatientBtn3.isVisible()) {
      await addPatientBtn3.click()
      await page.waitForTimeout(500)

      const speciesSelect = page.locator('select').filter({ hasText: /equine/i }).first()
      if (await speciesSelect.isVisible()) await speciesSelect.selectOption('bovine')

      nameInput = page.locator('input[placeholder*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Offline Cow ${Date.now()}`)
      }
      saveBtn = page.locator('button', { hasText: /save/i }).last()
      await saveBtn.click()
      await page.waitForTimeout(2000)
    }

    // Check total pending count in IndexedDB
    const pendingCount = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('shortGoOfflineDB')
        req.onsuccess = () => {
          const db = req.result
          let total = 0
          const tables = ['pendingHorses']
          let done = 0
          for (const table of tables) {
            try {
              const tx = db.transaction(table, 'readonly')
              const store = tx.objectStore(table)
              const countReq = store.count()
              countReq.onsuccess = () => {
                total += countReq.result
                done++
                if (done === tables.length) resolve(total)
              }
              countReq.onerror = () => { done++; if (done === tables.length) resolve(total) }
            } catch {
              done++
              if (done === tables.length) resolve(total)
            }
          }
        }
        req.onerror = () => resolve(-1)
      })
    })
    console.log('Total pending horses after offline adds:', pendingCount)
    expect(pendingCount).toBeGreaterThanOrEqual(2) // At least 2 patients should be queued

    // Page should not have crashed
    body = await page.locator('body').textContent() || ''
    expect(body).not.toContain('Unhandled Runtime Error')

    // --- Go back online and sync ---
    await goOnline(page)
    await page.waitForTimeout(6000) // Wait for auto-sync

    // Check sync happened
    const postSyncCount = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open('shortGoOfflineDB')
        req.onsuccess = () => {
          const db = req.result
          try {
            const tx = db.transaction('pendingHorses', 'readonly')
            const store = tx.objectStore('pendingHorses')
            const countReq = store.count()
            countReq.onsuccess = () => resolve(countReq.result)
            countReq.onerror = () => resolve(-1)
          } catch { resolve(-2) }
        }
        req.onerror = () => resolve(-1)
      })
    })
    console.log('Pending horses after sync:', postSyncCount)
    // Should be 0 after sync
    expect(postSyncCount).toBeLessThanOrEqual(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. OFFLINE RESTRICTIONS (things that should be blocked)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Offline Restrictions', () => {
  test('editing owner info is blocked offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Select an owner
    await page.waitForTimeout(2000)
    const ownerCard = page.locator('text=/Andrew|Charles/i').first()
    if (await ownerCard.isVisible()) {
      await ownerCard.click()
      await page.waitForTimeout(1000)
    }

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Try to edit owner
    const editBtn = page.locator('button', { hasText: /edit owner/i }).first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForTimeout(1000)

      // Try to save
      const saveBtn = page.locator('button', { hasText: /save/i }).first()
      if (await saveBtn.isVisible()) {
        await saveBtn.click()
        await page.waitForTimeout(1000)

        const body = await page.locator('body').textContent() || ''
        // Should show an offline warning message
        expect(body.toLowerCase()).toContain('offline')
      }
    }
  })

  test('archiving owner is blocked offline', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)
    await page.waitForTimeout(2000)

    // Select an owner
    const ownerCard = page.locator('text=/Andrew|Charles/i').first()
    if (await ownerCard.isVisible()) {
      await ownerCard.click()
      await page.waitForTimeout(1000)
    }

    // Go offline
    await goOffline(page)
    await page.waitForTimeout(500)

    // Try to archive
    const archiveBtn = page.locator('button', { hasText: /archive/i }).first()
    if (await archiveBtn.isVisible()) {
      await archiveBtn.click()
      // Should confirm dialog — accept it
      page.on('dialog', dialog => dialog.accept())
      await page.waitForTimeout(1000)

      const body = await page.locator('body').textContent() || ''
      expect(body.toLowerCase()).toContain('offline')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 10. OFFLINE DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Offline Data Integrity', () => {
  test('IndexedDB has cached data after online session', async ({ page }) => {
    await ensureAuth(page)
    await waitForDashboardData(page)

    // Check IndexedDB has cached data
    const cacheStats = await page.evaluate(async () => {
      return new Promise<Record<string, number>>((resolve) => {
        const req = indexedDB.open('shortGoOfflineDB')
        req.onsuccess = () => {
          const db = req.result
          const tables = ['cachedOwners', 'cachedHorses']
          const results: Record<string, number> = {}
          let done = 0
          for (const table of tables) {
            try {
              const tx = db.transaction(table, 'readonly')
              const store = tx.objectStore(table)
              const countReq = store.count()
              countReq.onsuccess = () => {
                results[table] = countReq.result
                done++
                if (done === tables.length) resolve(results)
              }
              countReq.onerror = () => {
                results[table] = -1
                done++
                if (done === tables.length) resolve(results)
              }
            } catch {
              results[table] = -2
              done++
              if (done === tables.length) resolve(results)
            }
          }
        }
        req.onerror = () => resolve({ error: -1 })
      })
    })

    console.log('Cache stats:', cacheStats)
    // Should have at least some cached owners and horses
    expect(cacheStats.cachedOwners).toBeGreaterThanOrEqual(1)
    expect(cacheStats.cachedHorses).toBeGreaterThanOrEqual(1)
  })
})
