import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Basic health check - page should load without errors
    await expect(page).toHaveURL('/');
    
    // Verify page is not in error state
    const errorElements = await page.locator('text=/error|Error|404|not found/i').count();
    expect(errorElements).toBe(0);
    
    // Page should have content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('page has title', async ({ page }) => {
    await page.goto('/');
    
    // Verify page has a title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
