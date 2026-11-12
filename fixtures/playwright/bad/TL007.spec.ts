import { test, expect } from '@playwright/test';

test('selects rows', async ({ page }) => {
  await page.locator('.list li').nth(2).click(); // expect: TL007
  await page.locator('xpath=//div[2]/span').click(); // expect: TL007
  await page.locator('div > ul li a').click(); // expect: TL007
  await page.locator('tr:nth-child(3)').click(); // expect: TL007
  await page.getByRole('row').first().click();
  await page.locator('[data-testid="row"]').last().click();
  await page.locator('tbody tr').filter({ hasText: 'Total' }).click();
  await expect(page.getByTestId('selected')).toHaveText('3');
});
