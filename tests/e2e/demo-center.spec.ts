import type { Page } from '@playwright/test';
import { demoState, expect, expectStep, finishScenario, fresh, isDesktop, next, open, openAllScenarios, panel, store, test } from './helpers';

/** หน้า Demo — MVP-First Demo Center */
const mvp = (page: Page) => page.getByTestId('mvp-section');
const sessionRole = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session') ?? '{"state":{}}').state.role);

test('MVP-First: เปิดหน้า Demo เห็น 5 ระบบหลักก่อน · ระบบเพิ่มเติมและ Scenario ทั้งหมดพับไว้ · เปิด/ปิดได้', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await expect(page.getByRole('heading', { level: 1, name: 'ทดลองใช้งาน SME Trust' })).toBeVisible();
  await expect(page.getByTestId('main-cta')).toBeVisible();
  await expect(page.getByTestId('main-cta')).toHaveText('เริ่ม Demo เส้นทางหลัก');
  const cards = mvp(page).getByTestId('mvp-card');
  await expect(cards).toHaveCount(5);
  for (const [i, t] of ['ลงทะเบียนร้านค้า', 'ประเมินความน่าเชื่อถือ', 'แสดงผล Assessment Badge', 'ตรวจสอบร้านค้า', 'ตรวจสอบเฉพาะกรณีจำเป็น'].entries()) await expect(cards.nth(i)).toContainText(t);
  await expect(page.getByTestId('recommended-flow').getByRole('listitem')).toHaveCount(5);
  // เส้นทางหลัก = Automation First (9A): ลงทะเบียน → ตรวจอัตโนมัติ → AUTO_PASS → ประเมิน → ผู้บริโภค
  const flow = page.getByTestId('recommended-flow').getByRole('listitem');
  for (const [i, t] of ['ลงทะเบียน / เชื่อมร้านค้า', 'ตรวจข้อมูลอัตโนมัติ', 'AUTO_PASS', 'ประเมินความน่าเชื่อถือ', 'ผู้บริโภคตรวจสอบ'].entries()) await expect(flow.nth(i)).toContainText(t);
  await expect(page.getByTestId('recommended-flow')).toContainText('ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่');
  // การ์ด Badge เปิด Scenario 14 (Automatic Assessment Badge) โดยตรง — ไม่มีการ์ดที่อ้างขั้นของเส้นทางหลัก
  await expect(cards.nth(2).getByRole('button')).toHaveText('เริ่ม Demo');
  await expect(page.getByTestId('mvp-in-main')).toHaveCount(0);
  // พับไว้เป็นค่าเริ่มต้น: ไม่เห็นปุ่มเริ่มของระบบเพิ่มเติมหรือ Scenario เดี่ยว
  await expect(page.getByTestId('secondary-group')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /^เริ่มสาธิต:/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Full Journey' })).toHaveCount(0);
  // ขยาย / พับ กลุ่ม AI Simulation
  const ai = page.getByTestId('secondary-group').filter({ hasText: 'AI Simulation' });
  await ai.locator(':scope > summary').click();
  await expect(ai.getByRole('button', { name: /^เริ่มสาธิต:/ })).toHaveCount(2);
  await ai.locator(':scope > summary').click();
  await expect(ai.getByRole('button', { name: /^เริ่มสาธิต:/ })).toHaveCount(0);
  // Scenario ทั้งหมด: Full Journey 2 ชุด + Scenario เดี่ยวทุกเรื่อง (8 + 9)
  await openAllScenarios(page);
  await expect(page.getByRole('button', { name: 'Start Full Journey' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เริ่ม Journey Marketplace & Trust', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(8);
  await page.getByRole('tab', { name: /Marketplace & Trust Assessment/ }).click();
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(9);
  // ไม่มีป้าย v1/v2 ที่ผู้ใช้เห็น
  expect(await page.locator('main').innerText()).not.toMatch(/\bv[12]\b/i);
});

test('CTA หลัก → เส้นทางหลัก (Scenario 9A): ขั้น · URL · บทบาท · ถัดไป/ย้อนกลับ · Refresh · Restart · เริ่มตั้งแต่ต้น', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await page.getByTestId('main-cta').click();
  await expect(panel(page).getByText('Scenario 9A:')).toBeVisible();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  expect(await sessionRole(page)).toBe('merchant');
  expect((await demoState(page)).activeScenario).toBe('s9a');
  await next(page);
  await expectStep(page, 2);
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await panel(page).locator('[data-demo="back"]').click();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  // Refresh แล้วอยู่ขั้นเดิม (Demo State คงอยู่)
  await next(page);
  await expectStep(page, 2);
  await page.reload();
  await expectStep(page, 2);
  expect((await demoState(page)).stepIndex).toBe(1);
  // Restart Scenario (ตัวควบคุมเดิม) → ขั้น 1
  await panel(page).getByRole('button', { name: 'Restart Scenario' }).click();
  await page.getByRole('dialog').getByRole('button').last().click();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  // กลับหน้า Demo ระหว่างสาธิต → เห็นสถานะ และ "เริ่มสาธิตตั้งแต่ต้น" ต้องยืนยันก่อน
  await open(page, '/demo');
  await expect(page.getByTestId('demo-hero')).toContainText('Scenario 9A');
  await page.getByTestId('recommended-flow').getByRole('button', { name: 'เริ่มสาธิตตั้งแต่ต้น' }).click();
  await expect(page.getByRole('dialog')).toContainText('เริ่มเส้นทางหลักตั้งแต่ต้น?');
  await page.getByRole('dialog').getByRole('button', { name: 'เริ่มตั้งแต่ต้น' }).click();
  await expect(panel(page).getByText('Scenario 9A:')).toBeVisible();
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
});

test('เส้นทางหลัก 9A ครบทุกขั้น: ลงทะเบียน (Marketplace) → ตรวจอัตโนมัติ → AUTO_PASS (ไม่มีเจ้าหน้าที่) → ประเมิน → ผู้บริโภค', async ({ page }) => {
  test.setTimeout(300_000);
  const m = page.locator('main');
  await fresh(page);
  await open(page, '/demo');
  await page.getByTestId('main-cta').click();
  await expect(panel(page).getByText('Scenario 9A:')).toBeVisible();
  await next(page);
  await m.getByRole('button', { name: /A\. เชื่อมต่อร้านค้าจาก Marketplace/ }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\/marketplace$/);
  await next(page);
  await m.getByRole('radio', { name: 'Shopee (จำลอง)' }).click();
  await m.getByRole('button', { name: 'ถัดไป' }).click();
  await m.getByLabel(/ข้าพเจ้าอนุญาต/).check();
  await m.getByRole('button', { name: 'อนุญาต (จำลอง)' }).click();
  await next(page);
  await m.getByRole('radiogroup', { name: 'ร้านค้าในบัญชี' }).getByRole('radio').nth(1).click(); // ร้าน "Official" ตามคำแนะนำในขั้นนี้
  await m.getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await expect(m.getByTestId('source-data')).toBeVisible();
  await next(page);
  await m.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(page).toHaveURL(/\/m\/register-shop\?from=import$/);
  await next(page);
  const desc = m.getByLabel(/รายละเอียดสินค้าและบริการ/);
  await desc.fill(`${await desc.inputValue()} รับประกันสินค้า 30 วัน`);
  await next(page);
  await m.getByRole('button', { name: 'ใช้ข้อมูลติดต่อจากบัญชี' }).click();
  await m.getByLabel(/อำเภอ\/เขต/).fill('เมืองขอนแก่น');
  for (let i = 0; i < 2; i++) await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await m.getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await next(page);
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(m.getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  // AUTO_PASS: ผ่านการลงทะเบียนทันที ไม่ออกใบรับรอง ไม่มีงานเจ้าหน้าที่
  await next(page);
  await expect(page).toHaveURL(/\/m\/shop$/);
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  const { current } = await demoState(page);
  const app = (await store<{ id: string; status: string; autoDecision?: { route: string } }>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect(app.status).toBe('approved');
  expect(app.autoDecision?.route).toBe('AUTO_PASS');
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === current.merchantId)).toBe(false);
  // Refresh แล้วอยู่ขั้นเดิม
  await page.reload();
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  // ระบบประเมินอัตโนมัติ — ไม่ส่งงานให้เจ้าหน้าที่
  expect((await store<{ merchantId: string }>(page, 'assessment-badges')).some((x) => x.merchantId === current.merchantId)).toBe(true);
  expect((await store<{ merchantId: string }>(page, 'officer-tasks')).some((t) => t.merchantId === current.merchantId)).toBe(false);
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/shop/${current.merchantId}$`));
  expect(await sessionRole(page)).toBe('consumer');
  await finishScenario(page, 's9a');
});

test('ปุ่มของ 5 ระบบหลักและระบบเพิ่มเติม เริ่ม Scenario ที่ถูกต้อง', async ({ page }) => {
  test.setTimeout(240_000);
  const cases: [string, string, string][] = [
    ['เริ่ม Demo: เชื่อมร้านค้าออนไลน์', 'Scenario 9A:', 's9a'],
    ['เริ่ม Demo: สมัครด้วยตนเอง', 'Scenario 9B:', 's9b'],
    ['เริ่ม Demo: ประเมินความน่าเชื่อถือ', 'Scenario 11:', 's11'],
    ['เริ่ม Demo: แสดงผล Assessment Badge', 'Scenario 14:', 's14'],
    ['เริ่ม Demo: ตรวจสอบร้านค้า', 'Scenario 13:', 's13'],
    ['เริ่ม Demo: ตรวจสอบเฉพาะกรณีจำเป็น', 'Scenario 15:', 's15'],
  ];
  await fresh(page);
  for (const [name, label, id] of cases) {
    await open(page, '/demo');
    await mvp(page).getByRole('button', { name, exact: true }).click();
    await expect(panel(page).getByText(label)).toBeVisible();
    await expectStep(page, 1);
    expect((await demoState(page)).activeScenario).toBe(id);
  }
  // ระบบเพิ่มเติม: กลุ่มร้องเรียนและอุทธรณ์ → Scenario 4
  await open(page, '/demo');
  const g = page.getByTestId('secondary-group').filter({ hasText: 'ระบบร้องเรียนและอุทธรณ์' });
  await g.locator(':scope > summary').click();
  await g.getByRole('button', { name: /^เริ่มสาธิต: ผู้บริโภคร้องเรียน/ }).click();
  await expect(panel(page).getByText('Scenario 4:')).toBeVisible();
  expect((await demoState(page)).activeScenario).toBe('s4');
});

test('Direct URL /demo?track=v2 เปิด Scenario ทั้งหมดที่ชุด Marketplace & Trust · Refresh ได้ · ลิงก์ไม่เสีย', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo?track=v2');
  await expect(page.getByTestId('all-scenarios')).toHaveAttribute('open', '');
  await expect(page.getByRole('tab', { name: /Marketplace & Trust Assessment/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Start Demo' })).toHaveCount(9);
  await page.reload();
  await expect(page.getByTestId('mvp-section')).toBeVisible();
  // ทุกลิงก์บนหน้า Demo เปิดได้ (เส้นทางภายในแอป)
  const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).href))]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect((await page.request.get(h)).status(), h).toBe(200);
});

for (const width of [375, 768]) {
  test(`หน้า Demo ${width}px: การ์ดเรียงลง ไม่มี Horizontal overflow · CTA ใช้ได้`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    await open(page, '/demo');
    const cards = mvp(page).getByTestId('mvp-card');
    await expect(cards).toHaveCount(5);
    const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, w: r.width })));
    if (width < 640) expect(new Set(boxes.map((b) => Math.round(b.x))).size, 'มือถือ: การ์ดเรียงเป็นคอลัมน์เดียว').toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await openAllScenarios(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByTestId('main-cta').click();
    await expect(panel(page).getByText(isDesktop(page) ? 'Scenario 9A:' : 'S9A ·', { exact: false })).toBeVisible();
  });
}
