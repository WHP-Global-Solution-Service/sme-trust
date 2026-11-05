import type { Page } from '@playwright/test';
import { expect, fresh, open, panel, test } from './helpers';

/** หน้าแรก Concept SME Trust v2 — ข้อความ CTA ลิงก์ Demo และ Responsive */
const main = (page: Page) => page.locator('main');
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...patch } }));
  }, s);
const cta = (page: Page, name: string) => main(page).getByRole('region', { name: 'SME Trust v2' }).getByRole('button', { name, exact: true });

test('หน้าแรก: ข้อความตาม Concept v2 และไม่มีข้อความเก่า', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('เชื่อมข้อมูลร้านค้าออนไลน์ ประเมินความน่าเชื่อถืออย่างโปร่งใส');
  for (const t of ['ไม่ใช่ Marketplace', 'ไม่ขายสินค้า', 'ไม่รับชำระเงิน', 'ไม่ได้เชื่อมต่อ API จริง', 'Data Confidence', 'Certification Level', 'แนะนำสำหรับผู้บริหาร']) await expect(main(page).getByText(t, { exact: false }).first()).toBeVisible();
  await expect(main(page)).not.toContainText('8 เรื่อง');
  await expect(main(page)).not.toContainText('Prevention First');
  await expect(main(page)).toContainText('สาธิตระบบ 15 เส้นทาง');
});

test('หน้าแรก: CTA ไปยัง Route และ Flow จริง', async ({ page }) => {
  // ผู้เข้าชมที่ยังไม่มีบัญชีบนอุปกรณ์นี้ → สมัครก่อน แล้วปุ่มสุดท้ายไปต่อที่การเชื่อมร้านค้า
  await fresh(page);
  await session(page, { role: 'consumer', operatorId: '', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/register$/);
  // มีบัญชีและเข้าสู่ระบบแล้ว → ไปที่ขั้นตอนเชื่อม Marketplace / ลงทะเบียนเองโดยตรง
  await open(page, '/');
  await session(page, { role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);
  await open(page, '/');
  await cta(page, 'ลงทะเบียนด้วยตนเอง').click();
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await expect(main(page).getByText('B. ลงทะเบียนด้วยตนเอง')).toBeVisible();
  // มีบัญชีแต่ยังไม่เข้าสู่ระบบ → หน้าเข้าสู่ระบบ แล้วกลับไปยังขั้นตอนที่เลือก
  await open(page, '/');
  await session(page, { role: 'consumer', operatorId: 'OP-013', merchantLoggedIn: false });
  await page.reload();
  await cta(page, 'เชื่อมร้านค้าออนไลน์').click();
  await expect(page).toHaveURL(/\/login$/);
  await open(page, '/');
  await cta(page, 'เข้าสู่ระบบ').click();
  await expect(page).toHaveURL(/\/login$/);
  await open(page, '/');
  await cta(page, 'ตรวจสอบร้านค้า').click();
  await expect(page).toHaveURL(/\/check$/);
});

test('หน้าแรก: ลิงก์ Demo — Full Journey v2 (แนะนำ), Scenario 9–13/9A/9B และ Full Journey v1', async ({ page }) => {
  await fresh(page);
  await main(page).getByRole('button', { name: 'Scenario 9–13 · 9A · 9B' }).click();
  await expect(page).toHaveURL(/\/demo\?track=v2$/);
  await expect(page.getByRole('tab', { name: /v2 — Marketplace Intelligence/ })).toHaveAttribute('aria-selected', 'true');
  await open(page, '/');
  await main(page).getByRole('link', { name: /Full Journey v1/ }).click();
  await expect(page).toHaveURL(/\/demo\?track=v1$/);
  await expect(page.getByRole('tab', { name: /v1 — Consumer Protection/ })).toHaveAttribute('aria-selected', 'true');
  await open(page, '/');
  await main(page).getByRole('button', { name: 'เริ่ม Full Journey v2' }).click();
  await expect(panel(page).getByText('Scenario 9:')).toBeVisible();
  await expect(panel(page).getByText('Full Journey v2 — Marketplace Intelligence')).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`หน้าแรก ${width}px: ไม่มี Horizontal overflow และ CTA ใช้งานได้`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ['เชื่อมร้านค้าออนไลน์', 'ลงทะเบียนด้วยตนเอง', 'เข้าสู่ระบบ', 'ตรวจสอบร้านค้า']) await expect(cta(page, name)).toBeVisible();
  });
}
