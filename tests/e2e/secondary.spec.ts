import type { Page } from '@playwright/test';
import { confirm, expect, fresh, open, store, test } from './helpers';

/** ปุ่มรอง: ดาวน์โหลด/พิมพ์/Export, การจัดการใบรับรอง, เข้าสู่ระบบ, การแจ้งเตือน, ตัวกรอง และจำลองหน้าจอ */
async function as(page: Page, session: Record<string, unknown>, path: string) {
  await fresh(page);
  await page.evaluate((s) => localStorage.setItem('smetrust:v1:session', JSON.stringify({ state: { role: 'consumer', consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {}, ...s }, version: 1 })), session);
  await open(page, path);
}
const merchant = (operatorId: string) => ({ role: 'merchant', operatorId, merchantLoggedIn: true });
const officer = { role: 'officer', officerId: 'OF-001' };
const readDownload = async (page: Page, click: () => Promise<void>) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), click()]);
  const chunks: Buffer[] = [];
  for await (const c of (await dl.createReadStream())!) chunks.push(c as Buffer);
  return { name: dl.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') };
};
/** แทนที่ window.print เพื่อตรวจว่าปุ่มพิมพ์เรียกใช้จริง (ไม่เปิดกล่องพิมพ์ของระบบ) */
const stubPrint = (page: Page) => page.evaluate(() => ((window as unknown as { __printed: number }).__printed = 0, (window.print = () => ((window as unknown as { __printed: number }).__printed += 1))));
const printed = (page: Page) => page.evaluate(() => (window as unknown as { __printed: number }).__printed);

test.describe('ดาวน์โหลด / พิมพ์ / Export', () => {
  test('Toolkit: ดาวน์โหลด Badge และ QR เป็นไฟล์ SVG ของร้านนั้น', async ({ page }) => {
    await as(page, merchant('OP-001'), '/m/toolkit');
    const badge = await readDownload(page, () => page.getByRole('button', { name: 'ดาวน์โหลด Badge (SVG)' }).click());
    expect(badge.name).toBe('sme-trust-badge-M-001.svg');
    expect(badge.text).toContain('<svg');
    expect(badge.text).toContain('บ้านผ้าคราม สกลนคร');
    expect(badge.text).toContain('ตัวอย่างใบรับรองสำหรับสาธิต');
    const qr = await readDownload(page, () => page.getByRole('button', { name: 'ดาวน์โหลด QR' }).click());
    expect(qr.name).toBe('sme-trust-qr-M-001.svg');
    expect(qr.text).toContain('<svg');
  });

  test('Toolkit: ร้านที่ใบรับรองใช้ไม่ได้ ปุ่มดาวน์โหลด Badge ถูกปิด', async ({ page }) => {
    await as(page, merchant('OP-004'), '/m/toolkit');
    await expect(page.getByRole('button', { name: 'ดาวน์โหลด Badge (SVG)' })).toBeDisabled();
  });

  test('Passport และใบรับรองการอบรม: ปุ่มพิมพ์ / บันทึก PDF เรียกพิมพ์จริง', async ({ page }) => {
    await as(page, merchant('OP-001'), '/m/passport');
    await stubPrint(page);
    await page.getByRole('button', { name: 'พิมพ์ / บันทึก PDF' }).click();
    expect(await printed(page)).toBe(1);
    await open(page, '/m/training/CRS-01');
    await stubPrint(page);
    const cert = page.getByRole('button', { name: 'ดูใบรับรองการอบรม' });
    if (await cert.isVisible()) await cert.click();
    await page.getByRole('button', { name: 'พิมพ์ใบรับรอง' }).click();
    expect(await printed(page)).toBe(1);
  });

  test('Reports: Export CSV ภาษาไทย (มี BOM สำหรับ Excel) จำนวนแถวตรงกับร้านค้า', async ({ page }) => {
    await as(page, officer, '/o/reports');
    const csv = await readDownload(page, () => page.getByRole('button', { name: 'Export CSV' }).click());
    expect(csv.name).toMatch(/^sme-trust-report-demo-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.text.replace(/^﻿/, '').trim().split(/\r?\n/);
    expect(lines[0]).toContain('ชื่อร้าน');
    expect(lines.length - 1).toBe(12); // ร้านค้าในข้อมูลตัวอย่าง
    expect(csv.text).toContain('บ้านผ้าคราม สกลนคร');
  });

  test('Admin: Export Demo State (JSON) ครบทุก Store', async ({ page }) => {
    await as(page, { role: 'admin', officerId: 'AD-001' }, '/admin/data');
    const json = await readDownload(page, () => page.getByRole('button', { name: 'Export Demo State (JSON)' }).click());
    const data = JSON.parse(json.text);
    expect(Object.keys(data)).toHaveLength(13); // 11 Store ของ v1 + การเชื่อมต่อ Marketplace และผลประเมินของ v2
    expect(data['ร้านค้า']).toHaveLength(12);
    expect(data['ประวัติ AI Simulation']).toHaveLength(4);
  });
});

test.describe('งานเจ้าหน้าที่', () => {
  test('จัดการใบรับรอง: ระงับ (ต้องมีเหตุผล) → คืนสถานะ, จำลองหมดอายุ → ต่ออายุ — ผู้บริโภคเห็นสถานะตรงกัน', async ({ page }) => {
    await as(page, officer, '/o/certification');
    const row = page.locator('tr', { hasText: 'SMT-2569-000105' });
    await row.getByRole('button', { name: 'ระงับ' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button').last().click();
    await expect(dlg.getByText(/อย่างน้อย 5 ตัวอักษร/)).toBeVisible(); // ไม่กรอกเหตุผล → ไม่ยอม
    await confirm(page, 'ทดสอบการระงับจาก E2E');
    await expect(row.getByText('ถูกระงับ')).toBeVisible();
    await open(page, '/verify/SMT-2569-000105');
    await expect(page.getByText('ถูกระงับการรับรอง').first()).toBeVisible();
    await open(page, '/o/certification');
    await page.locator('tr', { hasText: 'SMT-2569-000105' }).getByRole('button', { name: 'คืนสถานะ' }).click();
    await confirm(page, 'ตรวจสอบแล้วไม่พบปัญหา');
    await expect(page.locator('tr', { hasText: 'SMT-2569-000105' }).getByText('ใช้งานได้')).toBeVisible();
    await page.locator('tr', { hasText: 'SMT-2569-000105' }).getByRole('button', { name: 'จำลองหมดอายุ' }).click();
    await confirm(page);
    await page.locator('tr', { hasText: 'SMT-2569-000105' }).getByRole('button', { name: 'ต่ออายุ' }).click();
    await confirm(page);
    const certs = await store<{ merchantId: string; status: string }>(page, 'certifications');
    expect(certs.filter((c) => c.merchantId === 'M-006' && c.status === 'active')).toHaveLength(1);
  });

  test('ช่องทางขาย: ยืนยัน และไม่ผ่าน (ต้องมีเหตุผล)', async ({ page }) => {
    await as(page, officer, '/o/verification');
    await page.locator('tr', { hasText: 'baanphakram.demo' }).getByRole('button', { name: 'ยืนยัน' }).click();
    await confirm(page);
    await page.locator('tr', { hasText: 'kruamaemalee-shop' }).getByRole('button', { name: 'ไม่ผ่าน' }).click();
    await confirm(page, 'ไม่พบหลักฐานความเป็นเจ้าของ');
    const ms = await store<{ id: string; channels: { handle: string; status: string }[] }>(page, 'merchants');
    expect(ms.find((m) => m.id === 'M-001')!.channels.find((c) => c.handle === 'baanphakram.demo')!.status).toBe('verified');
    expect(ms.find((m) => m.id === 'M-002')!.channels.find((c) => c.handle === 'kruamaemalee-shop')!.status).toBe('rejected');
  });

  test('คำขอลงทะเบียน: ขอเอกสารเพิ่มเติม → ร้านค้าเห็นเหตุผล', async ({ page }) => {
    await as(page, officer, '/o/applications/APP-2569-0002');
    await page.getByRole('button', { name: 'เริ่มตรวจสอบ' }).click();
    await page.getByRole('button', { name: 'ขอเอกสารเพิ่มเติม' }).click();
    await confirm(page, 'กรุณาแนบใบอนุญาตผลิตอาหารฉบับล่าสุด');
    expect((await store<{ id: string; status: string }>(page, 'applications')).find((a) => a.id === 'APP-2569-0002')!.status).toBe('need_info');
    await page.evaluate(() => localStorage.setItem('smetrust:v1:session', JSON.stringify({ state: { role: 'merchant', operatorId: 'OP-002', merchantLoggedIn: true, shopDrafts: {} }, version: 1 })));
    await open(page, '/m/shop');
    await expect(page.getByText('กรุณาแนบใบอนุญาตผลิตอาหารฉบับล่าสุด').first()).toBeVisible();
  });

  test('Admin Dashboard: ตัวกรองจังหวัดเปลี่ยน KPI และกราฟดูเป็นตารางได้ / Audit Log ค้นหาได้', async ({ page }) => {
    await as(page, { role: 'admin', officerId: 'AD-001' }, '/admin');
    const kpi = page.locator('div', { hasText: /^ร้านค้าที่ลงทะเบียน/ }).locator('p').filter({ hasText: /^\d+$/ }).first();
    const all = Number(await kpi.innerText());
    await page.getByLabel('จังหวัด').selectOption('สกลนคร');
    await expect.poll(async () => Number(await kpi.innerText())).toBeLessThan(all);
    await page.getByText('ดูเป็นตาราง').first().click();
    await expect(page.locator('details[open] table').first()).toBeVisible();
    await open(page, '/admin/audit');
    await page.getByPlaceholder('ค้นหาการกระทำ เป้าหมาย หรือผู้ดำเนินการ').fill('ระงับ');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
    await expect(page.locator('tbody tr').first()).toContainText('ระงับ');
  });
});

test.describe('ผู้บริโภค / ผู้ประกอบการ', () => {
  test('ผู้บริโภคขอเจรจาเพิ่มเติม และขอส่งต่อเจ้าหน้าที่ (ต้องมีเหตุผล)', async ({ page }) => {
    await as(page, { role: 'consumer', consumerId: 'CS-002' }, '/consumer/cases/CMP-2569-0002');
    await page.getByRole('button', { name: 'ขอเจรจาเพิ่มเติม' }).click();
    await confirm(page, 'ขอให้ร้านเสนอเปลี่ยนสินค้าแทนการคืนเงิน');
    let c = (await store<{ id: string; status: string; offers: { status: string }[] }>(page, 'complaints')).find((x) => x.id === 'CMP-2569-0002')!;
    expect(c.offers.some((o) => o.status === 'negotiate')).toBe(true);
    await page.getByRole('button', { name: 'ขอส่งต่อเจ้าหน้าที่' }).click();
    await confirm(page, 'ตกลงกับร้านค้าไม่ได้');
    c = (await store<{ id: string; status: string; offers: { status: string }[] }>(page, 'complaints')).find((x) => x.id === 'CMP-2569-0002')!;
    expect(c.status).toBe('escalated');
    await expect(page.getByText('ส่งต่อเจ้าหน้าที่แล้ว').first()).toBeVisible();
  });

  test('การแจ้งเตือน: อ่านทั้งหมด → ไม่มีรายการที่ยังไม่อ่าน', async ({ page }) => {
    await as(page, merchant('OP-001'), '/m/notifications');
    await page.getByRole('button', { name: 'อ่านทั้งหมด' }).click();
    await expect(page.getByText(/ยังไม่อ่าน [1-9]/)).toHaveCount(0);
    const unread = (await store<{ recipientId?: string; read: boolean }>(page, 'notifications')).filter((n) => n.recipientId === 'OP-001' && !n.read);
    expect(unread).toHaveLength(0);
  });

  test('ร้านค้าหลายร้าน: Shop Switcher สลับร้านที่ใช้งาน (OP-008)', async ({ page }) => {
    await as(page, merchant('OP-008'), '/m/shop');
    await page.getByLabel(/ร้านค้า/).first().selectOption('M-012');
    await expect(page.getByRole('heading', { name: /เฮลท์พลัสช็อป/ }).first()).toBeVisible();
  });

  test('ทำเนียบร้านค้า: กรองหมวดและจังหวัด', async ({ page }) => {
    await as(page, {}, '/directory');
    const count = () => page.locator('main a[href*="/shop/"]').count();
    const all = await count();
    await page.getByLabel('จังหวัด').selectOption('จันทบุรี');
    await expect.poll(count).toBeLessThan(all);
    await expect(page.locator('main').getByText('ผลไม้สดจันทบุรี').first()).toBeVisible();
  });
});

test.describe('เข้าสู่ระบบ', () => {
  test('PIN ผิด 5 ครั้ง → ล็อก → ลืม PIN (OTP) → ตั้งใหม่ → เข้าสู่ระบบด้วย PIN ใหม่', async ({ page }) => {
    await as(page, { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: false }, '/login');
    const pad = async (digits: string) => {
      for (const d of digits) await page.locator('main').getByRole('button', { name: d, exact: true }).first().click();
    };
    for (let k = 0; k < 4; k++) await pad('999999');
    await expect(page.getByText('PIN ไม่ถูกต้อง (เหลือ 1 ครั้ง)')).toBeVisible();
    await pad('999999');
    await expect(page.getByText(/ผิดครบ 5 ครั้ง/)).toBeVisible();
    await page.getByRole('button', { name: 'ลืม PIN?' }).click();
    const dlg = page.getByRole('dialog');
    const otp = (await dlg.locator('.font-mono').innerText()).trim();
    await dlg.getByLabel('รหัส OTP 6 หลัก').fill(otp);
    await dlg.getByRole('button', { name: 'ยืนยัน OTP' }).click();
    for (const d of '147258147258') await dlg.getByRole('button', { name: d, exact: true }).click();
    await expect(dlg).toBeHidden();
    await pad('147258');
    await expect(page).toHaveURL(/\/m$/);
  });

  test('เข้าสู่ระบบด้วยชีวมิติ (จำลอง)', async ({ page }) => {
    await as(page, { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: false }, '/login');
    await page.getByRole('button', { name: 'เข้าสู่ระบบด้วยลายนิ้วมือ (จำลอง)' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page).toHaveURL(/\/m$/);
  });
});

test('จำลองหน้าจอ: สลับอุปกรณ์ หมุนจอ และออกจากโหมดจำลองที่หน้าเดิม', async ({ page }) => {
  await as(page, {}, '/preview?device=phone&path=/check');
  const frame = page.locator('iframe');
  await expect(frame).toHaveAttribute('width', '390');
  await page.getByRole('radio', { name: /iPad/ }).click();
  await expect(frame).toHaveAttribute('width', '820');
  await page.getByTitle('หมุนจอ').click();
  await expect(frame).toHaveAttribute('width', '1180');
  await expect(page.frameLocator('iframe').getByText('ตรวจสอบร้านค้าก่อนซื้อ').first()).toBeVisible();
  await page.getByRole('button', { name: /ออกจากโหมดจำลอง/ }).click();
  await expect(page).toHaveURL(/\/check$/);
});
