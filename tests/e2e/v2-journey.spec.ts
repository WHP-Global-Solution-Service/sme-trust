import type { Page } from '@playwright/test';
import { demoState, expect, expectBlocked, finishScenario, fresh, next, open, startDemoById, store, test } from './helpers';

/** กรณีพิเศษ: ร้านไม่มี Marketplace และข้อมูลยังไม่พอ — ผ่าน UI จริง (เปิดจากการ์ดกรณีพิเศษบนหน้า Demo) · Business Action ทุกอย่างกดในหน้าจอ */
const main = (page: Page) => page.locator('main');
type App = { id: string; merchantId: string; type: string; status: string };

test('กรณีพิเศษ: ไม่มี Marketplace → ลงทะเบียนเอง → ผ่านการลงทะเบียนอัตโนมัติ → ข้อมูลยังไม่เพียงพอ → ผู้บริโภคเห็นสถานะแทน Badge (ไม่มีขั้นเจ้าหน้าที่)', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await open(page, '/demo');
  await startDemoById(page, 's9b');
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
  // Automation First: ระบบตรวจคำขออัตโนมัติ → ผ่านการลงทะเบียน (ไม่มีขั้นตอนเจ้าหน้าที่ในกรณีปกติ)
  await expect(main(page).getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  await next(page);
  await expect(page).toHaveURL(/\/m\/shop$/);
  await expect(main(page).getByTestId('registration-auto-pass')).toBeVisible();
  const { current } = await demoState(page);
  const regApp = (await store<App & { autoDecision?: { route: string } }>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect(regApp.status).toBe('approved');
  expect(regApp.autoDecision?.route).toBe('AUTO_PASS');
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expect(main(page).getByText('Insufficient Data — ข้อมูลยังไม่เพียงพอ').first()).toBeVisible();
  // ระบบประเมินอัตโนมัติแล้ว → ไม่แสดง Badge และไม่ส่งงานให้เจ้าหน้าที่
  expect((await store<{ merchantId: string; status: string }>(page, 'assessment-badges')).find((x) => x.merchantId === current.merchantId)?.status).toBe('insufficient');
  expect((await store<{ merchantId: string }>(page, 'officer-tasks')).some((t) => t.merchantId === current.merchantId)).toBe(false);
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/shop/${current.merchantId}$`));
  await expect(main(page).getByText('ข้อมูลยังไม่เพียงพอ').first()).toBeVisible();
  await finishScenario(page, 's9b');
});
