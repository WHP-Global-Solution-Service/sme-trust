/**
 * P7 — Regression Tests สำหรับสิ่งที่แก้ใน Final QA
 * A: ผลลัพธ์แตกแขนงของ Scenario 12/13 (ขอข้อมูลเพิ่ม/ไม่อนุมัติ ไม่แสดง Badge ว่าอนุมัติแล้ว)
 * C: ชุดน้ำหนักมีเลขชุดและวันที่ ผลประเมินเดิมไม่ถูกแก้ย้อนหลัง
 * D: วันที่ซิงก์สัมพัทธ์กับวันเริ่ม Demo, Mock Sync ไม่สร้างข้อมูลซ้ำ, Fixture อายุข้อมูล
 * E: 9B เล่นซ้ำได้โดยไม่สร้างร้านซ้ำ
 * F: หมวดสินค้าของการเปรียบเทียบเปลี่ยนตามร้าน
 * G: KPI v2 คำนวณจาก State และกลับค่าเริ่มต้นเมื่อ Reset
 */
import { S, W, view, describe, check, finish, storage } from '../harness.mts';
import { integrityProblems } from '../integrity.mts';

const { findScenario } = await import('@/mock/scenarios');
const C = await import('@/demo/controller');
const V = await import('@/stores/workflowsV2');
const V2S = await import('@/mock/scenarios/v2');
const { useDemoStore } = await import('@/stores/demo');
const { useAssessmentConfigStore, currentModel } = await import('@/stores/assessmentConfig');
const { seed } = await import('@/mock/data');
const { demoAnchor } = await import('@/mock/data/helpers');
const { analyzeCase, effectiveCategory } = await import('@/features/marketplace/analysis/comparison');
const { computeV2Stats } = await import('@/utils/statsV2');
const { snapshotOf } = await import('@/features/marketplace/services/generator');

let cur = '';
const nav = ((to: string) => {
  cur = to;
}) as never;
const demo = () => useDemoStore.getState();
const session = () => S.useSessionStore.getState();
const asOfficer = () => session().set({ role: 'officer', officerId: 'OF-001' });
const assessment = (id?: string) => S.useAssessmentStore.getState().items.find((a) => a.id === id);
const activeCert = (mid: string) => S.useCertificationStore.getState().items.filter((c) => c.merchantId === mid && c.status === 'active');
const stats = () => computeV2Stats({ merchants: S.useMerchantStore.getState().items, connections: S.useMarketplaceStore.getState().items, assessments: S.useAssessmentStore.getState().items, certifications: S.useCertificationStore.getState().items });
const integrity = (label: string) => {
  const p = integrityProblems();
  check(p.length === 0, `ข้อมูลสอดคล้องกันหลัง ${label}${p.length ? ' — ' + p.slice(0, 3).join(' | ') : ''}`);
};
const DAY = 86_400_000;

// ================================================================ P7-A
for (const kind of ['need_info', 'rejected'] as const) {
  describe(`P7-A — Scenario 12 → 13 เมื่อเจ้าหน้าที่${kind === 'need_info' ? 'ขอข้อมูลเพิ่มเติม' : 'ไม่อนุมัติ'}`);
  W.resetAllDemoData();
  C.startScenario('s12', nav, { journey: true });
  const ctx = demo().current;
  const before = activeCert('M-005').map((c) => `${c.id}:L${c.level}`);
  asOfficer();
  check(V.decideAssessment(ctx.assessmentId!, kind, 'ทดสอบผลการพิจารณาที่ไม่ใช่การอนุมัติ').ok, `เจ้าหน้าที่บันทึกผล ${kind}`);
  const app = S.useVerificationStore.getState().items.find((a) => a.id === assessment(ctx.assessmentId)!.decision!.applicationId);
  check(app?.status === (kind === 'need_info' ? 'need_info' : 'rejected'), `  คำขอ ${app?.id} ที่ผูกไว้เปลี่ยนเป็น ${app?.status} ผ่าน กระบวนการรับรอง`);
  check(JSON.stringify(activeCert('M-005').map((c) => `${c.id}:L${c.level}`)) === JSON.stringify(before) && !activeCert('M-005').some((c) => c.level === 4), `  ไม่มีใบรับรองใหม่ — คงระดับเดิม (${before.join(', ')})`);
  // เดินขั้นที่เหลือของ Scenario 12 จนจบ
  let guard = 0;
  while (demo().activeScenario === 's12' && guard++ < 20) {
    const r = C.next(nav, cur);
    if (r === 'transition') C.next(nav, cur, true);
    if (r === 'completed' || r === 'blocked') break;
  }
  check(demo().completed.includes('s12'), '  จบ Scenario 12');
  const s12 = findScenario('s12')!;
  const o12 = s12.outcome!(demo().results.s12 ?? ctx);
  check(o12?.kind === kind && o12.tone !== 'success', `  หน้าจบ Scenario 12 แสดงผลจริง: "${o12?.title}"`);
  check(!!o12 && !o12.title.includes('อนุมัติยกระดับ') && o12.consumerView.includes('ไม่มี Badge ระดับใหม่'), `  สิ่งที่ผู้บริโภคเห็น: ${o12?.consumerView}`);
  const capturedCert = demo().results.s12?.certId;
  check(!capturedCert || S.useCertificationStore.getState().items.find((c) => c.id === capturedCert)?.level !== 4, '  Context ไม่ส่งต่อใบรับรอง Level 4 ที่ไม่มีอยู่จริง');

  // Scenario 13 ต่อเนื่อง
  C.startScenario('s13', nav, { carry: true, journey: true });
  check(demo().current.assessmentId === ctx.assessmentId && demo().current.merchantId === 'M-005', '  Scenario 13 ใช้ Assessment/Merchant ID เดิม');
  const s13 = findScenario('s13')!;
  const badgeText = (typeof s13.steps[0].instruction === 'function' ? s13.steps[0].instruction(demo().current) : s13.steps[0].instruction) as string;
  check(badgeText.includes('ยังไม่มี Badge ระดับใหม่') && !badgeText.includes('ได้รับอนุมัติ'), `  ขั้น Trust Badge: "${badgeText.slice(0, 70)}…"`);
  const page = view('/shop/M-005', { role: 'consumer', consumerId: 'CS-001' });
  check(page.includes('Level 3 — Trusted SME') && !page.includes('Trusted SME Plus') && !page.includes('Level 4 — '), '  หน้าร้านสาธารณะแสดงระดับเดิม (Level 3 — Trusted SME) ไม่มี Level 4');
  check(s13.outcome!(demo().current)?.kind === kind, '  หน้าจบ Scenario 13 แสดงผลเดียวกัน (ไม่ใช่ "อนุมัติแล้ว")');
  integrity(`ผล ${kind}`);
}

describe('P7-A — ผลอนุมัติยังทำงานตามเดิม');
W.resetAllDemoData();
C.startScenario('s12', nav, { journey: true });
asOfficer();
const ap = demo().current;
check(V.decideAssessment(ap.assessmentId!, 'approved', 'ผลประเมินและเกณฑ์การรับรอง ผ่านครบ', 4).ok, 'เจ้าหน้าที่อนุมัติ Level 4');
const oA = findScenario('s12')!.outcome!(ap);
check(oA?.kind === 'approved' && oA.tone === 'success' && activeCert('M-005').some((c) => c.level === 4), `  หน้าจบ: "${oA?.title}" และมีใบรับรอง Level 4`);

describe('P7-A — ทางเลือกอื่นของ Journey');
W.resetAllDemoData();
const c1 = V.connectMarketplace('M-005', 'lazada');
V.grantConsent(c1.id, 'established_good');
V.completeSync(c1.id, false, 'connect');
let x = S.useMarketplaceStore.getState().items.find((c) => c.id === c1.id)!;
check(x.status === 'sync_failed' && x.failKind === 'connect' && x.failReason!.includes('เชื่อมต่อ'), 'Connection Failed: สถานะและเหตุผลเฉพาะ');
V.resyncMarketplace(c1.id);
V.completeSync(c1.id, false, 'import');
x = S.useMarketplaceStore.getState().items.find((c) => c.id === c1.id)!;
check(x.failKind === 'import' && x.failReason!.includes('นำเข้า'), 'Import Failed: สถานะและเหตุผลเฉพาะ');
check(!V.currentInputs('M-005')!.input.marketplace.some((m) => m.connection.id === c1.id), '  การเชื่อมต่อที่ล้มเหลวไม่ถูกใช้ประเมิน');
V.resyncMarketplace(c1.id);
V.completeSync(c1.id, true);
x = S.useMarketplaceStore.getState().items.find((c) => c.id === c1.id)!;
check(x.status === 'connected' && x.syncSource === 'sync' && x.syncCount === 3 && !x.failKind, 'ลองใหม่สำเร็จ: ใช้การเชื่อมต่อเดิม (นับการซิงก์ 3 ครั้ง)');
// Suspended / Revoked
for (const [mid, st] of [['M-008', 'revoked'], ['M-005', 'suspended']] as const) {
  W.resetAllDemoData();
  if (st === 'suspended') {
    const cert = activeCert(mid)[0];
    S.useCertificationStore.getState().update(cert.id, { status: 'suspended' });
  }
  const t = V.runAssessment(mid)!;
  check(t.result.standing === st && t.result.recommendation.kind === 'blocked', `${st === 'revoked' ? 'Revoked' : 'Suspended'} Merchant (${mid}): Standing แยกจาก Band (${t.result.band}) และขอ Badge ไม่ได้`);
  check(!V.submitAssessment(t.id).ok, '  ส่งพิจารณาไม่ได้จนกว่าสถานะจะกลับเป็นปกติ');
}

describe('P7-A — Refresh / Restart Scenario / Restart Journey');
W.resetAllDemoData();
C.startJourney(nav, 'v2');
const startedOn = demo().activeScenario;
const persisted = { ...storage };
await (useDemoStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
check(demo().activeScenario === startedOn && demo().journeyTrack === 'v2' && Object.keys(persisted).some((k) => k.includes('demo')), 'Refresh: สถานะ Journey v2 อ่านกลับจาก localStorage ได้');
C.startScenario('s12', nav, { journey: true });
const s12ctx = demo().current;
const countBefore = S.useVerificationStore.getState().items.length;
C.restartScenario(nav);
check(demo().current.assessmentId === s12ctx.assessmentId && S.useVerificationStore.getState().items.length === countBefore, 'Restart Scenario: ใช้ ID เดิมและไม่สร้างคำขอซ้ำ');
C.restartJourney(nav);
check(demo().activeScenario === 's9' && demo().journeyTrack === 'v2' && demo().completed.length === 0, 'Restart Journey v2: กลับไป Scenario 9 และล้างความคืบหน้า');

// ================================================================ P7-C
describe('P7-C — Assessment Configuration');
W.resetAllDemoData();
const cfg = () => useAssessmentConfigStore.getState();
check(cfg().revision === 0 && !cfg().updatedAt, 'เริ่มต้น: ชุดน้ำหนักเริ่มต้น (#0)');
const t1 = V.runAssessment('M-001')!;
check(t1.result.weightSet?.revision === 0 && t1.result.weights.C1 === 25, '  ผลประเมินบันทึกเลขชุดน้ำหนักและสำเนาน้ำหนัก');
V.submitAssessment(t1.id);
check(!!cfg().setWeights({ C1: 50, C2: 25, C3: 20, C4: 10, C5: 20 }) && cfg().revision === 0, 'น้ำหนักผลรวม ≠ 100 → บันทึกไม่ได้ (เลขชุดไม่เปลี่ยน)');
check(cfg().setWeights({ C1: 40, C2: 20, C3: 10, C4: 10, C5: 20 }) === undefined && cfg().revision === 1 && !!cfg().updatedAt, 'บันทึกน้ำหนักใหม่ → ชุด #1 พร้อมวันที่เริ่มใช้');
cfg().setWeights({ C1: 40, C2: 20, C3: 10, C4: 10, C5: 20 });
check(cfg().revision === 1, '  บันทึกค่าเดิมซ้ำไม่สร้างชุดใหม่');
check(currentModel().weightSet?.revision === 1, '  โมเดลปัจจุบันอ้างชุด #1');
const t1After = assessment(t1.id)!;
check(t1After.result.weights.C1 === 25 && t1After.result.weightSet?.revision === 0 && t1After.result.score === t1.result.score, 'ผลประเมินเดิมไม่ถูกแก้ย้อนหลัง (ยังเป็นชุด #0)');
const t2 = V.runAssessment('M-003')!;
check(t2.result.weightSet?.revision === 1 && t2.result.weights.C1 === 40, 'ผลประเมินใหม่ใช้ชุด #1');
const officerPage = view(`/o/assessments/${t1.id}`, { role: 'officer', officerId: 'OF-001' });
check(officerPage.includes('ชุดน้ำหนักเริ่มต้น'), '  เจ้าหน้าที่เห็นว่าผลเดิมใช้ชุดน้ำหนักใด');
cfg().restoreDefault();
check(cfg().revision === 2 && cfg().weights.C1 === 25 && cfg().history.length === 3, 'คืนค่าเริ่มต้น → บันทึกเป็นชุด #2 (มีประวัติ 3 ชุด)');
check(view('/admin/assessment-model', { role: 'admin' }).includes('ชุดน้ำหนัก #2'), '  หน้าโมเดลแสดงชุดที่ใช้อยู่และวันที่');
W.resetAllDemoData();
check(cfg().revision === 0 && cfg().history.length === 1, 'Reset Demo Data → ชุดน้ำหนักเริ่มต้น');
storage['smetrust:v2:assessment-config'] = JSON.stringify({ state: { weights: { C1: 30, C2: 20, C3: 20, C4: 10, C5: 20 } }, version: 1 });
await (useAssessmentConfigStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
check(cfg().weights.C1 === 30 && cfg().revision === 1, 'Persistence: ข้อมูลรุ่นก่อน (มีแต่น้ำหนัก) → อ่านเป็นชุด #1');
W.resetAllDemoData();

// ================================================================ P7-D
describe('P7-D — Data Freshness');
W.resetAllDemoData();
const anchor = demoAnchor();
const seeded = S.useMarketplaceStore.getState().items.filter((c) => c.status === 'connected');
check(seeded.every((c) => c.lastSyncAt === new Date(anchor.getTime() - DAY).toISOString() && c.syncSource === 'seed'), 'Seed: ซิงก์ล่าสุด 1 วันก่อนวันเริ่ม Demo (ไม่ใช่วันที่คงที่)');
check(JSON.stringify(seed.marketplaceConnections()) === JSON.stringify(seed.marketplaceConnections()), '  Reset ซ้ำในวันเดียวกันได้ข้อมูลเหมือนเดิม');
const { buildMarketplaceConnections } = await import('@/mock/data/marketplace');
const nextYear = new Date(anchor.getTime() + 400 * DAY);
check(buildMarketplaceConnections(demoAnchor(nextYear)).every((c) => !c.lastSyncAt || new Date(c.lastSyncAt).getTime() > nextYear.getTime() - 3 * DAY), 'เริ่ม Demo อีก 400 วันข้างหน้า → ข้อมูลตัวอย่างยังเป็นข้อมูลใหม่');
const seedAssess = S.useAssessmentStore.getState().items;
check(seedAssess.every((a) => a.result.confidence.reasons.every((r) => !r.includes('ซิงก์ล่าสุดนานกว่า'))), 'ผลประเมินตัวอย่างไม่ถูกหักเพราะข้อมูลเก่า');
check(V.currentInputs('M-001')!.key === seedAssess.find((a) => a.merchantId === 'M-001')!.inputsKey, '  ผลประเมินตัวอย่างไม่แสดงว่า "ข้อมูลเปลี่ยนแปลง" หลัง Reset');

const conf = (mid: string) => {
  const r = V.runAssessment(mid)!.result;
  return r.confidence.score;
};
const mk = 'MKC-001';
const count0 = S.useMarketplaceStore.getState().items.length;
const snap0 = JSON.stringify(snapshotOf(S.useMarketplaceStore.getState().items.find((c) => c.id === mk)!, 'อาหารและเครื่องดื่ม'));
const fresh = conf('M-001');
V.simulateDataAge(mk, 'd30');
const c30 = conf('M-001');
V.simulateDataAge(mk, 'd90');
const c90 = conf('M-001');
V.simulateDataAge(mk, 'stale');
const cStale = conf('M-001');
check(fresh > c30 && c30 > c90 && c90 === cStale, `Fixture อายุข้อมูล: ใหม่ ${fresh} → 31 วัน ${c30} → 91 วัน ${c90} → 180 วัน ${cStale}`);
check(S.useMarketplaceStore.getState().items.find((c) => c.id === mk)!.syncSource === 'simulated_age', '  ที่มาของวันที่ = จำลองอายุข้อมูล (Source Context)');
check(S.useAuditStore.getState().items.some((a) => a.action.includes('จำลองอายุข้อมูล')), '  บันทึก Audit ว่าเป็นการจำลอง');
V.simulateDataAge(mk, 'sync_failed');
check(S.useMarketplaceStore.getState().items.find((c) => c.id === mk)!.status === 'sync_failed', 'Fixture ซิงก์ไม่สำเร็จ');
V.resyncMarketplace(mk);
V.completeSync(mk, true);
const after = S.useMarketplaceStore.getState().items.find((c) => c.id === mk)!;
check(after.syncSource === 'sync' && Date.now() - new Date(after.lastSyncAt!).getTime() < 60_000, 'Mock Sync: อัปเดตวันที่ซิงก์และที่มาเป็น "ผู้ใช้กดซิงก์"');
check(conf('M-001') === fresh, '  Confidence คำนวณใหม่กลับเป็นข้อมูลใหม่');
check(S.useMarketplaceStore.getState().items.length === count0 && JSON.stringify(snapshotOf(after, 'อาหารและเครื่องดื่ม')) === snap0, '  ไม่สร้างการเชื่อมต่อหรือข้อมูลการขายซ้ำ (Seed เดิม)');
const dataPage = view(`/m/marketplace/data/${mk}`, { role: 'merchant', operatorId: 'OP-001' });
check(dataPage.includes('Data Confidence ปัจจุบัน') && dataPage.includes('จำลองอายุข้อมูล'), 'หน้า Data Overview แสดงความใหม่ของข้อมูล Confidence ปัจจุบัน และเครื่องมือจำลอง');

// ================================================================ P7-E
describe('P7-E — Self-Registration 9B เล่นซ้ำได้');
W.resetAllDemoData();
const branch = findScenario('s9b')!;
check(branch.replayNote?.() === undefined, 'ข้อมูลเริ่มต้น: OP-012 ไม่มีร้าน → ไม่ต้องแจ้งเตือน');
const register = () => {
  const op = S.useOperatorStore.getState().items.find((o) => o.id === 'OP-012')!;
  return W.submitShopRegistration('OP-012', {
    businessType: 'individual', ownerName: op.name, shopName: 'ร้านผ้าทอริมทาง', category: 'แฟชั่นและเครื่องแต่งกาย', province: 'น่าน', district: 'เมือง', phone: op.phone, email: op.email,
    description: 'ขายผ่าน Facebook และหน้าร้านในตลาดชุมชน', channels: [{ type: 'facebook', handle: 'pha.tor.demo' }],
    documents: [{ id: 'd-b', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 1, addedAt: new Date().toISOString() }],
  });
};
// เล่นใน Journey: ร้าน v2 ทำ Scenario 9 แล้ว → 9B
C.startScenario('s11', nav, { journey: true });
const journeyShop = JSON.stringify({ c: S.useMarketplaceStore.getState().items.filter((c) => c.merchantId === 'M-005'), a: S.useAssessmentStore.getState().items.filter((a) => a.merchantId === 'M-005') });
for (const round of [1, 2, 3]) {
  C.startScenario('s9b', nav, { carry: true, journey: true });
  check(V2S.branchShops().length === 0, `รอบที่ ${round}: เริ่ม 9B แล้ว OP-012 ไม่มีร้านค้างจากรอบก่อน`);
  const { merchant, app } = register();
  const t = V.runAssessment(merchant.id)!;
  V.submitAssessment(t.id);
  check(V2S.branchShops().length === 1 && assessment(t.id)!.applicationId === app.id, `  รอบที่ ${round}: มีร้านเดียว (${merchant.id}) ผูกกับคำขอ ${app.id}`);
  if (round < 3) check(!!branch.replayNote?.()?.includes(merchant.shopName), '  เล่นซ้ำ → แจ้งว่ามีร้านเดิมและจะถูกล้าง');
}
check(JSON.stringify({ c: S.useMarketplaceStore.getState().items.filter((c) => c.merchantId === 'M-005'), a: S.useAssessmentStore.getState().items.filter((a) => a.merchantId === 'M-005') }) === journeyShop, 'ข้อมูลร้านของ Journey v2 (M-005) ไม่ถูกแตะ');
integrity('เล่น 9B ซ้ำ 3 รอบ');
C.restartScenario(nav);
check(V2S.branchShops().length === 0, 'Restart 9B: กลับจุดเริ่มต้น (ไม่มีร้าน)');
C.startScenario('s9b', nav);
check(V2S.branchShops().length === 0 && demo().current.operatorId === 'OP-012', 'Start Independently: เริ่มได้ด้วยบัญชี OP-012');
W.resetAllDemoData();
check(V2S.branchShops().length === 0, 'Reset Demo Data: OP-012 ไม่มีร้าน');
check(S.useOperatorStore.getState().items.find((o) => o.id === 'OP-012')!.kycStatus === 'verified', '  บัญชี OP-012 ยืนยันตัวตนแล้ว (Level 1) พร้อมเริ่ม');

// ================================================================ P7-F
describe('P7-F — หมวดสินค้าของการเปรียบเทียบ');
const food = analyzeCase('cheap_popular', 'อาหารและเครื่องดื่ม');
const beauty = analyzeCase('cheap_popular', 'ความงามและสุขภาพ');
check(food.snap.listings.every((l) => l.category === 'อาหารและเครื่องดื่ม') && beauty.snap.listings.every((l) => l.category === 'ความงามและสุขภาพ'), 'สินค้าในกรณีเปรียบเทียบเปลี่ยนตามหมวดที่เลือก');
check(effectiveCategory('หมวดที่ไม่มีในแคตตาล็อก') === 'ของใช้ในบ้าน' && effectiveCategory('อาหารและเครื่องดื่ม') === 'อาหารและเครื่องดื่ม', 'หมวดที่ไม่มีสินค้าตัวอย่างระบุหมวดที่ใช้แทนชัดเจน');
const watchBeauty = beauty.price.findings.filter((f) => f.level === 'watch').length;
const watchFood = food.price.findings.filter((f) => f.level === 'watch').length;
check(watchFood <= watchBeauty, `ความเสี่ยงของสินค้าตามหมวดมีผล: ราคาต่ำในอาหาร ${watchFood} รายการควรตรวจสอบ · ความงาม ${watchBeauty} รายการ`);
W.resetAllDemoData();
const analysis = view('/m/marketplace/analysis?tab=compare', { role: 'merchant', operatorId: 'OP-005' });
check(analysis.includes('หมวดสินค้าที่ใช้เปรียบเทียบ') && analysis.includes('อาหารและเครื่องดื่ม (หมวดของร้านคุณ)'), 'หน้าเปรียบเทียบใช้หมวดของร้านที่เลือกเป็นค่าเริ่มต้น');
check(!analysis.includes('เปรียบเทียบต่างหมวดกับร้านของคุณ'), '  หมวดเดียวกัน → ไม่แสดงคำเตือนข้ามหมวด');

// ================================================================ P7-G
describe('P7-G — Admin Dashboard v2');
W.resetAllDemoData();
const base = stats();
const k = base.kpi;
const merchants = S.useMerchantStore.getState().items;
const live = S.useMarketplaceStore.getState().items.filter((c) => c.status !== 'disconnected');
check(k.connectionSuccess === live.filter((c) => c.status === 'connected').length && k.connectionFailed === live.filter((c) => c.status === 'sync_failed').length, `Connection สำเร็จ ${k.connectionSuccess} / ไม่สำเร็จ ${k.connectionFailed} ตรงกับ State`);
check(base.platforms.reduce((s, p) => s + p.total, 0) === k.connections, '  ผลรวมตามแพลตฟอร์ม = จำนวนการเชื่อมต่อทั้งหมด');
check(base.bandData.reduce((s, d) => s + d.value, 0) === k.assessed && k.assessed === new Set(S.useAssessmentStore.getState().items.map((a) => a.merchantId)).size, `  ร้านตาม Band รวม = ร้านที่มีผลประเมิน (${k.assessed}) — นับร้านละครั้ง`);
check(base.confidenceData.reduce((s, d) => s + d.value, 0) === k.assessed, '  การกระจาย Confidence รวม = ร้านที่มีผลประเมิน');
check(k.connectedMerchants + k.selfRegistered <= merchants.length, '  ร้านที่เชื่อม Marketplace + ลงทะเบียนเอง ไม่เกินจำนวนร้าน');
check(k.revoked === 1, `  ใบรับรองที่ถูกเพิกถอนตามข้อมูลตัวอย่าง = ${k.revoked}`);
const adminPage = view('/admin', { role: 'admin' });
check(adminPage.includes('SME Trust — Marketplace & Trust Assessment') && adminPage.includes('ข้อมูลจำลองทั้งหมด') && adminPage.includes('จำนวน SME ทั้งหมด'), 'หน้า Admin มี KPI v2 พร้อมหมายเหตุข้อมูลจำลอง และ Dashboard v1 เดิมยังอยู่');
// เปลี่ยนตาม Scenario
C.startScenario('s13', nav, { journey: true });
const afterJourney = stats().kpi;
check(afterJourney.approved === k.approved + 1, `หลัง Scenario 12 อนุมัติ: อนุมัติการรับรอง ${k.approved} → ${afterJourney.approved}`);
W.resetAllDemoData();
check(JSON.stringify(stats()) === JSON.stringify(base), 'Reset Demo Data → KPI กลับค่าเริ่มต้น');

// ================================================================ P7-I
describe('Release — v2 แทน v1 ที่ /sme-trust/: Namespace ของ localStorage');
const { STORAGE_PREFIX, LEGACY_V1_PREFIX } = await import('@/stores/createEntityStore');
check(STORAGE_PREFIX === 'smetrust:v2:' && LEGACY_V1_PREFIX === 'smetrust:v1:', 'v2 ใช้ smetrust:v2: ทุก Base path (ไม่ชนกับข้อมูลเก่าของ v1)');
const persistedKeys = Object.keys(storage).filter((k) => k.startsWith('smetrust:'));
check(persistedKeys.length > 0 && persistedKeys.every((k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(LEGACY_V1_PREFIX)), `ทุกคีย์ที่ v2 เขียนอยู่ใต้ ${STORAGE_PREFIX} (${persistedKeys.filter((k) => k.startsWith(STORAGE_PREFIX)).length} คีย์)`);
const appUrlSrc = (await import('node:fs')).readFileSync(new URL('../../src/utils/appUrl.ts', import.meta.url), 'utf8');
const mainSrc = (await import('node:fs')).readFileSync(new URL('../../src/main.tsx', import.meta.url), 'utf8');
check(!/__p|replaceState/.test(appUrlSrc + mainSrc), 'ไม่มีการเขียน URL ใหม่ตอนเริ่มแอป (404.html = index.html เปิดเส้นทางเดิมโดยตรง)');

describe('Release — โหลดไฟล์หน้าแบบลองซ้ำ (Firefox ยกเลิก Dynamic import ระหว่างเปลี่ยนหน้า / เครือข่ายสะดุด)');
const { withRetry, RETRY_DELAYS_MS } = await import('@/routes/lazyPage');
const waits: number[] = [];
const fakeWait = (ms: number) => (waits.push(ms), Promise.resolve());
let calls = 0;
const flaky = () => (++calls === 1 ? Promise.reject(new Error('chunk aborted')) : Promise.resolve('page'));
check((await withRetry(flaky, RETRY_DELAYS_MS, fakeWait)) === 'page' && calls === 2 && waits.join() === '500', 'ล้มเหลวครั้งแรก → รอ 500ms แล้วโหลดสำเร็จ');
calls = 0;
waits.length = 0;
const original = new Error('chunk missing');
let thrown: unknown;
await withRetry(() => (++calls, Promise.reject(original)), RETRY_DELAYS_MS, fakeWait).catch((e) => (thrown = e));
check(thrown === original && calls === 3 && waits.join() === '500,1500', 'ล้มเหลวทุกครั้ง → ลองทั้งหมด 3 ครั้ง แล้วส่ง Error เดิมให้ ErrorBoundary (ไม่ซ่อนปัญหา)');
calls = 0;
waits.length = 0;
check((await withRetry(() => (++calls, Promise.resolve(1)), RETRY_DELAYS_MS, fakeWait)) === 1 && calls === 1 && waits.length === 0, 'โหลดสำเร็จครั้งแรก → ไม่รอและไม่โหลดซ้ำ');

finish();
