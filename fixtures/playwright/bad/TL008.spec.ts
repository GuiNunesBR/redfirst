import { test, expect } from '@playwright/test';

test('branches on the page state', async ({ page }) => {
  const banner = page.getByTestId('banner');
  if (await banner.isVisible()) { // expect: TL008
    await expect(banner).toHaveText('Sale');
  }
  try { // expect: TL008
    await page.getByRole('button', { name: 'Pay' }).click();
  } catch (error) {
    expect(String(error)).toContain('disabled');
  }
  const label = (await banner.isVisible()) ? 'Sale' : 'Regular';
  await expect(page).toHaveURL(/checkout/);
  await expect(page.getByTestId('label')).toHaveText(label);
});
