import 'dotenv/config';

export const env = {
  frontUrl: process.env.FRONT_URL ?? 'https://front.serverest.dev',
  apiUrl: process.env.API_URL ?? 'https://serverest.dev',
} as const;
