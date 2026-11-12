import { test, expect } from '@playwright/test';

test.skip('exports a PDF', async ({ page }) => { // expect: TL004
  await expect(page.getByTestId('export')).toHaveText('Done');
});

test.fixme('imports a CSV', async ({ page }) => { // expect: TL004
  await expect(page.getByTestId('import')).toHaveText('Done');
});

// Flaky on CI, see #482
test.skip('prints the invoice', async ({ page }) => {
  await expect(page.getByTestId('print')).toHaveText('Done');
});

test('runs only on chromium', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'not supported elsewhere'); // expect: TL004
  await expect(page.getByTestId('gpu')).toHaveText('on');
});

test('runs only on chromium, with a link', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WebKit bug: https://github.com/acme/shop/issues/12');
  await expect(page.getByTestId('gpu')).toHaveText('on');
});
