import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // @ffmpeg/ffmpeg spins up its worker via `new URL('./worker.js', import.meta.url)`.
  // Vite's esbuild-based dep pre-bundler doesn't carry that relative asset into
  // `.vite/deps/`, which 404s the worker in dev. Excluding it from pre-bundling
  // serves the package straight from node_modules, where the relative URL resolves.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
})
