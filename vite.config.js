import { defineConfig } from 'vite'

export default defineConfig({
  // Base public path
  base: './',

  // Build options
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },

  // Dev server options
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    allowedHosts: ['ran-solomon-symantec-jackets.trycloudflare.com']
  },

  // Asset handling
  assetsInclude: ['**/*.mp3', '**/*.wav']
})