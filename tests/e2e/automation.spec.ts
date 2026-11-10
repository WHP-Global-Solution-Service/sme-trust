import type { Page } from '@playwright/test';
import { confirm, expect, expectStep, finishScenario, fresh, next, open, panel, store, test } from './helpers';

/**
 * Automation First, Human by Exception — ผ่าน UI จริง
 * Scenario 14: เส้นทางปกติจบได้โดยไม่มีขั้นตอนเจ้าหน้าที่ · Scenario 15: กรณียกเว้น → Manual Review Queue → เจ้าหน้าที่ตัดสิน
 * และ Request More Information → ร้านตอบ → Reject · Refresh ไม่สร้างงานซ้ำ · ใบรับรองไม่เปลี่ยน
 */
const main = (page: Page) => page.locator('main');
const wiz = (page: Page) => main(page).getByRole('region', { name: /^เชื่อมต่อ (Shopee|Lazada) \(จำลอง\)$/ });
const session = (page: Page, s: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...patch } }));
  }, s);
type Task = { id: string; merchantId: string; status: string; category: string; connectionId?: string };
type Badge = { merchantId: string; status: string; route: string; band: string };
type Cert = { merchantId: string; status: string; level: number };

async function connectVia(page: Page, platform: 'shopee' | 'lazada', profile: string) {
  const label = platform === 'shopee' ? 'Shopee' : 'Lazada';
  await main(page).locator(`[data-platform="${platform}"]`).getByRole('button', { name: `เชื่อมต่อ ${label} (จำลอง)` }).click();
  await wiz(page).getByLabel(/ข้าพเจ้ายินยอม/).check();
  await wiz(page).getByRole('button', { name: 'ถัดไป' }).click();
  await wiz(page).getByRole('radio', { name: new RegExp(profile) }).click();
  await wiz(page).getByRole('button', { name: 'ดูตัวอย่างข้อมูล' }).click();
  await wiz(page).getByRole('button', { name: 'ยืนยันนำเข้าข้อมูล' }).click();
  await expect(wiz(page).getByText('เชื่อมต่อสำเร็จ (Connection Success)')).toBeVisible();
}

const sessionRole = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('smetrust:v2:session') ?? '{"state":{}}').state.role as string);

/**
 * เล่น Scenario 14 ครบทุกขั้นหลังเริ่มแล้ว (ใช้ทั้งจากหน้าแรกและจาก CTA หลักของหน้า Demo)
 * roleChecks: ตรวจบทบาททุกช่วง · ย้อนกลับข้ามบทบาท (ผู้บริโภค → ร้านค้า) · Refresh ที่ขั้นผู้บริโภค
 */
async function playS14(page: Page, roleChecks = false) {
  // เริ่ม Scenario = Reset + บันทึก State ลง localStorage แล้ว — ใช้เป็นจุดเทียบใบรับรอง
  const certsBefore = JSON.stringify((await store<Cert>(page, 'certifications')).filter((c) => c.merchantId === 'M-005'));
  expect(certsBefore).not.toBe('[]');
  await expect(page).toHaveURL(/\/m\/marketplace-app$/);
  await expect(main(page).getByTestId('marketplace-app')).toContainText('Seller Center (จำลอง)');
  await main(page).getByRole('button', { name: 'เชื่อมกับ SME Trust' }).click();
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  await next(page);
  await connectVia(page, 'shopee', 'ร้านที่ขายมานาน ผลงานดี');
  await next(page);
  await next(page);
  // Auto-Fill: ยืนยันโดยไม่เปลี่ยนชื่อร้าน/หมวด
  await expect(page).toHaveURL(/\/m\/marketplace\/profile\/MKC-[\d-]+$/);
  await main(page).getByLabel(/ข้าพเจ้าตรวจสอบข้อมูลแล้ว/).check();
  await main(page).getByRole('button', { name: 'ยืนยันการอัปเดตข้อมูลร้าน' }).click();
  await expect(main(page).getByRole('status').filter({ hasText: 'อัปเดตข้อมูลร้านแล้ว' })).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expect(main(page).getByTestId('automation-panel')).toContainText('AUTO_PASS');
  await expect(main(page).getByTestId('automation-panel').getByTestId('assessment-badge')).toHaveAttribute('data-status', 'active');
  await next(page);
  if (roleChecks) {
    await expectStep(page, 6);
    expect(await sessionRole(page)).toBe('merchant');
  }
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/shop\/M-005$/);
  await expect(main(page).getByTestId('public-badge')).toHaveAttribute('data-status', 'active');
  await expect(main(page).getByTestId('public-badge')).toContainText('ไม่ใช่การรับรอง');
  await expect(main(page)).not.toContainText('AUTO_PASS');
  if (roleChecks) {
    await expectStep(page, 7);
    expect(await sessionRole(page)).toBe('consumer');
    // ย้อนกลับข้ามบทบาท → ยืนยัน Role Transition → ร้านค้า ขั้น 6 (Badge ยังเป็น active ไม่ประเมินซ้ำ)
    await panel(page).locator('[data-demo="back"]').click();
    await page.getByRole('dialog').getByRole('button', { name: /ดำเนินการต่อในมุม/ }).click();
    await expectStep(page, 6);
    await expect(page).toHaveURL(/\/m\/trust$/);
    expect(await sessionRole(page)).toBe('merchant');
    await expect(main(page).getByTestId('automation-panel').getByTestId('assessment-badge')).toHaveAttribute('data-status', 'active');
    await next(page, { expectTransition: true });
    await expectStep(page, 7);
    // Refresh ที่ขั้นผู้บริโภค → ขั้นเดิม บทบาทเดิม Badge เดิม
    await page.reload();
    await expectStep(page, 7);
    await expect(page).toHaveURL(/\/shop\/M-005$/);
    expect(await sessionRole(page)).toBe('consumer');
    await expect(main(page).getByTestId('public-badge')).toHaveAttribute('data-status', 'active');
  }
  await finishScenario(page, 's14');
  await expect(page.getByText('ระบบออก Assessment Badge อัตโนมัติ — ไม่ต้องใช้เจ้าหน้าที่')).toBeVisible();
  expect((await store<Task>(page, 'officer-tasks')).filter((t) => t.merchantId === 'M-005')).toHaveLength(0);
  expect(JSON.stringify((await store<Cert>(page, 'certifications')).filter((c) => c.merchantId === 'M-005'))).toBe(certsBefore);
}

test('Scenario 14: Marketplace App → SME Trust → Auto-Fill → ประเมินอัตโนมัติ → Badge → ผู้บริโภค โดยไม่มีขั้นตอนเจ้าหน้าที่', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await main(page).getByRole('button', { name: 'เริ่ม Scenario 14' }).click();
  await expect(panel(page).getByText('Scenario 14:')).toBeVisible();
  await playS14(page);
});

test('หน้า Demo: ผลลัพธ์ Assessment Badge → "ดูทีละขั้น (Scenario 14)" ครบทุกขั้น · บทบาท · ย้อนกลับข้ามบทบาท · Refresh', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await open(page, '/demo');
  await page.getByTestId('results-section').locator(':scope > summary').click();
  await page.getByTestId('results-section').getByRole('button', { name: 'ดูทีละขั้น (Scenario 14)' }).click();
  await expect(panel(page).getByText('Scenario 14:')).toBeVisible();
  await expectStep(page, 1);
  expect(await sessionRole(page)).toBe('merchant');
  await playS14(page, true);
});

test('Scenario 15: ข้อมูลตัวตนขัดแย้ง → Manual Review Queue → เจ้าหน้าที่อนุมัติ → ระบบออก Badge ต่อเอง', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await main(page).getByRole('button', { name: 'เริ่ม Scenario 15' }).click();
  await expect(panel(page).getByText('Scenario 15:')).toBeVisible();
  await expect(page).toHaveURL(/\/m\/marketplace$/);
  await connectVia(page, 'lazada', 'บัญชีร้านเป็นชื่อบุคคลอื่น');
  await next(page);
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expect(main(page).getByTestId('automation-panel')).toContainText('MANUAL_REVIEW');
  await expect(main(page).getByTestId('automation-panel')).toContainText('ไม่ได้หมายความว่าร้านกระทำผิด');
  await page.reload();
  await expect(main(page).getByTestId('automation-panel')).toContainText('MANUAL_REVIEW');
  const tasks = (await store<Task>(page, 'officer-tasks')).filter((t) => t.merchantId === 'M-005');
  expect(tasks).toHaveLength(1);
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/o\/exceptions\?tab=identity$/);
  await expect(main(page).getByTestId('exception-list')).toContainText(tasks[0].id);
  await expect(main(page).getByTestId('exception-list')).toContainText('เหตุผลที่ส่งตรวจ');
  await next(page);
  await expect(page).toHaveURL(new RegExp(`/o/exceptions/${tasks[0].id}$`));
  await expect(main(page).getByTestId('evidence')).toContainText('เจ้าของบัญชี');
  await main(page).getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await confirm(page, 'ตรวจหลักฐานความเป็นเจ้าของแล้ว เป็นร้านเดียวกัน');
  await expect(main(page).getByText('อนุมัติ — ', { exact: false }).first()).toBeVisible();
  await next(page, { expectTransition: true });
  await expect(page).toHaveURL(/\/m\/trust$/);
  await expect(main(page).getByTestId('automation-panel').getByTestId('assessment-badge')).toHaveAttribute('data-status', 'active');
  await next(page, { expectTransition: true });
  await expect(main(page).getByTestId('public-badge')).toHaveAttribute('data-status', 'active');
  await finishScenario(page, 's15');
  await expect(page.getByText('เจ้าหน้าที่ยืนยันข้อมูลตัวตน — ระบบประเมินและออก Badge ต่อเอง')).toBeVisible();
  expect((await store<Task>(page, 'officer-tasks')).filter((t) => t.merchantId === 'M-005')).toHaveLength(1);
});

test('กรณียกเว้น: ขอข้อมูลเพิ่ม → ร้านตอบในงานเดิม → ไม่อนุมัติ · Refresh ไม่สร้างงานซ้ำ · ใบรับรองไม่เปลี่ยน', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/marketplace');
  // M-005 มี Shopee (จำลอง) อยู่แล้ว — เพิ่ม Lazada ที่ชื่อเจ้าของบัญชีไม่ตรง
  await connectVia(page, 'lazada', 'บัญชีร้านเป็นชื่อบุคคลอื่น');
  await page.reload();
  await page.reload();
  const tasks = (await store<Task>(page, 'officer-tasks')).filter((t) => t.merchantId === 'M-005');
  expect(tasks).toHaveLength(1);
  const id = tasks[0].id;
  // ผู้บริโภค: ไม่แสดง Band/Badge ระหว่างตรวจ
  await session(page, { role: 'consumer' });
  await open(page, '/shop/M-005');
  await expect(main(page).getByTestId('public-badge')).toHaveAttribute('data-status', 'under_review');
  await expect(main(page)).not.toContainText(id);
  // เจ้าหน้าที่ขอข้อมูลเพิ่ม
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/exceptions/${id}`);
  await main(page).getByRole('button', { name: 'ขอข้อมูลเพิ่มเติม' }).click();
  await confirm(page, 'กรุณาส่งหลักฐานความเป็นเจ้าของบัญชี Lazada');
  await expect(main(page).getByText('รอร้านค้าส่งข้อมูลเพิ่มเติม')).toBeVisible();
  // ร้านตอบในงานเดิม
  await session(page, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
  await open(page, '/m/trust');
  await expect(main(page).getByTestId('info-request')).toContainText('กรุณาส่งหลักฐานความเป็นเจ้าของบัญชี Lazada');
  await main(page).getByTestId('info-request').locator('textarea').fill('บัญชีเป็นของคู่สมรส แนบหนังสือยินยอม (จำลอง)');
  await main(page).getByRole('button', { name: 'ส่งข้อมูลให้เจ้าหน้าที่' }).click();
  await expect(main(page).getByTestId('info-request')).toHaveCount(0);
  expect((await store<Task>(page, 'officer-tasks')).filter((t) => t.merchantId === 'M-005').map((t) => t.status)).toEqual(['open']);
  // เจ้าหน้าที่ไม่อนุมัติ → ไม่ใช้ข้อมูล Lazada · Shopee เดิมยังใช้ประเมินได้ → Badge กลับมาแสดง
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, `/o/exceptions/${id}`);
  await expect(main(page).getByText('ร้านค้าส่งข้อมูลเพิ่มเติมแล้ว')).toBeVisible();
  await main(page).getByRole('button', { name: 'ไม่อนุมัติ', exact: true }).click();
  await confirm(page, 'หลักฐานไม่เพียงพอว่าเป็นร้านของผู้ประกอบการ');
  const t = (await store<Task>(page, 'officer-tasks')).find((x) => x.id === id)!;
  expect(t.status).toBe('rejected');
  const conn = (await store<{ id: string; identityReview?: { status: string } }>(page, 'marketplace-connections')).find((c) => c.id === t.connectionId)!;
  expect(conn.identityReview?.status).toBe('rejected');
  const badge = (await store<Badge>(page, 'assessment-badges')).find((b) => b.merchantId === 'M-005')!;
  expect(badge.status).toBe('active');
  await page.reload();
  expect((await store<Task>(page, 'officer-tasks')).filter((x) => x.merchantId === 'M-005')).toHaveLength(1);
  // ใบรับรองไม่ถูกแตะ — ยังไม่ถูกเขียนลง localStorage เลย (ไม่มีการเปลี่ยนแปลง) หรือยังเป็น Level 3 ใช้งานได้
  const certs = (await store<Cert>(page, 'certifications')).filter((c) => c.merchantId === 'M-005');
  expect(certs.length === 0 || certs.some((c) => c.level === 3 && c.status === 'active')).toBe(true);
  const audit = (await store<{ target: string; action: string }>(page, 'audit')).filter((a) => a.target === id).map((a) => a.action);
  expect(audit).toEqual(expect.arrayContaining(['ระบบส่งกรณียกเว้นให้เจ้าหน้าที่ตรวจสอบ', 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติมจากร้านค้า', 'ร้านค้าส่งข้อมูลเพิ่มเติมสำหรับกรณียกเว้น', 'เจ้าหน้าที่ไม่อนุมัติกรณียกเว้น']));
});

test('Officer Dashboard เน้น Exception Queue + KPI จาก Mock State · Run Simulation ไม่สร้างงานซ้ำ', async ({ page }) => {
  await fresh(page);
  await session(page, { role: 'officer', officerId: 'OF-001' });
  await open(page, '/o');
  await expect(main(page).getByTestId('automation-kpis')).toContainText('ไม่ใช่ผลการลดภาระงานที่วัดจากการใช้งานจริง');
  for (const t of ['Pending Manual Review', 'High Priority Cases', 'Identity Mismatch', 'Evidence Conflicts', 'Certification Requests', 'Escalated Complaints', 'Completed Reviews']) await expect(main(page).getByText(t, { exact: true }).first()).toBeVisible();
  await open(page, '/o/automation');
  await expect(main(page).getByTestId('cert-policy')).toContainText('เจ้าหน้าที่อนุมัติ');
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await confirm(page);
  await expect(page.getByText(/ประมวลผล \d+ ร้านแล้ว/)).toBeVisible();
  expect(await store<Task>(page, 'officer-tasks')).toHaveLength(0);
});
