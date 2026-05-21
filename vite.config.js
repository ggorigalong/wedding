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
    port: 3000,
    open: true
  },

  // Asset handling
  assetsInclude: ['**/*.mp3', '**/*.wav']
})