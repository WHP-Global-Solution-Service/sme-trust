import type { Page } from '@playwright/test';
import { demoState, expect, expectBlocked, finishScenario, fresh, next, open, panel, store, test } from './helpers';

/** P6 — Full Journey v2 (Scenario 9–13) และเส้นทางทางเลือก 9B ผ่าน UI จริง: Business Action ทุกอย่างกดในหน้าจอ */
const main = (page: Page) => page.locator('main');
const dlg = (page: Page) => page.getByRole('dialog');
const wiz = (page: Page) => main(page).getByRole('region', { name: /^เชื่อมต่อ (Shopee|Lazada) \(จำลอง\)$/ });
type Conn = { id: string; merchantId: string; platform: string; status: string };
type Tas = { id: string; merchantId: string; status: string; applicationId?: string; decision?: { kind: string; certId?: string } };
type App = { id: string; merchantId: string; type: string; status: string };

async function continueTo(page: Page, no: string) {
  await main(page).getByRole('button').first().click();
  await expect(panel(page).getByText(`Scenario ${no}:`)).toBeVisible();
  await expect(panel(page).getByText('Full Journey — Marketplace & Trust Assessment')).toBeVisible();
}

test('Demo Selector: แยก v1 / v2, Full Journey 2 ชุด และแท็บ Scenario เดี่ยว', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await expect(page.getByRole('region', { name: 'สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Full Journey — Marketplace & Trust Assessment' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Full Journey — Marketplace & Trust Assessment' }).getByText(/เน้นการเชื่อมข้อมูลจากแพลตฟอร์มขายเดิม/)).toBeVisible();
  // แท็บ v1 แสดง 8 การ์ด, แท็บ v2 แสดง 5 + ทางเลือก 9A (ร้านใหม่ Auto-Fill) + 9B (ลงทะเบียนเอง)
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(8);
  await page.getByRole('tab', { name: /Marketplace & Trust Assessment/ }).click();
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(9);
  await expect(page.getByRole('tabpanel').getByText('ร้านที่ไม่มีบัญชี Marketplace — ลงทะเบียนด้วยตนเอง')).toBeVisible();
  await expect(page.getByRole('tabpanel').getByText('ร้านใหม่ — สมัครด้วยข้อมูลจาก Marketplace (Auto-Fill)')).toBeVisible();
});

test('Full Journey v2: เชื่อมต่อ → วิเคราะห์ → ประเมิน → เจ้าหน้าที่อนุมัติ → ผู้บริโภคตรวจสอบ ด้วย ID เดียวกันตลอด', async ({ page }) => {
  test.setTimeout(600_000);
  await fresh(page);
  await open(page, '/demo');
  await page.getByRole('button', { name: 'เริ่ม Journey Marketplace & Trust', exact: true }).click();
  await expect(panel(page).getByText('Full Journey — Marketplace & Trust Assessment')).toBeVisible();
  await expect(panel(page).getByText('Scenario 9:')).toBeVisible();
  await expect(page).toHaveURL(/\/m$/);

  // ---------------- S9
  await next(page);
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  await expectBlocked(page);
  await main(page).locator('[data-platform="shopee"]').getByRole('button', { name: 'เชื่อมต่อ Shopee (จำลอง)' }).click();
  await expect(wiz(page).getByText('1. อนุญาตเข้าถึงข้อมูล')).toBeVisible();
  await next(page);
  await expectBlocked(page);
  await wiz(page).getByLabel(/ข้าพเจ้ายินยอม/).check();
  await wiz(page).getByRole('button', { name: 'ถัดไป' }).click();
  await next(page);
  await expectBlocked(page);
  await wiz(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await next(page);
  await expectBlocked(page);
  await expect(wiz(page).getByText('ระบบยังไม่ดึงข้อมูลจนกว่าจะกด')).toBeVisible();
  await wiz(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await next(page);
  await expect(wiz(page).getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
  await expect(wiz(page).getByRole('link', { name: 'เติมข้อมูลโปรไฟล์ร้านอัตโนมัติ' })).toBeVisible();
  await next(page);
  const conn = (await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === 'M-005' && c.status === 'connected')!;
  // Auto-Fill โปรไฟล์ร้านเดิม → ตรวจ/แก้ไข → ยืนยันอัปเดต (ไม่ใช่การสมัครร้านใหม่)
  const before = { merchants: (await store<{ id: string }>(page, 'merchants')).length, apps: (await store<App>(page, 'applications')).length, certs: JSON.stringify((await store<{ merchantId: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005')) };
  await expect(page).toHaveURL(new RegExp(`/m/marketplace/profile/${conn.id}$`));
  await expect(main(page).getByText('อัปเดตข้อมูลร้านเดิม — ไม่ใช่การสมัครร้านใหม่', { exact: false })).toBeVisible();
  await expect(main(page).getByTestId('import-summary')).toContainText('นำเข้าสำเร็จ');
  await expect(main(page).getByTestId('source-data')).toContainText('อ่านอย่างเดียว');
  await next(page);
  await expectBlocked(page);
  const desc = main(page).getByLabel(/คำอธิบายธุรกิจ/);
  await desc.fill(`${await desc.inputValue()} เปิดรับคำสั่งซื้อทุกวัน 08:00–20:00`);
  await expect(main(page).locator('[data-field="description"]').first()).toHaveAttribute('data-status', 'user_edited');
  await next(page);
  await expectBlocked(page);
  await main(page).getByLabel(/ข้าพเจ้าตรวจสอบข้อมูลแล้ว/).check();
  await main(page).getByRole('button', { name: 'ยืนยันการอัปเดตข้อมูลร้าน' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'อัปเดตข้อมูลร้านแล้ว' })).toBeVisible();
  const m5 = (await store<{ id: string; description: string }>(page, 'merchants')).find((m) => m.id === 'M-005')!;
  expect(m5.description).toContain('เปิดรับคำสั่งซื้อทุกวัน 08:00–20:00');
  expect((await store<{ id: string }>(page, 'merchants')).length).toBe(before.merchants);
  expect((await store<App>(page, 'applications')).length).toBe(before.apps);
  expect(JSON.stringify((await store<{ merchantId: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005'))).toBe(before.certs);
  expect((await store<{ merchantId: string; mode: string }>(page, 'marketplace-imports')).filter((r) => r.merchantId === 'M-005').map((r) => r.mode)).toEqual(['profile_update']);
  await next(page);
  await expect(page).toHaveURL(new RegExp(`/m/marketplace/data/${conn.id}$`));
  await expect(main(page).getByText('Data Availability')).toBeVisible();
  await expect(panel(page).getByText(conn.id).first()).toBeVisible(); // Context Preservation
  await finishScenario(page, 's9');
  await expect(main(page).getByRole('button', { name: 'ทางเลือก 9B: ร้านที่ไม่มี Marketplace' })).toBeVisible();
  await expect(main(page).getByRole('button', { name: 'ทางเลือก 9A: ร้านใหม่สมัครด้วย Auto-Fill' })).toBeVisible();

  // ---------------- S10
  await continueTo(page, '10');
  expect((await demoState(page)).current.connectionId).toBe(conn.id);
  await main(page).getByRole('link', { name: 'วิเคราะห์ข้อมูลการขาย' }).click();
  await expect(page).toHaveURL(/\/m\/marketplace\/analysis$/);
  await next(page);
  await expect(main(page).getByText('ราคากลางอ้างอิง').first()).toBeVisible();
  for (let k = 0; k < 4; k++) await next(page);
  await expect(page).toHaveURL(/tab=compare$/);
  await expectBlocked(page);
  await main(page).getByRole('radio', { name: /คะแนนดี แต่รีวิวผิดธรรมชาติ/ }).click();
  await expect(main(page).getByText(/พบ \(\d+% ใน 7 วัน\)/)).toBeVisible();
  await expect(main(page).getByText('ทำไมคะแนนดาวใกล้เคียงกันจึงให้ผลต่างกัน')).toBeVisible();
  await next(page);
  await expect(main(page).getByText('Analysis Summary')).toBeVisible();
  await finishScenario(page, 's10');

  // ---------------- S11
  await continueTo(page, '11');
  await expectBlocked(page); // ผลที่ระบบประเมินอัตโนมัติตอนซิงก์ไม่ผ่าน Gate ของขั้นนี้ — ร้านต้องกดประเมินเอง
  await main(page).getByRole('button', { name: /^(ประเมินความน่าเชื่อถือ|ประเมินใหม่)$/ }).first().click();
  await expect(main(page).getByText('5 Assessment Dimensions')).toBeVisible();
  await expect(main(page).getByText('Identity & Business')).toBeVisible();
  await expect(main(page).getByText('คะแนน (เฉพาะเจ้าหน้าที่)')).toHaveCount(0);
  for (let k = 0; k < 6; k++) await next(page);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: 'ส่งให้เจ้าหน้าที่พิจารณา' }).click();
  await expect(main(page).getByText('ส่งให้เจ้าหน้าที่พิจารณาแล้วเมื่อ')).toBeVisible();
  const tas = (await store<Tas>(page, 'trust-assessments')).find((a) => a.merchantId === 'M-005')!;
  expect(tas.status).toBe('pending_review');
  expect(tas.applicationId).toMatch(/^APP-/);
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/o/assessments/${tas.id}$`));
  await expect(main(page).getByText('คะแนน (เฉพาะเจ้าหน้าที่)')).toBeVisible();
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/shop\/M-005$/);
  await expect(main(page).getByText('คะแนน (เฉพาะเจ้าหน้าที่)')).toHaveCount(0);
  await expect(main(page).getByText(/ไม่ใช่การรับประกันว่าจะไม่มีปัญหาการซื้อขาย/)).toBeVisible();
  await finishScenario(page, 's11');

  // ---------------- S12
  await continueTo(page, '12');
  expect((await demoState(page)).current.assessmentId).toBe(tas.id);
  await expect(page).toHaveURL(/\/o\/assessments$/);
  await next(page);
  await expect(page).toHaveURL(new RegExp(`/o/applications/${tas.applicationId}$`));
  await expect(main(page).getByText('Marketplace Evidence').first()).toBeVisible();
  // เจ้าหน้าที่เห็นข้อมูลที่ร้านนำเข้าและแก้ไขใน Scenario 9
  await expect(main(page).getByTestId('import-review')).toContainText('ร้านอัปเดตโปรไฟล์จากข้อมูลที่นำเข้า');
  await expect(main(page).getByTestId('modified-fields')).toContainText('คำอธิบายธุรกิจ');
  for (let k = 0; k < 4; k++) await next(page);
  await expectBlocked(page);
  await main(page).getByRole('radio', { name: 'อนุมัติยกระดับ' }).click();
  await main(page).locator('select').last().selectOption('4');
  await main(page).getByPlaceholder('อธิบายเหตุผลของการพิจารณา').fill('ผลประเมิน Band A ความเชื่อมั่นสูง และผ่านเกณฑ์ v1 ของ Level 4 ครบ');
  await main(page).getByRole('button', { name: 'บันทึกผลการพิจารณา' }).click();
  await expect(main(page).getByText('อนุมัติยกระดับ Level 4')).toBeVisible();
  const decided = (await store<Tas>(page, 'trust-assessments')).find((a) => a.id === tas.id)!;
  const app = (await store<App>(page, 'applications')).find((a) => a.id === tas.applicationId)!;
  expect(app.status).toBe('approved'); // คำขอเดิม (ไม่สร้างคำขอใหม่)
  await next(page, { expectTransition: true });
  await expect(main(page).getByText('ได้รับอนุมัติ').first()).toBeVisible();
  await next(page);
  await expect(main(page).getByText(decided.decision!.certId!).first()).toBeVisible();
  await finishScenario(page, 's12');

  // ---------------- S13
  await continueTo(page, '13');
  expect((await demoState(page)).current.certId).toBe(decided.decision!.certId);
  await next(page, { expectTransition: true });
  await next(page);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: new RegExp(decided.decision!.certId!) }).click();
  await expect(main(page).getByText('ผลการตรวจสอบใบรับรอง').first()).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/shop\/M-005$/);
  for (let k = 0; k < 4; k++) await next(page);
  await next(page);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: 'ดูตัวอย่างหน้าร้าน' }).first().click();
  await expect(dlg(page).getByText('Mockup ภายในแอป (ไม่ใช่หน้าจริง)')).toBeVisible();
  await dlg(page).getByRole('button', { name: 'เข้าใจแล้ว' }).click();
  await finishScenario(page, 's13');

  // ---------------- Completion Summary
  await main(page).getByRole('button', { name: 'ดูสรุปผลกระทบ (Executive Impact Summary)' }).click();
  await expect(page).toHaveURL(/\/demo\/v2\/summary$/);
  await expect(main(page).getByText('ผลของร้านใน Journey: ร้านกาแฟดอยสูง')).toBeVisible();
  await expect(main(page).getByText('Level 4 — ', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('สาธิตแล้ว 5/5 Scenario')).toBeVisible();
});

test('ทางเลือก 9B: ไม่มี Marketplace → ลงทะเบียนเอง → Insufficient Data → เจ้าหน้าที่ขอหลักฐานเพิ่ม', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await open(page, '/demo');
  await page.getByRole('tab', { name: /Marketplace & Trust Assessment/ }).click();
  await page.getByRole('article').filter({ hasText: 'ร้านที่ไม่มีบัญชี Marketplace — ลงทะเบียนด้วยตนเอง' }).getByRole('button', { name: 'Start Demo' }).click();
  await expect(panel(page).getByText('Scenario 9B:')).toBeVisible();
  await next(page);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: 'ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await next(page);
  await main(page).getByRole('button', { name: 'เติมข้อมูลตัวอย่าง' }).click();
  await next(page);
  await next(page);
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: 'ประเมินความน่าเชื่อถือ' }).first().click();
  await expect(main(page).getByText('Insufficient Data — ข้อมูลยังไม่เพียงพอ').first()).toBeVisible();
  await next(page);
  await main(page).getByRole('button', { name: 'ส่งให้เจ้าหน้าที่พิจารณา' }).click();
  const { current } = await demoState(page);
  const tas = (await store<Tas>(page, 'trust-assessments')).find((a) => a.merchantId === current.merchantId)!;
  expect(tas.applicationId).toBe(current.applicationId); // ผูกกับคำขอลงทะเบียนเดิม
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/o/applications/${current.applicationId}$`));
  await next(page);
  await main(page).getByRole('radio', { name: 'ขอข้อมูลเพิ่มเติม' }).click();
  await main(page).getByPlaceholder('อธิบายเหตุผลของการพิจารณา').fill('กรุณาส่งภาพหน้าร้านและหลักฐานการขายย้อนหลัง 3 เดือน');
  await main(page).getByRole('button', { name: 'บันทึกผลการพิจารณา' }).click();
  await expect(main(page).getByText('ขอข้อมูลเพิ่มเติม').first()).toBeVisible();
  expect((await store<App>(page, 'applications')).find((a) => a.id === current.applicationId)!.status).toBe('need_info');
  await next(page, { expectTransition: true });
  await expect(main(page).getByText('เจ้าหน้าที่ขอข้อมูลเพิ่มเติม').first()).toBeVisible();
  await finishScenario(page, 's9b');
});
