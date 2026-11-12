import { test, expect } from '@playwright/test';

test('shows the product', async ({ page }) => { // expect: TL006
  await page.goto('/products/1');
  await expect(page.getByTestId('product')).toBeVisible();
  await expect(page.getByTestId('price')).toBeAttached();
});

test('shows the product price', async ({ page }) => {
  await page.goto('/products/1');
  await expect(page.getByTestId('product')).toBeVisible();
  await expect(page.getByTestId('price')).toHaveText('R$ 10,00');
});
