import type { APIRequestContext, APIResponse } from '@playwright/test';

export function createOrder(request: APIRequestContext, item: string): Promise<APIResponse> {
  return request.post('/api/orders', { data: { item } });
}
