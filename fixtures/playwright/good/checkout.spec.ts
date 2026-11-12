import { test, expect } from '@playwright/test';

test.describe('checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cart');
  });

  test('shows the total and moves to payment', async ({ page }) => {
    await expect(page.getByTestId('total')).toHaveText('R$ 10,00');
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/checkout') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Pay' }).click(),
    ]);
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL(/\/payment$/);
  });

  test('keeps the first row selected', async ({ page }) => {
    await page.getByRole('row').first().click();
    await expect(page.getByRole('row').first()).toHaveAttribute('aria-selected', 'true');
  });

  test('polls the order status', async ({ page }) => {
    await page.getByRole('button', { name: 'Pay' }).click();
    await expect.poll(async () => (await page.request.get('/api/orders/1')).status()).toBe(200);
  });

  // Payment provider sandbox is down, see PAY-210
  test.fixme('refunds an order', async ({ page }) => {
    await expect(page.getByTestId('refund')).toHaveText('Refunded');
  });

  test('returns the assertion promise', ({ page }) => {
    return expect(page.getByTestId('total')).toHaveText('R$ 10,00');
  });

  test('uses a reviewed disable', async ({ page }) => {
    // redfirst-disable-next-line TL007 -- legacy table without test ids, tracked in #77
    await page.locator('table tr').nth(1).click();
    await expect(page.getByTestId('detail')).toHaveText('Order #1');
  });
});
