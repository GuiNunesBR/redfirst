import { test, type Page } from '@playwright/test';

declare function verifyHeader(page: Page): Promise<void>;

test('opens the products page', async ({ page }) => { // expect: TL005
  await page.goto('/');
  await page.getByRole('link', { name: 'Products' }).click();
});

test('checks the header through a helper', async ({ page }) => {
  await page.goto('/');
  await verifyHeader(page);
});
