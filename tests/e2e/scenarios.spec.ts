import { expect, finishScenario, startDemo, store, test } from './helpers';
import { playS1, playS2, playS4, playS5, playS6, playS7, playS8 } from './flows';

/** กรณีพิเศษ (ระงับ/อุทธรณ์) และฟังก์ชันอื่นของระบบ — เปิดจากหน้า Demo ทุก Business Action ทำผ่าน UI จริง */
test.describe('การสาธิตแต่ละเรื่อง (เปิดจากหน้า Demo)', () => {
  test('S1 Registration: OTP, e-KYC, PIN → Identity Verified', async ({ page }) => {
    await startDemo(page, 1);
    await playS1(page);
    await finishScenario(page, 's1');
  });

  test('S2 Merchant Verification: สมัครร้าน → เจ้าหน้าที่อนุมัติ → Badge/Passport', async ({ page }) => {
    await startDemo(page, 2);
    const m = await playS2(page);
    expect(m.operatorId).toBe('OP-012');
    await finishScenario(page, 's2');
  });

  test('S4 Complaint Resolution: แจ้งปัญหา → ร้านเสนอคืนเงิน → ผู้บริโภคยืนยัน', async ({ page }) => {
    await startDemo(page, 4);
    await playS4(page);
    await finishScenario(page, 's4');
  });

  test('S5 Warning & Training: ออกคำเตือน → รับทราบ → อบรม/สอบ → ส่งหลักฐาน → ปิดรายการ', async ({ page }) => {
    await startDemo(page, 5);
    await playS5(page);
    await finishScenario(page, 's5');
    const m = (await store<{ id: string; riskStatus: string }>(page, 'merchants')).find((x) => x.id === 'M-003')!;
    expect(m.riskStatus).not.toBe('suspended');
  });

  test('S6 Suspension & Appeal: ระงับ → อุทธรณ์ → ยกเลิกการระงับ', async ({ page }) => {
    await startDemo(page, 6);
    await playS6(page, 'overturned');
    await finishScenario(page, 's6');
  });

  test('S7 AI Advertising Checker', async ({ page }) => {
    await startDemo(page, 7);
    await playS7(page);
    await finishScenario(page, 's7');
  });

  test('S8 AI Complaint Assistant: ร่างไม่ส่งอัตโนมัติ และผู้บริโภคเห็นคำตอบที่ร้านส่ง', async ({ page }) => {
    await startDemo(page, 8);
    await playS8(page);
    await finishScenario(page, 's8');
    await expect(page.getByRole('button', { name: 'จบการสาธิต' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เริ่ม Demo ใหม่' })).toBeVisible();
  });
});
