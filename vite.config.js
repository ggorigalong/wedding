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
        main: 'index.html',
        bride: 'bride.html',
        groom: 'groom.html'
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
    allowedHosts: ['ran-solomon-symantec-jackets.trycloudflare.com'],
    // 히스토리 API 폴백 완전 비활성화 - 정적 파일만 서빙
    middlewareMode: false,
    fs: {
      strict: false
    }
  },

  // Public directory
  publicDir: 'public',

  // Asset handling
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp']
})