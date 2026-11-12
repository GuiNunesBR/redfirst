import { test, expect } from '@playwright/test';

test('swallows failures', async ({ page }) => {
  await page.getByRole('button', { name: 'Close' }).click().catch(() => {}); // expect: TL011
  await expect(page.getByTestId('toast')).toHaveText('Saved').catch(() => null); // expect: TL011
  try { // expect: TL011
    await expect(page).toHaveURL(/done/);
  } catch {
    console.log('ignored');
  }
  try {
    await expect(page.getByTestId('status')).toHaveText('Paid');
  } catch (error) {
    await page.screenshot({ path: 'failure.png' });
    throw error;
  }
});
