import { expect, test, type Page } from '@playwright/test';

/**
 * GitHub Pages แบบรวม (playwright.pages.config.ts): v1 ที่ /sme-trust/ และ v2 ที่ /sme-trust/v2/
 * เซิร์ฟเวอร์จำลองตอบ /sme-trust/404.html (HTTP 404) เมื่อไม่พบไฟล์ — เหมือน GitHub Pages Project site
 */
const V2 = 'v2/';

function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Deep link ได้สถานะ 404 จาก GitHub Pages เสมอ (ข้อจำกัดที่ทราบ) — ไม่นับเป็น Runtime error
  // Firefox รายงานการโหลดฟอนต์ที่ถูกยกเลิกเพราะเปลี่ยนหน้า (NS_BINDING_ABORTED = 2152398850) เป็น error — ไม่ใช่ไฟล์เสีย
  page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && !/status=2152398850/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

async function asRole(page: Page, prefix: string, session: Record<string, string | boolean>) {
  await page.evaluate(
    ([p, s]) => {
      const key = `${p}session`;
      const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
      localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...(s as Record<string, string | boolean>) } }));
    },
    [prefix, session] as const,
  );
}

test('v1 อยู่ที่ /sme-trust/ และ v2 อยู่ที่ /sme-trust/v2/ (Asset ของแต่ละเวอร์ชันโหลดครบ)', async ({ page }) => {
  const errors = watch(page);
  await page.goto('');
  await expect(page.locator('#root')).not.toBeEmpty();
  const v1Scripts = await page.locator('script[type="module"]').evaluateAll((s) => s.map((x) => (x as HTMLScriptElement).src));
  expect(v1Scripts.every((s) => s.includes('/sme-trust/assets/') && !s.includes('/v2/'))).toBe(true);
  await page.goto(V2);
  await expect(page.locator('#root')).not.toBeEmpty();
  const v2Scripts = await page.locator('script[type="module"]').evaluateAll((s) => s.map((x) => (x as HTMLScriptElement).src));
  expect(v2Scripts.every((s) => s.includes('/sme-trust/v2/assets/'))).toBe(true);
  await page.goto(`${V2}demo`);
  await expect(page.getByRole('region', { name: 'Full Journey v2 — Marketplace Intelligence' })).toBeVisible();
  expect(errors).toEqual([]);
});

const V2_DEEP: [string, Record<string, string | boolean>, RegExp | string][] = [
  ['m', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }, 'ร้านกาแฟดอยสูง'],
  ['m/marketplace', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }, 'เชื่อมต่อ Marketplace (จำลอง)'],
  ['m/marketplace/analysis?tab=compare', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }, 'หมวดสินค้าที่ใช้เปรียบเทียบ'],
  ['m/trust', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }, /ผลประเมิน|ประเมินความน่าเชื่อถือ/],
  ['o/assessments', { role: 'officer', officerId: 'OF-001' }, /ผลประเมิน/],
  ['shop/M-005', { role: 'consumer', consumerId: 'CS-001' }, 'ร้านกาแฟดอยสูง'],
  ['demo', {}, 'Full Journey v2'],
  ['demo/v2/summary', {}, /Executive Impact Summary|สรุปผลกระทบ/],
];

test('Deep link และ Refresh ของ v2 ผ่าน 404.html: กลับมาที่เส้นทางเดิม (รวม Query) และไม่ตกไปที่ v1', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watch(page);
  await page.goto(V2);
  await page.evaluate(() => localStorage.clear());
  for (const [path, session, text] of V2_DEEP) {
    await page.goto(V2);
    await asRole(page, 'smetrust:v2:', session);
    const res = await page.goto(`${V2}${path}`);
    expect(res?.status(), `${path}: GitHub Pages ตอบ 404 แล้ว 404.html ส่งต่อ`).toBe(404);
    await expect(page).toHaveURL(new RegExp(`/sme-trust/v2/${path.replace(/[?]/g, '\\?')}$`));
    await expect(page.getByText(text).first()).toBeVisible();
    await expect(page.getByText('ไม่พบหน้าที่ต้องการ')).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/sme-trust/v2/${path.replace(/[?]/g, '\\?')}$`));
    await expect(page.getByText(text).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Deep link ของ v1 ยังทำงานเหมือนเดิม และข้อมูล localStorage ของ v1/v2 แยกกัน', async ({ page }) => {
  const errors = watch(page);
  await page.goto('');
  await page.evaluate(() => localStorage.clear());
  // v1: หน้าตรวจสอบใบรับรอง (ปลายทาง QR)
  const res = await page.goto('verify');
  expect(res?.status()).toBe(404);
  await expect(page).toHaveURL(/\/sme-trust\/verify$/);
  await expect(page.getByText('ไม่พบหน้าที่ต้องการ')).toHaveCount(0);
  // เริ่ม Journey v2 → v2 เขียนเฉพาะ smetrust:v2:*
  await page.goto(`${V2}demo`);
  await page.getByRole('button', { name: 'เริ่ม Journey v2', exact: true }).click();
  await expect(page).toHaveURL(/\/sme-trust\/v2\/m$/);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some((k) => k.startsWith('smetrust:v2:demo'))).toBe(true);
  expect(keys.some((k) => k.startsWith('smetrust:v1:demo'))).toBe(false);
  // v1 ไม่เห็นสถานะการสาธิตของ v2
  await page.goto('demo');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByText('Full Journey v2')).toHaveCount(0);
  expect(errors).toEqual([]);
});
