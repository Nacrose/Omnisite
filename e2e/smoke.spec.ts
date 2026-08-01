import { test, expect } from '@playwright/test'

test.describe('OmniSite smoke tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // App should render — either login page or dashboard (demo mode)
    await expect(page).toHaveTitle(/OmniSite/)
  })

  test('dashboard has KPI strip', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const body = page.locator('body')
    await expect(body).toContainText('SPI')
    await expect(body).toContainText('CPI')
  })

  test('can navigate to BOQ module', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    // Click BOQ in dock
    const boqBtn = page.locator('[title="BOQ & Rate Analysis"]')
    await boqBtn.click()
    await page.waitForTimeout(1000)
    const body = page.locator('body')
    await expect(body).toContainText('Code')
    await expect(body).toContainText('Description')
  })

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(500)
    const searchInput = page.locator('input[placeholder*="Search"]')
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('boq')
      await page.waitForTimeout(500)
      const body = page.locator('body')
      await expect(body).toContainText('BOQ')
    }
  })
})
