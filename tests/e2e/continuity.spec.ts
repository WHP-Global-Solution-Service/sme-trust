import type { Locator, Page } from '@playwright/test';
import { demoState, expect, expectStep, fresh, next, nextBtn, open, openAllScenarios, panel, store, test } from './helpers';
import { fillReportSample, playS1, startJourney } from './flows';

test('ข้ามไป Scenario 3 ขณะร้านจาก Scenario 2 ยังไม่อนุมัติ → แจ้งเหตุผลและให้เลือก (ไม่สลับ Merchant แบบเงียบ)', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await open(page, '/demo');
  await startJourney(page);
  await playS1(page);
  await next(page);
  await page.locator('main').getByRole('button').first().click(); // ดำเนินการต่อ → S2
  await expect(panel(page).getByText('Scenario 2:')).toBeVisible();
  // ส่งคำขอร้านค้า แต่ยังไม่ให้เจ้าหน้าที่อนุมัติ
  await next(page);
  await page.locator('main').getByRole('button', { name: 'เติมข้อมูลตัวอย่าง' }).click();
  for (let k = 0; k < 4; k++) await next(page);
  await page.locator('main').getByRole('checkbox').last().check();
  await page.locator('main').getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await next(page);
  await expectStep(page, 7);
  const s2 = (await demoState(page)).current;

  await open(page, '/demo');
  await openAllScenarios(page);
  await page.getByRole('button', { name: /^3\s/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'ข้ามไป' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('ข้อมูลสำหรับ Scenario 3 ยังไม่ครบ')).toBeVisible();
  await expect(dlg.getByText(/ร้าน "ขนมไทยบ้านสวน" จาก Scenario 2 ยังไม่ได้รับการรับรอง/)).toBeVisible();
  await expect(dlg.getByText(/M-001/)).toBeVisible();

  // ทางเลือก 1: กลับไปทำ Scenario 2 ให้ครบ → ขั้นเดิม ร้านเดิม
  await dlg.getByRole('button', { name: 'กลับไปทำ Scenario 2 ให้ครบ' }).click();
  await expect(panel(page).getByText('Scenario 2:')).toBeVisible();
  await expectStep(page, 7);
  expect((await demoState(page)).current.merchantId).toBe(s2.merchantId);

  // ทางเลือก 2: ใช้ข้อมูลตัวอย่าง → มีหมายเหตุอธิบายในตัวควบคุมตลอดทั้งเรื่อง และไม่สร้างร้านซ้ำ
  const merchants = (await store(page, 'merchants')).length;
  await open(page, '/demo');
  await openAllScenarios(page);
  await page.getByRole('button', { name: /^3\s/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'ข้ามไป' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ใช้ข้อมูลตัวอย่าง' }).click();
  await expect(panel(page).getByText('Scenario 3:')).toBeVisible();
  await expect(panel(page).getByText('ใช้ข้อมูลตัวอย่าง:')).toBeVisible();
  await expect(panel(page).getByText(/ยังไม่ได้รับการรับรอง/)).toBeVisible();
  const st = await demoState(page);
  expect(st.current.merchantId).toBe('M-001');
  expect(st.journey.merchantId).toBe(s2.merchantId);
  expect((await store(page, 'merchants')).length).toBe(merchants);
  // Refresh แล้วหมายเหตุยังอยู่
  await page.reload();
  await expect(panel(page).getByText('ใช้ข้อมูลตัวอย่าง:')).toBeVisible();
});

test('Restart Scenario ไม่สร้างข้อมูลซ้ำ / Refresh แล้วทำต่อได้ / Back-Next ไม่ทำ Action ซ้ำ', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await openAllScenarios(page);
  await page.getByRole('button', { name: 'Start Demo' }).nth(3).click();
  await next(page);
  await fillReportSample(page);
  await next(page);
  const before = (await store(page, 'complaints')).length;
  await page.locator('main').getByRole('button', { name: 'ส่งเรื่อง (Submit)' }).click();
  await expect.poll(async () => (await store(page, 'complaints')).length).toBe(before + 1);
  await next(page);
  // Back / Next หลายรอบ ไม่สร้างเรื่องเพิ่ม
  await panel(page).locator('[data-demo="back"]').click();
  await panel(page).locator('[data-demo="back"]').click();
  // หน้าจอต้องตามขั้นจริง (KI-V2-32: เดิมขั้นย้อนกลับแต่หน้าจอค้างที่หน้าติดตามสถานะ)
  await expectStep(page, 2);
  await expect(page).toHaveURL(/\/report\?merchant=/);
  // แบบฟอร์มเปิดใหม่ (ว่าง) แต่ขั้นนี้ทำแล้ว — ไปต่อได้โดยไม่ต้องส่งซ้ำ
  await expect(panel(page).getByText('ขั้นนี้ทำเสร็จแล้ว')).toBeVisible();
  await next(page);
  await next(page);
  expect((await store(page, 'complaints')).length).toBe(before + 1);
  // Refresh แล้วอยู่ขั้นเดิม
  await page.reload();
  await expectStep(page, 4);
  // Restart Scenario → เรื่องที่สร้างระหว่างทางถูกถอยกลับ
  await panel(page).getByRole('button', { name: 'Restart Scenario' }).click();
  await page.getByRole('dialog').getByRole('button').last().click();
  await expectStep(page, 1);
  expect((await store(page, 'complaints')).length).toBe(before);
});

// ---------------- KI-V2-38: ขั้นตอน · URL · หน้าจอ · บทบาท · Demo State ต้องตรงกันหลังทุกการเปลี่ยนขั้น ----------------
type Sync = { step: number; url: RegExp; page: (p: Page) => Locator; role: string; state?: (d: { current: Record<string, string> }) => boolean };
async function expectInSync(page: Page, s: Sync) {
  await expectStep(page, s.step); // 1. ขั้นปัจจุบันในตัวควบคุม
  await expect(page).toHaveURL(s.url); // 2. URL ของเบราว์เซอร์
  await expect(s.page(page)).toBeVisible(); // 3. หน้าที่ Render จริง (ไม่ค้างที่ "กำลังโหลดหน้า...")
  await expect(page.locator('main').getByText('กำลังโหลดหน้า')).toHaveCount(0);
  await expect(page.getByText('เกิดข้อผิดพลาดในการแสดงผล')).toHaveCount(0);
  await expect.poll(async () => (await sessionState(page)).role).toBe(s.role); // 4. บทบาทที่คาดไว้
  const d = await demoState(page); // 5. Demo State ที่เกี่ยวข้อง
  expect(d.stepIndex).toBe(s.step - 1);
  expect(d.status).toBe('running');
  if (s.state) expect(s.state(d)).toBe(true);
}
const sessionState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session') ?? '{"state":{}}').state);
const back = (page: Page) => panel(page).locator('[data-demo="back"]');
async function confirmTransition(page: Page) {
  const ok = page.getByRole('dialog').getByRole('button', { name: /ดำเนินการต่อในมุม/ });
  await expect(ok).toBeVisible();
  await ok.click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('KI-V2-38: Scenario 4 — ขั้น · URL · หน้าจอ · บทบาท · Demo State สอดคล้องกันหลัง Next/Back เร็ว Refresh และ Restart', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await openAllScenarios(page);
  await page.getByRole('button', { name: 'Start Demo' }).nth(3).click();
  const mid = (await demoState(page)).current.merchantId as string;
  const shopName = (await store<{ id: string; shopName: string }>(page, 'merchants')).find((m) => m.id === mid)!.shopName;
  const shop = { step: 1, url: new RegExp(`/shop/${mid}$`), page: (p: Page) => p.locator('main').getByRole('heading', { name: shopName }).first(), role: 'consumer', state: (d: { current: Record<string, string> }) => d.current.merchantId === mid && !d.current.complaintId };
  const form = (step: number) => ({ step, url: new RegExp(`/report\\?merchant=${mid}$`), page: (p: Page) => p.locator('main').getByRole('heading', { name: 'แจ้งปัญหาการซื้อขาย' }), role: 'consumer' });
  await expectInSync(page, shop);

  await next(page);
  await expectInSync(page, form(2));
  await fillReportSample(page);
  await next(page);
  await expectInSync(page, form(3));
  const before = (await store(page, 'complaints')).length;
  await page.locator('main').getByRole('button', { name: 'ส่งเรื่อง (Submit)' }).click();
  await expect.poll(async () => (await store(page, 'complaints')).length).toBe(before + 1);
  await next(page);
  const cid = (await demoState(page)).current.complaintId as string;
  expect(cid).toMatch(/^CMP-/);
  const track = { step: 4, url: new RegExp(`/consumer/cases/${cid}$`), page: (p: Page) => p.locator('main').getByText(cid).first(), role: 'consumer', state: (d: { current: Record<string, string> }) => d.current.complaintId === cid };
  await expectInSync(page, track);

  // เปลี่ยนบทบาท → ร้านค้า (เจ้าของร้านเดียวกัน เห็นเรื่องเดียวกัน — ไม่ใช่ "ไม่มีสิทธิ์")
  await next(page, { expectTransition: true });
  const respond = { step: 5, url: new RegExp(`/m/complaints/${cid}$`), page: (p: Page) => p.locator('main').getByText(cid).first(), role: 'merchant', state: (d: { current: Record<string, string> }) => d.current.complaintId === cid };
  await expectInSync(page, respond);
  await expect(page.locator('main').getByText('ไม่มีสิทธิ์ดูเรื่องนี้')).toHaveCount(0);
  expect((await sessionState(page)).operatorId).toBe((await demoState(page)).current.operatorId);

  // ย้อนกลับข้ามบทบาท → ผู้บริโภค
  await back(page).click();
  await confirmTransition(page);
  await expectInSync(page, track);

  // กดย้อนกลับติดกันเร็ว ๆ 2 ครั้ง (ไม่รอหน้าจอระหว่างกัน) → ขั้น 2 และหน้าจอต้องตามขั้นจริง
  await back(page).click();
  await back(page).click();
  await expectInSync(page, form(2));
  await expect(panel(page).getByText('ขั้นนี้ทำเสร็จแล้ว')).toBeVisible();

  // กดถัดไปติดกันเร็ว ๆ 2 ครั้ง → ขั้น 4 โดยไม่ส่งเรื่องซ้ำ
  await expect(nextBtn(page)).toBeEnabled();
  await nextBtn(page).click();
  await expect(nextBtn(page)).toBeEnabled();
  await nextBtn(page).click();
  await expectInSync(page, track);
  expect((await store(page, 'complaints')).length).toBe(before + 1);

  // Refresh / Resume → ทั้ง 5 ส่วนยังตรงกัน
  await page.reload();
  await expectInSync(page, track);

  // Restart Scenario → ข้อมูลกลับจุดเริ่มต้น และทั้ง 5 ส่วนกลับขั้น 1
  await panel(page).getByRole('button', { name: 'Restart Scenario' }).click();
  await page.getByRole('dialog').getByRole('button').last().click();
  await expectInSync(page, shop);
  expect((await store(page, 'complaints')).length).toBe(before);
  // เล่นต่อหลัง Restart ได้ตามปกติ
  await next(page);
  await expectInSync(page, form(2));
});
