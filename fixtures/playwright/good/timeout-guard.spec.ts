import { test, expect, type Page } from '@playwright/test';

// Regression (dogfooding): a timer that only rejects is a timeout guard, not a fixed sleep.
async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function totalOf(page: Page): Promise<string | null> {
  return page.getByTestId('total').textContent();
}

test('reads the total before the deadline', async ({ page }) => {
  await page.goto('/cart');
  expect(await withDeadline(totalOf(page), 5_000)).toBe('R$ 10,00');
});
