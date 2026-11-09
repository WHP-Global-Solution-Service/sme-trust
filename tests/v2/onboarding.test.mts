/**
 * Unified Merchant Onboarding — KYC & Business Verification, Dynamic Documents, Multi-Platform, Ownership,
 * Automation/Assessment Integration และความสอดคล้องของ Badge ในทุกมุมมอง
 */
import { S, W, view, describe, check, finish, actAs } from '../harness.mts';

const V = await import('@/stores/workflowsV2');
const AU = await import('@/stores/automation');
const VR = await import('@/features/onboarding/verification');
const AF = await import('@/features/marketplace/autofill');
const MODEL = await import('@/features/trust-assessment/model');
const { seed } = await import('@/mock/data');

const asMerchant = (op: string) => S.useSessionStore.setState({ role: 'merchant', operatorId: op, merchantLoggedIn: true });
const asOfficer = () => S.useSessionStore.setState({ role: 'officer', officerId: 'OF-001' });
const badge = (id: string) => S.useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === id);
const tasks = (id: string) => S.useOfficerTaskStore.getState().items.filter((t) => t.merchantId === id);
const merchants = () => S.useMerchantStore.getState().items;
const conns = (id: string) => S.useMarketplaceStore.getState().items.filter((c) => c.merchantId === id && c.status !== 'disconnected');
const doc = (kind: string) => ({ id: `d-${kind}`, name: `${kind}.pdf`, kind, sizeKb: 100, addedAt: new Date().toISOString() });
const baseForm = (over: Partial<Parameters<typeof W.submitShopRegistration>[1]> = {}): Parameters<typeof W.submitShopRegistration>[1] => ({
  businessType: 'individual', ownerName: 'ผู้ทดสอบ ระบบ', shopName: 'ร้านทดสอบสมัครเอง', category: 'หัตถกรรมและของที่ระลึก', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่', address: '', phone: '0812345678', email: 'self@example.com',
  description: 'งานหัตถกรรมทำมือจากชุมชน ส่งทั่วประเทศ เปลี่ยนสินค้าได้ภายใน 7 วัน', channels: [{ type: 'facebook', handle: 'self-demo.page' }], documents: [doc('ภาพสินค้า')], identityDocType: 'id_card', ...over,
});

W.resetAllDemoData();

// ------------------------------------------------------------------ KYC & Dynamic Documents
describe('Merchant KYC & Dynamic Document Requirements (กฎจำลอง)');
{
  const ind = VR.documentRequirements({ businessType: 'individual', category: 'หัตถกรรมและของที่ระลึก', kycVerified: true });
  check(ind.find((r) => r.id === 'identity')?.satisfiedBy?.includes('e-KYC') && ind.some((r) => r.id === 'business' && r.level === 'required') && !ind.some((r) => r.id === 'company'), 'บุคคลธรรมดา: ยืนยันตัวตนผ่าน e-KYC + หลักฐานการประกอบธุรกิจ (ไม่ต้องมีหนังสือรับรองนิติบุคคล)');
  check(!ind.some((r) => r.id === 'license'), 'หมวดที่ไม่มีกฎเฉพาะ → ไม่แสดงใบอนุญาตผลิตภัณฑ์');
  const jur = VR.documentRequirements({ businessType: 'juristic', category: 'อาหารและเครื่องดื่ม', applicantIsAuthorized: false, kycVerified: false });
  check(jur.some((r) => r.id === 'company' && r.level === 'required') && jur.some((r) => r.id === 'authorization' && r.level === 'required') && !jur.some((r) => r.id === 'business'), 'นิติบุคคล: หนังสือรับรอง + หนังสือมอบอำนาจเมื่อผู้สมัครไม่ใช่ผู้มีอำนาจ');
  check(!VR.documentRequirements({ businessType: 'juristic', category: 'อาหารและเครื่องดื่ม', applicantIsAuthorized: true, kycVerified: true }).some((r) => r.id === 'authorization'), 'ผู้สมัครเป็นผู้มีอำนาจเอง → ไม่ต้องมีหนังสือมอบอำนาจ');
  check(jur.find((r) => r.id === 'license')?.level === 'recommended' && jur.find((r) => r.id === 'license')!.reason.includes('กฎจำลอง'), 'หมวดอาหาร → แนะนำหลักฐานการขออนุญาตผลิตภัณฑ์ (ระบุว่าเป็นกฎจำลอง)');
  check(!jur.find((r) => r.id === 'identity')?.satisfiedBy, 'ยังไม่ยืนยันตัวตน → รายการยืนยันตัวตนยังไม่ครบ');
  const imp = VR.documentRequirements({ businessType: 'individual', category: 'ความงามและสุขภาพ', kycVerified: true, marketplaceImported: true });
  check(!!imp.find((r) => r.id === 'contact')?.satisfiedBy && imp.some((r) => r.id === 'license'), 'นำเข้าจาก Marketplace แล้ว → หลักฐานช่องทางขายครบ · หมวดความงาม → แนะนำหลักฐานจดแจ้ง');
  const c1 = VR.checkDocuments(jur, [doc('หนังสือรับรองนิติบุคคล')]);
  check(c1.missingRequired.map((r) => r.id).sort().join() === 'authorization,identity', 'ตรวจเอกสาร: ขาดหนังสือมอบอำนาจ (และยังไม่ยืนยันตัวตน)');
  check(VR.checkDocuments(jur, [doc('หนังสือรับรองนิติบุคคล'), doc('หนังสือมอบอำนาจ')]).missingRequired.filter((r) => r.kinds.length).length === 0, 'แนบครบ → ไม่มีเอกสารบังคับที่ขาด');
  check(VR.LICENSE_DISCLAIMER.includes('ต้องได้รับการตรวจสอบจากหน่วยงานที่เกี่ยวข้อง'), 'มีข้อความว่าข้อกำหนดจริงต้องตรวจกับหน่วยงานที่เกี่ยวข้อง');
  check(VR.dbdMockStatus('DEMO-0105569000123') === 'verified_simulation' && VR.dbdMockStatus('0105569000123') === 'invalid_format' && VR.dbdMockStatus('') === 'missing' && VR.DBD_LABEL.verified_simulation.includes('ไม่ได้ตรวจกับ DBD จริง'), 'Mock DBD: ตรวจรูปแบบเท่านั้น และระบุว่าไม่ได้ตรวจกับ DBD จริง');
  const ref = VR.maskRef('MID-2569-004821');
  check(ref.includes('****') && ref.endsWith('4821') && !ref.includes('2569'), `Mock Reference ปิดบังบางส่วน (${ref}) — ไม่ใช่เลขบัตรจริง`);
}

describe('Verification Summary — บุคคลธรรมดา / นิติบุคคล / ความเป็นเจ้าของร้าน');
{
  const m1 = merchants().find((m) => m.id === 'M-001')!;
  const op1 = S.useOperatorStore.getState().items.find((o) => o.id === m1.operatorId)!;
  const s1 = VR.verificationSummary(m1, op1, S.useMarketplaceStore.getState().items);
  check(s1.find((x) => x.id === 'identity')?.state === 'verified_simulation' && s1.find((x) => x.id === 'ownership')?.state === 'verified_simulation', 'M-001: ตัวตนผ่าน (จำลอง) · เจ้าของร้านตรงกันทั้ง Shopee และ Lazada');
  const jur = { ...m1, id: 'X', businessType: 'juristic' as const, juristic: { companyName: 'บริษัท ทดสอบ จำกัด', registrationNo: 'DEMO-0105569000123', companyType: 'บริษัทจำกัด', authorizedPerson: 'คุณ ก', applicantName: 'คุณ ข' }, documents: [doc('หนังสือรับรองนิติบุคคล')] };
  const s2 = VR.verificationSummary(jur, op1, []);
  check(s2.find((x) => x.id === 'business')?.state === 'verified_simulation' && s2.find((x) => x.id === 'representative')?.state === 'missing' && s2.find((x) => x.id === 'ownership')?.state === 'not_required', 'นิติบุคคล: DBD จำลองผ่าน · ขาดหนังสือมอบอำนาจ · ไม่มี Marketplace = ไม่จำเป็น (ไม่ใช่ผลลบ)');
}

// ------------------------------------------------------------------ Path B: Self-Registration → Assessment (ไม่ถูกหักเพราะไม่มี Marketplace)
describe('Path B — Self-Registration ใช้ Merchant/Assessment Workflow กลาง');
asMerchant('OP-012');
const self = actAs('merchant', () => W.submitShopRegistration('OP-012', baseForm(), { draftId: 'DRF-SELF-1' }));
const SID = self.merchant.id;
{
  const b = badge(SID)!;
  const a = V.latestAssessment(SID)!;
  check(!!b && b.status === 'insufficient' && b.route === 'AUTO_REQUEST_INFO' && a.origin === 'automation', 'ส่งคำขอแล้วระบบประเมินอัตโนมัติ → Insufficient Data · ร้านเพิ่มข้อมูลเอง');
  check(a.result.band === 'insufficient' && a.result.scoreBand !== undefined && a.result.components.filter((c) => ['C2', 'C3', 'C4'].includes(c.id)).every((c) => !c.available && c.effectiveWeight === 0), 'ไม่มี Marketplace → C2–C4 ไม่นับ (ไม่ใช่ศูนย์) ไม่ได้ Band ลบ');
  check(tasks(SID).length === 0 && S.useVerificationStore.getState().items.find((x) => x.id === self.app.id)!.status === 'submitted' && !S.useCertificationStore.getState().items.some((c) => c.merchantId === SID), 'ไม่สร้างงานเจ้าหน้าที่ · คำขอยังรอเจ้าหน้าที่ · ไม่มีใบรับรองอัตโนมัติ');
  check(merchants().find((m) => m.id === SID)!.identityDocType === 'id_card', 'บันทึกประเภทเอกสารยืนยันตัวตน (ไม่เก็บเลขเอกสาร)');
  const page = view('/m/trust', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: SID });
  check(page.includes('ไม่ถูกหักคะแนน') && page.includes('Insufficient Data'), 'ร้านเห็นคำแนะนำ: ไม่มี Marketplace ไม่ถูกหักคะแนน');
  const nM = merchants().length, nA = S.useVerificationStore.getState().items.length, nRuns = S.useAutomationRunStore.getState().items.length;
  const again = actAs('merchant', () => W.submitShopRegistration('OP-012', baseForm(), { draftId: 'DRF-SELF-1' }));
  check(again.duplicate && again.merchant.id === SID && merchants().length === nM && S.useVerificationStore.getState().items.length === nA && S.useAutomationRunStore.getState().items.length === nRuns, 'ส่งซ้ำ/Refresh จากฉบับร่างเดิม → ไม่สร้างร้าน คำขอ หรือการประมวลผลซ้ำ');
}

// ------------------------------------------------------------------ 4.1 Self-Registration → Connect Marketplace Later
describe('Multi-Platform 4.1 — ร้านที่สมัครเองเชื่อม Marketplace ภายหลัง (Merchant เดิม)');
{
  const nM = merchants().length;
  const before = badge(SID)!;
  const c = actAs('merchant', () => V.connectMarketplace(SID, 'shopee', 'established_good'));
  actAs('merchant', () => V.grantConsent(c.id));
  V.completeSync(c.id, true);
  const after = badge(SID)!;
  check(merchants().length === nM && conns(SID).length === 1 && conns(SID)[0].merchantId === SID, 'เชื่อม Shopee เป็นช่องทางของร้านเดิม — ไม่สร้างร้านหรือบัญชีใหม่');
  check(after.coverage > before.coverage && after.route === 'AUTO_PASS' && after.status === 'active' && after.history[0].trigger === 'import', `Coverage เพิ่ม (${before.coverage}% → ${after.coverage}%) · ประเมินใหม่อัตโนมัติ · Badge อัปเดต`);
  check(VR.ownershipOf(conns(SID)[0]) === 'matched', 'ความเป็นเจ้าของร้าน: ชื่อเจ้าของตรงกับผู้ยืนยันตัวตน (จำลอง)');
  // 4.2 เพิ่ม Lazada ภายใต้ Merchant เดียว · เชื่อมแพลตฟอร์มเดิมซ้ำได้การเชื่อมต่อเดิม
  const l = actAs('merchant', () => V.connectMarketplace(SID, 'lazada', 'growing_ok'));
  actAs('merchant', () => V.grantConsent(l.id));
  V.completeSync(l.id, true);
  const dup = actAs('merchant', () => V.connectMarketplace(SID, 'shopee', 'established_good'));
  check(conns(SID).length === 2 && dup.id === c.id, 'Multi-Platform 4.2: Shopee + Lazada ภายใต้ร้านเดียว · เชื่อม Shopee ซ้ำได้การเชื่อมต่อเดิม (ไม่ซ้ำ)');
  check(conns(SID).every((x) => x.platform && x.mockShopId && x.status && x.lastSyncAt && x.sourceCategory && VR.ownershipOf(x)), 'ทุก Connection มี Platform · Shop ID · สถานะ · ซิงก์ล่าสุด · หมวดต้นฉบับ (Provenance) · สถานะความเป็นเจ้าของ');
  check(V.latestAssessment(SID)!.result.dataSources.slice().sort().join() === 'lazada,shopee', 'ผลประเมินใช้ข้อมูลทั้งสองแพลตฟอร์ม');
}

// ------------------------------------------------------------------ 4.3 Duplicate & Ownership Prevention
describe('Multi-Platform 4.3 — ป้องกัน Shop ID ซ้ำและการอ้างความเป็นเจ้าของ');
{
  const target = conns(SID).find((c) => c.platform === 'shopee')!;
  check(V.shopClaim('shopee', target.mockShopId, 'M-999')?.merchantId === SID && !V.shopClaim('shopee', target.mockShopId, SID), 'ตรวจได้ว่า Shop ID นี้เชื่อมกับร้านใดอยู่แล้ว (เทียบ Shop ID ไม่ใช่ชื่อร้าน)');
  // ผู้ประกอบการอีกรายสมัครร้านใหม่ด้วย Shop ID เดียวกัน → ไม่รวมร้าน แต่ส่งเจ้าหน้าที่ตรวจความเป็นเจ้าของ
  asMerchant('OP-013');
  const src = AF.buildImportSource({ key: 'CLAIM-1', platform: 'shopee', archetype: 'established_good', seed: 777, mockShopId: target.mockShopId, shopName: 'ร้านทดสอบสมัครเอง', category: 'หัตถกรรมและของที่ระลึก' });
  const r = actAs('merchant', () => V.submitMarketplaceRegistration('OP-013', baseForm({ ownerName: 'ผู้อ้างสิทธิ์', email: 'claim@example.com' }), { draftId: 'DRF-CLAIM-1', source: src }));
  const CID = r.merchant.id;
  const cc = conns(CID)[0];
  check(CID !== SID && cc.ownershipConflict?.merchantId === SID && VR.ownershipOf(cc) === 'claimed_elsewhere', 'ร้านที่อ้าง Shop ID ซ้ำ: สร้างเป็นร้านแยก (ไม่รวมเพราะชื่อเหมือน) และบันทึกความขัดแย้งของความเป็นเจ้าของ');
  const t = tasks(CID);
  check(t.length === 1 && t[0].category === 'identity_mismatch' && t[0].title.includes('ถูกอ้างโดยร้านอื่น') && badge(CID)!.status === 'under_review', 'ส่งเจ้าหน้าที่ตาม Exception Rules (งานเดียว) · Badge ไม่แสดงระหว่างตรวจ');
  check(tasks(SID).length === 0 && badge(SID)!.status === 'active', 'ร้านที่เชื่อมอยู่ก่อนไม่ได้รับผลกระทบ');
  AU.processAll('simulation');
  check(tasks(CID).length === 1, 'Run Simulation ซ้ำ → ไม่สร้างงานซ้ำ');
  asOfficer();
  check(actAs(['officer', 'admin'], () => AU.resolveTask(t[0].id, 'reject', 'ร้านนี้เป็นของผู้ประกอบการที่เชื่อมอยู่ก่อน')).ok && VR.ownershipOf(conns(CID)[0]) === 'rejected' && badge(CID)!.status !== 'active', 'เจ้าหน้าที่ไม่อนุมัติ → ข้อมูลร้านนั้นไม่ถูกใช้ประเมินร้านที่อ้าง');
  const page = view(`/o/applications/${r.app.id}`, { role: 'officer', officerId: 'OF-001' });
  check(page.includes('สรุปการตรวจสอบผู้ประกอบการ (จำลอง)') && page.includes('ความเป็นเจ้าของร้านบน Marketplace'), 'หน้าคำขอของเจ้าหน้าที่แสดงสรุปการตรวจสอบรวมความเป็นเจ้าของร้าน');
}

// ------------------------------------------------------------------ Raw Data Protection + Engine unchanged
describe('Data Provenance — Raw Marketplace Data อ่านอย่างเดียว · Trust Model v2.1 ไม่เปลี่ยน');
{
  asMerchant('OP-012');
  const c = conns(SID).find((x) => x.platform === 'shopee')!;
  const snapBefore = JSON.stringify(V.latestAssessment(SID)!.result.analysis);
  const m = merchants().find((x) => x.id === SID)!;
  actAs('merchant', () => V.confirmProfileUpdate(c.id, { ...V.registeredValues(m), description: 'คำอธิบายใหม่จากการแก้โปรไฟล์ร้านเพื่อทดสอบการแยกข้อมูล' }, 'DRF-RAW-1'));
  check(JSON.stringify(V.latestAssessment(SID)!.result.analysis) === snapBefore, 'แก้โปรไฟล์ร้าน → คะแนน รีวิว ยอดขาย ราคา (Snapshot) ไม่เปลี่ยน');
  check(JSON.stringify(MODEL.MODEL_V2.weights) === JSON.stringify(seed.assessments()[0].result.weights) && MODEL.MODEL_V2.version === 'v2.1-sim', 'Trust Assessment Engine v2.1 และน้ำหนักเดิม (ไม่เปลี่ยนสูตร)');
  check(['imported', 'user_edited', 'manual', 'missing', 'verification_required', 'source_verified'].every((k) => k in AF.FIELD_STATUS_LABEL), 'สถานะที่มาของข้อมูลครบ: นำเข้า / แก้ไข / กรอกเอง / ขาด / รอตรวจ / ตรวจอัตโนมัติ');
}

// ------------------------------------------------------------------ KYC → Assessment → Badge
describe('KYC → Assessment → Badge (Identity Dimension)');
{
  const kycFactor = () => V.latestAssessment(SID)!.result.components.find((c) => c.id === 'C1')!.factors.find((f) => f.id === 'c1.kyc')!;
  W.setKycResult('OP-012', false);
  check(kycFactor().value === 'ยังไม่ยืนยัน' && kycFactor().impact === 0 && badge(SID)!.route === 'AUTO_REQUEST_INFO' && badge(SID)!.history[0].trigger === 'identity_change', 'ผลยืนยันตัวตนไม่ผ่าน → ประเมินใหม่ (C1 ไม่ได้คะแนน KYC) · ร้านยืนยันตัวตนเอง (AUTO_REQUEST_INFO)');
  check(tasks(SID).length === 0, 'ยังไม่ยืนยันตัวตนไม่ใช่เหตุส่งเจ้าหน้าที่');
  W.setKycResult('OP-012', true);
  check(kycFactor().value === 'ยืนยันแล้ว' && kycFactor().impact > 0 && badge(SID)!.status === 'active' && badge(SID)!.history[0].trigger === 'identity_change', 'ยืนยันตัวตนสำเร็จ → C1 ใช้สถานะ KYC ล่าสุด · Badge กลับมาแสดง');
}

// ------------------------------------------------------------------ Badge contents + cross-view
describe('Assessment Badge — เนื้อหาและความสอดคล้องทุกมุมมอง');
{
  const c = view(`/shop/${SID}`, { role: 'consumer' });
  const name = merchants().find((m) => m.id === SID)!.shopName;
  check(c.includes('Trust Assessment Badge') && c.includes(name) && c.includes('Coverage') && c.includes('แหล่งข้อมูล') && c.includes('ตรวจสอบสถานะ Badge') && c.includes('ไม่ใช่การรับรอง'), 'ผู้บริโภคเห็น Badge: ชื่อร้าน Band Coverage Confidence วันที่ แหล่งข้อมูล ลิงก์ตรวจสอบ และข้อความว่าไม่ใช่การรับรอง');
  check(!/คะแนนภายใน|AUTO_PASS|TSK-/.test(c), 'ไม่แสดงคะแนนภายใน เส้นทางระบบ หรืองานเจ้าหน้าที่ต่อผู้บริโภค');
  const shop = view('/m/shop', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: SID });
  check(shop.includes('การตรวจสอบผู้ประกอบการ (จำลอง)') && shop.includes('เพิ่มช่องทางขาย (Marketplace)') && shop.includes('ไม่ได้ตรวจกับ DBD'), 'หน้าร้านค้า: สรุปการตรวจสอบ + ทางเข้าเพิ่มช่องทางขาย + ระบุว่าเป็นการตรวจจำลอง');
  const mp = view('/m/marketplace', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: SID });
  check(mp.includes('ความเป็นเจ้าของร้าน') && mp.includes('ที่มาของข้อมูล'), 'หน้าการเชื่อมต่อแสดงที่มาของข้อมูลและความเป็นเจ้าของร้าน');
}

// ------------------------------------------------------------------ Final Release Validation
describe('Release Validation — นิติบุคคลสมัครเอง · ID ไม่ซ้ำทุก Store · Badge ถูกระงับ/เพิกถอนไม่แสดงทุกมุมมอง');
{
  asMerchant('OP-013');
  const jForm = baseForm({
    businessType: 'juristic', ownerName: 'คุณ ข ผู้แทน', shopName: 'บริษัท ทดสอบนิติบุคคล จำกัด', category: 'อาหารและเครื่องดื่ม', email: 'juristic@example.com',
    juristic: { companyName: 'บริษัท ทดสอบนิติบุคคล จำกัด', registrationNo: 'DEMO-0105569000999', companyType: 'บริษัทจำกัด', authorizedPerson: 'คุณ ก กรรมการ', applicantName: 'คุณ ข ผู้แทน' },
    documents: [doc('หนังสือรับรองนิติบุคคล'), doc('หนังสือมอบอำนาจ')],
  } as never);
  const j = actAs('merchant', () => W.submitShopRegistration('OP-013', jForm, { draftId: 'DRF-JUR-REL' }));
  const jm = merchants().find((m) => m.id === j.merchant.id)!;
  const jop = S.useOperatorStore.getState().items.find((o) => o.id === jm.operatorId)!;
  const js = VR.verificationSummary(jm, jop, S.useMarketplaceStore.getState().items);
  check(jm.businessType === 'juristic' && js.find((x) => x.id === 'business')?.state === 'verified_simulation' && js.find((x) => x.id === 'representative')?.state !== 'missing', 'นิติบุคคลสมัครเอง: Mock DBD ผ่าน (จำลอง) · แนบหนังสือมอบอำนาจแล้ว → ผู้แทนไม่ขาด');
  check(badge(jm.id)?.status === 'insufficient' && !S.useCertificationStore.getState().items.some((c) => c.merchantId === jm.id), 'นิติบุคคลไม่มี Marketplace → Insufficient Data (ไม่ใช่ผลลบ) · ไม่มีใบรับรองอัตโนมัติ');

  // ID ต้องไม่ซ้ำในทุก Store หลังทุก Flow ข้างต้น (สมัครเอง · เชื่อมภายหลัง · หลายแพลตฟอร์ม · อ้าง Shop ID ซ้ำ · นิติบุคคล)
  const dupIds = (name: string, ids: string[]) => {
    const d = ids.filter((id, i) => ids.indexOf(id) !== i);
    check(d.length === 0, `${name}: ID ไม่ซ้ำ (${ids.length} รายการ)${d.length ? ' — ซ้ำ: ' + d.join(',') : ''}`);
  };
  dupIds('Merchant', merchants().map((m) => m.id));
  dupIds('Registration/Verification Application', S.useVerificationStore.getState().items.map((a) => a.id));
  dupIds('Marketplace Connection', S.useMarketplaceStore.getState().items.map((c) => c.id));
  dupIds('Trust Assessment', S.useAssessmentStore.getState().items.map((a) => a.id));
  dupIds('Officer Task', S.useOfficerTaskStore.getState().items.map((t) => t.id));
  check(new Set(S.useAssessmentBadgeStore.getState().items.map((b) => b.merchantId)).size === S.useAssessmentBadgeStore.getState().items.length, 'Assessment Badge: ร้านละ 1 รายการ');
  const active = S.useMarketplaceStore.getState().items.filter((c) => c.status !== 'disconnected');
  const pairs = active.map((c) => `${c.merchantId}|${c.platform}`);
  check(new Set(pairs).size === pairs.length, 'ร้านหนึ่งมีการเชื่อมต่อที่ใช้งานอยู่ได้แพลตฟอร์มละ 1 รายการ');

  // ใบรับรองถูกระงับ / เพิกถอน → ไม่มี Badge ที่มีผลในทุกมุมมอง
  for (const st of ['suspended', 'revoked'] as const) {
    S.useCertificationStore.setState({ items: [...S.useCertificationStore.getState().items.filter((c) => c.merchantId !== SID), { ...(S.useCertificationStore.getState().items[0] as any), id: `CERT-REL-${st}`, merchantId: SID, status: st }] });
    AU.processMerchant(SID, 'measure_change');
    const b = badge(SID)!;
    const consumer = view(`/shop/${SID}`, { role: 'consumer' });
    const merchantV = view('/m/trust', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: SID });
    check(b.status === st && !consumer.includes('ตรวจสอบสถานะ Badge') && /ไม่แสดง|ระงับ|เพิกถอน/.test(merchantV), `ใบรับรอง ${st} → Badge ${b.status} · ผู้บริโภคไม่เห็น Badge ที่มีผล · ร้านเห็นสถานะ`);
  }
}

finish();
