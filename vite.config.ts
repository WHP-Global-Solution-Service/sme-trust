import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// base: กำหนดด้วย VITE_BASE เมื่อ Deploy ใต้ path ย่อย (เช่น GitHub Pages: /<repo>/)
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { chunkSizeWarningLimit: 1500 },
});
