import { test, expect } from '@playwright/test';

test.describe('Authenticated routes (storageState)', () => {
  test('can access /watchlist when authenticated', async ({ page }) => {
    await page.goto('/watchlist');

    // If storageState is missing/invalid, Clerk will typically redirect to /sign-in.
    await expect(page).toHaveURL(/\/watchlist(\b|\/|\?|#)/);

    await expect(page.getByRole('heading', { name: 'Watchlist' })).toBeVisible();
  });
});
