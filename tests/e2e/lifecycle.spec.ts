import type { Page } from '@playwright/test';
import { confirm, expect, fresh, open, store, test } from './helpers';

/**
 * วงจรใบรับรองและคำขอ (ข้ามบทบาท ผ่าน UI จริง): ยื่นขอระดับสูงขึ้น, ต่ออายุ, เพิกถอน, ไม่อนุมัติคำขอ,
 * เพิ่มช่องทางขาย และ Pagination ของตาราง
 */
type App = { id: string; merchantId: string; type: string; status: string; requestedLevel: number };
type Cert = { id: string; merchantId: string; level: number; status: string; supersededBy?: string };

const setSession = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((x) => localStorage.setItem('smetrust:v2:session', JSON.stringify({ state: { consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {}, ...x }, version: 1 })), s);
const asOfficer = (page: Page) => setSession(page, { role: 'officer', officerId: 'OF-001' });
const asMerchant = (page: Page, operatorId: string) => setSession(page, { role: 'merchant', operatorId, merchantLoggedIn: true });
const asConsumer = (page: Page) => setSession(page, { role: 'consumer', consumerId: 'CS-001' });

/** กดปุ่มแล้วยืนยันกล่อง (ใส่เหตุผลถ้ามีช่อง) */
async function act(page: Page, name: string | RegExp, reason?: string) {
  await page.locator('main').getByRole('button', { name, exact: typeof name === 'string' }).first().click();
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible({ timeout: 1500 }).catch(() => false)) {
    const needsReason = (await dlg.locator('textarea').count()) > 0;
    await confirm(page, needsReason ? reason ?? 'บันทึกจากการทดสอบ E2E' : undefined);
  }
}

/** เจ้าหน้าที่ตรวจและอนุมัติคำขอผ่าน UI */
async function approve(page: Page, appId: string) {
  await asOfficer(page);
  await open(page, `/o/applications/${appId}`);
  await page.getByRole('button', { name: 'เริ่มตรวจสอบ' }).click();
  for (const b of await page.getByRole('button', { name: 'ผ่าน', exact: true }).all()) await b.click();
  await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await confirm(page, undefined, 'อนุมัติ');
  await expect(page.getByText('อนุมัติแล้ว').first()).toBeVisible();
}

test('ยื่นขอ Trusted SME: ไม่อนุมัติคำขอเดิม → ร้านเห็นเหตุผล → ปิดคำเตือน → ยื่นใหม่ → อนุมัติ → ผู้บริโภคเห็น "ได้รับการรับรอง"', async ({ page }) => {
  await fresh(page);
  await asMerchant(page, 'OP-006');
  await open(page, '/m/certification');
  const applyBtn = page.getByRole('button', { name: 'ยื่นขอ Trusted SME', exact: true });
  await expect(page.getByText('มีคำขอรออนุมัติ')).toBeVisible();
  await expect(applyBtn).toBeDisabled(); // มีคำขอค้างอยู่ (APP-2569-0007) และยังมีคำเตือนค้าง

  // เจ้าหน้าที่ไม่อนุมัติคำขอเดิม เพราะยังมีคำเตือนที่ยังไม่ปิด
  await asOfficer(page);
  await open(page, '/o/applications/APP-2569-0007');
  await page.getByRole('button', { name: 'ไม่อนุมัติ', exact: true }).click();
  await confirm(page, 'ยังมีคำเตือนเรื่องเงื่อนไขการเคลมที่ยังไม่ปิด');
  await asMerchant(page, 'OP-006');
  await open(page, '/m/certification');
  await expect(page.getByText('คำขอ APP-2569-0007 ไม่ได้รับอนุมัติ')).toBeVisible();
  await expect(page.getByText('ยังมีคำเตือนเรื่องเงื่อนไขการเคลมที่ยังไม่ปิด').first()).toBeVisible();
  await expect(applyBtn).toBeDisabled(); // ยังไม่ผ่านเกณฑ์
  await expect(page.getByText(/ต้องผ่านเกณฑ์ทุกข้อก่อนยื่นคำขอ/).first()).toBeVisible();

  // เจ้าหน้าที่ตรวจผลการแก้ไขคำเตือนให้ผ่าน
  await asOfficer(page);
  await open(page, '/o/warnings/WRN-2569-0006');
  await act(page, 'เริ่มตรวจผล');
  await act(page, /ตรวจผลผ่าน/, 'หลักฐานนโยบายเคลมครบถ้วน');
  expect((await store<{ id: string; status: string }>(page, 'warnings')).find((w) => w.id === 'WRN-2569-0006')!.status).toBe('completed');

  // ร้านยื่นคำขอใหม่ได้ และยื่นซ้ำไม่ได้ระหว่างรอ
  await asMerchant(page, 'OP-006');
  await open(page, '/m/certification');
  await expect(applyBtn).toBeEnabled();
  await applyBtn.click();
  await confirm(page);
  await expect(page.getByText('มีคำขอรออนุมัติ')).toBeVisible();
  await expect(applyBtn).toBeDisabled();
  const app = (await store<App>(page, 'applications')).find((a) => a.merchantId === 'M-006' && a.status === 'submitted' && a.requestedLevel === 3)!;
  expect(app).toBeTruthy();

  await approve(page, app.id);
  const certs = (await store<Cert>(page, 'certifications')).filter((c) => c.merchantId === 'M-006' && c.status === 'active');
  expect(certs).toHaveLength(1);
  expect(certs[0].level).toBe(3);

  await asConsumer(page);
  await open(page, `/verify/${certs[0].id}`);
  await expect(page.getByText('ได้รับการรับรอง').first()).toBeVisible();
});

test('ต่ออายุใบรับรอง: เจ้าหน้าที่จำลองหมดอายุ → ร้านยื่นต่ออายุ → อนุมัติ → ใบเดิมถูกแทนที่', async ({ page }) => {
  await fresh(page);
  await asOfficer(page);
  await open(page, '/o/certification');
  await page.locator('tr', { hasText: 'SMT-2569-000104' }).getByRole('button', { name: 'จำลองหมดอายุ' }).click();
  await confirm(page);

  await asMerchant(page, 'OP-005');
  await open(page, '/m/certification');
  await expect(page.getByText('Certificate Expired')).toBeVisible();
  await page.getByRole('button', { name: 'ยื่นต่ออายุ' }).click();
  await confirm(page);
  await expect(page.getByText('มีคำขอรออนุมัติ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ยื่นต่ออายุ' })).toHaveCount(0);
  const app = (await store<App>(page, 'applications')).find((a) => a.merchantId === 'M-005' && a.status === 'submitted')!;
  expect(app).toBeTruthy();

  await approve(page, app.id);
  const certs = (await store<Cert>(page, 'certifications')).filter((c) => c.merchantId === 'M-005');
  const active = certs.filter((c) => c.status === 'active');
  expect(active).toHaveLength(1);
  expect(active[0].id).not.toBe('SMT-2569-000104');

  await asConsumer(page);
  await open(page, '/verify/SMT-2569-000104');
  await expect(page.getByText('ใบรับรองนี้ถูกแทนที่แล้ว')).toBeVisible();
  await expect(page.getByRole('link', { name: active[0].id })).toBeVisible();
});

test('เพิกถอนใบรับรอง (ระงับ → เพิกถอน พร้อมเหตุผล) → ผู้บริโภคเห็นถูกเพิกถอน และร้านใช้ Badge ไม่ได้', async ({ page }) => {
  await fresh(page);
  await asOfficer(page);
  await open(page, '/o/certification');
  const row = () => page.locator('tr', { hasText: 'SMT-2569-000105' });
  await row().getByRole('button', { name: 'ระงับ' }).click();
  await confirm(page, 'พบหลักฐานการโฆษณาเกินจริงซ้ำ');
  await row().getByRole('button', { name: 'เพิกถอน' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button').last().click();
  await expect(dlg.getByText(/อย่างน้อย 5 ตัวอักษร/)).toBeVisible(); // ต้องมีเหตุผล
  await confirm(page, 'ไม่แก้ไขตามคำเตือนภายในกำหนด');
  await expect(row().getByText('ถูกเพิกถอน')).toBeVisible();
  expect((await store<Cert>(page, 'certifications')).find((c) => c.id === 'SMT-2569-000105')!.status).toBe('revoked');

  await asConsumer(page);
  await open(page, '/verify/SMT-2569-000105');
  await expect(page.getByText('ถูกเพิกถอนการรับรอง').first()).toBeVisible();
  await asMerchant(page, 'OP-006');
  await open(page, '/m/certification');
  await expect(page.getByText('Certificate Revoked')).toBeVisible();
  await expect(page.getByText('ไม่แก้ไขตามคำเตือนภายในกำหนด').first()).toBeVisible();
  await open(page, '/m/toolkit');
  await expect(page.getByRole('button', { name: 'ดาวน์โหลด Badge (SVG)' })).toBeDisabled();
});

test('ไม่อนุมัติคำขอลงทะเบียน (ต้องมีเหตุผล) → ร้านค้าเห็นเหตุผลและวิธียื่นใหม่ → ยื่นคำขออีกครั้ง', async ({ page }) => {
  await fresh(page);
  await asOfficer(page);
  await open(page, '/o/applications/APP-2569-0002');
  await page.getByRole('button', { name: 'เริ่มตรวจสอบ' }).click();
  await page.getByRole('button', { name: 'ไม่อนุมัติ', exact: true }).click();
  await confirm(page, 'เอกสารใบอนุญาตไม่ตรงกับชื่อร้าน');
  await expect(page.getByText('เอกสารใบอนุญาตไม่ตรงกับชื่อร้าน').first()).toBeVisible();
  expect((await store<App>(page, 'applications')).find((a) => a.id === 'APP-2569-0002')!.status).toBe('rejected');

  await asMerchant(page, 'OP-002');
  await open(page, '/m/shop');
  await expect(page.getByText('คำขอไม่ได้รับอนุมัติ')).toBeVisible();
  await expect(page.getByText('เอกสารใบอนุญาตไม่ตรงกับชื่อร้าน').first()).toBeVisible();
  await page.getByPlaceholder('อธิบายสิ่งที่แก้ไขหรือแนบเพิ่ม').fill('แนบใบอนุญาตที่ชื่อตรงกับร้านแล้ว');
  await page.getByRole('button', { name: 'ยื่นคำขออีกครั้ง' }).click();
  await expect.poll(async () => (await store<App>(page, 'applications')).find((a) => a.id === 'APP-2569-0002')!.status).not.toBe('rejected');
});

test('เพิ่มช่องทางขาย: ตรวจรูปแบบ → สถานะรอตรวจสอบ → เจ้าหน้าที่ยืนยัน → หน้าร้านสาธารณะแสดงผ่านการตรวจสอบ', async ({ page }) => {
  await fresh(page);
  await asMerchant(page, 'OP-001');
  await open(page, '/m/shop');
  const input = page.getByPlaceholder('ชื่อบัญชี / ลิงก์ (สมมติ)');
  await input.fill('ab');
  await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
  await expect(page.getByText(/อย่างน้อย 3 ตัวอักษร/).first()).toBeVisible();
  await page.locator('main select').first().selectOption('tiktok');
  await input.fill('baanphakram.e2e');
  await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click();
  await expect(page.getByText('baanphakram.e2e').first()).toBeVisible();
  const ch = (await store<{ id: string; channels: { handle: string; type: string; status: string }[] }>(page, 'merchants')).find((m) => m.id === 'M-001')!.channels.find((c) => c.handle === 'baanphakram.e2e')!;
  expect(ch).toMatchObject({ type: 'tiktok', status: 'pending' });

  await asOfficer(page);
  await open(page, '/o/verification');
  await page.locator('tr', { hasText: 'baanphakram.e2e' }).getByRole('button', { name: 'ยืนยัน' }).click();
  await confirm(page);
  await asConsumer(page);
  await open(page, '/shop/M-001');
  await expect(page.getByText('baanphakram.e2e').first()).toBeVisible();
  expect((await store<{ id: string; channels: { handle: string; status: string }[] }>(page, 'merchants')).find((m) => m.id === 'M-001')!.channels.find((c) => c.handle === 'baanphakram.e2e')!.status).toBe('verified');
});

test('Pagination: ตารางข้อร้องเรียน 20 เรื่อง แบ่ง 10 รายการต่อหน้า และเรียงลำดับได้', async ({ page }) => {
  await fresh(page);
  await asOfficer(page);
  await open(page, '/o/complaints');
  await page.getByRole('tab', { name: /ทั้งหมด/ }).click();
  await expect(page.getByText('1–10 จาก 20')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'หน้าก่อนหน้า' })).toBeDisabled();
  const firstPage = await page.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: 'หน้าถัดไป' }).click();
  await expect(page.getByText('11–20 จาก 20')).toBeVisible();
  await expect(page.getByRole('button', { name: 'หน้าถัดไป' })).toBeDisabled();
  expect(await page.locator('tbody tr').first().innerText()).not.toBe(firstPage);
  await page.getByRole('button', { name: 'หน้าก่อนหน้า' }).click();
  await expect(page.getByText('1–10 จาก 20')).toBeVisible();
  // เรียงตาม Case ID: กดสองครั้งสลับลำดับ — แถวแรกต้องเป็นเรื่องแรก/สุดท้าย
  const firstId = () => page.locator('tbody tr').first().locator('td').first().innerText();
  await page.getByRole('button', { name: /Case ID/ }).click();
  const a = await firstId();
  await page.getByRole('button', { name: /Case ID/ }).click();
  const b = await firstId();
  expect([a, b].sort()).toEqual(['CMP-2569-0001', 'CMP-2569-0020']);
});
