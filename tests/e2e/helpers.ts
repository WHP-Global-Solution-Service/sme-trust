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

/** หน้า Demo (MVP-First): Scenario เดี่ยว · Full Journey · Reset อยู่ในส่วน "ดู Scenario ทั้งหมด" ที่พับไว้ — เปิดก่อนใช้งาน */
export async function openAllScenarios(page: Page) {
  const all = page.getByTestId('all-scenarios');
  await expect(all).toBeVisible();
  if (!(await all.evaluate((el) => (el as HTMLDetailsElement).open))) await all.locator(':scope > summary').click();
  await expect(all.getByRole('tab').first()).toBeVisible();
}

/** เริ่ม Scenario แบบเดี่ยวจากหน้ารวม */
export async function startDemo(page: Page, no: number) {
  await fresh(page);
  await open(page, '/demo');
  await openAllScenarios(page);
  await page.getByRole('button', { name: 'Start Demo' }).nth(no - 1).click();
  await expect(panel(page).getByText(isDesktop(page) ? `Scenario ${no}:` : `S${no} ·`, { exact: false })).toBeVisible();
}

/** จบ Scenario → หน้าสรุป */
export async function finishScenario(page: Page, id: string) {
  await nextBtn(page).click();
  await expect(page).toHaveURL(new RegExp(`/demo/complete/${id}$`));
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
}

/** ยืนยันกล่อง Confirm Dialog (ปุ่มสุดท้ายใน dialog) — กรอกเหตุผลถ้ามีช่อง */
export async function confirm(page: Page, reason?: string, button?: string | RegExp) {
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  if (reason) await dlg.locator('textarea').first().fill(reason);
  await (button ? dlg.getByRole('button', { name: button }) : dlg.getByRole('button').last()).click();
  await expect(dlg).toBeHidden();
}
