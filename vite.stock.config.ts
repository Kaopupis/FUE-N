import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ระบบสต๊อกสหมิตร: npm run build (หรือ stock:build) ได้ไฟล์ใน dist/ สำหรับ Cloudflare Pages
export default defineConfig({
  root: path.resolve(__dirname, 'stock'),
  base: './',
  plugins: [react()],
  // /api ส่งต่อไปที่ wrangler pages dev (npm run dev:full) ที่พอร์ต 8788
  server: { port: 3100, host: '0.0.0.0', proxy: { '/api': 'http://localhost:8788' } },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
