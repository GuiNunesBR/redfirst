import { test, expect } from '@playwright/test';

test('disables rules', async ({ page }) => {
  // redfirst-disable-next-line TL007 // expect: TL000
  await page.locator('.items li').first().click(); // expect: TL007
  // redfirst-disable-next-line TL007 -- the list has no stable handle yet, see #91
  await page.locator('.items li').last().click();
  await expect(page.getByTestId('count')).toHaveText('2');
});
