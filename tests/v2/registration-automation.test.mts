/** Automation First — ลงทะเบียนร้านค้า: AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW · เจ้าหน้าที่ตรวจเฉพาะกรณี · ลงทะเบียน ≠ ใบรับรอง ≠ Badge */
import { S, W, view, describe, check, finish, actAs, asOwner } from '../harness.mts';
import { integrityProblems } from '../integrity.mts';

const V = await import('@/stores/workflowsV2');
const AU = await import('@/stores/automation');
const { decideRegistration } = await import('@/features/automation/registration');
const { CERTIFICATION_POLICY } = await import('@/features/automation/policy');
const { MODEL_V2 } = await import('@/features/trust-assessment/model');
const { findScenario } = await import('@/mock/scenarios');
const { buildImportSource } = await import('@/features/marketplace/autofill');

const O = { role: 'officer' as const, officerId: 'OF-001' };
const app = (id: string) => S.useVerificationStore.getState().items.find((a) => a.id === id)!;
const merchant = (id: string) => S.useMerchantStore.getState().items.find((m) => m.id === id)!;
const certOf = (mid: string) => S.useCertificationStore.getState().items.filter((c) => c.merchantId === mid);
const officerNotes = () => S.useNotificationStore.getState().items.filter((n) => n.recipientRole === 'officer');
const doc = (name: string) => ({ id: `d-${name}`, name: `${name}.pdf`, kind: 'ทะเบียนพาณิชย์', sizeKb: 10, addedAt: new Date().toISOString() });
const form = (over: Record<string, unknown> = {}) => ({
  businessType: 'individual' as const, ownerName: 'ผู้ทดสอบ อัตโนมัติ', shopName: 'ร้านทดสอบอัตโนมัติ', category: 'บริการ', province: 'เชียงใหม่', district: 'เมือง',
  phone: '0812345678', email: 'auto@demo.local', description: 'ร้านทดสอบการตรวจคำขอลงทะเบียนอัตโนมัติ', channels: [{ type: 'facebook' as const, handle: 'auto.demo' }],
  documents: [doc('ทะเบียนพาณิชย์')], ...over,
});
const integrity = (label: string) => {
  const p = integrityProblems();
  check(p.length === 0, `ข้อมูลสอดคล้องกันหลัง ${label}${p.length ? ' — ' + p.slice(0, 3).join(' | ') : ''}`);
};

// ---------------------------------------------------------------- pure rules
describe('กฎการตรวจคำขอลงทะเบียน (Pure Function)');
check(decideRegistration({ kycVerified: true, documents: 1, channels: 1 }).route === 'AUTO_PASS', 'ข้อมูลครบ ไม่พบความผิดปกติ → AUTO_PASS');
const miss = decideRegistration({ kycVerified: false, documents: 0, channels: 0 });
check(miss.route === 'AUTO_REQUEST_INFO' && miss.reasons.length === 3, 'ไม่ยืนยันตัวตน / ไม่มีเอกสาร / ไม่มีช่องทางขาย → AUTO_REQUEST_INFO พร้อมเหตุผลครบ 3 ข้อ');
check(decideRegistration({ kycVerified: false, documents: 0, channels: 0, identityFlag: 'ตัวตนซ้ำ' }).route === 'MANUAL_REVIEW', 'ความผิดปกติมาก่อนข้อมูลไม่ครบ → MANUAL_REVIEW');
check(decideRegistration({ kycVerified: true, documents: 1, channels: 1, ownershipIssues: ['เจ้าของไม่ตรง'] }).route === 'MANUAL_REVIEW', 'เจ้าของร้านบน Marketplace ไม่ตรง → MANUAL_REVIEW');

// ---------------------------------------------------------------- AUTO_PASS (manual registration)
describe('AUTO_PASS — ลงทะเบียนเอง ข้อมูลครบ: ไม่ต้องให้เจ้าหน้าที่กดอนุมัติ');
W.resetAllDemoData();
S.useSessionStore.setState({ role: 'merchant', operatorId: 'OP-012', merchantLoggedIn: true });
const notesBefore = officerNotes().length;
const tasksBefore = S.useOfficerTaskStore.getState().items.length;
const p1 = asOwner('OP-012', () => W.submitShopRegistration('OP-012', form(), { draftId: 'DRF-AUTO-1' }));
check(p1.app.status === 'approved' && p1.app.autoDecision?.route === 'AUTO_PASS' && p1.merchant.registrationStatus === 'approved', `ร้าน ${p1.merchant.id} ผ่านอัตโนมัติ — คำขอ ${p1.app.id} approved (AUTO_PASS)`);
check(p1.app.timeline.some((t) => t.actor === 'system' && t.title.includes('AUTO_PASS')) && !p1.app.assignedOfficerId, 'Timeline บันทึกว่าระบบเป็นผู้ตรวจ (ไม่มีเจ้าหน้าที่ผู้รับผิดชอบ)');
check(officerNotes().length === notesBefore && S.useOfficerTaskStore.getState().items.length === tasksBefore, 'ไม่แจ้งเตือน ไม่สร้างงานเจ้าหน้าที่ (Officer ไม่อยู่ใน Normal Flow)');
check(certOf(p1.merchant.id).length === 0, 'ไม่ออกใบรับรอง — การลงทะเบียนไม่ใช่การรับรอง');
const badge1 = S.useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === p1.merchant.id);
check(!!badge1 && badge1.status === 'insufficient', `ประเมินอัตโนมัติทันที — ไม่มีข้อมูล Marketplace → ${badge1?.status} (ไม่แสดง Badge) แยกจากสถานะลงทะเบียน`);
check(!view('/o/exceptions', O).includes(p1.app.id), 'Exception Queue ไม่มีคำขอที่ผ่านอัตโนมัติ');
check(view('/m/shop', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: p1.merchant.id }).includes('ผ่านการตรวจสอบอัตโนมัติ'), 'ร้านค้าเห็นผลการตรวจอัตโนมัติ');
check(view(`/o/applications/${p1.app.id}`, O).includes('AUTO_PASS') && view(`/o/applications/${p1.app.id}`, O).includes('ไม่ออกใบรับรอง'), 'หน้าคำขอ (เจ้าหน้าที่) แสดงผลการตรวจอัตโนมัติและระบุว่าไม่ออกใบรับรอง');
const dup = asOwner('OP-012', () => W.submitShopRegistration('OP-012', form(), { draftId: 'DRF-AUTO-1' }));
check(!!dup.duplicate && dup.app.id === p1.app.id && S.useMerchantStore.getState().items.filter((m) => m.operatorId === 'OP-012').length === 1, 'ส่งซ้ำจากฉบับร่างเดิม → คืนคำขอเดิม ไม่ตรวจซ้ำหรือสร้างร้านซ้ำ');
integrity('AUTO_PASS');

// ---------------------------------------------------------------- AUTO_REQUEST_INFO
describe('AUTO_REQUEST_INFO — ข้อมูลไม่ครบ: ส่งกลับให้ร้านค้าแก้ไขเอง');
const p2 = asOwner('OP-012', () => W.submitShopRegistration('OP-012', form({ shopName: 'ร้านยังไม่แนบเอกสาร', documents: [] }), { draftId: 'DRF-AUTO-2' }));
check(p2.app.status === 'need_info' && p2.app.autoDecision?.route === 'AUTO_REQUEST_INFO' && p2.merchant.registrationStatus === 'need_info', `คำขอ ${p2.app.id} ส่งกลับให้ร้านค้า (AUTO_REQUEST_INFO)`);
check(!!p2.app.infoRequest?.includes('เอกสาร') && S.useNotificationStore.getState().items.some((n) => n.recipientId === 'OP-012' && n.title.includes('ต้องเพิ่มข้อมูล')), 'ร้านค้าได้รับแจ้งว่าต้องเพิ่มอะไร');
check(officerNotes().length === notesBefore && !view('/o/exceptions', O).includes(p2.app.id), 'ไม่เข้าคิวเจ้าหน้าที่');
check(view('/m/shop', { role: 'merchant', operatorId: 'OP-012', activeMerchantId: p2.merchant.id }).includes('ระบบขอข้อมูลเพิ่มเติม'), 'หน้าร้านค้าแสดงว่า "ระบบ" ขอข้อมูล (ไม่ใช่เจ้าหน้าที่)');
asOwner(p2.app.id, () => W.resubmitApplication(p2.app.id, 'แนบเอกสารแล้ว', [doc('แนบภายหลัง')]));
check(app(p2.app.id).status === 'approved' && app(p2.app.id).autoDecision?.route === 'AUTO_PASS' && officerNotes().length === notesBefore, 'ร้านแก้แล้วส่งใหม่ → ระบบตรวจใหม่อัตโนมัติ ผ่าน (ไม่ต้องรอเจ้าหน้าที่)');
integrity('AUTO_REQUEST_INFO');

// ---------------------------------------------------------------- MANUAL_REVIEW (identity anomaly)
describe('MANUAL_REVIEW — ตัวตนซ้ำกับร้านที่ถูกระงับ/เพิกถอน: เจ้าหน้าที่ตรวจเฉพาะกรณี');
S.useSessionStore.setState({ role: 'merchant', operatorId: 'OP-008' });
const p3 = asOwner('OP-008', () => W.submitShopRegistration('OP-008', form({ shopName: 'ร้านเปิดใหม่ของเจ้าของเดิม' }), { draftId: 'DRF-AUTO-3' }));
check(p3.app.status === 'pending_review' && p3.app.autoDecision?.route === 'MANUAL_REVIEW' && !!p3.merchant.identityFlag, `คำขอ ${p3.app.id} → MANUAL_REVIEW (ไม่ปฏิเสธอัตโนมัติ)`);
check(officerNotes().some((n) => n.link === `/o/applications/${p3.app.id}`), 'แจ้งเจ้าหน้าที่พร้อมลิงก์ไปที่คำขอ');
const q = view('/o/exceptions', O);
check(q.includes(p3.app.id) && q.includes('คำขอลงทะเบียน — กรณียกเว้น'), 'อยู่ใน Exception Queue พร้อมเหตุผลที่ระบบส่งตรวจ');
check(actAs(['officer', 'admin'], () => W.approveApplication(p3.app.id)).ok && merchant(p3.merchant.id).registrationStatus === 'approved' && certOf(p3.merchant.id).length === 0, 'เจ้าหน้าที่อนุมัติกรณียกเว้น → ลงทะเบียนแล้ว (ยังไม่ออกใบรับรอง)');
integrity('MANUAL_REVIEW identity');

// ---------------------------------------------------------------- MANUAL_REVIEW (Marketplace ownership) → officer confirms → automatic re-check
describe('MANUAL_REVIEW — เจ้าของร้านบน Marketplace ไม่ตรง → เจ้าหน้าที่ยืนยันแล้วระบบตรวจคำขอใหม่อัตโนมัติ');
W.resetAllDemoData();
S.useSessionStore.setState({ role: 'merchant', operatorId: 'OP-013', merchantLoggedIn: true });
const prof = V.mockShopProfile('OP-013', 'lazada');
const srcBad = buildImportSource({ key: 'REG-OWN', platform: 'lazada', archetype: 'owner_mismatch', seed: 777, mockShopId: prof.mockShopId, shopName: prof.shopName, category: prof.category });
const p4 = asOwner('OP-013', () => V.submitMarketplaceRegistration('OP-013', form({ shopName: prof.shopName, category: prof.category, channels: [] }), { draftId: 'DRF-AUTO-4', source: srcBad }));
check(p4.app.status === 'pending_review' && p4.app.autoDecision?.route === 'MANUAL_REVIEW' && p4.app.autoDecision.reasons.some((r) => r.includes('เจ้าของ')), `คำขอ ${p4.app.id} → MANUAL_REVIEW (ชื่อเจ้าของร้านบน Marketplace ไม่ตรง)`);
check(!p4.app.autoDecision!.reasons.some((r) => r.includes('ช่องทางขาย')), 'ร้านบน Marketplace นับเป็นช่องทางขาย (ไม่ส่งกลับเพราะไม่มีช่องทาง)');
const idTask = S.useOfficerTaskStore.getState().items.find((t) => t.merchantId === p4.merchant.id && t.category === 'identity_mismatch' && t.status === 'open');
check(!!idTask, `ระบบสร้างงาน Identity Mismatch ใน Exception Queue (${idTask?.id})`);
check(actAs(['officer', 'admin'], () => AU.resolveTask(idTask!.id, 'approve', 'ตรวจเอกสารแล้วเป็นร้านของผู้สมัครจริง')).ok, 'เจ้าหน้าที่ยืนยันเจ้าของร้าน');
check(app(p4.app.id).status === 'approved' && app(p4.app.id).autoDecision?.route === 'AUTO_PASS' && certOf(p4.merchant.id).length === 0, 'ระบบตรวจคำขอใหม่อัตโนมัติ → ผ่านการลงทะเบียน (ไม่ต้องกดอนุมัติคำขอซ้ำ · ไม่ออกใบรับรอง)');
integrity('MANUAL_REVIEW ownership');

// ---------------------------------------------------------------- separation of states & policy unchanged
describe('ลงทะเบียน ≠ ผลประเมิน ≠ Badge ≠ ใบรับรอง · นโยบายและโมเดลเดิม');
const l2 = CERTIFICATION_POLICY.find((p) => p.level === 2)!;
check(l2.mode === 'officer_approval' && l2.autoApprovalAuthorized === false, 'Certification Policy: Level 2 ยังต้องให้เจ้าหน้าที่อนุมัติ (ไม่เปลี่ยน)');
const req = asOwner(p4.merchant.id, () => W.applyCertification(p4.merchant.id, 2));
check(req.type === 'certification' && req.requestedLevel === 2 && !req.autoDecision && certOf(p4.merchant.id).length === 0, 'ยื่นขอ Level 2 → เป็นคำขอรับรองที่รอเจ้าหน้าที่ (ไม่อนุมัติอัตโนมัติ)');
check(view('/o/exceptions', O).includes(req.id), 'คำขอรับรองอยู่ในคิวเจ้าหน้าที่ (อำนาจอนุมัติ)');
check(MODEL_V2.version === 'v2.1-sim' && JSON.stringify(MODEL_V2.weights) === JSON.stringify({ C1: 25, C2: 25, C3: 20, C4: 10, C5: 20 }) && JSON.stringify(MODEL_V2.bands) === JSON.stringify({ A: 80, B: 65, C: 50 }), 'Model v2.1-sim น้ำหนัก และ Threshold ไม่เปลี่ยน');

// ---------------------------------------------------------------- demo scenarios
describe('Demo — กรณีปกติไม่มีขั้นตอนเจ้าหน้าที่ · กรณียกเว้นแยกเป็น Scenario 15');
for (const id of ['s9a', 's9b', 's14']) {
  const s = findScenario(id)!;
  check(!s.steps.some((st) => st.role === 'officer') && !s.audience.includes('officer'), `Scenario ${id.slice(1).toUpperCase()}: ไม่มีขั้นตอนหรือบทบาทเจ้าหน้าที่ในกรณีปกติ`);
}
check(findScenario('s15')!.steps.some((st) => st.role === 'officer'), 'Scenario 15 (กรณียกเว้น) ยังมีขั้นตอนเจ้าหน้าที่');
const s2 = findScenario('s2')!;
const ids = s2.steps.map((st) => st.id);
check(ids.indexOf('s2-auto') === ids.indexOf('s2-submit') + 1 && ids.indexOf('s2-apply') === ids.indexOf('s2-auto') + 1 && s2.steps.filter((st) => st.role === 'officer').every((st) => ids.indexOf(st.id) > ids.indexOf('s2-apply')), 'Scenario 2: ลงทะเบียนผ่านอัตโนมัติ → ยื่นขอใบรับรอง → เจ้าหน้าที่ตรวจเฉพาะใบรับรอง');
const demo = view('/demo', { role: 'consumer', consumerId: 'CS-001' });
check(demo.includes('ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่') && demo.includes('เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ — ไม่ใช่ขั้นตอนของร้านค้าปกติ'), 'หน้า Demo ระบุว่าลงทะเบียนตรวจอัตโนมัติ และเจ้าหน้าที่ตรวจเฉพาะกรณีผิดปกติ');

finish();
