import { test, expect } from '@playwright/test';

declare function sleep(ms: number): Promise<void>;

test('waits the wrong way', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000); // expect: TL002
  await new Promise((resolve) => setTimeout(resolve, 500)); // expect: TL002
  await sleep(100); // expect: TL002
  await expect(page.getByRole('heading')).toHaveText('Home');
});
