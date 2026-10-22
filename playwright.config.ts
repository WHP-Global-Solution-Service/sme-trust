import { defineConfig, devices } from '@playwright/test';

/**
 * E2E บนเบราว์เซอร์จริงกับ Production build (vite preview)
 *   npm run test:e2e          → base "/"
 *   npm run test:e2e:subpath  → base "/sme-trust/" (เหมือน GitHub Pages)
 */
const base = process.env.E2E_BASE ?? '/';
const port = base === '/' ? 4173 : 4174;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${port}${base}`,
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Safari: ใช้ WebKit ของ Playwright (Engine เดียวกับ Safari) — ไม่ใช่ Safari บน macOS/iOS จริง
    // WebKit บน Windows ช้ากว่า Chromium มาก — ขยายเวลารอ (ไม่ได้ลดเงื่อนไขการตรวจ)
    { name: 'webkit', testIgnore: /mobile\.spec\.ts/, timeout: 600_000, expect: { timeout: 30_000 }, use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, actionTimeout: 45_000 } },
    { name: 'iphone-safari', timeout: 600_000, expect: { timeout: 30_000 }, use: { ...devices['iPhone 13'], actionTimeout: 45_000 }, testMatch: /(mobile|responsive)\.spec\.ts/ },
    { name: 'ipad-safari', timeout: 600_000, expect: { timeout: 30_000 }, use: { ...devices['iPad (gen 7)'], actionTimeout: 45_000 }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    env: { VITE_BASE: base },
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
