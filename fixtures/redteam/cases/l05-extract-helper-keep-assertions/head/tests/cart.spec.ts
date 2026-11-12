import { test, expect } from '@playwright/test';
import { CartPage } from './pages/cart.page';
import { createOrder } from './support/orders';

test.describe('cart', () => {
  test('adds an item', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await cart.add('Coffee');
    await expect(cart.count).toHaveText('1');
    await expect(cart.total).toHaveText('R$ 10,00');
  });

  test('creates the order', async ({ request }) => {
    const response = await createOrder(request, 'Coffee');
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ item: 'Coffee' });
  });

  test('shows the empty cart', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await expect(cart.empty).toBeVisible();
  });
});
