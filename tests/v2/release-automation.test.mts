/**
 * Release Verification — Automation First (ก่อนเผยแพร่)
 * 1) Badge/ผลประเมินตรงกันในมุมร้านค้า ผู้บริโภค และเจ้าหน้าที่ ทุกร้าน
 * 2) Under Review / Suspended / Revoked / คำขอลงทะเบียนไม่ผ่าน — ไม่แสดง Badge ที่มีผลผิดสถานะ
 * 3) AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW ครบทุกเส้นทาง (ทุกเงื่อนไขย่อย)
 * 4) Manual Review ไม่สร้างงานซ้ำเมื่อ Refresh / Sync / Run Simulation
 * 5) Scenario 14–15 เดินครบทุกขั้นด้วย Demo Controller จริง
 * 7) Certification Level 2–4 ไม่ถูกอนุมัติอัตโนมัติ
 */
import { S, W, storage, view, describe, check, finish, actAs } from '../harness.mts';

const V = await import('@/stores/workflowsV2');
const AU = await import('@/stores/automation');
const D = await import('@/features/automation/derive');
const L = await import('@/features/automation/labels');
const V2S = await import('@/mock/scenarios/v2');
const C = await import('@/demo/controller');
const DS = await import('@/stores/demo');
const SC = await import('@/mock/scenarios');

const MID = 'M-005';
const O = { role: 'officer' as const, officerId: 'OF-001' };
const asOfficer = () => S.useSessionStore.setState(O);
const asMerchant = (op = 'OP-005') => S.useSessionStore.setState({ role: 'merchant', operatorId: op, merchantLoggedIn: true });
const badge = (id = MID) => S.useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === id);
const tasks = (id = MID) => S.useOfficerTaskStore.getState().items.filter((t) => t.merchantId === id);
const merchant = (id: string) => S.useMerchantStore.getState().items.find((m) => m.id === id)!;
const opOf = (id: string) => merchant(id).operatorId;
const conn = (id: string) => S.useMarketplaceStore.getState().items.find((c) => c.id === id)!;
function connect(archetype: Parameters<typeof V.connectMarketplace>[2], platform: 'shopee' | 'lazada' = 'shopee', mid = MID) {
  const c = actAs('merchant', () => V.connectMarketplace(mid, platform, archetype));
  actAs('merchant', () => V.grantConsent(c.id));
  V.completeSync(c.id, true);
  return conn(c.id);
}

/** ตรวจว่าทั้ง 3 มุมมองตรงกับ Badge ที่บันทึกไว้ และ Badge ตรงกับผลการคำนวณสด */
function consistent(mid: string, label: string) {
  const b = badge(mid);
  const a = V.latestAssessment(mid);
  if (!b || !a) return check(false, `${label}: มี Badge และผลประเมิน`);
  const ev = D.evaluate(V.dataBundle(), mid, a, S.useOfficerTaskStore.getState().items, new Date())!;
  const live = ev.status === b.status && ev.decision.route === b.route && b.assessmentId === a.id && b.band === a.result.band;
  const m = view('/m/trust', { role: 'merchant', operatorId: opOf(mid), activeMerchantId: mid });
  const c = view(`/shop/${mid}`, { role: 'consumer' });
  const o = view('/o/automation', O);
  const emblem = c.includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง');
  const merchantOk = m.includes(b.route) && (b.status === 'active' ? m.includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง') : m.includes(L.BADGE_STATUS[b.status].label));
  const consumerOk = b.status === 'active' ? emblem : !emblem && c.includes(L.BADGE_STATUS[b.status].consumer);
  const officerOk = o.includes(merchant(mid).shopName) && o.includes(L.BADGE_STATUS[b.status].label);
  check(live && merchantOk && consumerOk && officerOk, `${label}: ${b.status}/${b.route} ตรงกันทั้งผลคำนวณสด มุมร้านค้า ผู้บริโภค และเจ้าหน้าที่${live ? '' : ` (สด ${ev.status}/${ev.decision.route})`}${merchantOk ? '' : ' [ร้านค้า]'}${consumerOk ? '' : ' [ผู้บริโภค]'}${officerOk ? '' : ' [เจ้าหน้าที่]'}`);
}

W.resetAllDemoData();

describe('1) ทุกร้านในข้อมูลตั้งต้น — Badge ตรงกันทุกมุมมอง');
for (const b of S.useAssessmentBadgeStore.getState().items) consistent(b.merchantId, `${b.merchantId} ${merchant(b.merchantId).shopName}`);

describe('1) หลัง Run Simulation (ผลประเมินอัตโนมัติชุดใหม่) — ยังตรงกันทุกมุมมอง');
asOfficer();
AU.processAll('simulation');
for (const b of S.useAssessmentBadgeStore.getState().items) consistent(b.merchantId, `${b.merchantId} หลัง Run Simulation`);
{
  const page = view('/o/assessments/' + V.latestAssessment('M-001')!.id, O);
  check(page.includes('Trust Assessment Badge (อัตโนมัติ)') && page.includes(L.BADGE_STATUS[badge('M-001')!.status].label) && page.includes(`อิงผลประเมิน ${badge('M-001')!.assessmentId}`), 'หน้าผลประเมินของเจ้าหน้าที่แสดงสถานะ Badge เดียวกับร้านค้า/ผู้บริโภค');
  for (const mid of ['M-004', 'M-008', 'M-009']) {
    const a = V.latestAssessment(mid)!;
    check(view(`/o/assessments/${a.id}`, O).includes(L.BADGE_STATUS[badge(mid)!.status].label), `${mid}: หน้าเจ้าหน้าที่แสดง ${badge(mid)!.status} ตรงกับมุมอื่น`);
  }
}

describe('2) Under Review / Suspended / Revoked / คำขอลงทะเบียนไม่ผ่าน — ไม่มี Badge ที่มีผลผิดสถานะ');
W.resetAllDemoData();
asOfficer();
{
  for (const [mid, st] of [['M-004', 'suspended'], ['M-008', 'revoked'], ['M-009', 'withheld'], ['M-012', 'withheld']] as const) {
    const c = view(`/shop/${mid}`, { role: 'consumer' });
    check(badge(mid)!.status === st && !c.includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง'), `${mid}: ${st} → ผู้บริโภคไม่เห็นตรา Badge`);
  }
  const cert = S.useCertificationStore.getState().items.find((c) => c.merchantId === 'M-001' && c.status === 'active')!;
  actAs(['officer', 'admin'], () => W.setCertStatus(cert.id, 'revoked', 'ทดสอบเพิกถอนก่อนเผยแพร่'));
  AU.processAll('simulation');
  check(badge('M-001')!.status === 'revoked' && !view('/shop/M-001', { role: 'consumer' }).includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง'), 'เพิกถอนแล้ว Run Simulation → ยังเป็น Revoked (ประเมินใหม่ไม่ทำให้ Badge กลับมา)');
  const rsk = actAs(['officer', 'admin'], () => W.openRiskCase('M-003', 'ทดสอบเปิดเรื่องพิจารณาความเสี่ยง', []));
  check(badge('M-003')!.status === 'withheld', 'เปิดเรื่องพิจารณาความเสี่ยง → Badge ระงับการแสดงทันที');
  actAs(['officer', 'admin'], () => W.riskAction(rsk.id, 'under_investigation', 'เปิดการตรวจสอบเพื่อทดสอบ'));
  actAs(['officer', 'admin'], () => W.riskAction(rsk.id, 'suspended', 'ระงับเพื่อทดสอบ'));
  check(badge('M-003')!.status === 'suspended', 'ระงับผ่าน Risk Review → Suspended');
  actAs(['officer', 'admin'], () => W.riskAction(rsk.id, 'dismissed', 'ยุติเรื่องเพื่อทดสอบ'));
  check(badge('M-003')!.status === 'active', 'ยุติเรื่อง (คืนสถานะ) → Badge กลับมาแสดงตามผลประเมิน');
  consistent('M-003', 'M-003 หลังยุติเรื่อง');
}
{
  // ร้านใหม่ที่สมัครด้วย Marketplace (ข้อมูลดี) แล้วคำขอลงทะเบียนไม่ผ่าน — ต้องไม่แสดง Badge
  W.resetAllDemoData();
  asMerchant('OP-013');
  const src = V.mockShopProfile('OP-013', 'shopee');
  const { buildImportSource } = await import('@/features/marketplace/autofill');
  const source = buildImportSource({ key: 'REL-1', platform: 'shopee', archetype: 'established_good', seed: 4242, mockShopId: src.mockShopId, shopName: src.shopName, category: src.category });
  const form: Parameters<typeof V.submitMarketplaceRegistration>[1] = { businessType: 'individual', ownerName: 'ผู้ทดสอบ', shopName: src.shopName, description: src.description, category: src.category, phone: '0810000013', email: 'rel@example.com', province: 'กรุงเทพมหานคร', district: 'บางรัก', address: '', channels: [], documents: [] };
  const r = actAs('merchant', () => V.submitMarketplaceRegistration('OP-013', form, { draftId: 'REL-DRAFT-1', source }));
  const mid = r.merchant.id;
  check(!!badge(mid), `ร้านใหม่ ${mid} ประมวลผลอัตโนมัติหลังนำเข้า (${badge(mid)?.status})`);
  asOfficer();
  actAs(['officer', 'admin'], () => W.rejectApplication(r.app.id, 'เอกสารไม่ครบถ้วนสำหรับการทดสอบ'));
  check(merchant(mid).registrationStatus === 'rejected' && badge(mid)!.status !== 'active', `คำขอลงทะเบียนไม่ผ่าน → ไม่แสดง Badge (${badge(mid)!.status})`);
  check(!view(`/shop/${mid}`, { role: 'consumer' }).includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง'), 'ผู้บริโภคไม่เห็นตรา Badge ของร้านที่คำขอลงทะเบียนไม่ผ่าน');
  check(!S.useCertificationStore.getState().items.some((c) => c.merchantId === mid), 'ร้านใหม่ไม่ได้รับใบรับรองอัตโนมัติ');
  check(view('/m/trust', { role: 'merchant', operatorId: 'OP-013', activeMerchantId: mid }).includes('คำขอลงทะเบียนร้านไม่ผ่าน'), 'ร้านค้าเห็นเหตุผลและทางแก้ (ยื่นคำขอใหม่)');
  asMerchant('OP-013');
  actAs('merchant', () => W.resubmitApplication(r.app.id, 'แก้ไขเอกสารแล้ว', []));
  check(badge(mid)!.status === 'active' && S.useOfficerTaskStore.getState().items.filter((x) => x.merchantId === mid).length === 0, 'ยื่นคำขอใหม่ → Badge กลับมาตามผลประเมิน (ไม่สร้างงานกรณียกเว้น — คำขอยังรอเจ้าหน้าที่ตามเดิม)');
  check(S.useVerificationStore.getState().items.find((x) => x.id === r.app.id)!.status === 'submitted', 'คำขอลงทะเบียนยังรอเจ้าหน้าที่ (ไม่อนุมัติอัตโนมัติ)');
}

describe('3) ครบทุกเส้นทางของ Decision Router (ผ่าน Workflow จริง)');
W.resetAllDemoData();
asMerchant();
{
  const cases: [string, () => void, string, string][] = [
    ['AUTO_PASS — ร้านขายดี', () => connect('established_good'), 'AUTO_PASS', 'active'],
    ['AUTO_PASS — สัญญาณข้อเดียว (Band สูงสุด B)', () => connect('review_burst'), 'AUTO_PASS', 'active'],
    ['AUTO_REQUEST_INFO — ข้อมูลน้อย', () => connect('new_shop'), 'AUTO_REQUEST_INFO', 'insufficient'],
    ['AUTO_REQUEST_INFO — ข้อมูลหมดอายุ', () => { const c = connect('established_good'); V.simulateDataAge(c.id, 'stale'); }, 'AUTO_REQUEST_INFO', 'needs_update'],
    ['AUTO_REQUEST_INFO — ซิงก์ไม่สำเร็จ (ไม่มีข้อมูลที่ใช้ได้)', () => { const c = actAs('merchant', () => V.connectMarketplace(MID, 'shopee', 'established_good')); actAs('merchant', () => V.grantConsent(c.id)); V.completeSync(c.id, false, 'import'); }, 'AUTO_REQUEST_INFO', 'insufficient'],
    ['AUTO_REQUEST_INFO — ยกเลิกการเชื่อมต่อ', () => { const c = connect('established_good'); actAs('merchant', () => V.disconnectMarketplace(c.id)); }, 'AUTO_REQUEST_INFO', 'insufficient'],
    ['MANUAL_REVIEW — ข้อมูลตัวตนไม่ตรง', () => connect('owner_mismatch'), 'MANUAL_REVIEW', 'under_review'],
  ];
  for (const [label, run, route, status] of cases) {
    V2S.fixtureV2Clean();
    run();
    const b = badge();
    check(b?.route === route && b?.status === status, `${label} → ${route} / ${status}${b ? '' : ' (ไม่มี Badge)'}${b && (b.route !== route || b.status !== status) ? ` (ได้ ${b.route}/${b.status})` : ''}`);
    check(route === 'MANUAL_REVIEW' ? tasks().length === 1 : tasks().length === 0, `${label}: งานเจ้าหน้าที่ ${route === 'MANUAL_REVIEW' ? '1 งาน' : '0 งาน'}`);
    consistent(MID, label);
  }
  // ยังไม่ยืนยันตัวตน → ร้านทำเอง
  V2S.fixtureV2Clean();
  S.useOperatorStore.getState().update('OP-005', { kycStatus: 'none' });
  connect('established_good');
  check(badge()!.route === 'AUTO_REQUEST_INFO' && tasks().length === 0, 'AUTO_REQUEST_INFO — ยังไม่ยืนยันตัวตน (ไม่ส่งเจ้าหน้าที่)');
  W.setKycResult('OP-005', true);
  check(badge()!.route === 'AUTO_PASS' && badge()!.status === 'active', 'ยืนยันตัวตนสำเร็จ → ประเมินใหม่ → AUTO_PASS');
}

describe('4) Manual Review ไม่สร้างงานซ้ำ — Refresh / Sync / Run Simulation / Reload State');
W.resetAllDemoData();
asMerchant();
V2S.fixtureV2Clean();
{
  const c = connect('owner_mismatch');
  const t0 = JSON.stringify(tasks());
  const notes = () => S.useNotificationStore.getState().items.filter((n) => n.title.startsWith('กรณียกเว้นรอตรวจสอบ')).length;
  const n0 = notes();
  for (let i = 0; i < 3; i++) {
    actAs('merchant', () => V.resyncMarketplace(c.id));
    V.completeSync(c.id, true);
    AU.processAll('simulation');
    AU.processMerchant(MID, 'simulation');
    actAs('merchant', () => V.runAssessment(MID));
  }
  check(tasks().length === 1 && notes() === n0, 'Sync ×3 + Run Simulation ×3 + ประเมินเอง ×3 → งานเดียว แจ้งเตือนครั้งเดียว');
  check(JSON.stringify(tasks().map((t) => [t.id, t.fingerprint, t.status])) === JSON.stringify(JSON.parse(t0).map((t: { id: string; fingerprint: string; status: string }) => [t.id, t.fingerprint, t.status])), 'งานเดิม (รหัส Fingerprint สถานะ) ไม่เปลี่ยน');
  // Reload: โหลด State จาก localStorage ใหม่ (เหมือน Refresh เบราว์เซอร์) แล้วประมวลผลซ้ำ
  const saved = storage['smetrust:v2:officer-tasks'];
  await S.useOfficerTaskStore.persist.rehydrate();
  await S.useAssessmentBadgeStore.persist.rehydrate();
  AU.processAll('simulation');
  check(tasks().length === 1 && storage['smetrust:v2:officer-tasks'] === saved, 'Refresh (Rehydrate จาก localStorage) แล้วประมวลผลซ้ำ → ไม่มีงานใหม่');
  // เชื่อมอีกแพลตฟอร์มที่ไม่ตรงเช่นกัน → ประเด็นเดิมประเภทเดียวกัน อัปเดตงานเดิม (หนึ่งงานต่อประเภทต่อร้าน)
  connect('owner_mismatch', 'lazada');
  check(tasks().length === 1 && tasks()[0].history.some((h) => h.action === 'updated'), 'ประเด็นประเภทเดียวกันเพิ่มขึ้น → อัปเดตหลักฐานในงานเดิม (ไม่สร้างงานใหม่)');
}

describe('5) Scenario 14–15 — Demo Controller ครบทุกขั้นจนจบ');
{
  const nav = () => {};
  const demo = () => DS.useDemoStore.getState();
  const sig = (k: string, v: string | number | boolean) => DS.reportDemo(k, v);
  const nextOk = () => ['moved', 'completed'].includes(C.next(nav as never, '/demo-test', true));
  const canProceed = () => {
    const sc = C.activeScenario()!;
    return C.gateState(sc.steps[demo().stepIndex]).ok;
  };
  // ---- 14
  C.startScenario('s14', nav as never);
  asMerchant();
  check(demo().activeScenario === 's14' && demo().stepIndex === 0, 'S14 เริ่มที่ Marketplace App Simulation');
  check(!canProceed(), 'S14: ปุ่มถัดไปถูกปิดจนกว่าจะกด "เชื่อมกับ SME Trust"');
  sig('mktapp.connect', true);
  check(canProceed() && nextOk(), 'S14 ขั้น 1 → 2');
  check(!canProceed(), 'S14: ต้องยืนยันนำเข้าก่อน');
  const c = actAs('merchant', () => V.connectMarketplace(MID, 'shopee', 'established_good'));
  actAs('merchant', () => V.grantConsent(c.id));
  check(canProceed() && nextOk(), 'S14 ขั้น 2 → 3 (ยืนยันนำเข้าแล้ว)');
  V.completeSync(c.id, true);
  check(canProceed() && nextOk() && demo().current.connectionId === c.id, 'S14 ขั้น 3 → 4 (ระบบประมวลผลอัตโนมัติ · บันทึกการเชื่อมต่อลงบริบท)');
  check(!canProceed(), 'S14: ต้องยืนยัน Auto-Fill ก่อน');
  const r = actAs('merchant', () => V.confirmProfileUpdate(c.id, V.registeredValues(merchant(MID)), 'S14-DRAFT'));
  check(r.ok && canProceed() && nextOk(), 'S14 ขั้น 4 → 5 (ยืนยัน Auto-Fill)');
  check(nextOk() && nextOk(), 'S14 ขั้น 5 → 6 → 7 (ผลอัตโนมัติ → Badge → ผู้บริโภค)');
  const roles = SC.allScenarios.find((s) => s.id === 's14')!.steps.map((s) => s.role);
  check(!roles.includes('officer') && !roles.includes('admin'), 'S14 ไม่มีขั้นตอนเจ้าหน้าที่');
  check(nextOk(), 'S14 ขั้นสุดท้าย → จบ Scenario');
  const out14 = SC.allScenarios.find((s) => s.id === 's14')!.outcome!(demo().results.s14 ?? demo().current);
  check(demo().completed.includes('s14') && out14?.kind === 'approved', `S14 จบ → Completed · ผล: ${out14?.title}`);
  // ---- 15
  C.startScenario('s15', nav as never);
  asMerchant();
  check(demo().activeScenario === 's15' && !badge() && tasks().length === 0, 'S15 เริ่มจากร้านที่ยังไม่ประมวลผล (Reset)');
  const good = actAs('merchant', () => V.connectMarketplace(MID, 'shopee', 'established_good'));
  actAs('merchant', () => V.grantConsent(good.id));
  check(!canProceed(), 'S15: เลือกร้านตัวอย่างอื่น → ยังไปต่อไม่ได้ (ต้องเป็น "บัญชีร้านเป็นชื่อบุคคลอื่น")');
  actAs('merchant', () => V.disconnectMarketplace(good.id));
  const m = connect('owner_mismatch', 'lazada');
  check(canProceed() && nextOk(), 'S15 ขั้น 1 → 2');
  check(canProceed() && nextOk() && !!demo().current.taskId, 'S15 ขั้น 2 → 3 (มีงาน 1 งาน · บันทึกรหัสงานลงบริบท)');
  check(nextOk(), 'S15 ขั้น 3 → 4 (Manual Review Queue → Officer Decision)');
  check(!canProceed(), 'S15: ต้องบันทึกผลการพิจารณาก่อน');
  asOfficer();
  check(actAs(['officer', 'admin'], () => AU.resolveTask(demo().current.taskId!, 'approve', 'ยืนยันความเป็นเจ้าของแล้ว (ทดสอบ)')).ok && canProceed() && nextOk(), 'S15 ขั้น 4 → 5 (เจ้าหน้าที่อนุมัติ)');
  check(badge()!.status === 'active' && conn(m.id).identityReview?.status === 'verified', 'S15: Badge แสดงหลังเจ้าหน้าที่ยืนยัน');
  check(nextOk(), 'S15 ขั้น 5 → 6');
  check(nextOk(), 'S15 ขั้นสุดท้าย → จบ Scenario');
  const out15 = SC.allScenarios.find((s) => s.id === 's15')!.outcome!(demo().results.s15 ?? demo().current);
  check(demo().completed.includes('s15') && out15?.kind === 'approved', `S15 จบ → Completed · ผล: ${out15?.title}`);
}

describe('7) Certification Level 2–4 ไม่ถูกอนุมัติอัตโนมัติ');
W.resetAllDemoData();
asOfficer();
{
  const appsBefore = JSON.stringify(S.useVerificationStore.getState().items.map((a) => [a.id, a.status]));
  const certsBefore = JSON.stringify(S.useCertificationStore.getState().items);
  const pendingBefore = S.useAssessmentStore.getState().items.filter((a) => a.status === 'pending_review').map((a) => a.id);
  AU.processAll('simulation');
  AU.processAll('simulation');
  asMerchant();
  V2S.fixtureV2Clean();
  connect('established_good');
  check(JSON.stringify(S.useVerificationStore.getState().items.map((a) => [a.id, a.status])) === appsBefore, 'Run Simulation + AUTO_PASS → คำขอลงทะเบียน/รับรองทุกรายการสถานะเดิม (ไม่อนุมัติเอง)');
  check(JSON.stringify(S.useCertificationStore.getState().items) === certsBefore, 'ใบรับรองทุกใบไม่เปลี่ยน (ไม่ออก/ยกระดับ/ระงับ/เพิกถอนอัตโนมัติ)');
  check(pendingBefore.every((id) => S.useAssessmentStore.getState().items.find((a) => a.id === id)?.status === 'pending_review'), 'ผลประเมินที่รอเจ้าหน้าที่พิจารณายังรออยู่ (ระบบไม่ตัดสินแทน)');
  check(!S.useAuditStore.getState().items.some((a) => a.actorRole === 'system' && /อนุมัติคำขอ|ออกใบรับรอง/.test(a.action)), 'ไม่มี Audit Log ที่ระบบอนุมัติคำขอหรือออกใบรับรอง');
}

describe('8) KI-V2-32 — Demo Controller เปลี่ยนหน้าตามขั้นจริง แม้ location ของ React ยังไม่อัปเดต (startTransition)');
{
  const saved = (globalThis as any).location;
  const navs: string[] = [];
  const setLoc = (p: string) => {
    const [pathname, q] = p.split('?');
    (globalThis as any).location = { origin: saved.origin, pathname, search: q ? `?${q}` : '' };
  };
  const nav = (to: string) => {
    navs.push(to);
    setLoc(to);
  };
  check(C.livePath('/fallback') === '/fallback', 'ไม่มี pathname (เช่น SSR/Unit) → ใช้ค่าที่ส่งมา');
  C.startScenario('s4', nav as never);
  const sc = C.activeScenario()!;
  const ds = DS.useDemoStore.getState();
  // อยู่ขั้น 4 (ติดตามสถานะ) หลังส่งเรื่องแล้ว — เบราว์เซอร์อยู่ที่หน้าติดตามสถานะ
  ds.set({ stepIndex: 3, current: { ...ds.current, complaintId: 'CMP-TEST-0001' }, passed: ['s4-wizard', 's4-submit'] });
  const route = (i: number) => C.stepRoute(sc.steps[i]);
  setLoc(route(3));
  check(C.livePath('/stale') === route(3), `livePath อ่านเส้นทางจริงจากเบราว์เซอร์ (${route(3)})`);
  // React ยัง Render location เดิม (หน้าแบบฟอร์ม) เพราะการเปลี่ยนหน้าเป็น Transition ที่ยังไม่ Commit
  const staleReactPath = route(2);
  navs.length = 0;
  check(C.back(nav as never, staleReactPath) === 'moved' && DS.useDemoStore.getState().stepIndex === 2, 'ย้อนกลับ 4 → 3');
  check(navs.length === 1 && C.livePath() === route(2), `ย้อนกลับเปิดหน้าของขั้น 3 จริง แม้ location ของ React ยังเป็น ${staleReactPath} (เดิม: ข้ามการเปลี่ยนหน้า → ขั้นเปลี่ยนแต่หน้าจอค้าง)`);
  // ขั้น 2 และ 3 ใช้หน้าเดียวกัน → ไม่เปิดหน้าซ้ำ แม้ React ยังส่ง location ของหน้าติดตามสถานะมา
  navs.length = 0;
  check(C.back(nav as never, route(3)) === 'moved' && navs.length === 0 && C.livePath() === route(1), 'ย้อนกลับ 3 → 2 (หน้าเดียวกัน) ไม่เปิดหน้าซ้ำ');
  check(C.gateState(sc.steps[1]).ok, 'ขั้นที่ทำแล้วไปต่อได้โดยไม่ต้องทำซ้ำ');
  (globalThis as any).location = saved;
}

finish();
