import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * โหลดฟอนต์ไทย (Noto Sans Thai 400–700 ชุดอักษรไทยและละติน) พร้อมหน้าเว็บด้วย <link rel="preload">
 * เดิมฟอนต์น้ำหนัก 600/700 เริ่มโหลดหลัง Event load (เมื่อเนื้อหาของหน้าแสดง) — ถ้าผู้ใช้เปลี่ยนหน้าเร็ว
 * เบราว์เซอร์ยกเลิกการโหลดกลางทาง และ Firefox รายงานเป็น Console error (KI-V2-36)
 * Preload ทำให้ฟอนต์ (8 ไฟล์ รวมราว 78 KB) โหลดเสร็จเป็นส่วนหนึ่งของหน้า และข้อความไทยไม่กระพริบเปลี่ยนฟอนต์
 * ใช้ชื่อไฟล์จริงหลัง Build (มี Hash) — ไม่มีผลกับ Dev Server
 */
function preloadThaiFonts(): Plugin {
  let base = '/';
  return {
    name: 'preload-thai-fonts',
    apply: 'build',
    configResolved(c) {
      base = c.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => /noto-sans-thai-(thai|latin)-[4-7]00-normal-[^/]*\.woff2$/.test(f)).sort();
        return files.map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `${base}${f}` }, injectTo: 'head' as const }));
      },
    },
  };
}

// base: กำหนดด้วย VITE_BASE เมื่อ Deploy ใต้ path ย่อย (เช่น GitHub Pages: /<repo>/)
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), preloadThaiFonts()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { chunkSizeWarningLimit: 1500 },
});
