import type { Page } from '@playwright/test';
import { confirm, expect, fresh, open, store, test } from './helpers';

async function switchRole(page: Page, label: string) {
  await page.getByRole('button', { name: /Demo Mode|^Demo$/ }).first().click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

test('Role Switcher: สลับบทบาทแล้วเห็นข้อมูลชุดเดียวกัน และ Permission Denied เมื่อบทบาทไม่ตรง', async ({ page }) => {
  await fresh(page);
  await switchRole(page, 'เจ้าหน้าที่');
  await expect(page).toHaveURL(/\/o$/);
  // เจ้าหน้าที่อนุมัติคำขอของ "ครัวแม่มาลี" ผ่าน UI
  await open(page, '/o/applications/APP-2569-0002');
  await page.getByRole('button', { name: 'เริ่มตรวจสอบ' }).click();
  for (const b of await page.getByRole('button', { name: 'ผ่าน', exact: true }).all()) await b.click();
  await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await confirm(page, undefined, 'อนุมัติ');
  const cert = (await store<{ id: string; merchantId: string; status: string }>(page, 'certifications')).find((c) => c.merchantId === 'M-002' && c.status === 'active')!;
  expect(cert).toBeTruthy();
  // ผู้บริโภคเห็นสถานะเดียวกัน
  await switchRole(page, 'ผู้บริโภค');
  await open(page, `/verify/${cert.id}`);
  await expect(page.getByText('ผ่านเกณฑ์ธุรกิจ').first()).toBeVisible();
  // ผู้บริโภคเปิดหน้าเจ้าหน้าที่ → Permission Denied
  await open(page, '/o/applications');
  await expect(page.getByText('ไม่มีสิทธิ์เข้าถึงหน้านี้ (Permission Denied)')).toBeVisible();
  // ผู้ดูแลระบบ: Dashboard คำนวณจาก Mock State (มีใบรับรองเพิ่ม 1 ใบ)
  await switchRole(page, 'ผู้ดูแลระบบ');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(/ข้อมูลสาธิต/).first()).toBeVisible();
  // Reload แล้วข้อมูลยังอยู่
  await page.reload();
  expect((await store<{ id: string }>(page, 'certifications')).some((c) => c.id === cert.id)).toBe(true);
});

test('Reset Demo Data: กลับเป็นข้อมูลตัวอย่างทุก Store และ Reload แล้วยังเป็นข้อมูลเริ่มต้น', async ({ page }) => {
  await fresh(page);
  await switchRole(page, 'เจ้าหน้าที่');
  await open(page, '/o/applications/APP-2569-0002');
  await page.getByRole('button', { name: 'เริ่มตรวจสอบ' }).click();
  expect((await store<{ id: string; status: string }>(page, 'applications')).find((a) => a.id === 'APP-2569-0002')!.status).toBe('under_verification');
  await switchRole(page, 'ผู้ดูแลระบบ');
  await open(page, '/admin/data');
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  await confirm(page, undefined, 'รีเซ็ต');
  // หน้าแรกต้องลงท้ายด้วย "/" เสมอ (Sub-path Reload ได้ไม่เป็น 404)
  await expect(page).toHaveURL(/:\d+\/(sme-trust\/)?$/);
  await page.reload();
  expect((await store<{ id: string; status: string }>(page, 'applications')).find((a) => a.id === 'APP-2569-0002')!.status).toBe('pending_review');
  expect((await store(page, 'merchants')).length).toBe(12);
  expect((await store(page, 'complaints')).length).toBe(20);
});

test('Base path: ลิงก์ภายในทุกหน้าและลิงก์ตรวจสอบ (QR) อยู่ใต้ Base ของแอป', async ({ page, context, baseURL, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const base = new URL(baseURL!).pathname; // "/" หรือ "/sme-trust/"
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('smetrust:v1:session', JSON.stringify({ state: { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: true, consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {} }, version: 1 })));
  for (const path of ['/m', '/m/toolkit', '/verify/SMT-2569-000101', '/shop/M-001', '/demo']) {
    await open(page, path);
    await page.waitForLoadState('networkidle');
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')!));
    expect(hrefs.filter((h) => !h.startsWith(base)), `ลิงก์ที่ไม่อยู่ใต้ ${base} ในหน้า ${path}`).toEqual([]);
  }
  await open(page, '/m/toolkit');
  // ลิงก์เดียวกับที่ปุ่ม Copy ใช้ แสดงใน Toast หลังคัดลอก (อ่านได้ทุกเบราว์เซอร์)
  await page.getByRole('button', { name: 'Copy Verification Link' }).click();
  const link = browserName === 'chromium' ? await page.evaluate(() => navigator.clipboard.readText()) : (await page.getByText(/^https?:\/\/\S+\/verify\//).first().innerText()).trim();
  expect(link).toBe(`${new URL(baseURL!).origin}${base}verify/SMT-2569-000101`);
  await page.goto(link);
  await expect(page.getByText('SMT-2569-000101').first()).toBeVisible();
});
