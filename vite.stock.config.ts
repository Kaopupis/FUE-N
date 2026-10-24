import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ระบบสต๊อกสหมิตร: npm run build (หรือ stock:build) ได้ไฟล์ใน dist/ สำหรับ Cloudflare Pages
export default defineConfig({
  root: path.resolve(__dirname, 'stock'),
  base: './',
  plugins: [react()],
  server: { port: 3100, host: '0.0.0.0' },
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
