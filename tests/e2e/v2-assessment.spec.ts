import type { Page } from '@playwright/test';
import { confirm, expect, fresh, open, store, test } from './helpers';

/** v2 — Self-Registration + Marketplace (จำลอง) + Trust Assessment + Officer Review ผ่าน UI จริง */
type Conn = { merchantId: string; platform: string; status: string };
type Assessment = { id: string; merchantId: string; status: string; result: { score: number; band: string }; decision?: { kind: string } };

const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((x) => localStorage.setItem('smetrust:v1:session', JSON.stringify({ state: { consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {}, ...x }, version: 1 })), s);
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
  await dlg.getByLabel(/จำลองการซิงก์ไม่สำเร็จ/).check();
  await dlg.getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(dlg.getByText('ซิงก์ไม่สำเร็จ').first()).toBeVisible();
  await dlg.getByRole('button', { name: 'ลองซิงก์ใหม่' }).click();
  await expect(dlg.getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
  await dlg.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(lazada.getByText('เชื่อมต่อแล้ว (จำลอง)')).toBeVisible();
  await expect(lazada.getByText('คำสั่งซื้อ 12 เดือน')).toBeVisible();
  expect((await store<Conn>(page, 'marketplace-connections')).filter((c) => c.merchantId === 'M-005' && c.status === 'connected').map((c) => c.platform).sort()).toEqual(['lazada', 'shopee']);

  // ผลประเมินเดิมล้าสมัย → ประเมินใหม่ → ไม่มีคะแนนตัวเลขในมุมร้าน
  await main(page).getByRole('link', { name: 'ผลประเมินความน่าเชื่อถือ', exact: true }).click();
  await expect(main(page).getByText('ข้อมูลเปลี่ยนแปลงหลังการประเมิน')).toBeVisible();
  await expect(main(page).getByRole('button', { name: 'ส่งให้เจ้าหน้าที่พิจารณา' })).toBeDisabled();
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

test('Self-Registration: นำเข้าข้อมูลร้านจาก Shopee (จำลอง) → ส่งคำขอ → การเชื่อมต่อผูกกับร้านใหม่ → ประเมินได้', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true });
  await open(page, '/m/register-shop');
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await main(page).getByRole('button', { name: 'นำเข้าจาก Shopee (จำลอง)' }).click();
  await expect(page.getByRole('dialog').getByText(/ยังไม่มีการเชื่อมต่อ API จริง/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'ยินยอมและเชื่อมต่อ (จำลอง)' }).click();
  const shopName = await main(page).getByPlaceholder('ชื่อที่ใช้บนช่องทางขาย').inputValue();
  expect(shopName).toMatch(/^ร้าน/);
  await expect(main(page).getByRole('button', { name: 'นำเข้าจาก Shopee (จำลอง) แล้ว' })).toBeVisible();
  await main(page).getByLabel(/อำเภอ\/เขต/).fill('เมือง');
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  // ช่องทางขาย Marketplace ที่นำเข้า (react-hook-form ไม่ตั้ง attribute value จึงอ่านค่าจาก input โดยตรง)
  expect((await main(page).locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).some((v) => v.includes('(จำลอง)'))).toBe(true);
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await main(page).getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await main(page).getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await main(page).getByRole('checkbox').last().check();
  await main(page).getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();

  const merchants = await store<{ id: string; operatorId: string; shopName: string }>(page, 'merchants');
  const m = merchants.find((x) => x.operatorId === 'OP-012')!;
  expect(m.shopName).toBe(shopName);
  expect((await store<Conn>(page, 'marketplace-connections')).filter((c) => c.merchantId === m.id && c.status === 'connected').map((c) => c.platform)).toEqual(['shopee']);
  await open(page, '/m/trust');
  await main(page).getByRole('button', { name: 'ประเมินความน่าเชื่อถือ' }).click();
  await expect(main(page).getByText('Data Coverage — ความครบถ้วนของข้อมูล')).toBeVisible();
  await expect(main(page).getByText('Shopee (จำลอง)').first()).toBeVisible();
});

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
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v1:assessment-config')!).state.weights);
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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v1:assessment-config')!).state.weights.C1)).toBe(25);
});
