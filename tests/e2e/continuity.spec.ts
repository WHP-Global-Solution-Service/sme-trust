import { demoState, expect, expectStep, fresh, next, open, panel, store, test } from './helpers';
import { fillReportSample, playS1, startJourney } from './flows';

test('ข้ามไป Scenario 3 ขณะร้านจาก Scenario 2 ยังไม่อนุมัติ → แจ้งเหตุผลและให้เลือก (ไม่สลับ Merchant แบบเงียบ)', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await open(page, '/demo');
  await startJourney(page);
  await playS1(page);
  await next(page);
  await page.locator('main').getByRole('button').first().click(); // ดำเนินการต่อ → S2
  await expect(panel(page).getByText('Scenario 2:')).toBeVisible();
  // ส่งคำขอร้านค้า แต่ยังไม่ให้เจ้าหน้าที่อนุมัติ
  await next(page);
  await page.locator('main').getByRole('button', { name: 'เติมข้อมูลตัวอย่าง' }).click();
  for (let k = 0; k < 4; k++) await next(page);
  await page.locator('main').getByRole('checkbox').last().check();
  await page.locator('main').getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await next(page);
  await expectStep(page, 7);
  const s2 = (await demoState(page)).current;

  await open(page, '/demo');
  await page.getByRole('button', { name: /^3\s/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'ข้ามไป' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('ข้อมูลสำหรับ Scenario 3 ยังไม่ครบ')).toBeVisible();
  await expect(dlg.getByText(/ร้าน "ขนมไทยบ้านสวน" จาก Scenario 2 ยังไม่ได้รับการรับรอง/)).toBeVisible();
  await expect(dlg.getByText(/M-001/)).toBeVisible();

  // ทางเลือก 1: กลับไปทำ Scenario 2 ให้ครบ → ขั้นเดิม ร้านเดิม
  await dlg.getByRole('button', { name: 'กลับไปทำ Scenario 2 ให้ครบ' }).click();
  await expect(panel(page).getByText('Scenario 2:')).toBeVisible();
  await expectStep(page, 7);
  expect((await demoState(page)).current.merchantId).toBe(s2.merchantId);

  // ทางเลือก 2: ใช้ข้อมูลตัวอย่าง → มีหมายเหตุอธิบายในตัวควบคุมตลอดทั้งเรื่อง และไม่สร้างร้านซ้ำ
  const merchants = (await store(page, 'merchants')).length;
  await open(page, '/demo');
  await page.getByRole('button', { name: /^3\s/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'ข้ามไป' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ใช้ข้อมูลตัวอย่าง' }).click();
  await expect(panel(page).getByText('Scenario 3:')).toBeVisible();
  await expect(panel(page).getByText('ใช้ข้อมูลตัวอย่าง:')).toBeVisible();
  await expect(panel(page).getByText(/ยังไม่ได้รับการรับรอง/)).toBeVisible();
  const st = await demoState(page);
  expect(st.current.merchantId).toBe('M-001');
  expect(st.journey.merchantId).toBe(s2.merchantId);
  expect((await store(page, 'merchants')).length).toBe(merchants);
  // Refresh แล้วหมายเหตุยังอยู่
  await page.reload();
  await expect(panel(page).getByText('ใช้ข้อมูลตัวอย่าง:')).toBeVisible();
});

test('Restart Scenario ไม่สร้างข้อมูลซ้ำ / Refresh แล้วทำต่อได้ / Back-Next ไม่ทำ Action ซ้ำ', async ({ page }) => {
  await fresh(page);
  await open(page, '/demo');
  await page.getByRole('button', { name: 'Start Demo' }).nth(3).click();
  await next(page);
  await fillReportSample(page);
  await next(page);
  const before = (await store(page, 'complaints')).length;
  await page.locator('main').getByRole('button', { name: 'ส่งเรื่อง (Submit)' }).click();
  await expect.poll(async () => (await store(page, 'complaints')).length).toBe(before + 1);
  await next(page);
  // Back / Next หลายรอบ ไม่สร้างเรื่องเพิ่ม
  await panel(page).locator('[data-demo="back"]').click();
  await panel(page).locator('[data-demo="back"]').click();
  // แบบฟอร์มเปิดใหม่ (ว่าง) แต่ขั้นนี้ทำแล้ว — ไปต่อได้โดยไม่ต้องส่งซ้ำ
  await expect(panel(page).getByText('ขั้นนี้ทำเสร็จแล้ว')).toBeVisible();
  await next(page);
  await next(page);
  expect((await store(page, 'complaints')).length).toBe(before + 1);
  // Refresh แล้วอยู่ขั้นเดิม
  await page.reload();
  await expectStep(page, 4);
  // Restart Scenario → เรื่องที่สร้างระหว่างทางถูกถอยกลับ
  await panel(page).getByRole('button', { name: 'Restart Scenario' }).click();
  await page.getByRole('dialog').getByRole('button').last().click();
  await expectStep(page, 1);
  expect((await store(page, 'complaints')).length).toBe(before);
});
