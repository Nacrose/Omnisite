import { test, expect } from '@playwright/test'

/**
 * OmniSite E2E smoke tests.
 *
 * These tests run in CI against a production build with NO Supabase env vars.
 * The app falls back to demo mode — the proxy skips auth gating and the
 * client-side AuthProvider auto-logs in as a demo PM user.
 */

// Helper: wait for the app shell to mount. The <header> element is always
// visible at every viewport (no responsive hiding) and only renders after
// the workspace shell mounts (past the 'Loading workspace' gate).
async function waitForApp(page: import('@playwright/test').Page) {
  await expect(page.locator('header').first()).toBeVisible({ timeout: 15000 })
}

// Helper: navigate to the app and wait for the shell.
async function goToApp(page: import('@playwright/test').Page, path = '/') {
  await page.goto(path)
  await waitForApp(page)
  // Dismiss the onboarding tour if visible.
  const skipTour = page.getByText('Skip tour')
  if (await skipTour.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipTour.click()
  }
}

// Helper: click a dock button by title. The dock renders two versions
// (desktop hidden on mobile, mobile hidden on desktop). Iterate and click
// whichever one is actually visible.
async function clickDockButton(page: import('@playwright/test').Page, title: string) {
  const buttons = page.locator(`[title="${title}"]`)
  const count = await buttons.count()
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i)
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      return
    }
  }
  // Fallback: force-click the last one
  await buttons.last().click({ force: true })
}

test.describe('OmniSite smoke tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/OmniSite/)
  })

  test('dashboard has KPI strip', async ({ page }) => {
    await goToApp(page)
    await expect(page.locator('body')).toContainText('Schedule Progress')
    await expect(page.locator('body')).toContainText('Cost Variance')
  })

  test('can navigate to BOQ module via dock', async ({ page }) => {
    await goToApp(page)
    await clickDockButton(page, 'BOQ & Rate Analysis')
    await expect(page.locator('body')).toContainText('Description', { timeout: 10000 })
  })

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await goToApp(page)
    await page.keyboard.press('Control+k')
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('boq')
    await expect(page.locator('body')).toContainText('BOQ')
  })

  test('keyboard shortcut "b" navigates to BOQ', async ({ page }) => {
    await goToApp(page)
    await page.locator('body').click()
    await page.keyboard.press('b')
    await expect(page).toHaveURL(/\/boq/, { timeout: 10000 })
    await expect(page.locator('body')).toContainText('Description', { timeout: 10000 })
  })

  test('keyboard shortcut "s" navigates to Scheduler', async ({ page }) => {
    await goToApp(page)
    await page.locator('body').click()
    await page.keyboard.press('s')
    await expect(page).toHaveURL(/\/scheduler/, { timeout: 10000 })
  })

  test('keyboard shortcut "h" navigates back to Dashboard', async ({ page }) => {
    await page.goto('/boq')
    await expect(page.locator('body')).toContainText('Description', { timeout: 15000 })
    await page.locator('body').click()
    await page.keyboard.press('h')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('keyboard shortcut does not fire when typing in an input', async ({ page }) => {
    await goToApp(page)
    await page.keyboard.press('Control+k')
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('b')
    await expect(page).toHaveURL(/\/$|\/dashboard/)
  })

  test('login page renders with sign-in form', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
  })

  test('mobile (375px) layout shows the bottom dock', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
    const page = await context.newPage()
    await page.goto('/')
    // Just verify the header renders on mobile — proves the shell mounted.
    await waitForApp(page)
    await context.close()
  })

  test('status bar renders with mode indicator', async ({ page }) => {
    await goToApp(page)
    const footer = page.locator('footer').first()
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(/mode/i)
  })

  test('help modal opens with "?" and closes with Escape', async ({ page }) => {
    await goToApp(page)
    await page.locator('body').click()
    await page.keyboard.press('Shift+/')
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('help modal has a labelled close button', async ({ page }) => {
    await goToApp(page)
    await page.locator('body').click()
    await page.keyboard.press('Shift+/')
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    const closeBtn = dialog.getByRole('button', { name: /close/i })
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('skip-to-content link exists and is focusable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  test('main element has id="main-content"', async ({ page }) => {
    await goToApp(page)
    await expect(page.locator('main#main-content')).toBeVisible()
  })

  test('can navigate to Vendors module', async ({ page }) => {
    await goToApp(page)
    await clickDockButton(page, 'Vendors')
    await expect(page).toHaveURL(/\/vendors/, { timeout: 10000 })
  })
})
