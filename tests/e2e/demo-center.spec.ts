import type { Page } from '@playwright/test';
import { connectAndImport, review9aToSubmitStep } from './flows';
import { DEMO_TITLE, demoState, expect, expectDemoTitle, expectStep, fresh, isDesktop, next, open, openOtherDemos, panel, startDemoById, store, test } from './helpers';

/** หน้า Demo — Demo หลักเส้นเดียว (คลิกจริงตั้งแต่หน้าแรกจนจบ) · กรณีพิเศษ · ผลลัพธ์โดยตรง · ไม่มีเลข Scenario */
const cases = (page: Page) => page.getByTestId('case-section');
const results = (page: Page) => page.getByTestId('results-section');
const openResults = async (page: Page) => {
  if (!(await results(page).evaluate((el) => (el as HTMLDetailsElement).open))) await results(page).locator(':scope > summary').click();
  await expect(results(page).getByTestId('result-view').first()).toBeVisible();
};
const sessionRole = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session') ?? '{"state":{}}').state.role);
const nextBtn = (page: Page) => panel(page).locator('[data-demo="next"]');
type RegApp = { id: string; merchantId: string; status: string; autoDecision?: { route: string; reasons: string[] } };
type Shop = { id: string; operatorId: string; shopName: string };
const OP = 'OP-013';
/** จำนวนร้าน / คำขอลงทะเบียน / บันทึกการนำเข้าของบัญชี Demo หลัก (ตรวจว่าไม่มีข้อมูลซ้ำ) */
async function counts(page: Page) {
  const shops = (await store<Shop>(page, 'merchants')).filter((m) => m.operatorId === OP);
  const apps = (await store<RegApp & { type: string }>(page, 'applications')).filter((a) => shops.some((m) => m.id === a.merchantId) && a.type === 'registration');
  const imports = (await store<{ operatorId: string }>(page, 'marketplace-imports')).filter((x) => x.operatorId === OP);
  return { shops: shops.length, apps: apps.length, imports: imports.length };
}

/** เปิด Demo หลักจากหน้า Demo แล้วไปถึงขั้น 6 */
async function start9aToReview(page: Page) {
  await open(page, '/demo');
  await startDemoById(page, 's9a');
  await expectStep(page, 1);
  await connectAndImport(page);
}

/** ส่งคำขอ → ผลการตรวจอัตโนมัติต้องเป็น AUTO_PASS (ไม่ออกใบรับรอง) → ประเมิน → ผู้บริโภค → หน้าสรุป */
async function submit9aExpectAutoPassToEnd(page: Page) {
  const m = page.locator('main');
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(m.getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  await next(page);
  await expect(page).toHaveURL(/\/m\/shop$/);
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  await expect(panel(page).getByTestId('gate-blocked')).toHaveCount(0);
  const { current } = await demoState(page);
  const app = (await store<RegApp>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect(app.status).toBe('approved');
  expect(app.autoDecision?.route).toBe('AUTO_PASS');
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === current.merchantId)).toBe(false);
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  expect((await store<{ merchantId: string }>(page, 'officer-tasks')).some((t) => t.merchantId === current.merchantId)).toBe(false);
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/shop/${current.merchantId}$`));
  await nextBtn(page).click();
  await expect(page).toHaveURL(/\/demo\/complete\/s9a$/);
  return current;
}

test('หน้า Demo: Primary Action เดียว · ขั้นตอน Demo หลัก · กรณีพิเศษ 3 · ส่วนเพิ่มเติมพับไว้ · ไม่มีเลข Scenario', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await expect(page.getByRole('heading', { level: 1, name: 'ทดลองใช้งาน SME Trust' })).toBeVisible();
  await expect(page.getByTestId('main-cta')).toHaveCount(1);
  await expect(page.getByTestId('main-cta')).toHaveText(DEMO_TITLE.s9a);
  const flow = page.getByTestId('recommended-flow').getByRole('listitem');
  await expect(flow).toHaveCount(6);
  for (const [i, t] of ['เชื่อมข้อมูลร้านค้า', 'ลงทะเบียน', 'ตรวจสอบอัตโนมัติ', 'ประเมินความน่าเชื่อถือ', 'แสดงผล Badge', 'ผู้บริโภคตรวจสอบ'].entries()) await expect(flow.nth(i)).toContainText(t);
  await expect(page.getByTestId('main-journey').getByRole('button')).toHaveCount(0);
  await expect(cases(page).getByTestId('case-card')).toHaveCount(3);
  for (const id of ['s9b', 's15', 's6']) await expect(cases(page)).toContainText(DEMO_TITLE[id]);
  await expect(cases(page).getByTestId('view-note')).toHaveText('ร้านตัวอย่างจากข้อมูลตั้งต้น — แสดงผลประเมิน "ข้อมูลยังไม่เพียงพอ" ไม่ใช่ผลการตรวจคำขอลงทะเบียน');
  // ส่วนเพิ่มเติมพับไว้
  await expect(results(page).getByTestId('result-view').first()).toBeHidden();
  await expect(page.getByTestId('other-demos').getByTestId('other-demo').first()).toBeHidden();
  await openResults(page);
  await expect(results(page).getByTestId('result-view')).toHaveCount(3);
  await openOtherDemos(page);
  await expect(page.getByTestId('other-demo')).toHaveCount(6);
  // ไม่มีเลข Scenario / Full Journey / v1-v2
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/Scenario|Full Journey|\b9A\b|\b9B\b|\bv[12]\b/i);
});

test('Demo หลักจากหน้าแรกจนจบ: เชื่อมร้าน → ลงทะเบียน → AUTO_PASS → ประเมิน → Badge → ผู้บริโภคเห็นร้านเดียวกัน → จบการสาธิต (ไม่มีข้อมูลซ้ำ)', async ({ page }) => {
  test.setTimeout(300_000);
  const m = page.locator('main');
  await fresh(page);
  // 1. หน้าแรก → Primary Action เดียว
  await page.getByTestId('home-main-cta').click();
  await expectDemoTitle(page, 's9a');
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  expect(await sessionRole(page)).toBe('merchant');
  // 2–4. เชื่อมข้อมูลร้านค้า → ตรวจข้อมูล → ส่งคำขอ
  await connectAndImport(page);
  const importedName = await m.getByLabel(/ชื่อร้านค้า/).inputValue();
  expect(importedName).toContain('Official');
  await review9aToSubmitStep(page);
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(m.getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  // 5. ตรวจสอบอัตโนมัติ: AUTO_PASS ไม่ออกใบรับรอง Level 2
  await next(page);
  await expectStep(page, 9);
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  const { current } = await demoState(page);
  const shop = (await store<Shop>(page, 'merchants')).find((x) => x.id === current.merchantId)!;
  expect(shop.shopName).toBe(importedName);
  const app = (await store<RegApp>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect([app.status, app.autoDecision?.route]).toEqual(['approved', 'AUTO_PASS']);
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === shop.id)).toBe(false);
  // 6. ประเมินความน่าเชื่อถือ (ร้านเดิม) — Band และ Badge ตาม Engine จริง
  await next(page);
  await expectStep(page, 10);
  await expect(page).toHaveURL(/\/m\/trust$/);
  const badge = (await store<{ merchantId: string; status: string; band: string }>(page, 'assessment-badges')).find((x) => x.merchantId === shop.id)!;
  expect(badge).toBeTruthy();
  await expect(m.getByTestId('automation-panel').getByTestId('assessment-badge')).toHaveAttribute('data-status', badge.status);
  expect((await store<{ merchantId: string }>(page, 'officer-tasks')).some((t) => t.merchantId === shop.id)).toBe(false);
  // 7. ผู้บริโภคตรวจสอบร้านเดียวกัน
  await next(page, { expectTransition: true });
  await expectStep(page, 11);
  await expect(page).toHaveURL(new RegExp(`/shop/${shop.id}$`));
  expect(await sessionRole(page)).toBe('consumer');
  await expect(m.getByRole('heading', { name: shop.shopName }).first()).toBeVisible();
  await expect(m.getByTestId('public-badge')).toHaveAttribute('data-status', badge.status);
  // 8. หน้าสรุป → จบการสาธิต
  await nextBtn(page).click();
  await expect(page).toHaveURL(/\/demo\/complete\/s9a$/);
  await expect(page.getByText('สาธิตครบทุกขั้นแล้ว', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เริ่ม Demo ใหม่' })).toBeVisible();
  expect(await counts(page)).toEqual({ shops: 1, apps: 1, imports: 1 });
  await page.getByRole('button', { name: 'จบการสาธิต' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  expect((await demoState(page)).activeScenario).toBeFalsy();
  await expect(page.getByTestId('demo-resume')).toHaveCount(0);
});

test('ไม่ลงทะเบียนซ้ำ: กดส่งซ้ำ · ย้อนกลับไปหน้าลงทะเบียน · Refresh → แสดง "ส่งคำขอแล้ว" แทนแบบฟอร์ม และใช้ร้านเดิม', async ({ page }) => {
  test.setTimeout(300_000);
  const m = page.locator('main');
  await fresh(page);
  await start9aToReview(page);
  await review9aToSubmitStep(page);
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).dblclick();
  await expect(m.getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  expect(await counts(page)).toEqual({ shops: 1, apps: 1, imports: 1 });
  // Refresh หลังส่ง (ก่อนกดถัดไป) → ไม่เปิดแบบฟอร์มเปล่า
  await page.reload();
  await expect(m.getByTestId('demo-registration-done')).toBeVisible();
  await expect(m.getByRole('button', { name: 'ส่งคำขอ', exact: true })).toHaveCount(0);
  await next(page);
  await expectStep(page, 9);
  const shopId = (await demoState(page)).current.merchantId;
  // ย้อนกลับไปขั้นลงทะเบียน → แสดงว่าส่งแล้ว ไม่ให้กรอกใหม่ และไปต่อได้
  await panel(page).locator('[data-demo="back"]').click();
  await expectStep(page, 8);
  await expect(m.getByTestId('demo-registration-done')).toContainText('ส่งคำขอลงทะเบียนแล้วในการสาธิตนี้');
  await expect(nextBtn(page)).toBeEnabled();
  for (let k = 0; k < 6; k++) await panel(page).locator('[data-demo="back"]').click();
  await expectStep(page, 2);
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await expect(m.getByTestId('demo-registration-done')).toBeVisible();
  for (let k = 0; k < 7; k++) await next(page);
  await expectStep(page, 9);
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  expect((await demoState(page)).current.merchantId).toBe(shopId);
  expect(await counts(page)).toEqual({ shops: 1, apps: 1, imports: 1 });
});

test('ตัวควบคุมการสาธิต: ขั้น · URL · บทบาท · ถัดไป/ย้อนกลับ · Refresh · เริ่มเรื่องนี้ใหม่ · กลับมาสาธิตต่อ · กด CTA ซ้ำต้องยืนยัน', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await page.getByTestId('main-cta').click();
  await expectDemoTitle(page, 's9a');
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  await next(page);
  await expectStep(page, 2);
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await panel(page).locator('[data-demo="back"]').click();
  await expectStep(page, 1);
  await next(page);
  await page.reload();
  await expectStep(page, 2);
  expect((await demoState(page)).stepIndex).toBe(1);
  await panel(page).getByRole('button', { name: 'เริ่มเรื่องนี้ใหม่' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่มใหม่' }).click();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  // กลับหน้า Demo ระหว่างสาธิต → "สาธิตต่อ" กลับขั้นเดิม
  await next(page);
  await panel(page).getByRole('link', { name: 'หน้า Demo' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByTestId('demo-resume')).toContainText(DEMO_TITLE.s9a);
  await page.getByTestId('demo-resume').getByRole('button', { name: 'สาธิตต่อ' }).click();
  await expectStep(page, 2);
  // กด CTA ซ้ำระหว่างสาธิต → ต้องยืนยันก่อนเริ่มใหม่ (ไม่ล้างความคืบหน้าแบบเงียบ)
  await open(page, '/demo');
  await page.getByTestId('main-cta').click();
  await expect(page.getByRole('dialog')).toContainText('จะหยุด');
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่มตั้งแต่ต้น' }).click();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
});

test('ชื่อร้านไม่ตรงกับ Marketplace: ขั้น 6 ล็อกพร้อมเหตุผล → คืนชื่อร้าน → จบด้วย AUTO_PASS', async ({ page }) => {
  test.setTimeout(300_000);
  const m = page.locator('main');
  await fresh(page);
  await start9aToReview(page);
  const name = m.getByLabel(/ชื่อร้านค้า/);
  const original = await name.inputValue();
  await name.fill(`${original} สาขาใหม่`);
  await expect(nextBtn(page)).toBeDisabled();
  const blocked = panel(page).getByTestId('gate-blocked');
  await expect(blocked).toContainText('MANUAL_REVIEW');
  await expect(blocked).toContainText('คืนชื่อร้านตามต้นฉบับ');
  await expect(blocked.getByRole('button', { name: `เปิดกรณีพิเศษ: ${DEMO_TITLE.s15}` })).toBeVisible();
  await name.fill(original);
  await expect(blocked).toHaveCount(0);
  const desc = m.getByLabel(/รายละเอียดสินค้าและบริการ/);
  await desc.fill(`${await desc.inputValue()} รับประกันสินค้า 30 วัน`);
  await expect(nextBtn(page)).toBeEnabled();
  await next(page);
  await m.getByRole('button', { name: 'ใช้ข้อมูลติดต่อจากบัญชี' }).click();
  await m.getByLabel(/อำเภอ\/เขต/).fill('เมืองขอนแก่น');
  for (let i = 0; i < 2; i++) await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await m.getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await next(page);
  await submit9aExpectAutoPassToEnd(page);
});

test('ส่งคำขอด้วยชื่อร้านที่ไม่ตรง → ขั้น 9 อธิบาย MANUAL_REVIEW (ไม่บังคับผ่าน) → เริ่มใหม่ → ร้าน Official → AUTO_PASS', async ({ page }) => {
  test.setTimeout(420_000);
  const m = page.locator('main');
  await fresh(page);
  await start9aToReview(page);
  await review9aToSubmitStep(page);
  const name = m.getByLabel(/ชื่อร้านค้า/);
  for (let i = 0; i < 5 && !(await name.isVisible().catch(() => false)); i++) await m.getByRole('button', { name: 'ย้อนกลับ', exact: true }).click();
  await name.fill(`${await name.inputValue()} สาขาใหม่`);
  for (let i = 0; i < 5 && !(await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).isVisible().catch(() => false)); i++) await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(m.getByTestId('registration-decision')).toContainText('เจ้าหน้าที่ตรวจสอบเฉพาะกรณีนี้');
  await next(page);
  await expectStep(page, 9);
  await expect(nextBtn(page)).toBeDisabled();
  const blocked = panel(page).getByTestId('gate-blocked');
  await expect(blocked).toContainText('MANUAL_REVIEW');
  await expect(blocked).toContainText('ชื่อร้าน');
  const { current } = await demoState(page);
  const app = (await store<RegApp>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect([app.status, app.autoDecision?.route]).toEqual(['pending_review', 'MANUAL_REVIEW']);
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === current.merchantId)).toBe(false);
  await blocked.getByRole('button', { name: 'เริ่มใหม่ (กลับไปแก้ไข)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่มใหม่' }).click();
  await expectStep(page, 1);
  expect((await counts(page)).shops).toBe(0);
  await connectAndImport(page);
  await review9aToSubmitStep(page);
  await submit9aExpectAutoPassToEnd(page);
  expect(await counts(page)).toEqual({ shops: 1, apps: 1, imports: 1 });
});

test('กรณีพิเศษและฟังก์ชันอื่นเปิดจากหน้า Demo ได้ · ปุ่มกรณีพิเศษจากขั้นที่ล็อก · กลับหน้า Demo ได้', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  for (const id of ['s9b', 's15', 's6', 's4']) {
    await open(page, '/demo');
    await startDemoById(page, id);
    await expectStep(page, 1);
    await panel(page).getByRole('link', { name: 'หน้า Demo' }).click();
    await expect(page).toHaveURL(/\/demo$/);
  }
  // ขั้นที่ล็อกเพราะชื่อร้านไม่ตรง → "เปิดกรณีพิเศษ" → เริ่มกรณีข้อมูลไม่ตรงกัน
  await start9aToReview(page);
  const name = page.locator('main').getByLabel(/ชื่อร้านค้า/);
  await name.fill(`${await name.inputValue()} สาขาใหม่`);
  await panel(page).getByTestId('gate-blocked').getByRole('button', { name: `เปิดกรณีพิเศษ: ${DEMO_TITLE.s15}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'เปิดกรณีนี้' }).click();
  await expectDemoTitle(page, 's15');
  await expectStep(page, 1);
});

test('ผลลัพธ์โดยตรง: Badge · ผลประเมิน · การตรวจสอบของผู้บริโภค · ร้านข้อมูลไม่พอ · คิวงานเจ้าหน้าที่ — ไม่เริ่ม Demo ใหม่ และไม่สร้างข้อมูลใหม่', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await open(page, '/demo');
  const countsBefore = [(await store(page, 'assessment-badges')).length, (await store(page, 'trust-assessments')).length];
  await openResults(page);
  await results(page).getByRole('button', { name: 'ดู Badge ของร้านตัวอย่าง: Assessment Badge' }).click();
  await expect(page).toHaveURL(/\/shop\/M-001$/);
  await expect(page.locator('main').getByTestId('public-badge')).toHaveAttribute('data-status', 'active');
  expect(await sessionRole(page)).toBe('consumer');
  expect((await demoState(page)).activeScenario).toBeFalsy();
  await open(page, '/demo');
  await openResults(page);
  await results(page).getByRole('button', { name: 'เปิดหน้าตรวจสอบร้านค้า: ผู้บริโภคตรวจสอบร้านค้า' }).click();
  await expect(page).toHaveURL(/\/check$/);
  await open(page, '/demo');
  await openResults(page);
  await results(page).getByRole('button', { name: 'ดูผลประเมินร้านตัวอย่าง: ผลประเมินความน่าเชื่อถือ' }).click();
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expect(page.locator('main').getByTestId('automation-panel')).toBeVisible();
  await open(page, '/demo');
  await cases(page).getByRole('button', { name: `ดูร้านที่ข้อมูลยังไม่เพียงพอ: ${DEMO_TITLE.s9b}` }).click();
  await expect(page).toHaveURL(/\/shop\/M-002$/);
  await expect(page.locator('main').getByTestId('public-badge')).toHaveAttribute('data-status', 'insufficient');
  await open(page, '/demo');
  await cases(page).getByRole('button', { name: `เปิดคิวงานเจ้าหน้าที่: ${DEMO_TITLE.s15}` }).click();
  await expect(page).toHaveURL(/\/o\/exceptions$/);
  await expect(page.getByRole('heading', { level: 1, name: /Exception Queue/ })).toBeVisible();
  expect([(await store(page, 'assessment-badges')).length, (await store(page, 'trust-assessments')).length]).toEqual(countsBefore);
  // ระหว่างสาธิต: เปิดผลลัพธ์โดยตรง → หยุดชั่วคราว → "สาธิตต่อ" กลับขั้นเดิมด้วยบทบาทเดิม
  await open(page, '/demo');
  await page.getByTestId('main-cta').click();
  await expectDemoTitle(page, 's9a');
  await next(page);
  await expectStep(page, 2);
  await open(page, '/demo');
  await openResults(page);
  await results(page).getByRole('button', { name: 'ดู Badge ของร้านตัวอย่าง: Assessment Badge' }).click();
  await expect(page).toHaveURL(/\/shop\/M-001$/);
  expect((await demoState(page)).status).toBe('paused');
  await open(page, '/demo');
  await page.getByTestId('demo-resume').getByRole('button', { name: 'สาธิตต่อ' }).click();
  await expectStep(page, 2);
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  expect(await sessionRole(page)).toBe('merchant');
});

test('URL เดิมที่ยกเลิกแล้ว Redirect ไปหน้าที่เหมาะสม · ลิงก์บนหน้า Demo เปิดได้', async ({ page }) => {
  await fresh(page);
  for (const old of ['/demo/overview', '/demo/v2/summary']) {
    await open(page, old);
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByTestId('main-cta')).toBeVisible();
  }
  await open(page, '/demo?track=v2');
  await expect(page.getByTestId('main-cta')).toBeVisible();
  await page.evaluate(() => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true } }));
  });
  await open(page, '/m/marketplace-app');
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  await open(page, '/demo');
  const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).href))]);
  for (const h of hrefs) expect((await page.request.get(h)).status(), h).toBe(200);
});

for (const width of [375, 768]) {
  test(`หน้า Demo ${width}px: ไม่มี Horizontal overflow · CTA หลักใช้ได้`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    await open(page, '/demo');
    await expect(page.getByTestId('case-card')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await openOtherDemos(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByTestId('main-cta').click();
    await expectDemoTitle(page, 's9a');
    if (!isDesktop(page)) await expect(panel(page).getByText(/ขั้น 1\/\d+/)).toBeVisible();
  });
}
