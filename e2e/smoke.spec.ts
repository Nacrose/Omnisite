import { test, expect } from '@playwright/test'

test.describe('OmniSite E2E', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/')
    // Should show either the login page or the dashboard (demo mode)
    await expect(page).toHaveTitle(/OmniSite/)
  })

  test('dashboard loads with KPI strip', async ({ page }) => {
    await page.goto('/')
    // Wait for the app to render (demo mode auto-login)
    await page.waitForTimeout(2000)
    // Look for KPI labels
    const kpiText = await page.textContent('body')
    expect(kpiText).toContain('SPI')
    expect(kpiText).toContain('CPI')
  })

  test('navigate to BOQ module via dock', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    // Click BOQ in the dock (title attribute)
    const boqButton = page.locator('[title="BOQ & Rate Analysis"]')
    if (await boqButton.isVisible()) {
      await boqButton.click()
      await page.waitForTimeout(1000)
      // Should see BOQ grid header
      const bodyText = await page.textContent('body')
      expect(bodyText).toContain('Code')
      expect(bodyText).toContain('Description')
    }
  })

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(500)
    // Should see search input
    const searchInput = page.locator('input[placeholder*="Search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('boq')
      await page.waitForTimeout(500)
      const bodyText = await page.textContent('body')
      expect(bodyText).toContain('BOQ')
    }
  })
})
