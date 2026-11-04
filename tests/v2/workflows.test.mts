/** v2 — Workflow: การเชื่อมต่อ Marketplace (จำลอง), Self-Registration, ประเมิน, ส่งพิจารณา และการตัดสินของเจ้าหน้าที่ */
import { S, W, check, describe, finish, storage } from '../harness.mts';
import { integrityProblems } from '../integrity.mts';

const V2 = await import('@/stores/workflowsV2');
const { useAssessmentConfigStore } = await import('@/stores/assessmentConfig');
const { validateWeights } = await import('@/features/trust-assessment/model');
const { seed } = await import('@/mock/data');

const conns = () => S.useMarketplaceStore.getState().items;
const conn = (id: string) => conns().find((c) => c.id === id)!;
const assessment = (id: string) => S.useAssessmentStore.getState().items.find((a) => a.id === id)!;
const certs = (m: string) => S.useCertificationStore.getState().items.filter((c) => c.merchantId === m);
const officer = () => S.useSessionStore.getState().set({ role: 'officer', officerId: 'OF-001' });
const merchantSession = (op: string) => S.useSessionStore.getState().set({ role: 'merchant', operatorId: op, merchantLoggedIn: true });

describe('ข้อมูลตั้งต้น v2');
check(conns().length === 13 && S.useAssessmentStore.getState().items.length === 10, 'มีการเชื่อมต่อตัวอย่าง 13 รายการ และผลประเมินตัวอย่าง 10 รายการ');
check(S.domainStores.length === 13, 'Store v2 รวมอยู่ใน domainStores (Reset / Export / Snapshot ครอบคลุม)');
check(integrityProblems().length === 0, `Integrity ผ่าน (รวม FK ของ Store v2)${integrityProblems().length ? ' — ' + integrityProblems().slice(0, 3).join(' | ') : ''}`);
check(JSON.stringify(seed.assessments()) === JSON.stringify(seed.assessments()), 'ผลประเมินตัวอย่างสร้างซ้ำได้ผลเดิมทุกไบต์');

describe('เชื่อมต่อ Marketplace (จำลอง)');
merchantSession('OP-003');
const auditBefore = S.useAuditStore.getState().items.length;
const c = V2.connectMarketplace('M-003', 'lazada', 'growing_ok');
check(c.status === 'pending_consent' && c.scopes.length === 0 && !c.lastSyncAt, 'เริ่มเชื่อมต่อ → รอความยินยอม (ยังไม่ดึงข้อมูล)');
check(V2.connectMarketplace('M-003', 'lazada').id === c.id, 'เชื่อมแพลตฟอร์มเดิมซ้ำ → ใช้การเชื่อมต่อเดิม (ไม่สร้างซ้ำ)');
V2.grantConsent(c.id);
check(conn(c.id).status === 'syncing' && conn(c.id).scopes.length === 5 && !!conn(c.id).consentAt, 'ให้ความยินยอม → กำลังซิงก์ พร้อมขอบเขตข้อมูล 5 ข้อ');
V2.completeSync(c.id, false);
check(conn(c.id).status === 'sync_failed' && !!conn(c.id).failReason, 'จำลองซิงก์ล้มเหลว → แสดงเหตุผล');
V2.resyncMarketplace(c.id);
V2.completeSync(c.id, true);
check(conn(c.id).status === 'connected' && !!conn(c.id).lastSyncAt, 'ซิงก์ใหม่สำเร็จ → เชื่อมต่อแล้ว');
check(S.useAuditStore.getState().items.length >= auditBefore + 3, 'บันทึก Audit ทุกขั้น');
check(S.useNotificationStore.getState().items.some((n) => n.recipientId === 'OP-003' && n.title.includes('Lazada (จำลอง)')), 'แจ้งเตือนร้านค้าเมื่อซิงก์สำเร็จ (ชื่อแพลตฟอร์มมี "(จำลอง)")');
const covBefore = V2.currentInputs('M-003')!.input.marketplace.length;
V2.disconnectMarketplace(c.id);
check(conn(c.id).status === 'disconnected' && V2.currentInputs('M-003')!.input.marketplace.length === covBefore - 1, 'ยกเลิกการเชื่อมต่อ → ข้อมูลแพลตฟอร์มนั้นไม่ถูกใช้ประเมิน');
check(V2.connectMarketplace('M-003', 'lazada').id !== c.id, 'เชื่อมต่อใหม่หลังยกเลิกได้ (สร้างการเชื่อมต่อใหม่)');

describe('ประเมินและส่งพิจารณา');
merchantSession('OP-001');
const n0 = S.useAssessmentStore.getState().items.length;
const a1 = V2.runAssessment('M-001')!;
check(a1.status === 'draft' && S.useAssessmentStore.getState().items.length === n0, 'ผลล่าสุดเป็นร่าง → ประเมินใหม่แทนที่ร่างเดิม (ไม่สร้างซ้ำ)');
const certsBefore = certs('M-001').length;
check(a1.result.recommendation.kind === 'consider_l4' && certs('M-001').length === certsBefore, 'ผลประเมินเสนอ Level 4 แต่ไม่ออกใบรับรองอัตโนมัติ (D3)');
S.useMerchantStore.getState().update('M-001', (m) => ({ channels: m.channels.map((ch, i) => (i === 0 ? { ...ch, status: 'rejected' as const } : ch)) }));
const stale = V2.submitAssessment(a1.id);
check(!stale.ok && stale.error.includes('ประเมินใหม่'), 'ข้อมูลเปลี่ยนหลังประเมิน → ส่งไม่ได้จนกว่าจะประเมินใหม่');
V2.runAssessment('M-001');
check(V2.submitAssessment(a1.id).ok && assessment(a1.id).status === 'pending_review', 'ประเมินใหม่แล้วส่งพิจารณาได้');
check(S.useNotificationStore.getState().items.some((n) => n.recipientRole === 'officer' && n.title.includes('ผลประเมินความน่าเชื่อถือรอพิจารณา')), 'แจ้งเตือนเจ้าหน้าที่');
check(!V2.submitAssessment(a1.id).ok, 'ส่งซ้ำไม่ได้');
const blocked = V2.runAssessment('M-008')!;
check(!V2.submitAssessment(blocked.id).ok, 'ร้านถูกเพิกถอน (Revoked) → ส่งพิจารณา Badge ไม่ได้ (D8)');
const n1 = S.useAssessmentStore.getState().items.length;
V2.runAssessment('M-001');
check(S.useAssessmentStore.getState().items.length === n1 + 1, 'ผลที่ส่งพิจารณาแล้วไม่ถูกแทนที่ — ประเมินใหม่สร้างรายการใหม่');

describe('เจ้าหน้าที่พิจารณา (Officer Review)');
officer();
const pending6 = S.useAssessmentStore.getState().items.find((a) => a.merchantId === 'M-006' && a.status === 'pending_review')!;
check(!V2.decideAssessment(pending6.id, 'approved', 'ok', 3).ok, 'เหตุผลสั้นเกินไป → ไม่บันทึก');
const unmet = V2.decideAssessment(pending6.id, 'approved', 'ผลประเมินดีและข้อมูลครบ', 3);
check(!unmet.ok && unmet.error.includes('เกณฑ์ v1') && certs('M-006').every((x) => x.level < 3), `ยังไม่ผ่านเกณฑ์ v1 → อนุมัติไม่ได้: ${unmet.ok ? '' : unmet.error.slice(0, 60)}…`);
W.reviewCorrection('WRN-2569-0006', 'start');
W.reviewCorrection('WRN-2569-0006', 'approve', 'ผ่าน');
const before6 = certs('M-006').length;
const ok6 = V2.decideAssessment(pending6.id, 'approved', 'ผลประเมินดีและผ่านเกณฑ์ v1 ครบ', 3);
const d6 = assessment(pending6.id).decision!;
const newCert = certs('M-006').find((x) => x.status === 'active');
check(ok6.ok && newCert?.level === 3 && certs('M-006').length === before6 + 1, 'ปิดคำเตือนแล้วอนุมัติ → ออกใบรับรอง Level 3 ผ่าน Workflow v1');
check(d6.kind === 'approved' && d6.certId === newCert?.id && !!d6.applicationId && d6.officerName.length > 0 && !d6.overridesRecommendation, '  บันทึกผู้พิจารณา ใบรับรอง คำขอ และไม่ถือว่าตัดสินต่างจากข้อเสนอ');
check(S.useVerificationStore.getState().items.find((x) => x.id === d6.applicationId)?.status === 'approved', '  คำขอรับรองที่สร้างขึ้นสถานะอนุมัติ');
check(S.useAuditStore.getState().items.some((x) => x.action === 'พิจารณาผลประเมินความน่าเชื่อถือ' && x.target === pending6.id), '  บันทึก Audit การพิจารณา');
check(!V2.decideAssessment(pending6.id, 'rejected', 'ตัดสินซ้ำ').ok, 'ตัดสินซ้ำไม่ได้');
check(!V2.decideAssessment(a1.id, 'approved', 'ร้านมีระดับ 3 อยู่แล้ว', 3).ok, 'อนุมัติระดับที่ร้านมีอยู่แล้วไม่ได้');
const rej = V2.decideAssessment(a1.id, 'need_info', 'ขอหลักฐานการยืนยันช่องทางขายเพิ่มเติม');
check(rej.ok && assessment(a1.id).decision!.overridesRecommendation, 'ตัดสินต่างจากข้อเสนอของระบบได้ (มีเหตุผล) และบันทึกว่าเป็นการตัดสินต่าง');
check(S.useNotificationStore.getState().items.some((n) => n.recipientId === 'OP-001' && n.title.includes('ขอข้อมูลเพิ่มเติม')), '  แจ้งร้านค้า');
merchantSession('OP-012');
const a2 = V2.runAssessment('M-012')!;
S.useAssessmentStore.getState().update(a2.id, { status: 'pending_review' }); // จำลองว่าส่งแล้ว (ร้านนี้ Standing ไม่ปกติ)
officer();
const riskBefore = S.useRiskStore.getState().items.length;
check(V2.decideAssessment(a2.id, 'escalated', 'พบราคาต่ำผิดปกติในสินค้าความเสี่ยงสูง ขอให้ร้านชี้แจง').ok && S.useRiskStore.getState().items.length === riskBefore + 1, 'ส่งพิจารณาความเสี่ยง → เปิดเรื่องใน Risk Review เดิม (v1)');
check(integrityProblems().length === 0, `Integrity ผ่านหลัง Workflow ทั้งหมด${integrityProblems().length ? ' — ' + integrityProblems().slice(0, 3).join(' | ') : ''}`);

describe('Self-Registration — นำเข้าข้อมูลจาก Marketplace (จำลอง)');
const op = W.registerOperator({ name: 'นำเข้า ทดสอบ', phone: '0896667777', email: 'import@demo.local', province: 'ชลบุรี', pin: '246810' });
W.setKycResult(op.id, true);
const profile = V2.mockShopProfile(op.id, 'shopee');
check(profile.shopName.startsWith('ร้าน') && profile.description.includes('Shopee (จำลอง)') && JSON.stringify(V2.mockShopProfile(op.id, 'shopee')) === JSON.stringify(profile), 'ข้อมูลร้านที่นำเข้า: เติมชื่อ หมวด รายละเอียด (ซ้ำได้ผลเดิม) และระบุแหล่งที่มาแบบจำลอง');
const { merchant: m } = W.submitShopRegistration(op.id, {
  businessType: 'individual', ownerName: op.name, shopName: profile.shopName, category: profile.category, province: 'ชลบุรี', district: 'เมือง', phone: op.phone, email: op.email,
  description: profile.description, channels: [{ type: 'marketplace', handle: profile.handle }],
  documents: [{ id: 'd-i', name: 'เอกสาร.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 1, addedAt: new Date().toISOString() }],
});
const attached = V2.attachImportedMarketplaces(m.id, [{ platform: 'shopee', archetype: 'growing_ok' }]);
check(attached.length === 1 && attached[0].status === 'connected' && attached[0].merchantId === m.id, 'ส่งคำขอแล้ว → ผูกการเชื่อมต่อที่นำเข้ากับร้านใหม่');
const newA = V2.runAssessment(m.id)!;
check(newA.result.dataSources.includes('shopee') && newA.result.standing === 'normal', 'ประเมินร้านใหม่ได้ทันทีจากข้อมูลที่นำเข้า');

describe('Configuration และ Reset');
check(useAssessmentConfigStore.getState().setWeights({ C1: 40, C2: 20, C3: 10, C4: 10, C5: 20 }) === undefined, 'บันทึกน้ำหนักใหม่ที่ถูกต้องได้');
check(!!useAssessmentConfigStore.getState().setWeights({ C1: 60, C2: 20, C3: 10, C4: 10, C5: 20 }) && useAssessmentConfigStore.getState().weights.C1 === 40, 'น้ำหนักผลรวม ≠ 100 → ไม่บันทึก');
check(V2.runAssessment('M-005')!.result.weights.C1 === 40, 'ประเมินใหม่ใช้น้ำหนักที่ตั้งไว้');
storage['smetrust:v2:assessment-config'] = JSON.stringify({ state: { weights: { C1: 99, C2: 1, C3: 1, C4: 1, C5: 1 } }, version: 1 });
await (useAssessmentConfigStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
check(useAssessmentConfigStore.getState().weights.C1 !== 99 && !validateWeights(useAssessmentConfigStore.getState().weights), 'ค่าที่บันทึกไว้ผิดรูปแบบ → ไม่นำมาใช้ (คงค่าที่ถูกต้อง)');
useAssessmentConfigStore.getState().setWeights({ C1: 40, C2: 20, C3: 10, C4: 10, C5: 20 });
W.resetAllDemoData();
check(
  JSON.stringify(S.useMarketplaceStore.getState().items) === JSON.stringify(seed.marketplaceConnections()) &&
    JSON.stringify(S.useAssessmentStore.getState().items) === JSON.stringify(seed.assessments()) &&
    useAssessmentConfigStore.getState().weights.C1 === 25,
  'Reset Demo Data คืนการเชื่อมต่อ ผลประเมิน และน้ำหนักเป็นค่าเริ่มต้น',
);

finish();
