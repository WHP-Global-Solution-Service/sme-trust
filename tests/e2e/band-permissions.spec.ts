import type { Page } from '@playwright/test';
import { expect, fresh, open, test } from './helpers';

/** หน้าแรก: เกณฑ์ Band A/B/C/D (Responsive) · หน้า Role & Permission Matrix (เฉพาะผู้ดูแลระบบ) */
const section = (page: Page) => page.getByTestId('home-band-criteria');
const setRole = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => {
    const key = 'smetrust:v2:session';
    const cur = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":1}');
    localStorage.setItem(key, JSON.stringify({ ...cur, state: { ...cur.state, ...p } }));
  }, patch);

for (const width of [375, 768, 1440]) {
  test(`หน้าแรก ${width}px: เกณฑ์ Band A/B/C/D อ่านได้ ไม่ล้นจอ และ Band การ์ดเรียงตามขนาดจอ`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fresh(page);
    await section(page).scrollIntoViewIfNeeded();
    await expect(section(page).getByRole('heading', { name: 'เกณฑ์การจัดระดับความน่าเชื่อถือ' })).toBeVisible();
    for (const b of ['A', 'B', 'C', 'D']) await expect(page.getByTestId(`band-card-${b}`)).toBeVisible();
    await expect(page.getByTestId('band-a-cap')).toContainText('ได้สูงสุด Band B');
    await expect(page.getByTestId('band-card-D')).toContainText('ไม่มี Badge แสดงต่อผู้บริโภค');
    await expect(page.getByTestId('home-insufficient')).toContainText('ไม่ได้หมายความว่าร้านค้ามีปัญหา');
    await expect(page.getByTestId('home-identity-rule')).toContainText('ไม่ใช่เงื่อนไขในการคำนวณ Band');
    await expect(page.getByTestId('home-min-data').getByRole('listitem').filter({ hasText: 'ยืนยันตัวตน' })).toHaveCount(0);
    await expect(page.getByTestId('band-prototype-tag')).toContainText('เกณฑ์เริ่มต้นจากระบบต้นแบบ');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // ไม่มีองค์ประกอบใดในส่วนนี้ล้นขอบจอ
    const overflowing = await section(page).evaluate((el, w) => [...el.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > w + 1).length, width);
    expect(overflowing).toBe(0);
    const b = (await page.getByTestId('band-card-B').boundingBox())!;
    const c = (await page.getByTestId('band-card-C').boundingBox())!;
    if (width < 640) expect(c.y).toBeGreaterThan(b.y + b.height - 1); // มือถือ: การ์ดเรียงต่อกันแนวตั้ง
    else expect(Math.abs(c.y - b.y)).toBeLessThan(2); // จอกว้าง: B และ C อยู่แถวเดียวกัน
  });
}

test('Role & Permission Matrix: ผู้ดูแลระบบเปิดได้จากเมนู · ผู้บริโภคและเจ้าหน้าที่ถูกปฏิเสธ', async ({ page }) => {
  await fresh(page);
  await setRole(page, { role: 'admin', officerId: 'AD-001' });
  await open(page, '/admin');
  await page.getByRole('link', { name: 'Role & Permission' }).first().click();
  await expect(page).toHaveURL(/\/admin\/permissions$/);
  await expect(page.getByRole('heading', { name: 'Role & Permission Matrix' })).toBeVisible();
  await expect(page.getByTestId('perm-group-officer')).toContainText('profile_change.review');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  for (const role of [{ role: 'consumer' }, { role: 'officer', officerId: 'OF-001' }]) {
    await setRole(page, role);
    await open(page, '/admin/permissions');
    await expect(page.getByText('ไม่มีสิทธิ์เข้าถึงหน้านี้ (Permission Denied)')).toBeVisible();
  }
});

test('ฟอนต์ไทยโหลดพร้อมหน้าเว็บ (Preload) — ไม่เริ่มโหลดหลังหน้าแสดงแล้วถูกยกเลิกเมื่อเปลี่ยนหน้าเร็ว (KI-V2-36)', async ({ page }) => {
  await open(page, '/');
  const hrefs = await page.locator('link[rel="preload"][as="font"]').evaluateAll((ls) => ls.map((l) => (l as HTMLLinkElement).href));
  expect(hrefs).toHaveLength(8);
  expect(hrefs.every((h) => /noto-sans-thai-(thai|latin)-[4-7]00-normal-.*\.woff2$/.test(h))).toBe(true);
  // ไฟล์ที่ Preload คือไฟล์เดียวกับที่ CSS ใช้ และโหลดสำเร็จทั้งหมด
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Noto Sans Thai' && f.status === 'loaded').length);
  expect(loaded).toBe(8);
  const used = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.woff2$/.test(r.name)).map((r) => r.name));
  expect(new Set(used).size).toBe(8);
});
