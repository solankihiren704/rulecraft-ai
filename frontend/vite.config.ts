/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // This machine's vitest worker cold-start (fork/thread spawn + jsdom
    // init) regularly runs well past the 5s default on its own, before any
    // test body executes — observed as high as ~57s for environment setup
    // alone on a cold run. Bump both ceilings with real margin so that
    // overhead doesn't intermittently read as a failing test.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
