import { defineConfig } from 'vite'

export default defineConfig({
  // Base public path for production
  base: '/',

  // Build options
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    },
    // Ensure all public assets are copied
    copyPublicDir: true,
    // 대용량 파일 경고 임계값 증가
    chunkSizeWarningLimit: 1000
  },

  // Dev server options
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    allowedHosts: ['ran-solomon-symantec-jackets.trycloudflare.com']
  },

  // Public directory
  publicDir: 'public',

  // Asset handling
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp']
})