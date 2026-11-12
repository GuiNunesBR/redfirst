import { defineConfig } from 'vitest/config';

// Fixtures are named *.spec.ts / *.cy.ts on purpose; only tests/ holds vitest suites.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
