import type { Page } from '@playwright/test';
import { expect, fresh, open, store, test } from './helpers';

/**
 * คำขอเปลี่ยนข้อมูลร้านที่ผูกกับใบรับรอง (KI-V2-15) ผ่าน UI จริง
 * ร้านเดิม M-005 (Level 3) ที่เชื่อม Shopee (จำลอง) ไว้แล้ว → แก้ชื่อร้าน → คำขอ → เจ้าหน้าที่ขอข้อมูลเพิ่ม → ร้านแก้ (Draft/Refresh) → ส่งใหม่ → อนุมัติ
 */
const main = (page: Page) => page.locator('main');
const dlg = (page: Page) => page.getByRole('dialog');
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...patch } }));
  }, s);
type Req = { id: string; merchantId: string; status: string; revision: number; history: { action: string }[]; changes: { field: string; from: string; to: string; source?: string }[] };
type Shop = { id: string; shopName: string; category: string };
type Conn = { id: string; merchantId: string; status: string; sourceShopName?: string };

async function connectAndRename(page: Page, newName: string) {
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/marketplace');
  // ข้อมูลตั้งต้น: M-005 เชื่อม Shopee (จำลอง) ไว้แล้ว → เติมข้อมูลโปรไฟล์จากการเชื่อมต่อนั้น
  await main(page).locator('[data-platform="shopee"]').getByRole('link', { name: 'ดูภาพรวมข้อมูล' }).click();
  await expect(page).toHaveURL(/\/m\/marketplace\/data\/MKC-\d+$/);
  const connId = page.url().split('/').pop()!;
  await open(page, `/m/marketplace/profile/${connId}`);
  await expect(page).toHaveURL(/\/m\/marketplace\/profile\/MKC-\d+$/);
  // ชื่อร้านเดิม (ข้อมูลตั้งต้นยังไม่ถูกเขียนลง localStorage จนกว่าจะมีการเปลี่ยนแปลง — อ่านจากแบบฟอร์มที่เติมจากข้อมูลในระบบ)
  // รอให้ฟอร์มเติมค่าก่อนอ่าน (inputValue ไม่รอค่า — บนเว็บจริงที่โหลดช้ากว่าเคยอ่านได้ค่าว่าง)
  await expect(main(page).getByLabel(/ชื่อร้านที่ใช้แสดง/)).not.toHaveValue('');
  const before = { id: 'M-005', shopName: await main(page).getByLabel(/ชื่อร้านที่ใช้แสดง/).inputValue() };
  expect(before.shopName).toBe('ร้านกาแฟดอยสูง');
  await main(page).getByLabel(/ชื่อร้านที่ใช้แสดง/).fill(newName);
  await expect(main(page).locator('[data-field="shopName"]').first()).toHaveAttribute('data-status', 'verification_required');
  await main(page).getByLabel(/ข้าพเจ้าตรวจสอบข้อมูลแล้ว/).check();
  await main(page).getByRole('button', { name: 'ยืนยันการอัปเดตข้อมูลร้าน' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'อัปเดตข้อมูลร้านแล้ว' })).toBeVisible();
  const [req] = await store<Req>(page, 'profile-changes');
  return { before, req };
}

test('คำขอเปลี่ยนชื่อร้าน: ยื่น → เจ้าหน้าที่ขอข้อมูลเพิ่ม → ร้านแก้ (Draft/Refresh) → ส่งใหม่ (ไม่ซ้ำ) → อนุมัติ → ข้อมูลต้นฉบับคงเดิม', async ({ page }) => {
  test.setTimeout(300_000);
  const { before, req } = await connectAndRename(page, 'ดอยสูงคาเฟ่');
  expect(req.status).toBe('pending');
  expect(req.changes).toEqual([{ field: 'shopName', from: before.shopName, to: 'ดอยสูงคาเฟ่', source: before.shopName }]);
  // ข้อมูลเดิมยังใช้อยู่ · มุมร้านเห็นสถานะคำขอ
  expect((await store<Shop>(page, 'merchants')).find((m) => m.id === 'M-005')!.shopName).toBe(before.shopName);
  await expect(main(page).getByText(`คำขอเปลี่ยนข้อมูลร้าน ${req.id}`)).toBeVisible();
  const certs = JSON.stringify((await store<{ merchantId: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005'));

  // เจ้าหน้าที่: คิว → รายละเอียด → ขอข้อมูลเพิ่ม
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, '/o/profile-changes');
  await main(page).getByText(req.id).first().click();
  await expect(page).toHaveURL(new RegExp(`/o/profile-changes/${req.id}$`));
  const table = main(page).getByTestId('change-table');
  await expect(table.locator('[data-field="shopName"] [data-col="from"]')).toHaveText(before.shopName);
  await expect(table.locator('[data-field="shopName"] [data-col="to"]')).toHaveText('ดอยสูงคาเฟ่');
  await expect(table.locator('[data-field="shopName"] [data-col="source"]')).toHaveText(before.shopName);
  await expect(main(page).getByText('Level 3').first()).toBeVisible();
  await main(page).getByRole('button', { name: 'ขอข้อมูลเพิ่มเติม' }).click();
  await dlg(page).getByLabel(/ข้อมูลที่ต้องการเพิ่มเติม/).fill('กรุณาแนบหนังสือรับรองการเปลี่ยนชื่อร้าน');
  await dlg(page).getByRole('button', { name: 'ส่งคำขอ' }).click();
  await expect(main(page).getByText('รอร้านค้าส่งข้อมูลเพิ่มเติม')).toBeVisible();
  await expect(main(page).getByRole('button', { name: 'อนุมัติการเปลี่ยนข้อมูล' })).toHaveCount(0);

  // ร้านค้า: การแจ้งเตือน → แก้ไข → Refresh (ฉบับร่างอยู่) → ส่งใหม่ → Refresh (ไม่ซ้ำ)
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/notifications');
  await main(page).getByText('เจ้าหน้าที่ขอข้อมูลเพิ่มเติม (คำขอเปลี่ยนข้อมูลร้าน)').first().click();
  await expect(page).toHaveURL(new RegExp(`/m/profile-changes/${req.id}$`));
  await expect(main(page).getByText('กรุณาแนบหนังสือรับรองการเปลี่ยนชื่อร้าน').first()).toBeVisible();
  await main(page).getByLabel(/ชื่อร้านใหม่/).fill('ดอยสูง คอฟฟี่ โรสเตอร์');
  await main(page).getByLabel(/ข้อมูลเพิ่มเติมสำหรับเจ้าหน้าที่/).fill('แนบหนังสือรับรองการเปลี่ยนชื่อ (จำลอง)');
  await page.reload();
  await expect(main(page).getByLabel(/ชื่อร้านใหม่/)).toHaveValue('ดอยสูง คอฟฟี่ โรสเตอร์');
  await expect(main(page).getByLabel(/ข้อมูลเพิ่มเติมสำหรับเจ้าหน้าที่/)).toHaveValue('แนบหนังสือรับรองการเปลี่ยนชื่อ (จำลอง)');
  await main(page).getByRole('button', { name: 'ส่งข้อมูลเพิ่มเติม' }).click();
  await expect(main(page).getByText('รอเจ้าหน้าที่พิจารณา').first()).toBeVisible();
  await page.reload();
  let all = await store<Req>(page, 'profile-changes');
  expect(all).toHaveLength(1);
  expect(all[0].history.map((h) => h.action)).toEqual(['submitted', 'info_requested', 'resubmitted']);
  expect((await store<Shop>(page, 'merchants')).find((m) => m.id === 'M-005')!.shopName).toBe(before.shopName);

  // เจ้าหน้าที่อนุมัติ
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/profile-changes/${req.id}`);
  await main(page).getByRole('button', { name: 'อนุมัติการเปลี่ยนข้อมูล' }).click();
  await dlg(page).getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await expect(main(page).getByText('อนุมัติแล้ว').first()).toBeVisible();
  await page.reload();
  all = await store<Req>(page, 'profile-changes');
  expect(all.map((r) => r.status)).toEqual(['approved']);
  expect(all[0].history.map((h) => h.action)).toEqual(['submitted', 'info_requested', 'resubmitted', 'approved']);
  expect((await store<Shop>(page, 'merchants')).find((m) => m.id === 'M-005')!.shopName).toBe('ดอยสูง คอฟฟี่ โรสเตอร์');
  expect(JSON.stringify((await store<{ merchantId: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005'))).toBe(certs);
  const conn = (await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === 'M-005' && c.status === 'connected')!;
  expect(conn.sourceShopName).toBe(before.shopName); // ข้อมูลต้นฉบับ Marketplace คงเดิม
  const audit = (await store<{ action: string; target: string }>(page, 'audit')).filter((a) => a.target === req.id).map((a) => a.action);
  expect(audit).toEqual(expect.arrayContaining(['ร้านยื่นคำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง', 'ขอข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', 'ร้านส่งข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', 'อนุมัติการเปลี่ยนข้อมูลร้าน']));

  // ร้านค้าเห็นสถานะเดียวกัน และหน้าข้อมูล Marketplace ยังแสดงชื่อร้านต้นฉบับ
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, `/m/profile-changes/${req.id}`);
  await expect(main(page).getByText('อนุมัติแล้ว').first()).toBeVisible();
  await open(page, `/m/marketplace/profile/${conn.id}`);
  await main(page).getByRole('button', { name: 'อัปเดตอีกครั้ง' }).click();
  await expect(main(page).getByTestId('source-data')).toContainText(before.shopName); // ต้นฉบับ Marketplace ยังเป็นชื่อเดิม
  await expect(main(page).getByLabel(/ชื่อร้านที่ใช้แสดง/)).toHaveValue('ดอยสูง คอฟฟี่ โรสเตอร์'); // Auto-Fill ใช้ชื่อที่อนุมัติแล้ว
  await expect(main(page).locator('[data-field="shopName"]').first()).not.toHaveAttribute('data-status', 'verification_required');
});

test('คำขอเปลี่ยนชื่อร้าน: ไม่อนุมัติ (ต้องมีเหตุผล) → ข้อมูลเดิมไม่เปลี่ยน และร้านค้าเห็นเหตุผล', async ({ page }) => {
  test.setTimeout(300_000);
  const { before, req } = await connectAndRename(page, 'ร้านชื่อใหม่ทดสอบ');
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/profile-changes/${req.id}`);
  await main(page).getByRole('button', { name: 'ไม่อนุมัติ' }).click();
  await dlg(page).getByLabel(/เหตุผลการไม่อนุมัติ/).fill('ชื่อร้านไม่ตรงกับเอกสารทะเบียนพาณิชย์');
  await dlg(page).getByRole('button', { name: 'ไม่อนุมัติ' }).click();
  await expect(main(page).getByText('ไม่อนุมัติ — ข้อมูลร้านยังเป็นข้อมูลเดิม')).toBeVisible();
  expect((await store<Shop>(page, 'merchants')).find((m) => m.id === 'M-005')!.shopName).toBe(before.shopName);
  expect((await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === 'M-005')?.sourceShopName).toBeUndefined(); // ไม่แตะข้อมูลต้นฉบับ
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, `/m/profile-changes/${req.id}`);
  await expect(main(page).getByText('ชื่อร้านไม่ตรงกับเอกสารทะเบียนพาณิชย์').first()).toBeVisible();
});
