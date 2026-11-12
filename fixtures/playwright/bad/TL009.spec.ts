import { test, expect } from '@playwright/test';

test('reads the total with handles', async ({ page }) => {
  const total = await page.$('#total'); // expect: TL009
  await page.waitForSelector('#ready'); // expect: TL009
  const text = await page.$eval('#total', (e) => e.textContent); // expect: TL009
  expect(text).toBe('10');
  expect(total).not.toBeNull();
});
