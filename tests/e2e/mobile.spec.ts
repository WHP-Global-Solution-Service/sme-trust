import type { Page } from '@playwright/test';
import { expect, finishScenario, panel, startDemo, test } from './helpers';
import { playS1, playS3, playS7, playS8 } from './flows';

/**
 * มือถือ/แท็บเล็ต (ใช้กับโปรเจกต์ iphone-safari และ ipad-safari — WebKit + Touch)
 * ใช้แถบควบคุมการสาธิตด้านล่าง และตรวจว่าไม่ล้นจอแนวนอนหลังจบแต่ละเรื่อง
 */
const noOverflow = async (page: Page) => {
  const vw = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'ไม่ล้นจอแนวนอน').toBeLessThanOrEqual(vw);
};

test.describe('มือถือ/แท็บเล็ต — Demo Controller แบบแถบล่าง', () => {
  test('S1 ลงทะเบียนบนมือถือ (OTP, e-KYC, แป้น PIN แบบแตะ)', async ({ page }) => {
    await startDemo(page, 1);
    await playS1(page, { phone: '0893334455', first: 'มือถือ', last: 'ทดสอบ', email: 'mobile@demo.local' });
    await noOverflow(page);
    await finishScenario(page, 's1');
    await noOverflow(page);
  });

  test('S3 ผู้บริโภคตรวจสอบร้าน: QR, ใบรับรอง, หน้าต่างช่องทางขาย', async ({ page }) => {
    await startDemo(page, 3);
    await playS3(page);
    await noOverflow(page);
    await finishScenario(page, 's3');
  });

  test('S7 AI ตรวจโฆษณา: Highlight และเปรียบเทียบบนจอเล็ก', async ({ page }) => {
    await startDemo(page, 7);
    await playS7(page);
    await noOverflow(page);
    await finishScenario(page, 's7');
  });

  test('S8 AI ร่างคำตอบ → ร้านกดส่งเอง → Role Transition → ผู้บริโภคเห็นคำตอบ', async ({ page }) => {
    await startDemo(page, 8);
    // แผ่นรายละเอียดขั้นตอน (Sheet) เปิด/ปิดได้ และมีปุ่ม Restart / Exit
    await panel(page).getByRole('button', { name: 'ดูรายละเอียดขั้นตอน' }).click();
    await expect(page.getByText('Restart Scenario').last()).toBeVisible();
    await page.getByRole('button', { name: 'ปิด', exact: true }).click();
    await playS8(page);
    await noOverflow(page);
    await finishScenario(page, 's8');
  });
});
