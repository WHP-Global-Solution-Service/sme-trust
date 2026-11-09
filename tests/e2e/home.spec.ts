import type { Page } from '@playwright/test';
import { expect, fresh, open, panel, test } from './helpers';

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
  await expect(main(page)).toContainText('สาธิตระบบ 17 เส้นทาง');
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
  await open(page, '/');
  await cta(page, 'ทดลอง Demo').click();
  await expect(page).toHaveURL(/\/demo$/);
  await open(page, '/');
  await page.getByRole('banner').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('หน้าแรก: Demo ตาม User Journey เริ่ม Scenario/Journey จริง', async ({ page }) => {
  await fresh(page);
  await main(page).getByRole('button', { name: 'เริ่ม Scenario 9B' }).click();
  await expect(panel(page).getByText('Scenario 9B:')).toBeVisible();
  await open(page, '/');
  await main(page).getByRole('button', { name: 'เริ่ม Full Journey: Consumer Protection' }).click();
  // กำลังสาธิต 9B อยู่ → ต้องยืนยันก่อนรีเซ็ต (ไม่รีเซ็ตเงียบ)
  await expect(page.getByRole('dialog')).toContainText('รีเซ็ตข้อมูลสาธิต');
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่ม' }).click();
  await expect(panel(page).getByText('Scenario 1:')).toBeVisible();
  await open(page, '/');
  await main(page).getByRole('button', { name: 'เริ่ม Full Journey: Marketplace & Trust' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่ม' }).click();
  await expect(panel(page).getByText('Scenario 9:')).toBeVisible();
  await expect(panel(page).getByText('Full Journey — Marketplace & Trust Assessment')).toBeVisible();
  await open(page, '/');
  await main(page).getByRole('button', { name: 'ดู Demo ทั้งหมด' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(main(page).getByTestId('journey-guide')).toContainText('เส้นทางอัตโนมัติ — จากเชื่อมร้านค้าจนถึงได้รับผลประเมิน');
});

for (const width of [320, 375, 390, 768, 1440]) {
  test(`หน้าแรก ${width}px: ไม่มี Horizontal overflow · เข้าสู่ระบบมองเห็นใน Header · CTA ใช้งานได้`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ['เชื่อมร้านค้าออนไลน์', 'ลงทะเบียนด้วยตนเอง', 'ตรวจสอบร้านค้า', 'ทดลอง Demo']) await expect(cta(page, name)).toBeVisible();
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
  await open(page, '/');
  await session(page, { role: 'consumer', merchantLoggedIn: false });
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
