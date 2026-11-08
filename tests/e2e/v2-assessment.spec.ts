import type { Page } from '@playwright/test';
import { confirm, expect, fresh, open, store, test } from './helpers';

/** v2 — Self-Registration + Marketplace (จำลอง) + Trust Assessment + Officer Review ผ่าน UI จริง */
type Conn = { merchantId: string; platform: string; status: string };
type Assessment = { id: string; merchantId: string; status: string; result: { score: number; band: string }; decision?: { kind: string } };

const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((x) => localStorage.setItem('smetrust:v2:session', JSON.stringify({ state: { consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {}, ...x }, version: 1 })), s);
const main = (page: Page) => page.locator('main');

test('ร้านเชื่อมต่อ Lazada (จำลอง) → ประเมิน → ส่งพิจารณา → เจ้าหน้าที่ตัดสิน → ผู้บริโภคเห็น Band โดยไม่มีคะแนน', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/marketplace');
  await expect(main(page).getByText('ยังไม่มีการเชื่อมต่อ API จริง').first()).toBeVisible();
  await expect(main(page).getByText('Shopee (จำลอง)').first()).toBeVisible();

  // เชื่อมต่อ Lazada (จำลอง): ความยินยอม → เลือกร้าน → Preview → ยืนยันนำเข้า (จำลองซิงก์ล้มเหลว) → ลองใหม่สำเร็จ
  const lazada = main(page).locator('[data-platform="lazada"]');
  await lazada.getByRole('button', { name: 'เชื่อมต่อ Lazada (จำลอง)' }).click();
  const dlg = main(page).getByRole('region', { name: 'เชื่อมต่อ Lazada (จำลอง)' }); // แสดงในหน้า ไม่บังตัวควบคุมการสาธิต
  await expect(dlg.getByText('รายการสินค้าและราคา (ย้อนหลัง 6 เดือน)')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'ถัดไป' })).toBeDisabled(); // ต้องให้ความยินยอมก่อน
  await dlg.getByLabel(/ข้าพเจ้ายินยอม/).check();
  await dlg.getByRole('button', { name: 'ถัดไป' }).click();
  await expect(dlg.getByRole('radio', { name: /ร้านที่ขายมานาน ผลงานดี/ })).toHaveAttribute('aria-checked', 'true');
  await dlg.getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await expect(dlg.getByText('คะแนนร้าน')).toBeVisible();
  expect((await store<Conn>(page, 'marketplace-connections')).find((c) => c.merchantId === 'M-005' && c.platform === 'lazada')!.status).toBe('pending_consent'); // Preview ยังไม่ดึงข้อมูล
  await dlg.getByLabel('จำลอง: นำเข้าข้อมูลไม่สำเร็จ').check();
  await dlg.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(dlg.getByText('นำเข้าข้อมูลไม่สำเร็จ (Import Failed)')).toBeVisible();
  await dlg.getByRole('button', { name: 'ลองซิงก์ใหม่' }).click();
  await expect(dlg.getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
  await dlg.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(lazada.getByText('เชื่อมต่อแล้ว (จำลอง)')).toBeVisible();
  await expect(lazada.getByText('คำสั่งซื้อ 12 เดือน')).toBeVisible();
  expect((await store<Conn>(page, 'marketplace-connections')).filter((c) => c.merchantId === 'M-005' && c.status === 'connected').map((c) => c.platform).sort()).toEqual(['lazada', 'shopee']);

  // Automation First: ซิงก์สำเร็จ → ระบบประเมินใหม่ด้วยข้อมูลทั้งสองแพลตฟอร์มเอง (ไม่ค้างเป็น "ผลล้าสมัย") → ไม่มีคะแนนตัวเลขในมุมร้าน
  const auto = (await store<Assessment & { origin?: string; result: { dataSources: string[] } }>(page, 'trust-assessments')).filter((a) => a.merchantId === 'M-005');
  expect(auto.some((a) => a.origin === 'automation' && [...a.result.dataSources].sort().join() === 'lazada,shopee')).toBe(true);
  await main(page).getByRole('link', { name: 'ผลประเมินความน่าเชื่อถือ', exact: true }).click();
  await expect(main(page).getByTestId('automation-panel')).toBeVisible();
  await expect(main(page).getByText('ข้อมูลเปลี่ยนแปลงหลังการประเมิน')).toHaveCount(0);
  await main(page).getByRole('button', { name: 'ประเมินใหม่' }).first().click();
  await expect(main(page).getByText('ข้อมูลเปลี่ยนแปลงหลังการประเมิน')).toHaveCount(0);
  await expect(main(page).getByText('Data Coverage — ความครบถ้วนของข้อมูล')).toBeVisible();
  const mine = (await store<Assessment>(page, 'trust-assessments')).find((a) => a.merchantId === 'M-005' && a.status === 'draft')!;
  await expect(main(page)).not.toContainText(mine.result.score.toFixed(1));
  await main(page).getByRole('button', { name: 'ส่งให้เจ้าหน้าที่พิจารณา' }).click();
  await expect(main(page).getByText('ส่งให้เจ้าหน้าที่พิจารณาแล้วเมื่อ')).toBeVisible();

  // เจ้าหน้าที่: เห็นคะแนนและวิธีคำนวณ · เกณฑ์ v1 ของ Level 4 ครบ → อนุมัติยกระดับผ่าน Workflow v1
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, '/o/assessments');
  await main(page).getByText(mine.id).first().click();
  await expect(page).toHaveURL(new RegExp(`/o/assessments/${mine.id}$`));
  await expect(main(page).getByText(mine.result.score.toFixed(1)).first()).toBeVisible();
  await expect(main(page).getByText('วิธีคำนวณ')).toBeVisible();
  await main(page).getByRole('radio', { name: 'อนุมัติยกระดับ' }).click();
  await main(page).locator('select').last().selectOption('4');
  const certsBefore = (await store<{ merchantId: string; level: number; status: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005' && c.level === 4);
  expect(certsBefore).toHaveLength(0); // ระบบไม่ออก Badge เองระหว่างประเมิน/ส่งพิจารณา
  await main(page).getByRole('button', { name: 'บันทึกผลการพิจารณา' }).click();
  await expect(page.getByText(/กรุณาระบุเหตุผล/).first()).toBeVisible(); // ต้องมีเหตุผล
  await main(page).getByPlaceholder('อธิบายเหตุผลของการพิจารณา').fill('ผลประเมินดีมาก ข้อมูลครบสองแพลตฟอร์ม และผ่านเกณฑ์ v1 ของ Level 4');
  await main(page).getByRole('button', { name: 'บันทึกผลการพิจารณา' }).click();
  await expect(main(page).getByText('อนุมัติยกระดับ Level 4')).toBeVisible();
  await expect(main(page).getByText('ตัดสินต่างจากข้อเสนอของระบบ')).toHaveCount(0);
  const l4 = (await store<{ id: string; merchantId: string; level: number; status: string }>(page, 'certifications')).filter((c) => c.merchantId === 'M-005' && c.status === 'active');
  expect(l4.map((c) => c.level)).toEqual([4]);
  expect((await store<Assessment>(page, 'trust-assessments')).find((a) => a.id === mine.id)!.decision!.kind).toBe('approved');

  // ร้านเห็นผลการพิจารณา · ผู้บริโภคเห็น Band/Coverage/Confidence แต่ไม่เห็นคะแนน
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/trust');
  await expect(main(page).getByText('ผ่านเกณฑ์ v1 ของ Level 4').first()).toBeVisible();
  await session(page, { role: 'consumer', consumerId: 'CS-001' });
  await open(page, '/shop/M-005');
  await expect(main(page).getByText('Data Confidence — ความน่าเชื่อถือของข้อมูล')).toBeVisible();
  await expect(main(page).getByText(/Band [A-D] —/).first()).toBeVisible();
  await expect(main(page)).not.toContainText(mine.result.score.toFixed(1));
});

// Self-Registration ด้วยข้อมูลจาก Marketplace: ย้ายไปทดสอบเส้นทางใหม่ (เลือก Marketplace → อนุญาต → เลือกร้าน → Preview → Auto-Fill) ใน v2-autofill.spec.ts

test('ผู้ดูแลระบบปรับน้ำหนักโมเดล: ผลรวมต้อง 100 · บันทึก · คืนค่าเริ่มต้น', async ({ page }) => {
  await fresh(page);
  await session(page, { role: 'admin', officerId: 'AD-001' });
  await open(page, '/admin/assessment-model');
  await expect(main(page).getByText('ผลรวม 100% — ถูกต้อง')).toBeVisible();
  await main(page).getByLabel('น้ำหนัก C1').fill('40');
  await expect(main(page).getByText(/ผลรวม 115%/)).toBeVisible();
  await expect(main(page).getByRole('button', { name: 'บันทึกน้ำหนัก' })).toBeDisabled();
  await main(page).getByLabel('น้ำหนัก C2').fill('10');
  await main(page).getByRole('button', { name: 'บันทึกน้ำหนัก' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:assessment-config')!).state.weights);
  expect(saved).toMatchObject({ C1: 40, C2: 10 });
  await main(page).getByRole('button', { name: /คืนค่าเริ่มต้น/ }).click();
  await expect(main(page).getByLabel('น้ำหนัก C1')).toHaveValue('25');
  // Reset Demo Data คืนน้ำหนักเริ่มต้นด้วย
  await main(page).getByLabel('น้ำหนัก C1').fill('40');
  await main(page).getByLabel('น้ำหนัก C2').fill('10');
  await main(page).getByRole('button', { name: 'บันทึกน้ำหนัก' }).click();
  await open(page, '/admin/data');
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  await confirm(page, undefined, 'รีเซ็ต');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:assessment-config')!).state.weights.C1)).toBe(25);
});
