import type { Page } from '@playwright/test';
import { expect, fresh, open, openAllScenarios, store, test } from './helpers';

/** เข้าสู่ระบบผู้ประกอบการตัวอย่าง (OP-003 สวยใสคอสเมติก) ผ่าน Session จำลอง */
async function asMerchant(page: Page, path: string) {
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('smetrust:v2:session', JSON.stringify({ state: { role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true, consumerId: 'CS-001', officerId: 'OF-001', shopDrafts: {} }, version: 1 })));
  await open(page, path);
}

test.describe('AI-01 Advertising Compliance Checker', () => {
  test('ภาษาอังกฤษหลายเงื่อนไข: Highlight, Revision, Copy, Edit, Re-analyze, Before/After', async ({ page, context, browserName }) => {
    // WebKit ไม่รองรับการให้สิทธิ์ Clipboard ใน Playwright — ตรวจข้อความแจ้งผลการคัดลอกแทนการอ่าน Clipboard
    const canReadClipboard = browserName === 'chromium';
    if (canReadClipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await asMerchant(page, '/m/ai/ad-checker');
    await expect(page.getByText('AI Simulation — ไม่ใช่ AI Model จริง').first()).toBeVisible();
    await expect(page.getByText(/ไม่ใช่คำวินิจฉัยทางกฎหมาย/).first()).toBeVisible();
    const input = page.getByLabel('ข้อความโฆษณาที่ต้องการตรวจสอบ');
    // Validation
    await input.fill('สั้น');
    await page.getByRole('button', { name: 'วิเคราะห์ข้อความโฆษณา' }).click();
    await expect(page.getByText(/อย่างน้อย 10/).first()).toBeVisible();
    const text = 'Cures all diseases, instant results guaranteed, 100% safe. Best in Thailand! Only today, buy now.';
    await input.fill(text);
    await page.getByRole('button', { name: 'วิเคราะห์ข้อความโฆษณา' }).click();
    await expect(page.getByText(/^High —/).first()).toBeVisible();
    // ไม่นับ <mark> ในคำอธิบายสี (แดง/ส้ม/เทา)
    const marks = (await page.locator('mark').allInnerTexts()).filter((m) => !['แดง', 'ส้ม', 'เทา'].includes(m.trim()));
    expect(marks.length).toBeGreaterThanOrEqual(5);
    for (const m of marks) expect(text).toContain(m);
    const rev = page.getByLabel('แก้ไขข้อความฉบับเสนอแก้ไข');
    const revText = await rev.inputValue();
    expect(revText).not.toMatch(/Cures all|guaranteed|Best in Thailand/);
    expect(revText).toContain('[');
    await page.getByRole('button', { name: 'คัดลอกข้อความ' }).click();
    // Clipboard ของ Windows แปลงขึ้นบรรทัดเป็น CRLF
    if (canReadClipboard) expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(revText);
    else await expect(page.getByText(/คัดลอก.*แล้ว/).first()).toBeVisible();
    await rev.fill('Herbal tea 590 baht. Promotion 1–31 Oct, limited to 100 boxes, shipping 50 baht, terms apply.');
    await page.getByRole('button', { name: 'วิเคราะห์ใหม่เพื่อเปรียบเทียบ' }).click();
    await expect(page.getByText('เปรียบเทียบก่อน–หลังปรับข้อความ')).toBeVisible();
    await expect(page.getByText('ก่อนปรับ', { exact: true })).toBeVisible();
    await expect(page.getByText('หลังปรับ', { exact: true })).toBeVisible();
    // ประวัติไม่เก็บข้อความที่พิมพ์เอง
    const hist = await store<{ source: string }>(page, 'ai-history');
    expect(JSON.stringify(hist)).not.toContain('Cures all');
  });

  test('ข้อความวัสดุ 100% ไม่ถูกมองว่าเป็นข้อกล่าวอ้าง และผล Low ไม่ได้แปลว่าถูกกฎหมาย', async ({ page }) => {
    await asMerchant(page, '/m/ai/ad-checker');
    await page.getByLabel('ข้อความโฆษณาที่ต้องการตรวจสอบ').fill('เสื้อผ้าฝ้าย 100% ราคา 290 บาท ส่งฟรีเมื่อซื้อครบ 500 บาท ถึง 31 ต.ค. จำกัด 50 ตัว เงื่อนไขตามร้านกำหนด');
    await page.getByRole('button', { name: 'วิเคราะห์ข้อความโฆษณา' }).click();
    await expect(page.getByText(/^Low —/).first()).toBeVisible();
    await expect(page.getByText(/ไม่ใช่คะแนนรับรองความถูกต้องตามกฎหมาย/).first()).toBeVisible();
  });
});

test.describe('AI-02 Complaint Resolution Assistant', () => {
  test('"ยังไม่ได้รับคำตอบ" ไม่ถูกจัดเป็นไม่ได้รับสินค้า / ร่าง 3 Tone / ไม่ส่งอัตโนมัติ', async ({ page }) => {
    await asMerchant(page, '/m/ai/complaint');
    await page.getByRole('tab', { name: 'พิมพ์เอง / ตัวอย่าง' }).click();
    await page.getByLabel('ข้อร้องเรียนที่ได้รับ').fill('สั่งลิปเฉด 03 แต่ได้รับเฉด 05 แจ้งร้านทางแชตแล้วยังไม่ได้รับคำตอบ');
    await page.getByRole('button', { name: 'วิเคราะห์ข้อร้องเรียน' }).click();
    await expect(page.getByText('สินค้าไม่ตรงรายละเอียด').first()).toBeVisible();
    await expect(page.getByText('ไม่ได้รับสินค้า', { exact: true })).toHaveCount(0);
    const draft = page.getByRole('textbox').last();
    const seen = new Set<string>();
    for (const tone of [/สุภาพ/, /เป็นมิตร/, /กระชับ/]) {
      await page.getByRole('radio', { name: tone }).click();
      const d = await draft.inputValue();
      expect(d).not.toMatch(/คืนเงิน(?:ให้)?แล้ว|จัดส่งเรียบร้อย|ส่งสินค้า(?:ให้)?แล้ว/);
      seen.add(d);
    }
    expect(seen.size).toBe(3);
    // ข้อความที่พิมพ์เองนำไปใส่เคสไม่ได้ (ต้องเลือกเคสจาก Complaint Center)
    const insert = page.getByRole('button', { name: 'นำร่างไปใส่ช่องตอบกลับเคส' });
    if (await insert.count()) await expect(insert).toBeDisabled();
    const persisted = await page.evaluate(() => localStorage.getItem('smetrust:v2:ai-workspace') ?? '');
    expect(persisted).not.toContain('ลิปเฉด 03');
  });

  test('เคสที่ไม่มีอยู่ / เคสของร้านอื่น → แจ้งข้อผิดพลาด', async ({ page }) => {
    await asMerchant(page, '/m/ai/complaint?case=CMP-9999-0001');
    await expect(page.getByText(/ไม่พบเคส/).first()).toBeVisible();
    await open(page, '/m/ai/complaint?case=CMP-2569-0001');
    await expect(page.getByText(/ไม่พบเคส/).first()).toBeVisible();
  });

  test('ประวัติ AI: บันทึก, Clear History และ Reset Demo Data คืนตัวอย่าง', async ({ page }) => {
    await asMerchant(page, '/m/ai/ad-checker');
    await page.getByRole('button', { name: /อาหารเสริม/ }).first().click();
    await page.getByRole('button', { name: 'วิเคราะห์ข้อความโฆษณา' }).click();
    await expect(page.getByText(/^High —/).first()).toBeVisible();
    await open(page, '/m/ai/history');
    await expect(page.getByText(/ตัวอย่าง: อาหารเสริม/).first()).toBeVisible();
    expect((await store(page, 'ai-history')).length).toBe(5);
    await page.getByRole('button', { name: 'Clear History' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'ล้างประวัติ' }).click();
    await expect(page.getByText('ยังไม่มีประวัติการวิเคราะห์')).toBeVisible();
    await open(page, '/demo');
    await openAllScenarios(page);
    await page.getByRole('button', { name: 'Reset Demo Data ทั้งหมด' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'รีเซ็ตข้อมูล' }).click();
    await expect.poll(async () => (await store(page, 'ai-history')).length).toBe(4);
  });
});
