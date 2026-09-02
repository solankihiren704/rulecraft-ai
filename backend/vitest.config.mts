import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // Tests run without a real backend/.env file (and without a live
    // database) so they work the same way locally and in CI. These are
    // dummy values only used to satisfy the env schema (src/config/env.ts)
    // — no test actually connects to this database.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/rulecraft_ai_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-not-for-production-use-only',
      JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production-use-only',
    },
  },
})
