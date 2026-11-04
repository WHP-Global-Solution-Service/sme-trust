import { defineConfig, devices } from '@playwright/test';

/**
 * E2E โครงสร้าง GitHub Pages แบบรวม: v1 ที่ /sme-trust/ และ v2 ที่ /sme-trust/v2/
 * เตรียมไฟล์ด้วย `node scripts/e2e-pages.mjs` (Build v1 จาก main แบบอ่านอย่างเดียว + Build v2 + รวม) — ไม่มีการ Deploy
 * เซิร์ฟเวอร์จำลองพฤติกรรม GitHub Pages: ไม่พบไฟล์ → /sme-trust/404.html (HTTP 404)
 */
const port = 4320;
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /pages\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 2,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}/sme-trust/`, locale: 'th-TH', viewport: { width: 1440, height: 900 } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', timeout: 600_000, expect: { timeout: 30_000 }, use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/pages-preview.mjs .pages/site /sme-trust/ ${port}`,
    url: `http://localhost:${port}/sme-trust/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
