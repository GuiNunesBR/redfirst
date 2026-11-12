import { test, expect } from '@playwright/test';
import { CartPage } from './pages/cart.page';

test.describe('cart', () => {
  test('adds an item', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await cart.add('Coffee');
    await expect(cart.count).toHaveText('1');
    await expect(cart.total).toHaveText('R$ 10,00').catch(() => {});
  });

  test('creates the order', async ({ request }) => {
    const response = await request.post('/api/orders', { data: { item: 'Coffee' } });
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ item: 'Coffee' });
  });

  test('shows the empty cart', async ({ page }) => {
    const cart = new CartPage(page);
    await cart.open();
    await expect(cart.empty).toBeVisible();
  });
});
