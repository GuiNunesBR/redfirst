import { test, expect } from '@playwright/test';

test('shows the cart total', async ({ page }) => {
  await page.goto('/cart');
  expect(page.getByTestId('total')).toHaveText('R$ 10,00'); // expect: TL001
  void expect(page).toHaveURL(/cart/); // expect: TL001
  expect.poll(() => page.title()).toBe('Cart'); // expect: TL001
  await expect(page.getByRole('heading')).toHaveText('Cart');
  expect(await page.title()).toBe('Cart');
});
