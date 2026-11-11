import { expect, test as base, type Page } from '@playwright/test';

/** ทุก Test ตรวจว่าไม่มี JavaScript / Console error */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await use(errors);
      expect(errors, 'ไม่มี JavaScript / Console error').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** เปิดเส้นทางภายในแอป (รองรับ base path เช่น /sme-trust/) */
export const open = (page: Page, path: string) => page.goto(path.replace(/^\//, ''));

/** ล้างข้อมูลสาธิตทั้งหมด แล้วเปิดหน้าแรก */
export async function fresh(page: Page) {
  await open(page, '/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/** อ่าน Store จาก localStorage (ข้อมูลเดียวกับที่ UI ใช้) */
export async function store<T = Record<string, unknown>>(page: Page, name: string): Promise<T[]> {
  return page.evaluate((n) => JSON.parse(localStorage.getItem(`smetrust:v2:${n}`) ?? '{"state":{"items":[]}}').state.items, name);
}
export async function demoState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:demo') ?? '{"state":{}}').state);
}

// ---------------- Demo Controller ----------------
/** ≥ 1024px ใช้แผงด้านขวา, จอเล็กกว่าใช้แถบล่าง (มือถือ/แท็บเล็ต) */
export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024;
export const panel = (page: Page) => (isDesktop(page) ? page.locator('aside[aria-label="ตัวควบคุมการสาธิต"]') : page.locator('[data-demo="bar"]'));
export const nextBtn = (page: Page) => panel(page).locator('[data-demo="next"]');

/** กด "ถัดไป" — ถ้ามี Role Transition ให้ตรวจคำอธิบายแล้วยืนยัน */
export async function next(page: Page, opts: { expectTransition?: boolean } = {}) {
  await expect(nextBtn(page)).toBeEnabled();
  await nextBtn(page).click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: /ดำเนินการต่อในมุม/ });
  if (opts.expectTransition) await expect(confirm).toBeVisible();
  if (await confirm.isVisible().catch(() => false)) {
    await expect(page.getByRole('dialog').getByText('เปลี่ยนมุมมองการสาธิต')).toBeVisible();
    await confirm.click();
  }
}

/** ตรวจว่าปุ่ม "ถัดไป" ถูกปิดจนกว่าจะทำ Action ของขั้นนั้น */
export async function expectBlocked(page: Page) {
  await expect(nextBtn(page)).toBeDisabled();
  if (isDesktop(page)) await expect(panel(page).getByText('ทำขั้นนี้ให้เสร็จก่อนไปต่อ')).toBeVisible();
}

export const expectStep = (page: Page, n: number) => expect(panel(page).getByText(new RegExp(`ขั้น ${n}/\\d+`))).toBeVisible();

/** ชื่อการสาธิตที่ผู้ใช้เห็น (ไม่มีเลข Scenario) — ตรงกับ src/mock/scenarios */
export const DEMO_TITLE: Record<string, string> = {
  s9a: 'ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ',
  s9b: 'กรณีร้านค้าไม่มี Marketplace และข้อมูลยังไม่พอ',
  s15: 'กรณีข้อมูลร้านค้าไม่ตรงกัน — เจ้าหน้าที่ตรวจสอบ',
  s6: 'กรณีร้านค้าถูกระงับการรับรองและการอุทธรณ์',
  s1: 'ผู้ประกอบการสมัครสมาชิกและยืนยันตัวตน',
  s2: 'สมัครร้านค้าและได้รับการรับรองหลังการตรวจสอบ',
  s4: 'ผู้บริโภคร้องเรียนและร้านค้าช่วยแก้ไขก่อนส่งต่อ',
  s5: 'ผู้ประกอบการได้รับคำเตือนและเข้ารับการอบรม',
  s7: 'AI ตรวจสอบโฆษณาก่อนเผยแพร่',
  s8: 'AI ช่วยร้านค้าแก้ไขข้อร้องเรียน',
};
const SPECIAL = ['s9b', 's15', 's6'];

/** หน้า Demo: เปิดส่วน "ฟังก์ชันอื่นของระบบ" ที่พับไว้ */
export async function openOtherDemos(page: Page) {
  const box = page.getByTestId('other-demos');
  await expect(box).toBeVisible();
  if (!(await box.evaluate((el) => (el as HTMLDetailsElement).open))) await box.locator(':scope > summary').click();
  await expect(box.getByTestId('other-demo').first()).toBeVisible();
}

/** ตรวจว่าตัวควบคุมการสาธิตกำลังแสดงเรื่องนี้ (เดสก์ท็อปดูชื่อ · มือถือดู Demo State) */
export async function expectDemoTitle(page: Page, id: string) {
  await expect.poll(async () => (await demoState(page)).activeScenario).toBe(id);
  if (isDesktop(page)) await expect(panel(page).getByTestId('demo-title')).toHaveText(DEMO_TITLE[id]);
}

/** เริ่มการสาธิตจากหน้า Demo (อยู่ที่ /demo แล้ว) — Demo หลัก · กรณีพิเศษ · ฟังก์ชันอื่น */
export async function startDemoById(page: Page, id: string) {
  if (id === 's9a') await page.getByTestId('main-cta').click();
  else if (SPECIAL.includes(id)) await page.getByTestId('case-section').getByRole('button', { name: `ทดลองกรณีนี้: ${DEMO_TITLE[id]}`, exact: true }).click();
  else {
    await openOtherDemos(page);
    await page.getByTestId('other-demos').getByRole('button', { name: `เริ่มสาธิต: ${DEMO_TITLE[id]}`, exact: true }).click();
  }
  const ok = page.getByRole('dialog').getByRole('button', { name: 'เริ่มตั้งแต่ต้น' });
  if (await ok.isVisible({ timeout: 1000 }).catch(() => false)) await ok.click();
  await expectDemoTitle(page, id);
}

/** เริ่มการสาธิตแบบเดี่ยวด้วยข้อมูลตั้งต้น (รับรหัส เช่น 's4' หรือหมายเลขเดิม เช่น 4) */
export async function startDemo(page: Page, idOrNo: string | number) {
  await fresh(page);
  await open(page, '/demo');
  await startDemoById(page, typeof idOrNo === 'number' ? `s${idOrNo}` : idOrNo);
}

/** จบการสาธิต → หน้าสรุป */
export async function finishScenario(page: Page, id: string) {
  await nextBtn(page).click();
  await expect(page).toHaveURL(new RegExp(`/demo/complete/${id}$`));
  await expect(page.getByText('สาธิตครบทุกขั้นแล้ว', { exact: true })).toBeVisible();
}

/** ยืนยันกล่อง Confirm Dialog (ปุ่มสุดท้ายใน dialog) — กรอกเหตุผลถ้ามีช่อง */
export async function confirm(page: Page, reason?: string, button?: string | RegExp) {
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  if (reason) await dlg.locator('textarea').first().fill(reason);
  await (button ? dlg.getByRole('button', { name: button }) : dlg.getByRole('button').last()).click();
  await expect(dlg).toBeHidden();
}
