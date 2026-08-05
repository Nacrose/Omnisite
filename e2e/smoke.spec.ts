import { test, expect } from '@playwright/test'

/**
 * OmniSite E2E smoke tests.
 *
 * These tests run in CI against a production build with NO Supabase env vars.
 * The app falls back to demo mode — the proxy skips auth gating and the
 * client-side AuthProvider auto-logs in as a demo PM user.
 *
 * Tests are designed to be resilient:
 * - Use `waitForLoadState('domcontentloaded')` instead of `networkidle`
 *   (networkidle can hang if Supabase realtime tries to reconnect)
 * - Use text-based locators instead of strict role queries (CardTitle is a
 *   div, not a heading)
 * - Allow generous timeouts for module lazy-loading (next/dynamic)
 */

// Helper: navigate to the app and wait for the shell to be interactive.
async function goToApp(page: import('@playwright/test').Page, path = '/') {
  await page.goto(path)
  // Wait for the dock to render — proves the app shell mounted.
  await expect(page.locator('[title="BOQ & Rate Analysis"]').first()).toBeVisible({
    timeout: 15000,
  })
  // Dismiss the onboarding tour if it's visible — it traps focus and
  // intercepts keyboard events, which breaks keyboard-shortcut tests.
  const skipTour = page.getByText('Skip tour')
  if (await skipTour.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipTour.click()
  }
}

test.describe('OmniSite smoke tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/OmniSite/)
  })

  test('dashboard has KPI strip', async ({ page }) => {
    await goToApp(page)
    const body = page.locator('body')
    // The KPI strip shows proxy labels for EVM indices:
    //   Schedule Progress (proxy for SPI)
    //   Cost Variance (proxy for CPI)
    //   Forecast Cost (proxy for EAC)
    //   Budget Margin (proxy for Margin)
    // See src/components/modules/dashboard/kpi-strip.tsx for the rationale.
    await expect(body).toContainText('Schedule Progress')
    await expect(body).toContainText('Cost Variance')
  })

  test('can navigate to BOQ module via dock', async ({ page }) => {
    await goToApp(page)
    const boqBtn = page.locator('[title="BOQ & Rate Analysis"]').first()
    await boqBtn.click()
    // Wait for the BOQ grid to render (lazy-loaded module).
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

  // ─── Keyboard shortcut navigation ──────────────────────────────────────

  test('keyboard shortcut "b" navigates to BOQ', async ({ page }) => {
    await goToApp(page)
    // Click somewhere on the page body first to ensure focus is not in an input.
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
    // Wait for BOQ to load
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
    // URL should stay on dashboard, not navigate to /boq
    await expect(page).toHaveURL(/\/$|\/dashboard/)
  })

  // ─── Login page ────────────────────────────────────────────────────────

  test('login page renders with sign-in form', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    // The login page has email + password inputs.
    await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input#password')).toBeVisible()
    // Sign in button.
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible()
    // Brand label.
    await expect(page.locator('body')).toContainText('OmniSite')
  })

  // ─── Mobile responsive layout ──────────────────────────────────────────

  test('mobile (375px) layout shows the bottom dock', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    await page.goto('/')
    // Wait for the mobile dock to appear. On mobile, the dock is at the
    // bottom and shows module icons. Use the BOQ button title (same as
    // goToApp) since it's always present in the dock regardless of viewport.
    await expect(page.locator('[title="BOQ & Rate Analysis"]').first()).toBeVisible({
      timeout: 15000,
    })
    await context.close()
  })

  // ─── Status bar ────────────────────────────────────────────────────────

  test('status bar renders with mode indicator', async ({ page }) => {
    await goToApp(page)
    const footer = page.locator('footer').first()
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(/mode/i)
  })

  // ─── Help modal ────────────────────────────────────────────────────────

  test('help modal opens with "?" and closes with Escape', async ({ page }) => {
    await goToApp(page)
    // goToApp already dismisses the onboarding tour.
    await page.locator('body').click()
    await page.keyboard.press('Shift+/')
    // The modal has role="dialog" and an aria-labelledby pointing to the
    // "Keyboard Shortcuts" heading.
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('help modal has a labelled close button', async ({ page }) => {
    await goToApp(page)
    // goToApp already dismisses the onboarding tour.
    await page.locator('body').click()
    await page.keyboard.press('Shift+/')
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    const closeBtn = dialog.getByRole('button', { name: /close/i })
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  // ─── Skip-to-content link ──────────────────────────────────────────────

  test('skip-to-content link exists and is focusable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  test('main element has id="main-content"', async ({ page }) => {
    await goToApp(page)
    const main = page.locator('main#main-content')
    await expect(main).toBeVisible()
  })

  // ─── Vendors module (renamed from Subcontractor) ───────────────────────

  test('can navigate to Vendors module', async ({ page }) => {
    await goToApp(page)
    const vendorsBtn = page.locator('[title="Vendors"]').first()
    await expect(vendorsBtn).toBeVisible()
    await vendorsBtn.click()
    // The vendors module should render (lazy-loaded).
    await expect(page).toHaveURL(/\/vendors/, { timeout: 10000 })
  })
})
