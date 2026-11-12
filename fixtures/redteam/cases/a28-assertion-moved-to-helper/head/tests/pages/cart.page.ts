import { expect, type Locator, type Page } from '@playwright/test';

export class CartPage {
  readonly count: Locator;
  readonly total: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.count = page.getByTestId('cart-count');
    this.total = page.getByTestId('cart-total');
    this.empty = page.getByTestId('cart-empty');
  }

  async open(): Promise<void> {
    await this.page.goto('/cart');
  }

  async verifyTotal(): Promise<void> {
    await expect(this.total).toBeVisible();
  }

  async add(item: string): Promise<void> {
    await this.page.getByRole('button', { name: `Add ${item}` }).click();
  }
}
