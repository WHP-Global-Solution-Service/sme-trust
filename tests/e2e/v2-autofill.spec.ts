import type { Page } from '@playwright/test';
import { expect, fresh, open, store, test } from './helpers';

/**
 * Marketplace-Assisted Registration & Auto-Fill (จำลอง) ผ่าน UI จริง
 * ร้านใหม่ (OP-013): เลือก Marketplace → อนุญาต (จำลอง) → เลือกร้าน → Preview → ยืนยันนำเข้า → แบบฟอร์มถูกเติม → แก้ไข → ส่งเอง
 */
type Rec = { id: string; operatorId: string; merchantId: string; applicationId?: string; connectionId?: string; mode: string; source: { mockShopId: string; description: string; platform: string } };
type App = { id: string; merchantId: string; type: string; requestedLevel: number; importId?: string };
type Conn = { id: string; merchantId: string; status: string; mockShopId: string; sourceCategory?: string };

const main = (page: Page) => page.locator('main');
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((x) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{"shopDrafts":{}},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { consumerId: 'CS-001', officerId: 'OF-001', ...cur.state, ...x } }));
  }, s);

/** ไม่มี Request ไปโดเมนอื่น (ไม่เรียก API ภายนอก) */
function watchExternal(page: Page) {
  const ext: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) ext.push(r.url());
  });
  return ext;
}

async function importFrom(page: Page, platform: 'Shopee' | 'Lazada', shopIndex = 0) {
  await main(page).getByRole('radio', { name: `${platform} (จำลอง)` }).click();
  await main(page).getByRole('button', { name: 'ถัดไป' }).click();
  await main(page).getByLabel(/ข้าพเจ้าอนุญาต/).check();
  await main(page).getByRole('button', { name: 'อนุญาต (จำลอง)' }).click();
  await main(page).getByRole('radiogroup', { name: 'ร้านค้าในบัญชี' }).getByRole('radio').nth(shopIndex).click();
  await main(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await expect(main(page).getByTestId('source-data')).toBeVisible();
}

test('ร้านใหม่: Marketplace → อนุญาต (จำลอง) → เลือกร้าน → Preview → Auto-Fill → Refresh/Resume → แก้ไข → ส่งคำขอเอง → ไม่ซ้ำ → เจ้าหน้าที่เห็นต้นฉบับเทียบที่แก้', async ({ page }) => {
  test.setTimeout(300_000);
  const external = watchExternal(page);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });

  // ทางเข้า: A (Marketplace) / B (ลงทะเบียนด้วยตนเอง — ค่าเริ่มต้น)
  await open(page, '/m/register-shop');
  await expect(main(page).getByText('B. ลงทะเบียนด้วยตนเอง')).toBeVisible();
  await main(page).getByRole('button', { name: /A\. เชื่อมต่อร้านค้าจาก Marketplace/ }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);

  // อนุญาต (จำลอง): ไม่ใช่หน้า Login และไม่มีช่องรหัสผ่าน
  await main(page).getByRole('radio', { name: 'Shopee (จำลอง)' }).click();
  await main(page).getByRole('button', { name: 'ถัดไป' }).click();
  await expect(main(page).getByText(/ไม่ใช่หน้า Login/)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(main(page).getByRole('button', { name: 'อนุญาต (จำลอง)' })).toBeDisabled();
  await main(page).getByLabel(/ข้าพเจ้าอนุญาต/).check();
  await main(page).getByRole('button', { name: 'อนุญาต (จำลอง)' }).click();
  await expect(main(page).getByText(/พบ 3 ร้านในบัญชี Shopee \(จำลอง\)/)).toBeVisible();
  // Refresh ระหว่างขั้นตอน → กลับมาที่ขั้นเลือกร้าน
  await page.reload();
  await expect(main(page).getByText(/พบ 3 ร้านในบัญชี Shopee \(จำลอง\)/)).toBeVisible();
  await main(page).getByRole('radiogroup', { name: 'ร้านค้าในบัญชี' }).getByRole('radio').first().click();
  await main(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  const sourceCard = main(page).getByTestId('source-data');
  await expect(sourceCard).toContainText('อ่านอย่างเดียว');
  await expect(sourceCard).toContainText('Marketplace Shop ID');
  const appsBefore = (await store<App>(page, 'applications')).length;
  await main(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();

  // Auto-Fill → ทบทวนข้อมูลที่นำเข้า (ยังไม่ส่งคำขอ)
  await expect(page).toHaveURL(/\/m\/register-shop\?from=import$/);
  await expect(main(page).getByRole('region', { name: 'ทบทวนข้อมูลที่นำเข้า' })).toBeVisible();
  await expect(main(page).getByTestId('import-summary')).toContainText('นำเข้าสำเร็จ3 รายการ');
  await expect(main(page).getByTestId('import-summary')).toContainText('ต้องกรอกเพิ่ม4 รายการ');
  const shopName = await main(page).getByLabel(/ชื่อร้านค้า/).inputValue();
  expect(shopName).toMatch(/^ร้าน/);
  await expect(main(page).getByText('ไม่มีในข้อมูลที่นำเข้า — กรุณากรอกเพิ่ม').first()).toBeVisible();
  expect((await store<App>(page, 'applications')).length).toBe(appsBefore); // ไม่ Auto-Submit

  // แก้ไขข้อมูลที่นำเข้า 1 จุด → ป้าย "ผู้สมัครแก้ไข" + ต้นฉบับให้เทียบ
  const desc = main(page).getByLabel(/รายละเอียดสินค้าและบริการ/);
  const original = await desc.inputValue();
  await desc.fill(`${original} รับประกันสินค้า 30 วัน`);
  await expect(main(page).getByText(`ต้นฉบับจาก Marketplace: ${original}`)).toBeVisible();
  await expect(main(page).getByTestId('import-summary')).toContainText('ข้อมูลที่แก้ไข1 รายการ');
  // Refresh → ฉบับร่าง (รวมค่าที่แก้) ยังอยู่
  await page.reload();
  await expect(main(page).getByLabel(/รายละเอียดสินค้าและบริการ/)).toHaveValue(`${original} รับประกันสินค้า 30 วัน`);
  await expect(main(page).getByTestId('source-data')).toContainText(shopName);

  // กรอกข้อมูลที่ขาด
  await main(page).getByRole('button', { name: 'ใช้ข้อมูลติดต่อจากบัญชี' }).click();
  await main(page).getByLabel(/อำเภอ\/เขต/).fill('เมืองขอนแก่น');
  await expect(main(page).getByTestId('import-summary')).toContainText('ต้องกรอกเพิ่ม0 รายการ');
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  // ย้อนกลับ/ถัดไป ไม่ทำให้ข้อมูลหาย
  await page.getByRole('button', { name: 'ย้อนกลับ' }).click();
  await expect(main(page).getByLabel(/รายละเอียดสินค้าและบริการ/)).toHaveValue(`${original} รับประกันสินค้า 30 วัน`);
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  expect((await main(page).locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).some((v) => v.startsWith('shopee.mock/shop/'))).toBe(true);
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await main(page).getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();

  // ตรวจสอบ: ตารางเทียบต้นฉบับกับข้อมูลที่ส่ง แล้วส่งเอง
  await expect(main(page).locator('[data-field="description"]').first()).toHaveAttribute('data-status', 'user_edited');
  await expect(main(page).locator('[data-field="phone"]').first()).toHaveAttribute('data-status', 'manual');
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();

  const recs = (await store<Rec>(page, 'marketplace-imports')).filter((r) => r.operatorId === 'OP-013');
  const shops = (await store<{ id: string; operatorId: string; shopName: string }>(page, 'merchants')).filter((m) => m.operatorId === 'OP-013');
  const app = (await store<App>(page, 'applications')).find((a) => a.merchantId === shops[0]?.id)!;
  const conn = (await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === shops[0]?.id)!;
  expect(recs).toHaveLength(1);
  expect(shops).toHaveLength(1);
  expect(shops[0].shopName).toBe(shopName);
  expect(app.type).toBe('registration');
  expect(app.requestedLevel).toBe(2);
  expect(app.importId).toBe(recs[0].id);
  expect(conn.status).toBe('connected');
  expect(conn.mockShopId).toBe(recs[0].source.mockShopId);
  expect(conn.sourceCategory).toBeTruthy();
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === shops[0].id)).toBe(false); // ไม่ออก Badge อัตโนมัติ
  // Automation First: แก้เฉพาะรายละเอียด (ชื่อร้านตรงกับต้นฉบับ) → ระบบผ่านการลงทะเบียนอัตโนมัติ (ไม่ออกใบรับรอง)
  expect(app.status).toBe('approved');
  expect((app as App & { autoDecision?: { route: string } }).autoDecision?.route).toBe('AUTO_PASS');

  // Refresh หลังส่ง → ไม่สร้างคำขอซ้ำ (ฉบับร่างถูกล้างแล้ว)
  await page.reload();
  await expect(main(page).getByText('พบฉบับร่างที่บันทึกไว้')).toHaveCount(0);
  expect((await store<App>(page, 'applications')).filter((a) => a.merchantId === shops[0].id)).toHaveLength(1);
  expect((await store<{ operatorId: string }>(page, 'merchants')).filter((m) => m.operatorId === 'OP-013')).toHaveLength(1);

  // เจ้าหน้าที่: ต้นฉบับเทียบกับข้อมูลที่แก้ไข
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/applications/${app.id}`);
  const review = main(page).getByTestId('import-review');
  await expect(review).toContainText('คำขอนี้เติมข้อมูลจาก Marketplace');
  await expect(review).toContainText(recs[0].source.mockShopId);
  await expect(review).toContainText('เชื่อมต่อแล้ว (จำลอง)');
  await expect(review).toContainText('ยืนยันแล้ว (Mock e-KYC)');
  await expect(main(page).getByTestId('modified-fields')).toContainText('คำอธิบายธุรกิจ');
  await expect(main(page).getByTestId('missing-fields')).toContainText('ไม่มี');
  await expect(review.locator('[data-field="description"]')).toContainText(original);
  await expect(review.locator('[data-field="description"]')).toContainText('รับประกันสินค้า 30 วัน');
  // กรณีปกติระบบผ่านการลงทะเบียนอัตโนมัติ — เจ้าหน้าที่เห็นผลการตรวจและข้อมูลต้นฉบับ แต่ไม่มีงานที่ต้องกดอนุมัติ
  await expect(main(page).getByTestId('auto-decision')).toContainText('AUTO_PASS');
  await expect(main(page).getByRole('button', { name: 'อนุมัติ', exact: true })).toHaveCount(0);
  await expect(main(page).getByRole('button', { name: 'ขอเอกสารเพิ่มเติม' })).toHaveCount(0);

  expect(external).toEqual([]);
});

test('เปลี่ยน Marketplace ต้องยืนยันก่อนแทนข้อมูลเดิม · ยกเลิกการนำเข้าล้างเฉพาะค่าที่ยังเป็นต้นฉบับ', async ({ page }) => {
  test.setTimeout(240_000);
  const external = watchExternal(page);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });
  await open(page, '/m/register-shop/marketplace');
  await importFrom(page, 'Shopee');
  await main(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(main(page).getByRole('region', { name: 'ทบทวนข้อมูลที่นำเข้า' }).getByText('นำเข้าจาก Shopee (จำลอง)').first()).toBeVisible();
  await main(page).getByLabel(/อีเมลร้าน/).fill('mine@demo.local');

  // เปลี่ยนเป็น Lazada → ระบบเตือนก่อนแทนข้อมูล
  await main(page).getByRole('button', { name: 'เปลี่ยน Marketplace / ร้าน' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);
  await importFrom(page, 'Lazada');
  await main(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('แทนที่ข้อมูลที่นำเข้าไว้เดิม?')).toBeVisible();
  await expect(dlg).toContainText('Shopee (จำลอง)');
  await dlg.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/); // ไม่แทนข้อมูลเมื่อยกเลิก
  const draft1 = await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session')!).state.shopDrafts['OP-013'].data.importSource.platform);
  expect(draft1).toBe('shopee');
  await main(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await dlg.getByRole('button', { name: 'แทนที่ข้อมูล' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\?from=import$/);
  await expect(main(page).getByRole('region', { name: 'ทบทวนข้อมูลที่นำเข้า' }).getByText('นำเข้าจาก Lazada (จำลอง)').first()).toBeVisible();
  await expect(main(page).getByLabel(/อีเมลร้าน/)).toHaveValue('mine@demo.local'); // ช่องที่กรอกเองยังอยู่
  expect(await main(page).getByLabel(/ชื่อร้านค้า/).inputValue()).not.toBe('');
  await expect(main(page).getByTestId('source-data')).toContainText('Lazada (จำลอง)');
  await expect(main(page).getByTestId('source-data')).not.toContainText('Shopee (จำลอง)');

  // ยกเลิกการนำเข้า: ค่าที่ยังเป็นต้นฉบับถูกล้าง · ค่าที่แก้/กรอกเองยังอยู่
  const desc = main(page).getByLabel(/รายละเอียดสินค้าและบริการ/);
  await desc.fill(`${await desc.inputValue()} (แก้โดยผู้สมัคร)`);
  await main(page).getByRole('button', { name: 'ยกเลิกการนำเข้า' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิกการนำเข้า' }).click();
  await expect(main(page).getByRole('region', { name: 'ทบทวนข้อมูลที่นำเข้า' })).toHaveCount(0);
  await expect(main(page).getByLabel(/ชื่อร้านค้า/)).toHaveValue('');
  await expect(main(page).getByLabel(/รายละเอียดสินค้าและบริการ/)).toHaveValue(/\(แก้โดยผู้สมัคร\)$/);
  await expect(main(page).getByLabel(/อีเมลร้าน/)).toHaveValue('mine@demo.local');
  await expect(main(page).getByRole('button', { name: 'นำเข้าจาก Marketplace' })).toBeVisible();
  const draft2 = await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session')!).state.shopDrafts['OP-013'].data);
  expect(draft2.importSource).toBeUndefined();
  expect((await store<Rec>(page, 'marketplace-imports')).length).toBe(0);
  expect(external).toEqual([]);
});
