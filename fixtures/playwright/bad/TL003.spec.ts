import { test, expect } from '@playwright/test';

test.describe.only('cart', () => { // expect: TL003
  test.only('adds an item', async ({ page }) => { // expect: TL003
    await expect(page.getByTestId('count')).toHaveText('1');
  });
});
