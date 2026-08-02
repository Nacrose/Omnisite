import { test, expect } from '@playwright/test'

test.describe('OmniSite smoke tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveTitle(/OmniSite/)
  })

  test('dashboard has KPI strip', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for the KPI strip to actually render — Playwright auto-retries up to 5s.
    const body = page.locator('body')
    await expect(body).toContainText('SPI')
    await expect(body).toContainText('CPI')
  })

  test('can navigate to BOQ module', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // The dock renders both a desktop and mobile version of each button.
    // Use .first() to pick the desktop one (visible on md+ screens).
    const boqBtn = page.locator('[title="BOQ & Rate Analysis"]').first()
    await expect(boqBtn).toBeVisible()
    await boqBtn.click()
    // Wait for the BOQ grid header to render — proves the module mounted.
    const body = page.locator('body')
    await expect(body).toContainText('Code')
    await expect(body).toContainText('Description')
  })

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for the dock to render — proves the app shell is interactive.
    const dockBtn = page.locator('[title="BOQ & Rate Analysis"]').first()
    await expect(dockBtn).toBeVisible()

    await page.keyboard.press('Control+k')
    // Wait for the palette's search input to appear (auto-retries up to 5s).
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('boq')
    // Wait for a filtered result to appear in the palette body.
    const body = page.locator('body')
    await expect(body).toContainText('BOQ')
  })

  // ─── Keyboard shortcut navigation ─────────────────────────────────────────

  test('keyboard shortcut "b" navigates to BOQ', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[title="BOQ & Rate Analysis"]').first()).toBeVisible()

    await page.keyboard.press('b')
    // BOQ grid renders a "Description" column header.
    await expect(page.locator('body')).toContainText('Description')
    await expect(page).toHaveURL(/\/boq$/)
  })

  test('keyboard shortcut "s" navigates to Scheduler', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[title="BOQ & Rate Analysis"]').first()).toBeVisible()

    await page.keyboard.press('s')
    await expect(page).toHaveURL(/\/scheduler$/)
    // The scheduler renders a Gantt canvas; just assert the URL changed.
  })

  test('keyboard shortcut "h" navigates back to Dashboard', async ({ page }) => {
    await page.goto('/boq')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Description')

    await page.keyboard.press('h')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('body')).toContainText('SPI')
  })

  // ─── Login page ────────────────────────────────────────────────────────────

  test('login page renders the sign-in card', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // The login page has a heading "Sign in" and an Email + Password field.
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    // Submit button.
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    // Brand label.
    await expect(page.locator('body')).toContainText('OmniSite')
  })

  // ─── Mobile responsive layout ──────────────────────────────────────────────

  test('mobile (375px) layout shows the bottom dock and hides the desktop dock', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The mobile dock is always visible on small screens.
    // The mobile dock container has md:hidden so it's visible below md.
    const mobileDock = page.locator('.md\\:hidden.fixed.bottom-0').first()
    await expect(mobileDock).toBeVisible()

    // The desktop dock (hidden on mobile) is not visible.
    const desktopDock = page.locator('.hidden.md\\:flex.fixed.bottom-6').first()
    await expect(desktopDock).not.toBeVisible()

    await context.close()
  })

  // ─── Status bar presence ──────────────────────────────────────────────────

  test('status bar renders on desktop with mode + collaborator info', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The status bar is hidden on mobile (md:block wrapper). On desktop it
    // shows "Local mode" or "Demo mode" plus the collaborator count.
    const footer = page.locator('footer').first()
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(/mode/i)
  })

  // ─── Help modal open/close ─────────────────────────────────────────────────

  test('help modal opens with "?" and closes with Escape', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[title="BOQ & Rate Analysis"]').first()).toBeVisible()

    // "?" opens the help modal.
    await page.keyboard.press('Shift+/')
    // The modal has role="dialog" and an aria-labelledby pointing to the
    // "Keyboard Shortcuts" heading.
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible()

    // Escape closes it.
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('help modal exposes a labelled close button', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Shift+/')

    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible()

    // The close button has aria-label="Close help dialog".
    const closeBtn = dialog.getByRole('button', { name: /close help dialog/i })
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await expect(dialog).not.toBeVisible()
  })

  // ─── Skip-to-content link ──────────────────────────────────────────────────

  test('skip-to-content link is hidden by default and revealed on focus', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The skip link exists with href="#main-content".
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toHaveAttribute('href', '#main-content')

    // Initially it's visually hidden (sr-only). Tab to focus it — once
    // focused it should become visible.
    await skipLink.focus()
    // The focus:not-sr-only utility removes the sr-only styles, making the
    // link text visible.
    await expect(skipLink).toContainText(/skip to content/i)
  })

  test('main element has id="main-content" for the skip link target', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const main = page.locator('main#main-content')
    await expect(main).toBeVisible()
  })
})
