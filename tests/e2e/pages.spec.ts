import { expect, test, type Page } from '@playwright/test';

/**
 * เว็บไซต์ GitHub Pages (playwright.pages.config.ts): SME Trust v2 แทน v1 ที่ URL เดิม /sme-trust/
 * เซิร์ฟเวอร์จำลองตอบ /sme-trust/404.html (HTTP 404) เมื่อไม่พบไฟล์ — เหมือน GitHub Pages Project site
 * 404.html = สำเนา index.html (postbuild) → แอปเปิดที่เส้นทางเดิมโดยตรง ไม่มีการ Redirect
 */

function watch(page: Page) {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Deep link ได้สถานะ 404 จาก GitHub Pages เสมอ (ข้อจำกัดที่ทราบ) — ไม่นับเป็น Runtime error
  // Firefox รายงานการโหลดฟอนต์ที่ถูกยกเลิกเพราะเปลี่ยนหน้า (NS_BINDING_ABORTED = 2152398850) เป็น error — ไม่ใช่ไฟล์เสีย
  page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && !/status=2152398850/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && errors.push(`${r.status()} ${r.url()}`));
  page.on('request', (r) => requests.push(r.url()));
  return { errors, requests };
}

async function asRole(page: Page, session: Record<string, string | boolean>) {
  await page.evaluate((s) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...s } }));
  }, session);
}

const escape = (p: string) => p.replace(/[?.]/g, (c) => `\\${c}`);

test('หน้าแรก /sme-trust/ เป็น SME Trust v2: Asset ทั้งหมดอยู่ใต้ /sme-trust/ และไม่มีการเรียก /sme-trust/v2/ หรือโดเมนภายนอก', async ({ page }) => {
  const { errors, requests } = watch(page);
  const res = await page.goto('');
  expect(res?.status()).toBe(200);
  await expect(page.locator('#root')).not.toBeEmpty();
  const scripts = await page.locator('script[type="module"]').evaluateAll((s) => s.map((x) => (x as HTMLScriptElement).src));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((s) => s.includes('/sme-trust/assets/'))).toBe(true);
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(icon).toBe('/sme-trust/favicon.svg');
  expect((await page.request.get(icon!)).status()).toBe(200);
  // หน้า Demo มีทั้ง Full Journey เดิม (Scenario 1–8) และ v2 (Scenario 9–13)
  await page.goto('demo');
  await expect(page.getByRole('region', { name: 'สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Full Journey — Marketplace & Trust Assessment' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Consumer Protection/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Marketplace & Trust Assessment/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests.filter((u) => /\/sme-trust\/v2\//.test(u))).toEqual([]);
  expect(requests.filter((u) => !u.startsWith('http://localhost:4320/'))).toEqual([]);
  expect(errors).toEqual([]);
});

const M5 = { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true };
const M1 = { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: true };
const DEEP: [string, Record<string, string | boolean>, RegExp | string][] = [
  // v2: Marketplace / Trust Assessment / Officer Review / Consumer / Demo
  ['m', M5, 'ร้านกาแฟดอยสูง'],
  ['m/marketplace', M5, 'เชื่อมต่อ Marketplace (จำลอง)'],
  ['m/marketplace/analysis?tab=compare', M5, 'หมวดสินค้าที่ใช้เปรียบเทียบ'],
  ['m/trust', M5, /ผลประเมิน|ประเมินความน่าเชื่อถือ/],
  ['o/assessments', { role: 'officer', officerId: 'OF-001' }, /ผลประเมิน/],
  ['shop/M-005', { role: 'consumer', consumerId: 'CS-001' }, 'ร้านกาแฟดอยสูง'],
  ['demo', {}, 'Full Journey — Marketplace & Trust Assessment'],
  ['demo/v2/summary', {}, /Executive Impact Summary|สรุปผลกระทบ/],
  // ฟังก์ชันเดิมจาก v1: ตรวจใบรับรอง (ปลายทาง QR), ข้อร้องเรียน, AI, เจ้าหน้าที่, ผู้ดูแลระบบ
  ['verify/SMT-2569-000101', { role: 'consumer', consumerId: 'CS-001' }, 'SMT-2569-000101'],
  ['report', { role: 'consumer', consumerId: 'CS-001' }, 'แจ้งปัญหาการซื้อขาย'],
  ['m/ai', M1, 'AI ผู้ช่วย SME'],
  ['o', { role: 'officer', officerId: 'OF-001' }, 'Officer Dashboard'],
  ['admin/assessment-model', { role: 'admin' }, 'โมเดลการประเมิน (Trust Assessment)'],
];

test('Deep link และ Refresh ทุกกลุ่มฟังก์ชัน: GitHub Pages ตอบ 404.html แล้วแอปแสดงเส้นทางเดิม (รวม Query) โดยไม่ Redirect', async ({ page }) => {
  test.setTimeout(600_000);
  const { errors } = watch(page);
  await page.goto('');
  await page.evaluate(() => localStorage.clear());
  for (const [path, session, text] of DEEP) {
    await page.goto('');
    await asRole(page, session);
    const res = await page.goto(path);
    expect(res?.status(), `${path}: GitHub Pages ตอบ 404 พร้อม 404.html`).toBe(404);
    await expect(page, path).toHaveURL(new RegExp(`/sme-trust/${escape(path)}$`));
    await expect(page.getByText(text).first(), path).toBeVisible();
    await expect(page.getByText('ไม่พบหน้าที่ต้องการ')).toHaveCount(0);
    await page.reload();
    await expect(page, `${path} (Refresh)`).toHaveURL(new RegExp(`/sme-trust/${escape(path)}$`));
    await expect(page.getByText(text).first(), `${path} (Refresh)`).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('ผู้ที่เคยเปิด v1: ข้อมูลเก่าใต้ smetrust:v1:* ไม่ถูกโหลดเข้า v2 และไม่ถูกลบ (พร้อม Rollback)', async ({ page }) => {
  const { errors } = watch(page);
  await page.goto('');
  // จำลองข้อมูลที่ v1 ทิ้งไว้ในเบราว์เซอร์ (รูปแบบเก่า + สถานะการสาธิตที่ค้างอยู่)
  const legacy = {
    'smetrust:v1:merchants': JSON.stringify({ state: { items: [{ id: 'M-005', name: 'ร้านจากเวอร์ชันเดิม' }] }, version: 1 }),
    'smetrust:v1:demo': JSON.stringify({ state: { activeScenario: 's3', stepIndex: 2, status: 'running', journeyMode: true }, version: 1 }),
    'smetrust:v1:session': JSON.stringify({ state: { role: 'admin' }, version: 1 }),
  };
  await page.evaluate((l) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v);
  }, legacy);
  await page.goto('shop/M-005');
  await expect(page.getByText('ร้านกาแฟดอยสูง').first()).toBeVisible();
  await expect(page.getByText('ร้านจากเวอร์ชันเดิม')).toHaveCount(0);
  // เริ่ม Journey v2 → เขียนเฉพาะ smetrust:v2:*
  await page.goto('demo');
  await page.getByRole('button', { name: 'เริ่ม Journey Marketplace & Trust', exact: true }).click();
  await expect(page).toHaveURL(/\/sme-trust\/m$/);
  const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  expect(Object.keys(after).some((k) => k.startsWith('smetrust:v2:demo'))).toBe(true);
  for (const [k, v] of Object.entries(legacy)) expect(after[k], `${k} ต้องคงเดิม`).toBe(v);
  expect(errors).toEqual([]);
});
