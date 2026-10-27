import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
