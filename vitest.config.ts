import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/memory/__tests__/**/*.test.ts'],
  },
});
