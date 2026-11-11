import type { Page } from '@playwright/test';
import { demoState, expect, expectDemoTitle, expectStep, fresh, next, nextBtn, store, test } from './helpers';
import { connectAndImport, review9aToSubmitStep } from './flows';

/**
 * Demo หลักบนมือถือ (iphone-safari / ipad-safari — WebKit + Touch; รันกับ Chromium ขนาดมือถือได้ด้วย)
 * คลิกจริงตั้งแต่หน้าแรกจนจบ และตรวจทุกหน้าที่ผ่านว่า:
 * ไม่ล้นจอแนวนอน · แถบควบคุมการสาธิตด้านล่างไม่บังปุ่ม/ช่องกรอกของหน้า (หลังเลื่อนสุดหน้า) · ตัวบอกขั้นถูกต้อง
 */
type Shop = { id: string; operatorId: string; shopName: string };
type RegApp = { id: string; merchantId: string; type: string; status: string; autoDecision?: { route: string } };
const OP = 'OP-013';

async function checkLayout(page: Page, where: string) {
  await page.waitForLoadState('networkidle');
  const vw = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth), `${where}: ไม่ล้นจอแนวนอน`).toBeLessThanOrEqual(vw);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  const covered = await page.evaluate(() => {
    const bar = document.querySelector('[data-demo="bar"]');
    if (!bar || bar.getBoundingClientRect().height === 0) return ['(ไม่พบแถบควบคุมด้านล่าง)'];
    const top = bar.getBoundingClientRect().top;
    return [...document.querySelectorAll('main button, main a, main input, main textarea, main select, main [role="radio"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0 && r.bottom > top + 1 && r.top < innerHeight;
      })
      .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30));
  });
  expect(covered, `${where}: องค์ประกอบที่ถูกแถบควบคุมบังหลังเลื่อนสุดหน้า`).toEqual([]);
}

async function counts(page: Page) {
  const shops = (await store<Shop>(page, 'merchants')).filter((m) => m.operatorId === OP);
  const apps = (await store<RegApp>(page, 'applications')).filter((a) => a.type === 'registration' && shops.some((m) => m.id === a.merchantId));
  return { shops: shops.length, apps: apps.length };
}

test('มือถือ: Demo หลักจากหน้าแรกจนจบ — ปุ่มไม่ถูกบัง · ไม่ล้นจอ · ลงทะเบียนครั้งเดียว · ร้านเดียวกันจนจบ', async ({ page }) => {
  test.setTimeout(600_000);
  const m = page.locator('main');
  await fresh(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.getByTestId('home-main-cta').click();
  await expectDemoTitle(page, 's9a');
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/m$/);
  await checkLayout(page, 'ขั้น 1 หน้าหลักผู้ประกอบการ');

  await connectAndImport(page); // ขั้น 2–5 → อยู่ที่ขั้น 6
  const importedName = await m.getByLabel(/ชื่อร้านค้า/).inputValue();
  expect(importedName).toContain('Official');
  await checkLayout(page, 'ขั้น 6 ทบทวนข้อมูลที่นำเข้า');

  await review9aToSubmitStep(page); // ขั้น 6–7 → อยู่ที่ขั้น 8
  await checkLayout(page, 'ขั้น 8 ส่งคำขอ');
  await m.getByRole('checkbox').last().check();
  await m.getByRole('button', { name: 'ส่งคำขอ', exact: true }).click();
  await expect(m.getByTestId('registration-decision')).toContainText('ผ่านการตรวจสอบอัตโนมัติ');
  expect(await counts(page)).toEqual({ shops: 1, apps: 1 });

  await next(page);
  await expectStep(page, 9);
  await expect(page).toHaveURL(/\/m\/shop$/);
  await expect(m.getByTestId('registration-auto-pass')).toBeVisible();
  await checkLayout(page, 'ขั้น 9 ผลตรวจอัตโนมัติ');
  const { current } = await demoState(page);
  const shop = (await store<Shop>(page, 'merchants')).find((x) => x.id === current.merchantId)!;
  expect(shop.shopName).toBe(importedName);
  const app = (await store<RegApp>(page, 'applications')).find((a) => a.id === current.applicationId)!;
  expect([app.status, app.autoDecision?.route]).toEqual(['approved', 'AUTO_PASS']);
  expect((await store<{ merchantId: string }>(page, 'certifications')).some((c) => c.merchantId === shop.id), 'AUTO_PASS ไม่ออกใบรับรองอัตโนมัติ').toBe(false);

  await next(page);
  await expectStep(page, 10);
  await expect(page).toHaveURL(/\/m\/trust$/);
  const badge = (await store<{ merchantId: string; status: string }>(page, 'assessment-badges')).find((x) => x.merchantId === shop.id)!;
  expect(badge).toBeTruthy();
  await expect(m.getByTestId('automation-panel').getByTestId('assessment-badge')).toHaveAttribute('data-status', badge.status);
  await checkLayout(page, 'ขั้น 10 ผลประเมินความน่าเชื่อถือ');

  await next(page, { expectTransition: true });
  await expectStep(page, 11);
  await expect(page).toHaveURL(new RegExp(`/shop/${shop.id}$`));
  await expect(m.getByRole('heading', { name: shop.shopName }).first()).toBeVisible();
  await expect(m.getByTestId('public-badge')).toHaveAttribute('data-status', badge.status);
  await checkLayout(page, 'ขั้น 11 หน้าร้านสำหรับผู้บริโภค');

  await nextBtn(page).click();
  await expect(page).toHaveURL(/\/demo\/complete\/s9a$/);
  await expect(page.getByText('สาธิตครบทุกขั้นแล้ว', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await counts(page)).toEqual({ shops: 1, apps: 1 });
  await page.getByRole('button', { name: 'จบการสาธิต' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  expect((await demoState(page)).activeScenario).toBeFalsy();
});
