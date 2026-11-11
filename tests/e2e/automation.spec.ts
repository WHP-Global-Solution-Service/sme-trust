import type { Page } from '@playwright/test';
import { confirm, DEMO_TITLE, expect, expectDemoTitle, expectStep, finishScenario, fresh, next, open, panel, store, test } from './helpers';

/**
 * Automation First, Human by Exception — ผ่าน UI จริง
 * กรณีข้อมูลร้านค้าไม่ตรงกัน (เปิดจากหน้าแรก) — เส้นทางปกติอยู่ใน Demo หลัก (demo-center.spec) · กรณียกเว้น → Manual Review Queue → เจ้าหน้าที่ตัดสิน
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

test('กรณีข้อมูลร้านค้าไม่ตรงกัน: ข้อมูลตัวตนขัดแย้ง → คิวงานเจ้าหน้าที่ → เจ้าหน้าที่อนุมัติ → ระบบออก Badge ต่อเอง', async ({ page }) => {
  test.setTimeout(300_000);
  await fresh(page);
  // เปิดจากการ์ดกรณีพิเศษบนหน้าแรก (ไม่มีเลข Scenario)
  await main(page).locator(`[data-journey="${DEMO_TITLE.s15}"]`).getByRole('button', { name: 'ทดลองกรณีนี้' }).click();
  await expectDemoTitle(page, 's15');
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
