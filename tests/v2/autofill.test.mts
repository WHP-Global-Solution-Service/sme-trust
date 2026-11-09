/**
 * Marketplace-Assisted Registration & Auto-Fill (จำลอง)
 * ครอบคลุม: Auto-Fill Success, Missing Fields, Edit Imported Fields, Read-only Source Protection, Draft Persistence,
 * Refresh & Resume (localStorage), Cancel / Reconnect, No Duplicate Applications, Officer Sees Original vs Edited,
 * Assessment Uses Raw Source Data, Scenario 9A Full Flow, Model v2.1 ไม่เปลี่ยน และ No External API Calls
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { S, W, storage, view, describe, check, finish, actAs, asOwner } from '../harness.mts';

const A = await import('@/features/marketplace/autofill');
const V = await import('@/stores/workflowsV2');
const G = await import('@/features/marketplace/services/generator');
const INP = await import('@/features/trust-assessment/inputs');
const MODEL = await import('@/stores/assessmentConfig');
const C = await import('@/demo/controller');
const { findScenario, scenarioCode } = await import('@/mock/scenarios');
const { useDemoStore, reportDemo } = await import('@/stores/demo');
const V2S = await import('@/mock/scenarios/v2');

const OP = 'OP-013';
const merchants = () => S.useMerchantStore.getState().items;
const apps = () => S.useVerificationStore.getState().items;
const conns = () => S.useMarketplaceStore.getState().items;
const records = () => S.useImportRecordStore.getState().items;

// ------------------------------------------------------------------ 1. Auto-Fill Success
describe('Auto-Fill Success — ร้านในบัญชี Marketplace (จำลอง) และข้อมูลต้นฉบับ');
const shops = A.mockAccountShops(OP, 'สุดารัตน์ ขายดี', 'shopee');
check(shops.length === 3 && new Set(shops.map((x) => x.mockShopId)).size === 3 && shops.every((x) => x.mockShopId.startsWith('SPE-')), 'พบ 3 ร้านในบัญชี Shopee (จำลอง) — Shop ID จำลองไม่ซ้ำ');
check(JSON.stringify(A.mockAccountShops(OP, 'สุดารัตน์ ขายดี', 'shopee')) === JSON.stringify(shops), 'Deterministic — เปิดซ้ำได้ร้านชุดเดิม');
const shop = shops[0];
const src = A.sourceOfShop(shop);
check(
  src.shopName === shop.shopName && src.mockShopId === shop.mockShopId && src.shopUrl === `shopee.mock/shop/${shop.mockShopId}` && src.description.length >= 20 && !!src.avatar.initials && src.categories.length > 0 && src.products.length >= 1 && src.products.length === G.generateSnapshot({ id: shop.key, platform: 'shopee', archetype: shop.archetype, seed: src.seed, sourceCategory: src.category }, src.category).listings.length && src.products.every((p) => p.price > 0) && src.reviewCount > 0 && src.salesVolume > 0 && !!src.lastSyncAt,
  'ข้อมูลต้นฉบับครบ: ชื่อร้าน, Shop ID, URL, คำอธิบาย, รูปร้าน, หมวด, สินค้า, ราคา, คะแนน, รีวิว, ยอดขาย, เวลาซิงก์',
);
check(!/https?:\/\//.test(src.shopUrl) && src.shopUrl.includes('.mock/'), 'ลิงก์ร้านเป็นลิงก์จำลอง (ไม่ใช่โดเมนจริง)');
const imp = A.importedValues(src);
check(imp.shopName === src.shopName && imp.description === src.description && imp.category === src.category && Object.keys(imp).length === 3, 'เติมอัตโนมัติ 3 ช่องที่มีในแหล่งข้อมูล: ชื่อร้าน คำอธิบาย หมวดหมู่');

// ------------------------------------------------------------------ 2. Missing Fields
describe('Missing Fields — ช่องที่ไม่มีในแหล่งข้อมูลต้องกรอกเพิ่ม');
const blank: Record<string, string> = { shopName: '', description: '', category: '', phone: '', email: '', province: '', district: '', address: '' };
const filled = { ...blank, ...imp } as Parameters<typeof A.fieldRows>[0];
const rules = A.newRegistrationRules(src);
let rows = A.fieldRows(filled, rules);
let sum = A.summarize(rows);
check(sum.imported === 3 && sum.missing === 4 && sum.edited === 0, `สรุปหลังนำเข้า: นำเข้าสำเร็จ ${sum.imported} · ต้องกรอกเพิ่ม ${sum.missing} (เบอร์ อีเมล จังหวัด อำเภอ) · แก้ไข ${sum.edited}`);
check(['phone', 'email', 'province', 'district'].every((k) => rows.find((r) => r.key === k)!.status === 'missing'), 'ช่องติดต่อและที่ตั้งเป็น "ต้องกรอกเพิ่ม" — ระบบไม่สร้างข้อมูลขึ้นเอง');
check(rows.find((r) => r.key === 'address')!.status === 'manual' && A.fieldRows(filled, A.newRegistrationRules(src, true)).find((r) => r.key === 'address')!.status === 'missing', 'ที่อยู่: ไม่บังคับสำหรับบุคคลธรรมดา / บังคับสำหรับนิติบุคคล');

// ------------------------------------------------------------------ 3. Edit Imported Fields
describe('Edit Imported Fields — แก้ไขแล้วติดตามที่มาและเก็บต้นฉบับ');
const edited = { ...filled, description: `${src.description} รับประกันสินค้า 30 วัน`, shopName: `${src.shopName} สาขาขอนแก่น`, phone: '0899999999', email: 'shop@demo.local', province: 'ขอนแก่น', district: 'เมือง' };
rows = A.fieldRows(edited, rules);
sum = A.summarize(rows);
const r = (k: string) => rows.find((x) => x.key === k)!;
check(r('description').status === 'user_edited' && r('description').imported === src.description, 'แก้คำอธิบาย → "ผู้สมัครแก้ไข" และเก็บค่าต้นฉบับไว้เทียบ');
check(r('shopName').status === 'verification_required', 'แก้ชื่อร้านให้ต่างจากต้นฉบับ → "รอการตรวจสอบ"');
check(r('category').status === 'imported' && r('phone').status === 'manual', 'ช่องที่ไม่แก้ยังเป็น "นำเข้า" · ช่องที่กรอกเพิ่มเป็น "กรอกเอง"');
check(sum.edited === 2 && sum.verification === 1 && sum.missing === 0 && sum.imported === 1, `สรุป: แก้ไข ${sum.edited} · รอตรวจสอบ ${sum.verification} · ต้องกรอกเพิ่ม ${sum.missing}`);
check(A.fieldStatus('description', `  ${src.description}  `, rules) === 'imported', 'ช่องว่างหน้า/หลังไม่ถือว่าแก้ไข');

// ------------------------------------------------------------------ 4. Read-only Source Protection
describe('Read-only Source Protection — แก้แบบฟอร์มไม่เปลี่ยนข้อมูลต้นฉบับ');
const frozen = JSON.stringify(src);
A.fieldRows({ ...edited, category: 'ของใช้ในบ้าน' }, rules);
check(JSON.stringify(src) === frozen, 'คำนวณสถานะ/แก้ค่าในแบบฟอร์ม → Raw Source ไม่เปลี่ยนแม้แต่ไบต์เดียว');
const cleared = A.clearImported(edited, src);
check(cleared.shopName === edited.shopName && cleared.description === edited.description && cleared.category === '' && cleared.phone === edited.phone, 'ยกเลิกการนำเข้า: ช่องที่ยังเป็นค่าต้นฉบับถูกล้าง · ช่องที่แก้/กรอกเองยังอยู่');
const pinned = { id: 'X', platform: 'shopee' as const, archetype: shop.archetype, seed: src.seed, sourceCategory: src.category };
const s1 = G.generateSnapshot(pinned, src.category);
const s2 = G.generateSnapshot(pinned, 'ของใช้ในบ้าน');
check(JSON.stringify(s1) === JSON.stringify(s2), 'Generator ใช้หมวดต้นฉบับที่บันทึกตอนนำเข้า — แก้หมวดในโปรไฟล์ไม่เปลี่ยนสินค้า ราคา รีวิว หรือยอดขาย');

// ------------------------------------------------------------------ 5. Submit (No Duplicate) + Assessment Uses Raw Source
describe('ส่งคำขอสมัครร้านใหม่ — ไม่ซ้ำ ใช้ Raw Source ประเมิน และไม่ออก Badge อัตโนมัติ');
V2S.fixtureBranchClean(OP);
const op13 = S.useOperatorStore.getState().items.find((o) => o.id === OP)!;
check(!!op13 && op13.kycStatus === 'verified' && !merchants().some((m) => m.operatorId === OP), 'บัญชีตัวอย่าง OP-013 ยืนยันตัวตนแล้ว (Level 1) และยังไม่มีร้าน');
const form = {
  businessType: 'individual' as const,
  ownerName: op13.name,
  shopName: edited.shopName,
  category: edited.category,
  province: edited.province,
  district: edited.district,
  address: '',
  phone: edited.phone,
  email: edited.email,
  description: edited.description,
  channels: [{ type: 'marketplace' as const, handle: src.shopUrl }],
  documents: [{ id: 'doc-af-1', name: 'ทะเบียนพาณิชย์ (ตัวอย่างจำลอง).pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 200, addedAt: new Date().toISOString() }],
};
const counts = () => ({ m: merchants().length, a: apps().length, c: conns().length, r: records().length });
const before = counts();
const res = asOwner(OP, () => V.submitMarketplaceRegistration(OP, form, { draftId: 'DRF-AF-1', source: src }));
const after1 = counts();
check(after1.m === before.m + 1 && after1.a === before.a + 1 && after1.c === before.c + 1 && after1.r === before.r + 1, 'ส่งครั้งแรก: ร้าน +1 · คำขอ +1 · การเชื่อมต่อ +1 · บันทึกการนำเข้า +1');
check(res.app.type === 'registration' && res.app.requestedLevel === 2 && res.app.importId === res.record.id && res.app.sourceDraftId === 'DRF-AF-1', 'คำขอลงทะเบียนตาม Workflow เดิม (Level 2 เมื่ออนุมัติ) ผูกบันทึกการนำเข้าและฉบับร่าง');
check(!S.useCertificationStore.getState().items.some((c) => c.merchantId === res.merchant.id), 'ไม่ออกใบรับรอง/Badge อัตโนมัติ');
check(res.app.timeline.some((t) => t.title.includes('เติมแบบฟอร์มจาก Shopee (จำลอง)')), 'Timeline ของคำขอบันทึกว่าเติมจาก Shopee (จำลอง) พร้อมจำนวนช่องที่นำเข้า/แก้ไข');
const again = asOwner(OP, () => V.submitMarketplaceRegistration(OP, form, { draftId: 'DRF-AF-1', source: src }));
check(again.duplicate === true && again.app.id === res.app.id && JSON.stringify(counts()) === JSON.stringify(after1), 'ส่งซ้ำ (กดซ้ำ / Refresh / Back) → คำขอเดิม ไม่สร้างร้าน คำขอ การเชื่อมต่อ หรือบันทึกซ้ำ');
const manualA = asOwner(OP, () => W.submitShopRegistration(OP, { ...form, shopName: 'ร้านกรอกเอง' }, { draftId: 'DRF-AF-MANUAL' }));
const manualB = asOwner(OP, () => W.submitShopRegistration(OP, { ...form, shopName: 'ร้านกรอกเอง' }, { draftId: 'DRF-AF-MANUAL' }));
check(manualB.duplicate === true && manualB.app.id === manualA.app.id, 'เส้นทางกรอกเอง (9B) ก็ส่งซ้ำไม่ได้คำขอซ้ำ');

const c13 = conns().find((c) => c.id === res.record.connectionId)!;
check(c13.status === 'connected' && c13.seed === src.seed && c13.mockShopId === src.mockShopId && c13.sourceCategory === src.category && c13.archetype === src.archetype, 'การเชื่อมต่อใช้ Seed / Shop ID / หมวดต้นฉบับเดียวกับที่ผู้สมัครเห็นตอน Preview');
const snapUsed = G.snapshotOf(c13, merchant13().category);
function merchant13() {
  return merchants().find((m) => m.id === res.merchant.id)!;
}
const ratingUsed = snapUsed.totalReviews ? Math.round((snapUsed.ratingHistogram.reduce((s, c, i) => s + c * (i + 1), 0) / snapUsed.totalReviews) * 100) / 100 : 0;
check(ratingUsed === src.rating && snapUsed.totalReviews === src.reviewCount && snapUsed.monthlyOrders.reduce((a, b) => a + b, 0) === src.salesVolume && JSON.stringify(snapUsed.listings.map((l) => l.price)) === JSON.stringify(src.products.map((p) => p.price)), 'ข้อมูลที่ Engine ใช้ = ข้อมูลที่ผู้สมัครเห็นตอน Preview (คะแนน รีวิว ยอดขาย ราคา)');
const a1 = asOwner(res.merchant.id, () => V.runAssessment(res.merchant.id))!;
S.useMerchantStore.getState().update(res.merchant.id, { category: 'ของใช้ในบ้าน', shopName: 'ชื่อที่แก้ภายหลัง', description: 'คำอธิบายที่แก้ภายหลัง ยาวพอสำหรับการทดสอบ' });
const input2 = INP.buildAssessmentInput(res.merchant.id, V.dataBundle(), new Date())!;
check(JSON.stringify(input2.marketplace.map((x) => x.snapshot)) === JSON.stringify([snapUsed]), 'แก้หมวด/ชื่อ/คำอธิบายของร้านภายหลัง → Snapshot ที่ใช้ประเมินเหมือนเดิม');
const a2 = asOwner(res.merchant.id, () => V.runAssessment(res.merchant.id))!;
check(a2.result.band === a1.result.band && a2.result.score === a1.result.score && a2.result.confidence.level === a1.result.confidence.level, `ผลประเมินไม่เปลี่ยนจากการแก้ข้อมูลลงทะเบียน (Band ${a1.result.band} · คะแนน ${a1.result.score})`);
check(MODEL.currentModel().version === a1.result.modelVersion && a1.result.modelVersion.includes('2.1'), `ใช้ Model v2.1 เดิม (${a1.result.modelVersion})`);

// ------------------------------------------------------------------ 6. Officer Sees Original vs Edited
describe('Officer Review — ต้นฉบับเทียบกับข้อมูลที่แก้ไข');
const O = { role: 'officer' as const, officerId: 'OF-001' };
let page = view(`/o/applications/${res.app.id}`, O);
check(page.includes('คำขอนี้เติมข้อมูลจาก Marketplace') && page.includes('Shopee (จำลอง)') && page.includes(src.mockShopId), 'เจ้าหน้าที่เห็นแหล่งข้อมูล (Shopee จำลอง · Shop ID)');
check(page.includes(src.description) && page.includes(edited.description), 'เห็นค่าต้นฉบับและค่าในคำขอของช่องที่แก้');
check(page.includes('ช่องที่ผู้สมัครแก้ไข: ชื่อร้านที่ใช้สมัคร, คำอธิบายธุรกิจ') && page.includes('ช่องที่ยังขาด: ไม่มี'), 'เห็นรายการช่องที่แก้ และช่องที่ขาด');
check(page.includes('สถานะการเชื่อมต่อ') && page.includes('เชื่อมต่อแล้ว') && page.includes('ผลประเมิน') && page.includes(a2.id) && page.includes('ยืนยันแล้ว (Mock e-KYC)'), 'เห็นสถานะการเชื่อมต่อ ผลประเมิน และสถานะยืนยันตัวตน');
check(page.includes('รอการตรวจสอบ') && page.includes('ขอเอกสารเพิ่มเติม'), 'ชื่อร้านที่ต่างจากต้นฉบับมีป้าย "รอการตรวจสอบ" และขอข้อมูลเพิ่มได้ตาม Workflow เดิม');
actAs(['officer', 'admin'], () => W.requestInfo(res.app.id, 'ขอหลักฐานการเปลี่ยนชื่อร้านให้ต่างจากชื่อบน Marketplace'));
check(apps().find((a) => a.id === res.app.id)!.status === 'need_info' && merchants().find((m) => m.id === res.merchant.id)!.registrationStatus === 'need_info', 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติมผ่าน Workflow เดิมได้');

// ------------------------------------------------------------------ 7. Draft Persistence / Refresh & Resume / Cancel
describe('Draft Persistence — ฉบับร่างใน localStorage ของ v2');
const ses = S.useSessionStore.getState();
ses.saveDraft(OP, { step: 2, data: { ...filled, docs: [], importSource: src, draftId: 'DRF-AF-2', channels: [{ type: 'marketplace', handle: src.shopUrl }] }, savedAt: new Date().toISOString() });
const raw = storage['smetrust:v2:session'] ?? '';
check(raw.includes('DRF-AF-2') && raw.includes(src.mockShopId), 'ฉบับร่าง (ค่าที่กรอก + ข้อมูลต้นฉบับ + รหัสฉบับร่าง) บันทึกใน localStorage ของ v2 (smetrust:v2:session)');
check(!/password|รหัสผ่าน"|token|accessToken|idCard|citizenId|nationalId/i.test(raw), 'ไม่มีรหัสผ่าน Token หรือเลขบัตรประชาชนในฉบับร่าง');
page = view('/m/register-shop?from=import', { role: 'merchant', operatorId: OP, merchantLoggedIn: true });
check(page.includes('ทบทวนข้อมูลที่นำเข้า (Review Imported Information)') && page.includes('นำเข้าสำเร็จ') && page.includes('ต้องกรอกเพิ่ม') && page.includes(src.shopName) && page.includes('อ่านอย่างเดียว'), 'เปิดแบบฟอร์มหลังนำเข้า (หรือ Refresh) → แสดงข้อมูลที่เติมไว้ สรุป และข้อมูลต้นฉบับทันที');
check(page.includes('นำเข้าจาก Shopee (จำลอง)') && page.includes('ไม่มีในข้อมูลที่นำเข้า — กรุณากรอกเพิ่ม'), 'ป้ายที่มา "นำเข้าจาก Shopee (จำลอง)" และข้อความ "ต้องกรอกเพิ่ม" ในแต่ละช่อง');
page = view('/m/register-shop', { role: 'merchant', operatorId: OP, merchantLoggedIn: true });
check(page.includes('พบฉบับร่างที่บันทึกไว้') && page.includes('ข้อมูลนำเข้าจาก Shopee (จำลอง)'), 'กลับมาที่แบบฟอร์มภายหลัง → เสนอ Resume ฉบับร่าง (ระบุแหล่งข้อมูลที่นำเข้า)');
page = view('/m/register-shop', { role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true });
check(page.includes('A. เชื่อมต่อร้านค้าจาก Marketplace') && page.includes('B. ลงทะเบียนด้วยตนเอง') && page.includes('ขั้นตอนที่ 1/7'), 'ทางเข้าลงทะเบียน: ตัวเลือก A (Marketplace) และ B (ลงทะเบียนด้วยตนเอง — ค่าเริ่มต้น)');
ses.saveDraft(V.importFlowKey(OP), { step: 2, data: { platform: 'lazada', agree: true }, savedAt: new Date().toISOString() });
page = view('/m/register-shop/marketplace', { role: 'merchant', operatorId: OP, merchantLoggedIn: true });
check(page.includes('เลือกร้านค้า') && page.includes('Lazada (จำลอง)') && page.includes('LZD-'), 'ขั้นตอนเชื่อมบัญชี Refresh แล้วกลับมาที่ขั้นเดิม (เลือกร้านใน Lazada จำลอง)');
ses.saveDraft(V.importFlowKey(OP), { step: 1, data: { platform: 'shopee' }, savedAt: new Date().toISOString() });
page = view('/m/register-shop/marketplace', { role: 'merchant', operatorId: OP, merchantLoggedIn: true });
check(page.includes('Simulation') && page.includes('ไม่ใช่หน้า Login') && !/type="password"|รหัสผ่าน:/.test(page), 'หน้าอนุญาตเป็นการจำลอง — ไม่ใช่หน้า Login และไม่มีช่องรหัสผ่าน');

// ------------------------------------------------------------------ 8. Scenario 9 (ร้านเดิม): Cancel / Reconnect
describe('ร้านเดิม (M-005): ยกเลิกการเชื่อมต่อแล้วจัดการฉบับร่างตามกฎ');
V2S.fixtureV2Clean();
const [c5] = V.attachImportedMarketplaces('M-005', [{ platform: 'lazada', archetype: 'established_good' }]);
const m5 = merchants().find((m) => m.id === 'M-005')!;
const reg5 = V.registeredValues(m5);
const src5 = V.sourceOfConnection(c5, m5);
ses.saveDraft(V.profileDraftKey(c5.id), { step: 1, data: { values: { ...reg5, description: 'ร่างที่ยังไม่ยืนยัน ต้องถูกล้างเมื่อยกเลิกการเชื่อมต่อ' }, draftId: 'DRF-AF-5' }, savedAt: new Date().toISOString() });
page = view(`/m/marketplace/profile/${c5.id}`, { role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
check(page.includes('ไม่ใช่การสมัครร้านใหม่') && page.includes('ร่างที่ยังไม่ยืนยัน') && page.includes('Level 3'), 'Refresh หน้าเติมโปรไฟล์ร้านเดิม → ฉบับร่างที่แก้ไว้ยังอยู่');
asOwner(c5.id, () => V.disconnectMarketplace(c5.id));
check(!S.useSessionStore.getState().shopDrafts[V.profileDraftKey(c5.id)], 'ยกเลิกการเชื่อมต่อ → ฉบับร่างที่ยังไม่ยืนยันจากการเชื่อมต่อนั้นถูกล้าง');
check(asOwner(c5.id, () => V.confirmProfileUpdate(c5.id, reg5, 'DRF-AF-6')).ok === false && merchants().find((m) => m.id === 'M-005')!.description === m5.description, 'ยืนยันอัปเดตจากการเชื่อมต่อที่ยกเลิกแล้วไม่ได้ — โปรไฟล์ร้านไม่เปลี่ยน');
const c5b = asOwner('M-005', () => V.connectMarketplace('M-005', 'lazada'));
check(c5b.id !== c5.id && c5b.status === 'pending_consent', 'เชื่อมต่อใหม่ (Reconnect) ได้การเชื่อมต่อใหม่ที่ต้องยินยอมอีกครั้ง');
V2S.fixtureV2Clean();
const [c6] = V.attachImportedMarketplaces('M-005', [{ platform: 'shopee', archetype: 'established_good' }]);
const m6 = merchants().find((m) => m.id === 'M-005')!;
const reg6 = V.registeredValues(m6);
const src6 = V.sourceOfConnection(c6, m6);
const certBefore = JSON.stringify(S.useCertificationStore.getState().items.filter((c) => c.merchantId === 'M-005'));
const rename = asOwner(c6.id, () => V.confirmProfileUpdate(c6.id, { ...reg6, shopName: 'ดอยสูงคาเฟ่', category: 'ของใช้ในบ้าน', description: `${src6.description} คั่วสดทุกสัปดาห์`, phone: '0812345678' }, 'DRF-AF-7'));
const m6b = merchants().find((m) => m.id === 'M-005')!;
check(rename.ok && rename.record!.pending.join() === 'shopName,category' && m6b.shopName === m6.shopName && m6b.category === m6.category, 'ชื่อร้าน/หมวดที่ผูกกับใบรับรอง → รอเจ้าหน้าที่ตรวจ (ยังไม่เปลี่ยนในโปรไฟล์)');
check(rename.record!.applied.join() === 'description,phone' && m6b.phone === '0812345678' && m6b.description.endsWith('คั่วสดทุกสัปดาห์'), 'คำอธิบายและช่องทางติดต่อบันทึกลงโปรไฟล์ทันที');
check(JSON.stringify(S.useCertificationStore.getState().items.filter((c) => c.merchantId === 'M-005')) === certBefore, 'ใบรับรอง Level 3 เดิมไม่เปลี่ยน');
check(S.useNotificationStore.getState().items.some((n) => n.recipientRole === 'officer' && n.title === 'ร้านค้าขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง'), 'แจ้งเจ้าหน้าที่ให้ตรวจการเปลี่ยนชื่อร้าน/หมวด');
asOwner('M-005', () => V.runAssessment('M-005'));
const as5 = S.useAssessmentStore.getState().items.find((a) => a.merchantId === 'M-005')!;
page = view(`/o/assessments/${as5.id}`, O);
check(page.includes('ร้านอัปเดตโปรไฟล์จากข้อมูลที่นำเข้า') && page.includes('ข้อมูลเดิมในระบบ') && page.includes('ดอยสูงคาเฟ่') && page.includes('รอการตรวจสอบ (ยังไม่เปลี่ยนในโปรไฟล์ร้าน): ชื่อร้านที่ใช้สมัคร, หมวดหมู่ธุรกิจ'), 'เจ้าหน้าที่ (หน้าผลประเมิน) เห็นข้อมูลเดิม / จาก Marketplace / ที่ส่ง และช่องที่รอตรวจ');
V2S.fixtureV2Clean();
check(!records().some((x) => x.merchantId === 'M-005') && merchants().find((m) => m.id === 'M-005')!.description === m5.description, 'เล่น Scenario 9 ซ้ำ → ล้างบันทึกการนำเข้าและคืนโปรไฟล์ตั้งต้น (ไม่ซ้อนการอัปเดต)');

// ------------------------------------------------------------------ 9. Scenario 9A Full Flow (Demo Controller)
describe('Scenario 9A — ร้านใหม่สมัครด้วย Auto-Fill (Demo Controller)');
let cur = '';
const nav = ((to: string) => {
  cur = to;
}) as never;
const demo = () => useDemoStore.getState();
const sc9a = findScenario('s9a')!;
check(!!sc9a && sc9a.branch === true && scenarioCode(sc9a) === '9A' && sc9a.caseNote!.includes('ไม่ใช่การยกระดับร้านกาแฟดอยสูง'), 'มีเส้นทาง 9A แยกชัดเจน (สมัครร้านใหม่ ไม่ใช่การยกระดับ M-005)');
for (let round = 1; round <= 2; round++) {
  C.startScenario('s9a', nav);
  check(demo().current.operatorId === OP && !merchants().some((m) => m.operatorId === OP) && !records().some((x) => x.operatorId === OP), `รอบที่ ${round}: เริ่ม 9A ด้วย OP-013 — ไม่มีร้าน/บันทึกค้างจากรอบก่อน`);
  const blocked = () => C.next(nav, cur) === 'blocked';
  C.next(nav, cur); // home → entry
  check(cur === '/m/register-shop' && blocked(), '  ขั้นเลือกวิธีลงทะเบียน: ต้องกด A ก่อน');
  reportDemo('reg.flow', 0);
  C.next(nav, cur);
  check(cur === '/m/register-shop/marketplace' && blocked(), '  ขั้นอนุญาต (จำลอง): ต้องอนุญาตก่อน');
  reportDemo('reg.flow', 2);
  C.next(nav, cur);
  check(blocked(), '  ขั้นเลือกร้าน: ต้องเลือกร้านก่อน');
  reportDemo('reg.flow', 3);
  C.next(nav, cur);
  check(blocked(), '  ขั้นตรวจข้อมูลก่อนนำเข้า: ต้องยืนยันนำเข้าก่อน');
  reportDemo('reg.imported', 1);
  C.next(nav, cur);
  check(cur === '/m/register-shop?from=import' && blocked(), '  ขั้นทบทวนข้อมูลที่นำเข้า: ต้องแก้ไขอย่างน้อย 1 ช่อง');
  reportDemo('reg.edited', 1);
  C.next(nav, cur);
  check(blocked(), '  ขั้นกรอกข้อมูลที่ขาด: ต้องไปถึงขั้นตรวจสอบข้อมูล');
  reportDemo('shop.step', 5);
  C.next(nav, cur);
  check(blocked(), '  ขั้นส่งคำขอ: ระบบไม่ส่งแทนผู้ใช้');
  const sub = asOwner(OP, () => V.submitMarketplaceRegistration(OP, form, { draftId: `DRF-9A-${round}`, source: src }));
  // ขั้นถัดไปเปลี่ยนบทบาทเป็นเจ้าหน้าที่ → Controller แสดงคำอธิบายการเปลี่ยนบทบาทก่อน แล้วจึงไปต่อ
  check(C.next(nav, cur) === 'transition' && C.next(nav, cur, true) === 'moved', '  ส่งคำขอแล้ว → เปลี่ยนเป็นมุมเจ้าหน้าที่ (มีคำอธิบายการเปลี่ยนบทบาท)');
  check(cur === `/o/applications/${sub.app.id}` && demo().current.applicationId === sub.app.id && demo().current.importId === sub.record.id && demo().current.merchantId === sub.merchant.id, '  ส่งคำขอแล้ว → เจ้าหน้าที่เปิดคำขอเดียวกัน (ส่งต่อ Application / Import / Merchant ID)');
  page = view(cur, O);
  check(page.includes('คำขอนี้เติมข้อมูลจาก Marketplace') && page.includes('ช่องที่ผู้สมัครแก้ไข'), '  เจ้าหน้าที่เห็นต้นฉบับเทียบกับข้อมูลที่แก้ไข');
  check(C.next(nav, cur) === 'completed' && cur === '/demo/complete/s9a', '  จบ 9A → หน้าสรุป');
  page = view(cur);
  check(page.includes('เส้นทางทางเลือก 9A') && page.includes('Level 2 เมื่ออนุมัติ'), '  สรุป 9A: เป็นเส้นทางสมัครใหม่ (Level 2 เมื่ออนุมัติ ไม่มี Badge อัตโนมัติ)');
  check(merchants().filter((m) => m.operatorId === OP).length === 1 && records().filter((x) => x.operatorId === OP).length === 1, '  มีร้านและบันทึกการนำเข้าของ OP-013 อย่างละ 1 รายการ (ไม่ซ้ำ)');
}
check(!!sc9a.replayNote?.()?.includes('OP-013'), 'เล่นซ้ำ: แจ้งก่อนล้างร้านเดิมของ OP-013');
W.resetAllDemoData();
check(records().length === 0 && !merchants().some((m) => m.operatorId === OP) && Object.keys(S.useSessionStore.getState().shopDrafts).length === 0, 'Reset Demo Data → ไม่มีบันทึกการนำเข้า ร้านของ OP-013 หรือฉบับร่างค้าง');

// ------------------------------------------------------------------ 10. Model v2.1 / ข้อมูลตั้งต้นไม่เปลี่ยน
describe('Model v2.1 และข้อมูลตั้งต้นของ Scenario 9–13 ไม่เปลี่ยน');
const seedConns = conns().filter((c) => !c.sourceCategory);
check(seedConns.length === conns().length, 'การเชื่อมต่อตัวอย่างเดิมไม่มีหมวดต้นฉบับ → Snapshot และผลประเมินเหมือนก่อนเพิ่มฟีเจอร์');
check(MODEL.currentModel().version === 'v2.1-sim', `Model ${MODEL.currentModel().version}`);

// ------------------------------------------------------------------ 11. No External API Calls
describe('No External API Calls');
const files: string[] = [];
const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(ts|tsx)$/.test(f) && files.push(join(d, f))));
walk('src');
const offenders = files.filter((f) => /\bfetch\(|XMLHttpRequest|new WebSocket|sendBeacon|EventSource\(|axios/.test(readFileSync(f, 'utf8')));
check(offenders.length === 0, `ไม่มีการเรียกเครือข่ายใน src/ (${files.length} ไฟล์)${offenders.length ? ' — ' + offenders.join(', ') : ''}`);
const newFiles = ['src/features/marketplace/autofill.ts', 'src/features/merchants/MarketplaceRegistrationPage.tsx', 'src/features/marketplace/pages/MarketplaceProfilePage.tsx', 'src/features/marketplace/components/ImportProvenance.tsx'];
check(newFiles.every((f) => !/type="password"|type=\{?['"]password|https?:\/\/(?!www\.w3\.org)/.test(readFileSync(f, 'utf8'))), 'ไฟล์ใหม่ไม่มีช่องรหัสผ่านและไม่มี URL ภายนอก');

finish();
