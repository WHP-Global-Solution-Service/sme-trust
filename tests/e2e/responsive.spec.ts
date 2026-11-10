import { expect, fresh, open, openAllScenarios, test } from './helpers';

/** Mobile 375 / Tablet 768 / Desktop 1440 — ไม่มี Horizontal overflow และแถบควบคุมการสาธิตไม่บังปุ่มของหน้า */
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];
const PAGES: [string, Record<string, unknown>][] = [
  ['/', {}],
  ['/demo', {}],
  ['/demo/overview', {}],
  ['/check?q=บ้านผ้าคราม', { role: 'consumer' }],
  ['/shop/M-001', { role: 'consumer' }],
  ['/report?merchant=M-001', { role: 'consumer' }],
  ['/m', { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/register-shop', { role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true }],
  ['/m/ai', { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/ai/ad-checker', { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/ai/complaint?case=CMP-2569-0005', { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/complaints/CMP-2569-0005', { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/o', { role: 'officer', officerId: 'OF-001' }],
  ['/o/applications/APP-2569-0002', { role: 'officer', officerId: 'OF-001' }],
  ['/o/risk/RSK-2569-0001', { role: 'officer', officerId: 'OF-001' }],
  ['/admin', { role: 'admin', officerId: 'AD-001' }],
];

for (const vp of VIEWPORTS) {
  test(`${vp.name} ${vp.width}px: ไม่มี Horizontal overflow ใน ${PAGES.length} หน้าหลัก`, async ({ page, browserName }) => {
    await page.setViewportSize(vp);
    await fresh(page);
    const over: string[] = [];
    for (const [path, session] of PAGES) {
      await page.evaluate((s) => localStorage.setItem('smetrust:v2:session', JSON.stringify({ state: { role: 'consumer', consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {}, ...s }, version: 1 })), session);
      await open(page, path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > vp.width) over.push(`${path} (${w}px)`);
      // ภาพสำหรับตรวจด้วยตา (Chromium) — WebKit headless รอโหลดฟอนต์นานผิดปกติขณะจับภาพ
      if (browserName === 'chromium') await page.screenshot({ path: `test-results/responsive/${vp.name}${path.replace(/[/?=&]+/g, '_')}.png`, fullPage: true });
    }
    expect(over, 'หน้าที่ล้นแนวนอน').toEqual([]);
  });

  test(`${vp.name} ${vp.width}px: Demo Controller ไม่บังปุ่มของหน้า และ Modal อยู่ในจอ`, async ({ page }) => {
    await page.setViewportSize(vp);
    await fresh(page);
    await open(page, '/demo');
    await openAllScenarios(page);
    await page.getByRole('button', { name: 'Start Demo' }).nth(7).click();
    await page.locator('[data-demo="next"]:visible').first().click();
    await expect(page).toHaveURL(/\/m\/complaints\/CMP-2569-0005$/);
    // หน้าแยกไฟล์ (lazy) — รอให้เนื้อหาของหน้าแสดงก่อนวัดตำแหน่ง
    await expect(page.locator('main').getByRole('button', { name: 'ส่งการตอบกลับ' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('[data-demo="next"]')].map((b) => b.closest('.fixed')).filter((e): e is Element => !!e && e.getBoundingClientRect().height > 0);
      const barTop = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
      const barLeft = Math.min(...bars.map((b) => b.getBoundingClientRect().left));
      const btns = [...document.querySelectorAll('main button, main a, main textarea')].filter((b) => b.getBoundingClientRect().height > 0);
      const covered = btns.filter((b) => {
        const rc = b.getBoundingClientRect();
        return rc.bottom > barTop + 1 && rc.right > barLeft + 1 && rc.top < innerHeight;
      });
      return { covered: covered.map((b) => (b.textContent ?? '').trim().slice(0, 30)), sendVisible: !!btns.find((b) => b.textContent?.includes('ส่งการตอบกลับ')) };
    });
    expect(r.covered, 'ปุ่มที่ถูกแถบควบคุมบังหลังเลื่อนสุดหน้า').toEqual([]);
    expect(r.sendVisible).toBe(true);
    // Modal (Role Transition / Confirm) อยู่ภายในจอ
    await page.locator('main').getByRole('button', { name: 'ส่งการตอบกลับ' }).click();
    const dlg = page.getByRole('dialog');
    if (await dlg.isVisible().catch(() => false)) {
      const box = (await dlg.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    }
  });
}
