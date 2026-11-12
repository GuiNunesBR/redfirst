import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly count: Locator;
  readonly total: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.count = page.getByRole('status', { name: 'Items in cart' });
    this.total = page.getByTestId('cart-total');
    this.empty = page.getByTestId('cart-empty');
  }

  async open(): Promise<void> {
    await this.page.goto('/cart');
  }

  async add(item: string): Promise<void> {
    await this.page.getByRole('button', { name: `Add ${item}` }).click();
  }
}
