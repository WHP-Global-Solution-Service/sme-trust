import type { Page } from '@playwright/test';
import { DEMO_TITLE, demoState, expect, expectBlocked, expectDemoTitle, finishScenario, fresh, next, open, panel, startDemo, store, test } from './helpers';

/**
 * P7 — Final QA: กรณีร้านไม่มี Marketplace เล่นซ้ำ, ความใหม่ของข้อมูล, หมวดการเปรียบเทียบ, Dashboard v2,
 * ชุดน้ำหนัก, Direct URL / Refresh / localStorage และ Layout ที่ 375 / 768 / 1440 px
 * ทุก Test ตรวจ Console/Runtime error อัตโนมัติ (helpers.test)
 */
const main = (page: Page) => page.locator('main');
type Tas = { id: string; merchantId: string; status: string; applicationId?: string; decision?: { kind: string; certId?: string } };
type App = { id: string; status: string };
type Cert = { id: string; merchantId: string; level: number; status: string };
type Conn = { id: string; merchantId: string; platform: string; status: string; syncSource?: string };

/** ตั้งบทบาทผ่าน Session Store (เหมือนการเลือกบัญชีตัวอย่าง) แล้วเปิดหน้า */
async function asRole(page: Page, session: Record<string, string | boolean>, path: string) {
  await page.evaluate((s) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...s } }));
  }, session);
  await open(page, path);
}

/** ไม่มี Scroll แนวนอนทั้งหน้า */
async function expectNoOverflow(page: Page, label: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `ไม่มี Horizontal overflow: ${label}`).toBeLessThanOrEqual(1);
}

/** ร้านกาแฟดอยสูง (M-005 — มี Shopee ในข้อมูลตั้งต้นแล้ว) เชื่อม Lazada (จำลอง) เพิ่มผ่าน UI จริงของ "ช่องทางขายออนไลน์" — ได้การเชื่อมต่อที่ซิงก์ใหม่ (0 วัน) โดยไม่สร้างร้านใหม่ */
async function connectM005(page: Page) {
  await fresh(page);
  await asRole(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true, activeMerchantId: 'M-005' }, '/m/marketplace');
  const wiz = main(page).getByRole('region', { name: /^เชื่อมต่อ (Shopee|Lazada) \(จำลอง\)$/ });
  await main(page).locator('[data-platform="lazada"]').getByRole('button', { name: 'เชื่อมต่อ Lazada (จำลอง)' }).click();
  await wiz.getByLabel(/ข้าพเจ้ายินยอม/).check();
  await wiz.getByRole('button', { name: 'ถัดไป' }).click();
  await wiz.getByRole('radio', { name: /ร้านที่ขายมานาน ผลงานดี/ }).click();
  await wiz.getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await wiz.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(wiz.getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
}

test.describe('P7 — Desktop flows', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1440) < 1024, 'ใช้แผงควบคุมด้านขวา (Desktop)');

  test('9B เล่นซ้ำ: แจ้งร้านเดิมของ OP-012 แล้วล้างก่อนเริ่มใหม่ (ไม่สร้างร้านซ้ำ)', async ({ page }) => {
    test.setTimeout(300_000);
    await startDemo(page, 's9b');
    await next(page);
    await main(page).getByRole('button', { name: 'ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง' }).click();
    await next(page);
    await main(page).getByRole('button', { name: 'เติมข้อมูลตัวอย่าง' }).click();
    await next(page);
    await next(page);
    await main(page).getByRole('checkbox').last().check();
    await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
    const shops = async () => (await store<{ id: string; operatorId: string }>(page, 'merchants')).filter((m) => m.operatorId === 'OP-012');
    await expect.poll(async () => (await shops()).length).toBe(1);
    // เล่นซ้ำจากการ์ดกรณีพิเศษบนหน้า Demo → แจ้งก่อนล้างร้านเดิมของบัญชีตัวอย่าง
    await open(page, '/demo');
    await page.getByTestId('case-section').getByRole('button', { name: `ทดลองกรณีนี้: ${DEMO_TITLE.s9b}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('OP-012');
    await page.getByRole('dialog').getByRole('button', { name: 'เริ่มตั้งแต่ต้น' }).click();
    await expectDemoTitle(page, 's9b');
    expect(await shops()).toHaveLength(0);
    // Refresh ระหว่างเล่น → ยังอยู่ที่เรื่องเดิม
    await page.reload();
    await expectDemoTitle(page, 's9b');
  });

  test('ความใหม่ของข้อมูล: จำลองข้อมูลเก่า → Confidence ลด → ซิงก์ใหม่ (ไม่สร้างข้อมูลซ้ำ)', async ({ page }) => {
    await connectM005(page);
    const conn = (await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === 'M-005' && c.platform === 'lazada' && c.status === 'connected')!;
    expect((await store<Conn>(page, 'marketplace-connections')).filter((c) => c.merchantId === 'M-005' && c.status !== 'disconnected').map((c) => c.platform).sort()).toEqual(['lazada', 'shopee']); // เพิ่มช่องทางให้ร้านเดิม ไม่สร้างร้านใหม่
    const count = (await store<Conn>(page, 'marketplace-connections')).length;
    await open(page, `/m/marketplace/data/${conn.id}`);
    const card = page.getByTestId('freshness');
    await expect(card.getByText(/ข้อมูลใหม่ \(0 วัน\)/)).toBeVisible();
    // ร้านค้าไม่เห็น Confidence เป็นตัวเลขหรือคะแนนที่หัก (สิทธิ์ assessment.score.view) — ตรวจจากเหตุผลที่ Engine ใช้หักความเชื่อมั่นแทน
    const status = card.getByRole('status').first();
    const confText = async () => (await status.innerText()).replace(/คำนวณใหม่[\s\S]*$/, '').trim();
    const fresh0 = await confText();
    expect(fresh0).toMatch(/^Data Confidence ปัจจุบัน: \D/);
    expect(fresh0).not.toMatch(/\(−\d/);
    expect(fresh0).not.toMatch(/ข้อมูลซิงก์ล่าสุดนานกว่า/);
    await card.getByRole('button', { name: 'ข้อมูลเกิน 90 วัน' }).click();
    await expect(card.getByText(/ข้อมูลเก่าเกิน 90 วัน/)).toBeVisible();
    await expect(status).toContainText(/ข้อมูลซิงก์ล่าสุดนานกว่า \d+ วัน/); // Engine หักความเชื่อมั่นเพราะข้อมูลเก่า
    expect(await confText()).not.toMatch(/\(−\d/);
    await card.getByRole('button', { name: 'ซิงก์ข้อมูล (จำลอง)' }).click();
    await expect(card.getByText(/ข้อมูลใหม่ \(0 วัน\)/)).toBeVisible();
    await expect(card.getByText('ผู้ใช้กดซิงก์ (จำลอง)', { exact: false })).toBeVisible();
    expect(await confText()).toBe(fresh0); // กลับเป็นผลเดิมทุกตัวอักษร
    expect((await store<Conn>(page, 'marketplace-connections')).length).toBe(count);
    // Refresh → ค่าเดิม (localStorage)
    await page.reload();
    await expect(page.getByTestId('freshness').getByText('ผู้ใช้กดซิงก์ (จำลอง)', { exact: false })).toBeVisible();
  });

  test('การเปรียบเทียบใช้หมวดของร้าน และเตือนเมื่อเปรียบเทียบต่างหมวด', async ({ page }) => {
    await fresh(page);
    await asRole(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true, activeMerchantId: 'M-005' }, '/m/marketplace/analysis?tab=compare');
    const sel = main(page).getByLabel('หมวดสินค้าที่ใช้เปรียบเทียบ');
    await expect(sel).toHaveValue('อาหารและเครื่องดื่ม');
    await expect(page.getByTestId('compare-category')).toContainText('อาหารและเครื่องดื่ม');
    await expect(main(page).getByText('เปรียบเทียบต่างหมวดกับร้านของคุณ')).toHaveCount(0);
    await sel.selectOption('ความงามและสุขภาพ');
    await expect(page.getByTestId('compare-category')).toContainText('เซรั่มบำรุงผิว');
    await expect(main(page).getByText('เปรียบเทียบต่างหมวดกับร้านของคุณ')).toBeVisible();
  });

  test('Admin: Dashboard v2 คำนวณจาก State, ชุดน้ำหนักมีเลขชุด/วันที่ และ Reset กลับค่าเริ่มต้น', async ({ page }) => {
    await fresh(page);
    await asRole(page, { role: 'admin' }, '/admin');
    const kpi = page.getByTestId('v2-kpi');
    await expect(kpi.getByText('ข้อมูลจำลองทั้งหมด', { exact: false })).toBeVisible();
    await expect(page.getByText('จำนวน SME ทั้งหมด')).toBeVisible(); // Dashboard v1 ยังอยู่
    // ตัวเลขมาจาก State: สำเร็จ + ไม่สำเร็จ ≤ ทั้งหมด (ค่าตรงกับ State ตรวจใน tests/v2/p7.test.mts)
    const okCard = await kpi.getByText('Connection สำเร็จ').locator('xpath=ancestor::*[contains(@class,"p-4")][1]').innerText();
    const failCard = await kpi.getByText('Connection ไม่สำเร็จ').locator('xpath=ancestor::*[contains(@class,"p-4")][1]').innerText();
    const [, ok, total] = okCard.replace(/\s+/g, ' ').match(/Connection สำเร็จ (\d+) จาก (\d+)/)!.map(Number);
    const failed = Number(failCard.replace(/\s+/g, ' ').match(/Connection ไม่สำเร็จ (\d+)/)![1]);
    expect(ok + failed).toBeLessThanOrEqual(total);
    expect(ok).toBeGreaterThan(0);
    // ชุดน้ำหนัก
    await open(page, '/admin/assessment-model');
    await expect(page.getByTestId('weight-set')).toContainText('ชุดน้ำหนักเริ่มต้น');
    await page.getByLabel('น้ำหนัก C1').fill('30');
    await page.getByLabel('น้ำหนัก C4').fill('5');
    await page.getByRole('button', { name: 'บันทึกน้ำหนัก' }).click();
    await expect(page.getByTestId('weight-set')).toContainText('ชุดน้ำหนัก #1');
    await page.reload();
    await expect(page.getByTestId('weight-set')).toContainText('ชุดน้ำหนัก #1'); // Persistence
    await page.getByLabel('น้ำหนัก C1').fill('60');
    await expect(page.getByText(/ผลรวมน้ำหนักต้องเท่ากับ 100/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'บันทึกน้ำหนัก' })).toBeDisabled();
    await open(page, '/admin/data');
    await main(page).getByRole('button', { name: 'Reset Demo Data' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'รีเซ็ต' }).click();
    await expect(page).toHaveURL(/\/$/);
    await asRole(page, { role: 'admin' }, '/admin/assessment-model');
    await expect(page.getByTestId('weight-set')).toContainText('ชุดน้ำหนักเริ่มต้น');
  });
});

const nextBtn = (page: Page) => panel(page).locator('[data-demo="next"]');

// ---------------------------------------------------------------- ทุกขนาดจอ
const V2_ROUTES: [string, Record<string, string | boolean>][] = [
  ['/demo', {}],
  ['/demo/v2/summary', {}],
  ['/m/marketplace', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }],
  ['/m/marketplace/data/MKC-003', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }],
  ['/m/marketplace/analysis?tab=compare', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }],
  ['/m/trust', { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true }],
  ['/o/assessments', { role: 'officer', officerId: 'OF-001' }],
  ['/o/assessments/TAS-2569-0004', { role: 'officer', officerId: 'OF-001' }],
  ['/shop/M-005', { role: 'consumer', consumerId: 'CS-001' }],
  ['/admin', { role: 'admin' }],
  ['/admin/assessment-model', { role: 'admin' }],
];

for (const width of [375, 768, 1440]) {
  test(`Direct URL + Refresh ของหน้า v2 ที่ ${width}px — ไม่มี Overflow และไม่มี Error`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: width < 800 ? 820 : 900 });
    await fresh(page);
    for (const [path, session] of V2_ROUTES) {
      await asRole(page, session, path);
      await expect(page).not.toHaveURL(/\/login$/); // เปิดหน้าจริง ไม่ถูกส่งไปหน้าเข้าสู่ระบบ
      await expect(page.locator('body')).not.toContainText('ไม่พบหน้าที่ต้องการ');
      await expect(page.locator('body')).not.toContainText('Permission Denied');
      await expect(page.locator('main, [role="main"], body').first()).not.toBeEmpty();
      await expectNoOverflow(page, `${path} @ ${width}px`);
      if (path === '/m/trust') {
        await page.reload(); // Refresh บน Deep link
        await expect(page.locator('body')).not.toContainText('ไม่พบหน้าที่ต้องการ');
      }
    }
  });
}
