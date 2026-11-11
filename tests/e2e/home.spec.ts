import type { Page } from '@playwright/test';
import { DEMO_TITLE, expect, expectDemoTitle, fresh, open, panel, test } from './helpers';

/** หน้าแรก Executive Ready — ข้อความ CTA ขั้นตอน Demo ตาม User Journey และ Responsive */
const main = (page: Page) => page.locator('main');
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...patch } }));
  }, s);
const cta = (page: Page, name: string) => main(page).getByRole('region', { name: 'SME Trust', exact: true }).getByRole('button', { name, exact: true });

test('หน้าแรก: Hero ตามข้อกำหนด · 5 ขั้นตอน · 2 ช่องทางสมัคร · Disclaimer และไม่มี v1/v2', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('เชื่อมข้อมูลร้านค้า ประเมินความน่าเชื่อถือ สร้างความมั่นใจในการซื้อขายออนไลน์');
  await expect(main(page).getByTestId('not-marketplace')).toHaveText('ไม่ใช่ Marketplace ไม่ขายสินค้า และไม่รับชำระเงิน');
  await expect(main(page).getByRole('list', { name: 'ขั้นตอนการทำงานของ SME Trust' }).getByRole('listitem')).toHaveCount(5);
  await expect(main(page).getByText('เจ้าหน้าที่ตรวจสอบเฉพาะกรณีจำเป็น')).toBeVisible();
  await expect(main(page).locator('[data-path="A"]')).toContainText('Auto-Fill');
  await expect(main(page).locator('[data-path="B"]')).toContainText('เลือกประเภทผู้ประกอบการ');
  await expect(main(page).getByText('ระบบสร้างผลประเมินและ Assessment Badge อัตโนมัติ เมื่อข้อมูลผ่านเกณฑ์')).toBeVisible();
  await expect(main(page).getByTestId('home-mock-assessment')).toContainText('ไม่ใช่การรับรอง');
  await expect(main(page).getByTestId('prototype-disclaimer')).toHaveText('ระบบนี้เป็นต้นแบบเพื่อสาธิตแนวคิด ใช้ข้อมูลจำลอง และยังไม่เชื่อมต่อกับ Shopee, Lazada, DBD หรือ สคบ. จริง');
  await expect(main(page)).toContainText('ทดลองใช้งานด้วยข้อมูลจำลอง');
  const text = (await main(page).innerText()).replace(/v2\.1-sim/g, '');
  expect(text).not.toMatch(/\bv1\b|\bv2\b|Prevention First|8 Scenario/);
});

test('หน้าแรก: CTA ไปยัง Route และ Flow จริง', async ({ page }) => {
  // ยังไม่มีบัญชี → สมัครก่อน แล้วปุ่มสุดท้ายไปต่อที่การเชื่อมร้านค้า
  await fresh(page);
  await session(page, { role: 'consumer', operatorId: '', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/register$/);
  // เข้าสู่ระบบแล้ว → ขั้นตอนเชื่อม Marketplace / ลงทะเบียนเองโดยตรง
  await open(page, '/');
  await session(page, { role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);
  await open(page, '/');
  await cta(page, 'ลงทะเบียนด้วยตนเอง').click();
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  // ปุ่มในการ์ดช่องทาง B ไปที่เดียวกัน
  await open(page, '/');
  await main(page).locator('[data-path="B"]').getByRole('button').click();
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  // มีบัญชีแต่ยังไม่เข้าสู่ระบบ → หน้าเข้าสู่ระบบ
  await open(page, '/');
  await session(page, { role: 'consumer', operatorId: 'OP-013', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/login$/);
  await open(page, '/');
  await cta(page, 'ตรวจสอบร้านค้า').click();
  await expect(page).toHaveURL(/\/check$/);
  // บัญชีที่มีร้านลงทะเบียนแล้ว (OP-001 / M-001) → ไม่พากลับไปลงทะเบียนร้านใหม่
  await open(page, '/');
  await session(page, { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: true });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  await open(page, '/');
  await cta(page, 'ลงทะเบียนด้วยตนเอง').click();
  await expect(page).toHaveURL(/\/m\/shop$/);
  await open(page, '/');
  await page.getByRole('banner').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('หน้าแรก: Primary Action เดียวเริ่ม Demo หลักทันที · กรณีพิเศษเริ่มได้ · ไม่มีเลข Scenario / Full Journey', async ({ page }) => {
  await fresh(page);
  await expect(page.getByTestId('home-main-cta')).toHaveCount(1);
  await expect(page.getByTestId('home-main-cta')).toHaveText(DEMO_TITLE.s9a);
  expect(await main(page).innerText()).not.toMatch(/Scenario \d|Full Journey/);
  await page.getByTestId('home-main-cta').click();
  await expectDemoTitle(page, 's9a');
  await expect(page).toHaveURL(/\/m$/);
  // กำลังสาธิตอยู่ → เริ่มกรณีพิเศษต้องยืนยันก่อนรีเซ็ต (ไม่รีเซ็ตเงียบ)
  await open(page, '/');
  await main(page).locator(`[data-journey="${DEMO_TITLE.s15}"]`).getByRole('button', { name: 'ทดลองกรณีนี้' }).click();
  await expect(page.getByRole('dialog')).toContainText('รีเซ็ตข้อมูลสาธิต');
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่มตั้งแต่ต้น' }).click();
  await expectDemoTitle(page, 's15');
  await open(page, '/');
  await main(page).getByRole('link', { name: 'หน้า Demo' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByTestId('main-cta')).toHaveText(DEMO_TITLE.s9a);
});

for (const width of [320, 375, 390, 768, 1440]) {
  test(`หน้าแรก ${width}px: ไม่มี Horizontal overflow · เข้าสู่ระบบมองเห็นใน Header · CTA ใช้งานได้`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of [DEMO_TITLE.s9a, 'เชื่อมร้านค้าออนไลน์', 'ลงทะเบียนด้วยตนเอง', 'ตรวจสอบร้านค้า']) await expect(cta(page, name)).toBeVisible();
    // KI-V2-31: ปุ่มเข้าสู่ระบบอยู่ใน Header ทุกขนาดจอ ไม่ล้นจอ และไม่ทับกับปุ่ม Demo Mode
    const banner = page.getByRole('banner');
    const login = banner.getByRole('button', { name: 'เข้าสู่ระบบ' });
    const demoBtn = banner.getByRole('button', { name: 'Demo Mode' });
    await expect(login).toBeVisible();
    await expect(login).toBeInViewport({ ratio: 1 });
    await expect(demoBtn).toBeInViewport({ ratio: 1 });
    const a = (await login.boundingBox())!;
    const b = (await demoBtn.boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    expect(a.height).toBeGreaterThanOrEqual(40); // พื้นที่แตะเพียงพอบนมือถือ
    // Header สูงบรรทัดเดียว (ไม่ห่อจนแน่น)
    expect((await banner.boundingBox())!.height).toBeLessThanOrEqual(64);
  });
}

test('มือถือ 375px: เข้าสู่ระบบจาก Header และกลับเข้าสู่ขั้นตอนลงทะเบียนที่ตั้งใจไว้หลังเข้าสู่ระบบ', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await fresh(page);
  // ปุ่มเข้าสู่ระบบใน Header → หน้าเข้าสู่ระบบ → เข้าสู่ระบบสำเร็จ → หน้าหลักผู้ประกอบการ
  await page.getByRole('banner').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'เข้าสู่ระบบด้วยลายนิ้วมือ (จำลอง)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/m$/);
  // ออกจากระบบ (มีบัญชีแต่ยังไม่เข้าสู่ระบบ) → CTA "เชื่อมร้านค้าออนไลน์" → เข้าสู่ระบบ → กลับไปที่ขั้นตอนเชื่อม Marketplace
  // ใช้บัญชีตัวอย่างที่ยังไม่มีร้าน (OP-013) — บัญชีที่มีร้านแล้วจะไปหน้าช่องทางขายออนไลน์แทน (ทดสอบใน CTA test)
  await open(page, '/');
  await session(page, { role: 'consumer', operatorId: 'OP-013', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'เข้าสู่ระบบด้วยลายนิ้วมือ (จำลอง)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);
  // CTA "ลงทะเบียนด้วยตนเอง" → เข้าสู่ระบบ → กลับไปที่แบบลงทะเบียนร้าน
  await open(page, '/');
  await session(page, { role: 'consumer', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'ลงทะเบียนด้วยตนเอง').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'เข้าสู่ระบบด้วยลายนิ้วมือ (จำลอง)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop$/);
});
