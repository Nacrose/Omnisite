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
    const boqBtn = page.locator('[title="BOQ & Rate Analysis"]')
    // Wait for the dock button to be visible & stable before clicking.
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
    const dockBtn = page.locator('[title="BOQ & Rate Analysis"]')
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
})
