import { test, expect } from '@playwright/test';
import { CartPage } from './pages/cart.page';

test.describe('cart', () => {
  test('adds an item', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await cart.add('Coffee');
    await expect(cart.count).toHaveText('1');
    await expect(cart.total).toHaveText('R$ 10,00');
  });

  test('shows the empty cart', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await expect(cart.empty).toBeVisible();
  });
});
