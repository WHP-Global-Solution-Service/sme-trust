import type { Page } from '@playwright/test';
import { demoState, expect, finishScenario, fresh, open, panel, store, test } from './helpers';
import { startJourney, playS1, playS2, playS3, playS4, playS5, playS6, playS7, playS8 } from './flows';

/** กด CTA "ดำเนินการต่อ" บนหน้าสรุป — ถ้าเรื่องถัดไปเป็นกรณีศึกษาแยก ต้องมีกล่องแจ้งก่อน */
export async function continueTo(page: Page, no: number, expectCaseNote = false) {
  await page.locator('main').getByRole('button').first().click();
  const dlg = page.getByRole('dialog');
  if (expectCaseNote) {
    await expect(dlg.getByText('ใช้กรณีศึกษาแยก')).toBeVisible();
    await dlg.getByRole('button', { name: `เริ่ม Scenario ${no}` }).click();
  }
  await expect(panel(page).getByText(`Scenario ${no}:`)).toBeVisible();
  await expect(panel(page).getByText('Full Journey Demo')).toBeVisible();
}

test('Full Journey 1→8 ผ่าน UI จริง: Context ต่อเนื่อง ไม่มีข้อมูลซ้ำ และจบที่หน้าสรุปภาพรวม', async ({ page }) => {
  test.setTimeout(900_000);
  await fresh(page);
  await open(page, '/demo');
  await startJourney(page);

  const opId = await playS1(page);
  await finishScenario(page, 's1');

  await continueTo(page, 2);
  expect((await demoState(page)).current.operatorId).toBe(opId);
  const shop = await playS2(page);
  expect(shop.operatorId).toBe(opId);
  await finishScenario(page, 's2');

  await continueTo(page, 3);
  expect((await demoState(page)).current.merchantId).toBe(shop.id);
  await expect(panel(page).getByText('ใช้ข้อมูลตัวอย่าง:')).toHaveCount(0);
  await playS3(page);
  await finishScenario(page, 's3');

  await continueTo(page, 4);
  expect((await demoState(page)).current.merchantId).toBe(shop.id);
  await playS4(page);
  await finishScenario(page, 's4');

  await continueTo(page, 5, true);
  await playS5(page);
  await finishScenario(page, 's5');

  await continueTo(page, 6, true);
  await playS6(page);
  await finishScenario(page, 's6');

  await continueTo(page, 7);
  expect((await demoState(page)).current.operatorId).toBe(opId);
  await playS7(page);
  await finishScenario(page, 's7');

  await continueTo(page, 8, true);
  await playS8(page);
  await finishScenario(page, 's8');

  await page.getByRole('button', { name: 'ดูสรุปภาพรวม SME Trust Platform' }).click();
  await expect(page).toHaveURL(/\/demo\/overview$/);
  await expect(page.getByText('8/8').first()).toBeVisible();
  // ข้อมูลตัวอย่างมี 12 ร้าน — ทั้ง Journey สร้างร้านใหม่เพียง 1 ร้าน
  expect((await store(page, 'merchants')).length).toBe(13);
});
