import type { Page } from '@playwright/test';
import { expect, fresh, open, store, test } from './helpers';

/**
 * Unified Merchant Onboarding ผ่าน UI จริง
 * นิติบุคคล + Mock DBD + Dynamic Documents (หนังสือมอบอำนาจ) · Preliminary Verification · ประเมินอัตโนมัติหลังส่ง
 * ร้านใน Marketplace ที่เชื่อมกับร้านของตนแล้วเลือกซ้ำไม่ได้ · ร้านที่สมัครเองเพิ่ม Marketplace ภายหลังได้
 */
const main = (page: Page) => page.locator('main');
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{"shopDrafts":{}},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { consumerId: 'CS-001', officerId: 'OF-001', ...cur.state, ...patch } }));
  }, s);
const next = (page: Page) => main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
type Shop = { id: string; operatorId: string; businessType: string; juristic?: { registrationNo: string }; documents: { kind: string }[] };

test('นิติบุคคล: Mock DBD + หนังสือมอบอำนาจตามกฎ + สรุปการตรวจสอบ → ส่งคำขอ → ประเมินอัตโนมัติ (ไม่อนุมัติเอง)', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true });
  await open(page, '/m/register-shop');
  await main(page).getByRole('button', { name: /นิติบุคคล/ }).click();
  await next(page);
  await main(page).getByLabel(/ชื่อนิติบุคคล/).fill('บริษัท ขนมไทยทดสอบ จำกัด');
  await main(page).getByLabel(/เลขทะเบียนนิติบุคคล/).fill('DEMO-0105569000123');
  await main(page).getByLabel(/ประเภทนิติบุคคล/).selectOption({ index: 1 });
  await main(page).getByLabel(/ชื่อผู้มีอำนาจลงนาม/).fill('คุณสมชาย ผู้มีอำนาจ');
  await main(page).getByLabel(/ชื่อผู้แทนที่สมัคร/).fill('คุณสมหญิง ผู้แทน');
  await expect(main(page).getByTestId('juristic-checks')).toContainText('ไม่ได้ตรวจกับ DBD จริง');
  await expect(main(page).getByTestId('juristic-checks')).toContainText('ต้องแนบ "หนังสือมอบอำนาจ"');
  await next(page);
  await main(page).getByLabel(/ชื่อร้านค้า/).fill('ขนมไทยทดสอบ');
  await main(page).getByLabel(/ประเภทธุรกิจ\/หมวดสินค้า/).selectOption('อาหารและเครื่องดื่ม');
  await main(page).getByLabel(/จังหวัด/).selectOption({ index: 1 });
  await main(page).getByLabel(/อำเภอ\/เขต/).fill('เมือง');
  await main(page).getByLabel(/ที่อยู่สถานประกอบการ/).fill('99/9 ถนนทดสอบ');
  await main(page).getByLabel(/เบอร์โทรศัพท์ร้าน/).fill('0812345678');
  await main(page).getByLabel(/อีเมลร้าน/).fill('jur@example.com');
  await main(page).getByLabel(/รายละเอียดสินค้าและบริการ/).fill('ขนมไทยทำสดใหม่ทุกวัน ระบุวันผลิตทุกกล่อง ส่งทั่วประเทศ');
  await next(page);
  await main(page).getByPlaceholder(/ชื่อบัญชี/).first().fill('khanom-test.page');
  await next(page);
  // Dynamic Documents: นิติบุคคล + ผู้สมัครไม่ใช่ผู้มีอำนาจ + หมวดอาหาร
  const reqs = main(page).getByTestId('doc-requirements');
  await expect(reqs.locator('[data-req="company"]')).toHaveAttribute('data-met', 'false');
  await expect(reqs.locator('[data-req="authorization"]')).toHaveAttribute('data-met', 'false');
  await expect(reqs.locator('[data-req="license"]')).toContainText('แนะนำ');
  await expect(reqs).not.toContainText('ทะเบียนพาณิชย์'); // บุคคลธรรมดาเท่านั้น
  await expect(reqs).toContainText('กฎจำลอง');
  await main(page).getByRole('button', { name: 'หนังสือรับรองนิติบุคคล', exact: true }).click();
  await next(page);
  await expect(main(page).getByText('เอกสารไม่ครบ: หนังสือมอบอำนาจจากผู้มีอำนาจลงนาม')).toBeVisible();
  await main(page).getByRole('button', { name: 'หนังสือมอบอำนาจ', exact: true }).click();
  await expect(reqs.locator('[data-req="authorization"]')).toHaveAttribute('data-met', 'true');
  await next(page);
  // Preliminary Verification
  const ver = main(page).getByTestId('verification-summary');
  await expect(ver.locator('[data-verify="business"]')).toHaveAttribute('data-state', 'verified_simulation');
  await expect(ver.locator('[data-verify="representative"]')).toHaveAttribute('data-state', 'verified_simulation');
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();
  const shop = (await store<Shop>(page, 'merchants')).find((m) => m.operatorId === 'OP-012')!;
  expect(shop.businessType).toBe('juristic');
  expect(shop.juristic?.registrationNo).toBe('DEMO-0105569000123');
  expect(shop.documents.map((d) => d.kind).sort()).toEqual(['หนังสือมอบอำนาจ', 'หนังสือรับรองนิติบุคคล']);
  const badge = (await store<{ merchantId: string; status: string; route: string }>(page, 'assessment-badges')).find((b) => b.merchantId === shop.id)!;
  expect([badge.route, badge.status]).toEqual(['AUTO_REQUEST_INFO', 'insufficient']);
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === shop.id)).toBe(false);
  // มุมเจ้าหน้าที่เห็นสรุปเดียวกัน
  const app = (await store<{ id: string; merchantId: string }>(page, 'applications')).find((a) => a.merchantId === shop.id)!;
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/applications/${app.id}`);
  await expect(main(page).getByTestId('officer-verification').locator('[data-verify="representative"]')).toHaveAttribute('data-state', 'verified_simulation');
});

test('ร้านที่สมัครเองเพิ่ม Marketplace ภายหลัง: ร้านเดิม · ประเมินใหม่ · Badge อัปเดต · ร้านนี้เลือกนำเข้าซ้ำเพื่อสมัครร้านใหม่ไม่ได้', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true });
  // สมัครเอง (ตัวอย่าง) → Insufficient Data
  await open(page, '/m/register-shop');
  await next(page);
  await next(page);
  await main(page).getByRole('button', { name: 'เติมข้อมูลตัวอย่าง' }).click();
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();
  const shops = (await store<Shop>(page, 'merchants')).filter((m) => m.operatorId === 'OP-012');
  expect(shops).toHaveLength(1);
  await open(page, '/m/trust');
  await expect(main(page).getByTestId('automation-panel')).toContainText('ไม่ถูกหักคะแนน');
  // เพิ่มช่องทางขายจากหน้าร้าน
  await open(page, '/m/shop');
  await main(page).getByRole('link', { name: 'เพิ่มช่องทางขาย (Marketplace)' }).click();
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  const wiz = main(page).getByRole('region', { name: /^เชื่อมต่อ Shopee \(จำลอง\)$/ });
  await main(page).locator('[data-platform="shopee"]').getByRole('button', { name: 'เชื่อมต่อ Shopee (จำลอง)' }).click();
  await expect(wiz.getByTestId('match-existing')).toContainText('ไม่สร้างบัญชีหรือร้านใหม่');
  await wiz.getByLabel(/ข้าพเจ้ายินยอม/).check();
  await wiz.getByRole('button', { name: 'ถัดไป' }).click();
  await wiz.getByRole('radio', { name: /ร้านที่ขายมานาน ผลงานดี/ }).click();
  await wiz.getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await wiz.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(wiz.getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
  await wiz.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(main(page).locator('[data-platform="shopee"]').getByTestId('ownership-status')).toContainText('ตรงกับผู้ยืนยันตัวตน');
  expect((await store<Shop>(page, 'merchants')).filter((m) => m.operatorId === 'OP-012')).toHaveLength(1);
  const b = (await store<{ merchantId: string; status: string; route: string }>(page, 'assessment-badges')).find((x) => x.merchantId === shops[0].id)!;
  expect([b.route, b.status]).toEqual(['AUTO_PASS', 'active']);
  await session(page, { role: 'consumer' });
  await open(page, `/shop/${shops[0].id}`);
  await expect(main(page).getByTestId('assessment-badge')).toHaveAttribute('data-status', 'active');
  await expect(main(page).getByTestId('badge-verify-link')).toContainText(`/shop/${shops[0].id}`);
});

test('สมัครด้วย Marketplace: ร้านในบัญชีที่เชื่อมกับร้านของตนแล้วเลือกนำเข้าซ้ำไม่ได้ (กันสร้างร้านซ้ำ)', async ({ page }) => {
  test.setTimeout(180_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });
  const pick = async () => {
    await open(page, '/m/register-shop/marketplace');
    await main(page).getByRole('radio', { name: 'Shopee (จำลอง)' }).click();
    await main(page).getByRole('button', { name: 'ถัดไป' }).click();
    await main(page).getByLabel(/ข้าพเจ้าอนุญาต/).check();
    await main(page).getByRole('button', { name: 'อนุญาต (จำลอง)' }).click();
  };
  await pick();
  await main(page).getByRole('radiogroup', { name: 'ร้านค้าในบัญชี' }).getByRole('radio').first().click();
  await main(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await main(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await main(page).getByRole('button', { name: 'ใช้ข้อมูลติดต่อจากบัญชี' }).click();
  await main(page).getByLabel(/อำเภอ\/เขต/).fill('เมืองขอนแก่น');
  await next(page);
  await next(page);
  await main(page).getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await next(page);
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();
  // กลับไปสมัครใหม่ด้วยบัญชีเดิม → ร้านแรกในบัญชีเชื่อมกับร้านของตนแล้ว เลือกไม่ได้
  await page.evaluate(() => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key)!);
    delete cur.state.shopDrafts['flow:OP-013'];
    localStorage.setItem(key, JSON.stringify(cur));
  });
  await pick();
  const first = main(page).getByRole('radiogroup', { name: 'ร้านค้าในบัญชี' }).getByRole('radio').first();
  await expect(first).toBeDisabled();
  await expect(main(page).getByTestId('shop-claimed-own')).toContainText('ไม่ต้องสมัครร้านใหม่');
  await expect(main(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' })).toBeDisabled();
  expect((await store<Shop>(page, 'merchants')).filter((m) => m.operatorId === 'OP-013')).toHaveLength(1);
});
