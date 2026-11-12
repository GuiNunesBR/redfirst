import { test, expect } from '@playwright/test';

test('asserts constants', async ({ page }) => {
  const total = await page.getByTestId('total').textContent();
  expect(true).toBe(true); // expect: TL012
  expect(1).toBeTruthy(); // expect: TL012
  expect(total).toBe(total); // expect: TL012
  expect(total).toBe('R$ 10,00');
});
