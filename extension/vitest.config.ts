import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.tsx', 'src/popup/**', 'src/onboarding/**'],
    },
    testTimeout: 30000, // generous timeout for integration tests
  },
})
