/**
 * ขั้นตอนของแต่ละการสาธิตผ่าน UI จริง (เล่นทีละเรื่อง)
 * ทุก Business Action ทำด้วยการคลิกในหน้าจอ (Demo Controller ใช้เพียงเปลี่ยนขั้น)
 */
import type { Page } from '@playwright/test';
import { confirm, demoState, expect, expectBlocked, expectStep, next, panel, store } from './helpers';

const main = (page: Page) => page.locator('main');
const mainBtn = (page: Page, name: string | RegExp) => main(page).getByRole('button', { name, exact: typeof name === 'string' });

/** กดปุ่มแล้วยืนยัน Confirm Dialog ถ้ามี */
async function clickMaybeConfirm(page: Page, name: string | RegExp, reason?: string) {
  await mainBtn(page, name).click();
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible({ timeout: 800 }).catch(() => false)) await confirm(page, reason);
}

/** เปิดส่วน "เติมข้อมูลตัวอย่างสำหรับสาธิต" ของแบบฟอร์มแจ้งปัญหา แล้วเลือก "กรณีปกติ" */
export async function fillReportSample(page: Page) {
  const normal = mainBtn(page, 'กรณีปกติ');
  if (!(await normal.isVisible())) await main(page).getByText('เติมข้อมูลตัวอย่างสำหรับสาธิต').click();
  await normal.click();
  await expect(main(page).getByText(/ขั้นตอนที่ 6\/7/)).toBeVisible();
}

type Merchant = { id: string; operatorId: string; registrationStatus: string; shopName: string };
type Complaint = { id: string; status: string; messages: { from: string; text: string }[] };

// ------------------------------------------------------------------ S1
export async function playS1(page: Page, who = { phone: '0891112233', first: 'ทดสอบ', last: 'อีทูอี', email: 'e2e@demo.local' }) {
  await expectStep(page, 1);
  await expect(main(page).getByRole('button', { name: 'ลงทะเบียนด้วยตนเอง' })).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/register$/);
  await expectBlocked(page);
  // Validation: เบอร์ผิดรูปแบบ
  await page.getByPlaceholder('08xxxxxxxx').fill('123');
  await mainBtn(page, 'ขอรหัส OTP').click();
  await expect(main(page).getByRole('alert').first()).toBeVisible();
  await page.getByPlaceholder('08xxxxxxxx').fill(who.phone);
  await main(page).getByRole('checkbox').check();
  await mainBtn(page, 'ขอรหัส OTP').click();
  await next(page);
  // OTP ผิด → แจ้ง OTP Invalid
  await page.getByLabel('รหัส OTP 6 หลัก').fill('000000');
  await mainBtn(page, 'ยืนยัน').click();
  const otp = (await main(page).locator('.font-mono.text-2xl').innerText()).trim();
  if (otp !== '000000') await expect(main(page).getByText(/OTP Invalid/)).toBeVisible();
  await page.getByLabel('รหัส OTP 6 หลัก').fill(otp);
  await mainBtn(page, 'ยืนยัน').click();
  await next(page);
  await page.getByLabel('ชื่อ', { exact: false }).first().fill(who.first);
  await page.getByLabel('นามสกุล').fill(who.last);
  await page.getByLabel('อีเมล').fill(who.email);
  await page.getByLabel('จังหวัด').selectOption({ index: 1 });
  await mainBtn(page, 'ถัดไป').click();
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'เริ่มยืนยันตัวตน').click();
  await mainBtn(page, 'จำลองการถ่ายบัตร').click();
  await expect(mainBtn(page, 'จำลองการสแกนใบหน้า')).toBeVisible({ timeout: 8000 });
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'จำลองการสแกนใบหน้า').click();
  await expect(main(page).getByText('Identity Verified').first()).toBeVisible({ timeout: 8000 });
  await mainBtn(page, 'ดำเนินการต่อ').click();
  await next(page);
  await expectBlocked(page);
  const pin = async (digits: string) => {
    for (const d of digits) await main(page).getByRole('button', { name: d, exact: true }).click();
  };
  await pin('111111');
  await expect(main(page).getByText('PIN ง่ายเกินไป')).toBeVisible();
  await pin('258036');
  await pin('258036');
  await expect(main(page).getByRole('heading', { name: 'ลงทะเบียนสำเร็จ' })).toBeVisible();
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'เข้าสู่หน้าหลัก').click();
  await expect(page).toHaveURL(/\/m$/);
  await next(page);
  await expect(main(page).getByText('ยืนยันตัวตนแล้ว (Level 1)').first()).toBeVisible();
  const ops = await store<{ id: string; phone: string; kycStatus: string }>(page, 'operators');
  const op = ops.find((o) => o.phone === who.phone)!;
  expect(op.kycStatus).toBe('verified');
  return op.id;
}

// ------------------------------------------------------------------ S2
export async function playS2(page: Page) {
  await expectStep(page, 1);
  await next(page);
  await expect(page).toHaveURL(/\/m\/register-shop$/);
  await expectBlocked(page);
  await mainBtn(page, 'ถัดไป').click();
  await next(page);
  // ข้อมูลผู้ประกอบการเติมจากบัญชีให้แล้ว → ขั้นข้อมูลร้าน (ว่าง) → กดถัดไปต้องแจ้งข้อผิดพลาด
  await mainBtn(page, 'ถัดไป').click();
  await expect(main(page).getByText('ขั้นตอนที่ 3/7')).toBeVisible();
  await mainBtn(page, 'ถัดไป').click();
  await expect(main(page).getByRole('alert').first()).toBeVisible();
  await expectBlocked(page);
  await mainBtn(page, 'เติมข้อมูลตัวอย่าง').click();
  for (let k = 0; k < 3; k++) await next(page);
  await expectBlocked(page);
  await main(page).getByRole('checkbox').last().check();
  await mainBtn(page, 'ส่งคำขอ').click();
  await expect(main(page).getByText(/APP-\d{4}-\d{4}/).first()).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/m\/shop$/);
  // Automation First: ระบบตรวจคำขออัตโนมัติ — ลงทะเบียนแล้วโดยไม่ต้องรอเจ้าหน้าที่ (ยังไม่ใช่ใบรับรอง)
  await expect(main(page).getByTestId('registration-auto-pass')).toBeVisible();
  await expect(main(page).getByText('Pending Approval')).toHaveCount(0);
  const reg = (await demoState(page)).current;
  const regApp = (await store<{ id: string; status: string; autoDecision?: { route: string } }>(page, 'applications')).find((a) => a.id === reg.applicationId)!;
  expect(regApp.status).toBe('approved');
  expect(regApp.autoDecision?.route).toBe('AUTO_PASS');
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === reg.merchantId)).toBe(false);
  // ยื่นขอใบรับรอง Business Verified (แยกจากการลงทะเบียน — เจ้าหน้าที่พิจารณาตามนโยบาย)
  await next(page);
  await expect(page).toHaveURL(/\/m\/certification$/);
  await expectBlocked(page);
  await mainBtn(page, 'ยื่นขอ Business Verified').click();
  await confirm(page, undefined, 'ยื่นคำขอ');
  await next(page, { expectTransition: true });
  const { current } = await demoState(page);
  expect(current.applicationId).not.toBe(reg.applicationId);
  await expect(page).toHaveURL(new RegExp(`/o/applications/${current.applicationId}$`));
  await expectBlocked(page);
  await mainBtn(page, 'เริ่มตรวจสอบ').click();
  await next(page);
  await expectBlocked(page);
  for (const b of await main(page).getByRole('button', { name: 'ผ่าน', exact: true }).all()) await b.click();
  await mainBtn(page, 'อนุมัติ').click();
  await confirm(page, undefined, 'อนุมัติ');
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/m\/notifications$/);
  await expect(main(page).getByText('ได้รับอนุมัติ').first()).toBeVisible();
  await next(page);
  await expect(main(page).getByText('Business Verified').first()).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/m\/passport$/);
  const m = (await store<Merchant>(page, 'merchants')).find((x) => x.id === current.merchantId)!;
  expect(m.registrationStatus).toBe('approved');
  return m;
}

// ------------------------------------------------------------------ S4
export async function playS4(page: Page) {
  const { current } = await demoState(page);
  await expect(page).toHaveURL(new RegExp(`/shop/${current.merchantId}$`));
  await next(page);
  await expectBlocked(page);
  await fillReportSample(page);
  await next(page);
  await expectBlocked(page);
  const before = (await store<Complaint>(page, 'complaints')).length;
  await mainBtn(page, 'ส่งเรื่อง (Submit)').click();
  await expect(main(page).getByText(/CMP-\d{4}-\d{4}/).first()).toBeVisible();
  expect((await store<Complaint>(page, 'complaints')).length).toBe(before + 1);
  await next(page);
  const cid = (await demoState(page)).current.complaintId as string;
  await expect(page).toHaveURL(new RegExp(`/consumer/cases/${cid}$`));
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/m/complaints/${cid}$`));
  await expectBlocked(page);
  await main(page).locator('select').first().selectOption('refund');
  await page.locator('#reply-note').fill('ร้านขออภัยในความไม่สะดวก ยินดีคืนเงินเต็มจำนวนตามข้อเสนอนี้');
  await clickMaybeConfirm(page, 'ส่งการตอบกลับ');
  await next(page, { expectTransition: true });
  await expect(main(page).getByText('ยินดีคืนเงินเต็มจำนวน').first()).toBeVisible();
  await expectBlocked(page);
  await clickMaybeConfirm(page, 'ยอมรับข้อเสนอ');
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'ได้รับการแก้ไขแล้ว (Consumer Confirm)').click();
  await confirm(page, undefined, 'ยืนยัน');
  await next(page);
  await expect(main(page).getByText('แก้ไขสำเร็จ').first()).toBeVisible();
  const c = (await store<Complaint>(page, 'complaints')).find((x) => x.id === cid)!;
  expect(c.status).toBe('resolved');
  return cid;
}

// ------------------------------------------------------------------ S5
export async function playS5(page: Page) {
  await expect(panel(page).getByText(/กรณีศึกษาแยก/).first()).toBeVisible();
  await next(page);
  await next(page);
  await expect(page).toHaveURL(/\/o\/warnings\/new\?merchant=M-003$/);
  await expectBlocked(page);
  await mainBtn(page, 'เติมตัวอย่าง').click();
  await clickMaybeConfirm(page, 'ออกคำเตือน');
  await next(page, { expectTransition: true });
  const { current } = await demoState(page);
  await expect(page).toHaveURL(new RegExp(`/m/warnings/${current.warningId}$`));
  await expectBlocked(page);
  await mainBtn(page, 'กดรับทราบ').click();
  await confirm(page);
  await next(page);
  await next(page);
  await expect(page).toHaveURL(/\/m\/training\/CRS-02$/);
  await expectBlocked(page);
  await main(page).getByRole('button', { name: /เริ่มเรียน|เรียนต่อ/ }).click();
  for (let k = 0; k < 5; k++) {
    const b = main(page).getByRole('button', { name: /เรียนจบบทนี้|จบบทเรียน/ });
    if (!(await b.isVisible().catch(() => false))) break;
    await b.click();
  }
  await expect(main(page).getByRole('heading', { name: 'แบบทดสอบ' })).toBeVisible();
  await next(page);
  await expectBlocked(page);
  // ตอบผิดก่อน → ไม่ผ่าน แล้วทำใหม่
  const answer = async (picks: number[]) => {
    const qs = main(page).locator('ol > li');
    for (let i = 0; i < picks.length; i++) await qs.nth(i).locator('input[type=radio]').nth(picks[i]).check();
    await mainBtn(page, 'ส่งคำตอบ').click();
  };
  await answer([0, 0, 0, 0]);
  await expect(mainBtn(page, 'ทำแบบทดสอบอีกครั้ง')).toBeVisible();
  await expectBlocked(page);
  await mainBtn(page, 'ทำแบบทดสอบอีกครั้ง').click();
  await answer([2, 1, 1, 1]);
  await expect(mainBtn(page, 'ดูใบรับรองการอบรม').or(mainBtn(page, 'พิมพ์ใบรับรอง')).first()).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(new RegExp(`/m/warnings/${current.warningId}$`));
  await expectBlocked(page);
  await main(page).getByLabel('คำอธิบายการแก้ไข').fill('แก้ไขข้อความโฆษณาทุกช่องทางแล้ว และเข้าอบรมครบ');
  await mainBtn(page, 'ภาพหลังแก้ไข').click();
  await mainBtn(page, 'ส่งกลับให้ตรวจ').click();
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(new RegExp(`/o/warnings/${current.warningId}$`));
  await expectBlocked(page);
  await clickMaybeConfirm(page, 'เริ่มตรวจผล');
  await clickMaybeConfirm(page, 'ตรวจผลผ่าน', 'หลักฐานครบถ้วน');
  const w = (await store<{ id: string; status: string }>(page, 'warnings')).find((x) => x.id === current.warningId)!;
  expect(w.status).toBe('completed');
}

// ------------------------------------------------------------------ S6
export async function playS6(page: Page, decision: 'upheld' | 'overturned' = 'upheld') {
  await expect(page).toHaveURL(/\/o\/risk\/RSK-2569-0001$/);
  await next(page);
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'ระงับการรับรอง').click();
  await confirm(page, 'ข้อร้องเรียนไม่ได้รับสินค้าหลายเรื่องพร้อมหลักฐาน', 'ระงับการรับรองชั่วคราว');
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/m\/review$/);
  await expect(main(page).getByText('ยื่นอุทธรณ์').first()).toBeVisible();
  await next(page);
  await expectBlocked(page);
  await main(page).locator('textarea').first().fill('ร้านได้จัดส่งสินค้าครบทุกคำสั่งซื้อ มีหลักฐานเลขพัสดุ ขอให้ทบทวน');
  await mainBtn(page, 'ยื่นอุทธรณ์').click();
  await confirm(page);
  await next(page, { expectTransition: true });
  await expectBlocked(page);
  await mainBtn(page, decision === 'upheld' ? 'ยกอุทธรณ์ (คงผล)' : 'รับอุทธรณ์ (คืนสถานะ)').click();
  await confirm(page, 'พิจารณาหลักฐานทั้งหมดแล้ว');
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/verify\/SMT-/);
  await expect(main(page).getByText(decision === 'upheld' ? 'ถูกระงับการรับรอง' : 'ผ่านเกณฑ์ธุรกิจ').first()).toBeVisible({ timeout: 5000 });
}

// ------------------------------------------------------------------ S7
export async function playS7(page: Page) {
  await expect(main(page).getByText('AI ผู้ช่วย SME').first()).toBeVisible();
  await next(page);
  await next(page);
  await expect(page).toHaveURL(/\/m\/ai\/ad-checker$/);
  await expect(main(page).getByText('AI Simulation — ไม่ใช่ AI Model จริง').first()).toBeVisible();
  await expectBlocked(page);
  await mainBtn(page, /อาหารเสริม/).first().click();
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'วิเคราะห์ข้อความโฆษณา').click();
  await expect(main(page).getByText('ระดับความเสี่ยงเบื้องต้น (Overall Risk)')).toBeVisible();
  await expect(main(page).getByText(/^High —/).first()).toBeVisible();
  expect(await main(page).locator('mark').count()).toBeGreaterThan(0);
  await next(page);
  await next(page);
  await next(page);
  const rev = page.getByLabel('แก้ไขข้อความฉบับเสนอแก้ไข');
  const text = await rev.inputValue();
  expect(text).not.toMatch(/รักษาได้ทุกโรค/);
  await rev.fill(`${text} สอบถามรายละเอียดเพิ่มเติมทางแชต`);
  await next(page);
  await expectBlocked(page);
  await mainBtn(page, 'วิเคราะห์ใหม่เพื่อเปรียบเทียบ').click();
  await expect(main(page).getByText('เปรียบเทียบก่อน–หลังปรับข้อความ')).toBeVisible();
  await next(page);
}

// ------------------------------------------------------------------ S8
export async function playS8(page: Page) {
  await next(page);
  await expect(page).toHaveURL(/\/m\/complaints\/CMP-2569-0005$/);
  await expect(main(page).getByRole('link', { name: /ให้ AI ช่วยวิเคราะห์/ }).or(mainBtn(page, /ให้ AI ช่วยวิเคราะห์/)).first()).toBeVisible();
  await next(page);
  await expect(main(page).getByText('ร่างคำตอบถึงลูกค้า (Response Draft)')).toBeVisible();
  await expect(main(page).getByText('สินค้าไม่ตรงรายละเอียด').first()).toBeVisible();
  await next(page);
  await next(page);
  await next(page);
  await main(page).getByRole('radio', { name: /เป็นมิตร/ }).click();
  await expect(main(page).getByRole('radio', { name: /เป็นมิตร/ })).toHaveAttribute('aria-checked', 'true');
  await next(page);
  await next(page);
  await expectBlocked(page);
  const msgsBefore = (await store<Complaint>(page, 'complaints')).find((c) => c.id === 'CMP-2569-0005')!.messages.length;
  await mainBtn(page, 'นำร่างไปใส่ช่องตอบกลับเคส').click();
  await expect(page).toHaveURL(/\/m\/complaints\/CMP-2569-0005$/);
  await expect(main(page).getByText(/ยังไม่ได้ส่งถึงลูกค้า/).first()).toBeVisible();
  const draft = await page.locator('#reply-note').inputValue();
  expect(draft.length).toBeGreaterThan(50);
  await next(page);
  await expectBlocked(page);
  expect((await store<Complaint>(page, 'complaints')).find((c) => c.id === 'CMP-2569-0005')!.messages.length).toBe(msgsBefore);
  await clickMaybeConfirm(page, 'ส่งการตอบกลับ');
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/consumer\/cases\/CMP-2569-0005$/);
  await expect(main(page).getByText(draft.split('\n').find((l) => l.length > 20)!.slice(0, 25)).first()).toBeVisible();
  await next(page);
}

// ---------------- Demo หลัก (ใช้ร่วมกันระหว่างเดสก์ท็อปและมือถือ) ----------------

/** ขั้น 1–5: เลือก Shopee → ร้าน "Official" (ตามคำแนะนำ) → ยืนยันนำเข้า → อยู่ที่ขั้น 6 (ทบทวนข้อมูลที่นำเข้า) — เริ่มที่ขั้น 1 แล้ว */
export async function connectAndImport(page: Page) {
  const m = page.locator('main');
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
  await expectStep(page, 6);
}

/** ขั้น 6–7: แก้รายละเอียดสินค้า (คงชื่อร้าน) → กรอกข้อมูลที่ขาด แนบเอกสาร → ถึงขั้นตรวจสอบข้อมูล → อยู่ที่ขั้น 8 (ส่งคำขอ) */
export async function review9aToSubmitStep(page: Page) {
  const m = page.locator('main');
  const desc = m.getByLabel(/รายละเอียดสินค้าและบริการ/);
  await desc.fill(`${await desc.inputValue()} รับประกันสินค้า 30 วัน`);
  await next(page);
  await m.getByRole('button', { name: 'ใช้ข้อมูลติดต่อจากบัญชี' }).click();
  await m.getByLabel(/อำเภอ\/เขต/).fill('เมืองขอนแก่น');
  for (let i = 0; i < 2; i++) await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await m.getByRole('button', { name: /ทะเบียนพาณิชย์/ }).first().click();
  await m.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await next(page);
  await expectStep(page, 8);
}
