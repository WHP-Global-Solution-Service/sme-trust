/**
 * Automation First, Human by Exception
 * ครอบคลุม: Auto Assessment, Automatic Badge, AUTO_PASS, AUTO_REQUEST_INFO, MANUAL_REVIEW, No Duplicate Officer Tasks,
 * Assessment Recalculation, Badge State Update, Missing Data, Low Confidence, High Risk, Identity Mismatch,
 * Suspended / Revoked, Consumer Visibility, Certification Independence, Merchant Change Request,
 * Restart / Refresh / Reset, Scenario Regression, No External API Calls
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { S, W, view, describe, check, finish, actAs } from '../harness.mts';

const V = await import('@/stores/workflowsV2');
const AU = await import('@/stores/automation');
const V2S = await import('@/mock/scenarios/v2');
const R = await import('@/features/automation/router');
const KPI = await import('@/features/automation/kpi');
const POL = await import('@/features/automation/policy');
const AF = await import('@/features/marketplace/autofill');
const SC = await import('@/mock/scenarios');
const { seed } = await import('@/mock/data');
const C = await import('@/demo/controller');

const MID = 'M-005';
const asOfficer = () => S.useSessionStore.setState({ role: 'officer', officerId: 'OF-001' });
const asMerchant = () => S.useSessionStore.setState({ role: 'merchant', operatorId: 'OP-005', merchantLoggedIn: true });
const badge = (id = MID) => S.useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === id);
const tasks = (id = MID) => S.useOfficerTaskStore.getState().items.filter((t) => t.merchantId === id);
const runs = (id = MID) => S.useAutomationRunStore.getState().items.filter((r) => r.merchantId === id);
const assessments = (id = MID) => S.useAssessmentStore.getState().items.filter((a) => a.merchantId === id);
const certsJson = () => JSON.stringify(S.useCertificationStore.getState().items);
const notes = (title: string) => S.useNotificationStore.getState().items.filter((n) => n.title.includes(title));
const conn = (id: string) => S.useMarketplaceStore.getState().items.find((c) => c.id === id)!;

/** ร้าน M-005 เริ่มจากยังไม่เชื่อมต่อ แล้วเชื่อม + ยินยอม + ซิงก์ (เหมือนผู้ใช้กดยืนยันนำเข้า) */
function connect(archetype: Parameters<typeof V.connectMarketplace>[2], platform: 'shopee' | 'lazada' = 'shopee') {
  const c = actAs('merchant', () => V.connectMarketplace(MID, platform, archetype));
  actAs('merchant', () => V.grantConsent(c.id));
  V.completeSync(c.id, true);
  return conn(c.id);
}

W.resetAllDemoData();
asMerchant();

// ------------------------------------------------------------------ Seed
describe('สถานะเริ่มต้น (Seed) — คำนวณด้วยกฎเดียวกับแอป');
{
  const bs = S.useAssessmentBadgeStore.getState().items;
  check(bs.length === 10 && S.useAutomationRunStore.getState().items.length === 10, 'มี Badge และบันทึกการประมวลผลตั้งต้นของ 10 ร้านที่มีผลประเมิน');
  check(badge('M-001')?.status === 'active' && badge('M-001')?.route === 'AUTO_PASS', 'M-001 (ข้อมูลครบ ไม่มีสัญญาณ) → AUTO_PASS + Badge แสดงได้');
  check(badge('M-002')?.status === 'insufficient' && badge('M-002')?.route === 'AUTO_REQUEST_INFO', 'M-002 (ร้านใหม่ ข้อมูลน้อย) → AUTO_REQUEST_INFO + Insufficient Data');
  check(badge('M-003')?.route === 'AUTO_PASS' && badge('M-003')?.band === 'B', 'M-003 (สัญญาณทั่วไปข้อเดียว) → ไม่ส่งเจ้าหน้าที่ Band สูงสุด B');
  check(badge('M-004')?.status === 'suspended' && badge('M-008')?.status === 'revoked', 'M-004 Suspended / M-008 Revoked → ไม่แสดง Badge แม้ผลประเมินสูง');
  check(badge('M-009')?.status === 'withheld' && badge('M-012')?.status === 'withheld', 'ร้านที่มีเรื่องพิจารณาความเสี่ยงเปิดอยู่ → ระงับการแสดงระหว่างพิจารณา');
  check(S.useOfficerTaskStore.getState().items.length === 0, 'Seed ไม่สร้างงานซ้ำ — ประเด็นของร้านที่มีมาตรการอยู่แล้วรวมกับเรื่องเดิม');
  check(JSON.stringify(seed.assessmentBadges()) === JSON.stringify(seed.assessmentBadges()), 'Seed สร้างซ้ำได้ผลเดิมทุกไบต์');
}

// ------------------------------------------------------------------ AUTO_PASS
describe('Auto Assessment + Automatic Badge Generation + AUTO_PASS');
V2S.fixtureV2Clean();
check(!badge() && tasks().length === 0 && runs().length === 0 && assessments().length === 0, 'fixture ล้าง Badge งาน บันทึก และผลประเมินของร้าน');
const certsBefore = certsJson();
const good = connect('established_good');
{
  const a = V.latestAssessment(MID)!;
  const b = badge()!;
  check(!!a && a.origin === 'automation' && a.status === 'draft', 'ยืนยันนำเข้า → ระบบประเมินด้วย Engine เอง (origin = automation) โดยร้านไม่ต้องกดประเมิน');
  check(b?.status === 'active' && b.route === 'AUTO_PASS' && b.assessmentId === a.id, 'สร้าง Assessment Badge อัตโนมัติ ผูกกับผลประเมินล่าสุด');
  check(b.modelVersion === a.result.modelVersion && b.history.length === 1 && b.history[0].trigger === 'import', 'บันทึก Model Version และประวัติ Badge (เหตุการณ์ = นำเข้าข้อมูล)');
  check(tasks().length === 0, 'AUTO_PASS ไม่สร้างงานให้เจ้าหน้าที่');
  check(notes('ได้รับ Trust Assessment Badge อัตโนมัติ').length === 1, 'แจ้งร้านค้าว่าได้รับ Badge อัตโนมัติ');
  check(runs().length === 1 && runs()[0].reassessed && runs()[0].route === 'AUTO_PASS', 'บันทึกการประมวลผล (ประเมินใหม่ · AUTO_PASS)');
  check(S.useAuditStore.getState().items.some((x) => x.target === b.id && x.actorRole === 'system'), 'Audit Log บันทึกการอัปเดต Badge โดยระบบ');
  check(certsJson() === certsBefore, 'Certification Independence: ใบรับรองไม่เปลี่ยน');
}

describe('No duplicate · Assessment Recalculation · Badge State Update');
{
  const a1 = V.latestAssessment(MID)!.id;
  const hist = badge()!.history.length;
  AU.processMerchant(MID, 'simulation');
  AU.processMerchant(MID, 'simulation');
  AU.processAll('simulation');
  check(assessments().length === 1 && V.latestAssessment(MID)!.id === a1, 'ประมวลผลซ้ำ/Refresh ด้วยข้อมูลเดิม → ไม่สร้างผลประเมินใหม่');
  check(badge()!.history.length === hist && notes('ได้รับ Trust Assessment Badge อัตโนมัติ').length === 1, 'ข้อมูลไม่เปลี่ยน → ไม่บันทึกประวัติ Badge และไม่แจ้งเตือนซ้ำ');
  check(runs()[0].reassessed === false, 'บันทึกว่าใช้ผลประเมินเดิม (ข้อมูลไม่เปลี่ยน)');
  V.simulateDataAge(good.id, 'stale');
  check(V.latestAssessment(MID)!.result.computedAt >= runs()[1].at && badge()!.status === 'needs_update' && badge()!.route === 'AUTO_REQUEST_INFO', 'ข้อมูลหมดอายุ (180 วัน) → ประเมินใหม่ → AUTO_REQUEST_INFO · Badge รอร้านอัปเดตข้อมูล');
  check(badge()!.history.length === hist + 1 && badge()!.history[0].trigger === 'data_age', 'Badge บันทึกประวัติเมื่อสถานะเปลี่ยน (เหตุการณ์ = อายุข้อมูล)');
  check(notes('ต้องอัปเดตข้อมูลก่อนแสดง Assessment Badge').length === 1 && tasks().length === 0, 'แจ้งร้านให้ซิงก์เอง — ไม่สร้างงานเจ้าหน้าที่');
  actAs('merchant', () => V.resyncMarketplace(good.id));
  V.completeSync(good.id, true);
  check(badge()!.status === 'active' && runs()[0].trigger === 'sync', 'ร้านซิงก์ใหม่ → ประเมินซ้ำอัตโนมัติ → Badge กลับมาแสดง');
}

describe('Merchant ประเมินเองแล้วระบบจัดเส้นทางต่อ (origin = merchant)');
{
  const a = actAs('merchant', () => V.runAssessment(MID))!;
  check(a.origin === 'merchant' && runs()[0].trigger === 'merchant_assessment' && badge()!.assessmentId === a.id, 'ร้านกดประเมินใหม่ → ระบบใช้ผลนั้นจัดเส้นทางและอัปเดต Badge');
}

// ------------------------------------------------------------------ AUTO_REQUEST_INFO / Missing Data
describe('AUTO_REQUEST_INFO — Missing Data');
V2S.fixtureV2Clean();
connect('new_shop');
{
  const b = badge()!;
  check(b.status === 'insufficient' && b.route === 'AUTO_REQUEST_INFO', 'ร้านเปิดใหม่ (ข้อมูลน้อย) → Insufficient Data · AUTO_REQUEST_INFO');
  check(tasks().length === 0, 'ข้อมูลไม่พอไม่ใช่เหตุส่งเจ้าหน้าที่');
  check(notes('ข้อมูลยังไม่เพียงพอสำหรับ Assessment Badge').length >= 1, 'แจ้งร้านพร้อมสิ่งที่ต้องเพิ่ม');
  const page = view('/m/trust', { role: 'merchant', operatorId: 'OP-005' });
  check(page.includes('ข้อมูลยังไม่เพียงพอ (Insufficient Data)') && page.includes('ร้านค้าเพิ่มข้อมูลเอง'), 'หน้าร้านค้าแสดง Insufficient Data และคำแนะนำเพิ่มข้อมูล');
}
V2S.fixtureV2Clean();
{
  const latest = V.latestAssessment(MID);
  check(!latest && !badge(), 'ไม่มีการเชื่อมต่อ → ยังไม่ประมวลผล (ไม่สร้าง Badge จากข้อมูลว่าง)');
  const page = view('/m/trust', { role: 'merchant', operatorId: 'OP-005' });
  check(page.includes('ยังไม่มีผลการประมวลผล'), 'หน้าร้านค้าบอกให้เชื่อมต่อ Marketplace ก่อน');
}

// ------------------------------------------------------------------ Router (pure) — Low Confidence / High Risk / Evidence Conflict
describe('Decision Router (Pure) — Low Confidence / High Risk / Evidence Conflict');
{
  const baseAssessment = seed.assessments().find((a) => a.merchantId === 'M-001')!;
  const ctx = (patch: Partial<Parameters<typeof R.routeAssessment>[0]> = {}, result = baseAssessment.result) => ({
    merchantId: 'M-001', result, standing: 'normal' as const, kycVerified: true, connections: [{ id: 'X1', platform: 'shopee' as const, status: 'connected', lastSyncAt: new Date().toISOString(), mockShopId: 'SPE-1', mockShopName: 'ร้าน', ownerName: 'ก', ownerMismatch: false }], cleared: {}, asOf: new Date(), ...patch,
  });
  check(R.routeAssessment(ctx()).route === 'AUTO_PASS', 'ข้อมูลครบ ไม่มีสัญญาณ → AUTO_PASS');
  const low = { ...baseAssessment.result, confidence: { level: 'low' as const, score: 30, reasons: ['ตัวอย่างน้อย'] } };
  const dLow = R.routeAssessment(ctx({}, low));
  check(dLow.route === 'AUTO_REQUEST_INFO' && dLow.issues.some((i) => i.category === 'low_confidence') && R.badgeStatusFor(dLow, low, 'normal') === 'needs_update', 'Low Confidence → AUTO_REQUEST_INFO · Badge ไม่แสดง');
  const sig = (id: string) => ({ id, component: 'risk' as const, label: id, value: '-', impact: -5, direction: 'negative' as const, evidence: [], source: 'marketplace' as const });
  const one = { ...baseAssessment.result, riskFactors: [sig('risk.review-burst')] };
  check(R.routeAssessment(ctx({}, one)).route === 'AUTO_PASS' && R.routeAssessment(ctx({}, one)).issues.some((i) => i.kind === 'advisory'), 'สัญญาณทั่วไปข้อเดียว → ข้อสังเกต (ไม่ส่งตรวจ)');
  const two = { ...baseAssessment.result, riskFactors: [sig('risk.review-burst'), sig('risk.sales-spike')] };
  const dTwo = R.routeAssessment(ctx({}, two));
  check(dTwo.route === 'MANUAL_REVIEW' && dTwo.issues.find((i) => i.category === 'risk_signal')?.priority === 'medium', `สัญญาณทั่วไป ${POL.ROUTING_POLICY.softSignalThreshold} ข้อพร้อมกัน → MANUAL_REVIEW (ปานกลาง)`);
  const hard = { ...baseAssessment.result, riskFactors: [sig('risk.cross')] };
  const dHard = R.routeAssessment(ctx({}, hard));
  check(dHard.route === 'MANUAL_REVIEW' && dHard.issues.find((i) => i.category === 'risk_signal')?.priority === 'high', 'High Risk (สัญญาณร่วม) → MANUAL_REVIEW เร่งด่วน');
  check(dHard.issues.find((i) => i.category === 'risk_signal')!.detail.includes('ไม่ใช่ข้อสรุปว่ากระทำผิด'), 'ข้อความแยกการคัดกรองออกจากการตัดสินว่าทุจริต');
  const fp = dHard.issues.find((i) => i.category === 'risk_signal')!.fingerprint;
  check(R.routeAssessment(ctx({ cleared: { [fp]: 'TSK-1' } }, hard)).route === 'AUTO_PASS', 'ประเด็นที่เจ้าหน้าที่ตรวจแล้ว (Fingerprint เดิม) ไม่ส่งซ้ำ');
  check(R.routeAssessment(ctx({ cleared: { [fp]: 'TSK-1' } }, two)).route === 'MANUAL_REVIEW', 'สัญญาณชุดใหม่ (Fingerprint ต่าง) → ส่งตรวจใหม่');
  const gap = { ...baseAssessment.result, analysis: { ...baseAssessment.result.analysis, reviews: { ...baseAssessment.result.analysis.reviews, platformGap: 1.2 } } };
  check(R.routeAssessment(ctx({}, gap)).issues.some((i) => i.category === 'evidence_conflict' && i.kind === 'manual'), 'คะแนนรีวิวต่างกันระหว่างแพลตฟอร์ม ≥ 0.8 → Evidence Conflict');
  check(R.routeAssessment(ctx({ kycVerified: false })).route === 'AUTO_REQUEST_INFO', 'ยังไม่ยืนยันตัวตน → ร้านทำ e-KYC เอง');
  const measured = R.routeAssessment(ctx({ standing: 'under_review', measureRef: { kind: 'risk_case', id: 'RSK-1', to: '/o/risk/RSK-1' } }, hard));
  check(measured.route === 'MANUAL_REVIEW' && !measured.issues.some((i) => i.category === 'risk_signal') && measured.issues.find((i) => i.category === 'measure')?.handledBy?.id === 'RSK-1', 'มีเรื่องพิจารณาความเสี่ยงอยู่แล้ว → รวมกับเรื่องเดิม ไม่สร้างประเด็นซ้ำ');
  check(R.badgeStatusFor(measured, hard, 'suspended') === 'suspended' && R.badgeStatusFor(measured, hard, 'revoked') === 'revoked', 'Suspended / Revoked มาก่อนผลประเมินเสมอ');
  check(R.publicBadgeView('active').showBadge && !R.publicBadgeView('under_review').showBand && R.publicBadgeView('withheld').showBand, 'ผู้บริโภคเห็น Badge เฉพาะ active · ระหว่างตรวจข้อมูลตัวตน/หลักฐานไม่แสดง Band');
}

// ------------------------------------------------------------------ MANUAL_REVIEW: Identity Mismatch
describe('MANUAL_REVIEW — Identity Mismatch · Evidence Snapshot · No Duplicate Tasks');
V2S.fixtureV2Clean();
const certs2 = certsJson();
const mis = connect('owner_mismatch');
{
  const ts = tasks();
  check(ts.length === 1 && ts[0].category === 'identity_mismatch' && ts[0].priority === 'high' && ts[0].connectionId === mis.id, 'ชื่อเจ้าของบัญชีไม่ตรงผู้ยืนยันตัวตน → งานเจ้าหน้าที่ 1 งาน (เร่งด่วน)');
  check(badge()!.status === 'under_review' && badge()!.route === 'MANUAL_REVIEW', 'ระหว่างตรวจ Badge ไม่แสดง (under_review)');
  const ev = ts[0].evidence;
  check(ev.assessmentId === V.latestAssessment(MID)!.id && ev.connections[0].ownerName.includes('(จำลอง)') && ev.kycName === S.useOperatorStore.getState().items.find((o) => o.id === 'OP-005')!.name, 'แนบ Evidence Snapshot (ผลประเมิน เจ้าของบัญชีจาก Raw Source และผู้ยืนยันตัวตน)');
  check(ts[0].summary.includes('ระบบตัดสินเองไม่ได้'), 'งานมีเหตุผลที่ระบบส่งมาให้ตรวจ');
  check(notes('กรณียกเว้นรอตรวจสอบ').length === 1 && notes('ข้อมูลบางส่วนส่งให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม').length === 1, 'แจ้งเจ้าหน้าที่และร้านค้า');
  AU.processMerchant(MID, 'simulation');
  AU.processAll('simulation');
  actAs('merchant', () => V.resyncMarketplace(mis.id));
  V.completeSync(mis.id, true);
  check(tasks().length === 1 && notes('กรณียกเว้นรอตรวจสอบ').length === 1, 'Refresh / ประเมินซ้ำ / ซิงก์ซ้ำ → ไม่สร้างงานหรือแจ้งเตือนซ้ำ');
  const consumer = view(`/shop/${MID}`, { role: 'consumer' });
  check(consumer.includes('อยู่ระหว่างตรวจสอบเพิ่มเติม') && !consumer.includes('Band A — น่าเชื่อถือสูง') && !consumer.includes(ts[0].id), 'ผู้บริโภค: ไม่แสดง Band/Badge ระหว่างตรวจ และไม่เห็นงานของเจ้าหน้าที่');
  const officer = view(`/o/exceptions/${ts[0].id}`, { role: 'officer', officerId: 'OF-001' });
  check(officer.includes('Evidence Snapshot') && officer.includes('เหตุผลที่ระบบส่งมาให้ตรวจ') && officer.includes('ขอข้อมูลเพิ่มเติม'), 'หน้าเจ้าหน้าที่: หลักฐาน เหตุผล และปุ่ม Approve / Reject / Request Info');
  const q = view('/o/exceptions?tab=identity', { role: 'officer', officerId: 'OF-001' });
  check(q.includes(ts[0].id) && q.includes('Identity Mismatch') && q.includes('เหตุผลที่ส่งตรวจ'), 'Exception Queue แสดงงานในหมวด Identity Mismatch พร้อมเหตุผล');
}

describe('Request More Information → ร้านตอบ → งานเดิมกลับเข้าคิว');
{
  const id = tasks()[0].id;
  asOfficer();
  check(!actAs(['officer', 'admin'], () => AU.resolveTask(id, 'request_info', 'สั้น')).ok, 'ต้องมีเหตุผลอย่างน้อย 5 ตัวอักษร');
  check(actAs(['officer', 'admin'], () => AU.resolveTask(id, 'request_info', 'กรุณาส่งหลักฐานความเป็นเจ้าของบัญชีร้าน')).ok && tasks()[0].status === 'info_requested', 'ขอข้อมูลเพิ่ม → สถานะรอข้อมูลจากร้านค้า');
  check(notes('เจ้าหน้าที่ขอข้อมูลเพิ่มเติม').length >= 1, 'แจ้งร้านค้า');
  asMerchant();
  const page = view('/m/trust', { role: 'merchant', operatorId: 'OP-005' });
  check(page.includes('กรุณาส่งหลักฐานความเป็นเจ้าของบัญชีร้าน') && page.includes('ส่งข้อมูลให้เจ้าหน้าที่'), 'ร้านค้าเห็นคำขอและแบบฟอร์มตอบกลับ');
  check(actAs('merchant', () => AU.respondToTask(id, 'แนบหนังสือมอบอำนาจจากเจ้าของบัญชี (จำลอง)')).ok && tasks()[0].status === 'open' && tasks().length === 1, 'ร้านตอบ → งานเดิมกลับเข้าคิว (ไม่สร้างงานใหม่)');
  check(!actAs('merchant', () => AU.respondToTask(id, 'ส่งซ้ำอีกครั้งหนึ่ง')).ok, 'ตอบซ้ำไม่ได้เมื่องานไม่ได้รอข้อมูล');
}

describe('Approve → ยืนยันตัวตน → ระบบประเมินและออก Badge ต่อเอง');
{
  const id = tasks()[0].id;
  asOfficer();
  check(actAs(['officer', 'admin'], () => AU.resolveTask(id, 'approve', 'ตรวจหนังสือมอบอำนาจแล้ว เป็นร้านเดียวกัน')).ok, 'อนุมัติได้');
  check(tasks()[0].status === 'approved' && conn(mis.id).identityReview?.status === 'verified', 'บันทึกผลการตรวจข้อมูลตัวตนบนการเชื่อมต่อ');
  check(badge()!.status === 'active' && badge()!.route === 'AUTO_PASS' && runs()[0].trigger === 'officer_decision', 'ระบบประมวลผลใหม่ → AUTO_PASS → Badge แสดง');
  check(!actAs(['officer', 'admin'], () => AU.resolveTask(id, 'approve', 'กดซ้ำอีกครั้งหนึ่ง')).ok && tasks().length === 1, 'กดซ้ำไม่ได้ และไม่มีงานใหม่');
  AU.processAll('simulation');
  check(tasks().length === 1, 'ประมวลผลซ้ำหลังอนุมัติไม่สร้างงานเดิมอีก');
  check(S.useAuditStore.getState().items.some((a) => a.target === id && a.action === 'เจ้าหน้าที่อนุมัติกรณียกเว้น'), 'Audit Log บันทึกการตัดสิน');
  check(certsJson() === certs2, 'Certification Independence: การตัดสินกรณียกเว้นไม่เปลี่ยนใบรับรอง');
}

describe('Reject → ไม่ใช้ข้อมูลจากร้านที่ไม่ใช่ของผู้ประกอบการ (ใบรับรองไม่เปลี่ยน)');
V2S.fixtureV2Clean();
{
  const c = connect('owner_mismatch', 'lazada');
  const id = tasks()[0].id;
  asOfficer();
  const before = certsJson();
  check(actAs(['officer', 'admin'], () => AU.resolveTask(id, 'reject', 'ไม่พบหลักฐานว่าเป็นเจ้าของบัญชีร้าน')).ok && tasks()[0].status === 'rejected', 'ไม่อนุมัติได้');
  check(conn(c.id).identityReview?.status === 'rejected' && V.latestAssessment(MID)!.result.dataSources.length === 0, 'ข้อมูลจากการเชื่อมต่อนี้ไม่ถูกใช้ประเมิน (ประเมินใหม่โดยไม่มีข้อมูลร้านนั้น)');
  check(badge()!.status === 'insufficient' && badge()!.route === 'AUTO_REQUEST_INFO', 'กลับเป็นเส้นทางร้านค้าเพิ่มข้อมูลเอง (เชื่อมร้านของตนเอง)');
  check(certsJson() === before && !S.useRiskStore.getState().items.some((r) => r.merchantId === MID), 'ใบรับรองไม่เปลี่ยน และไม่เปิดเรื่องความเสี่ยงสำหรับกรณีข้อมูลตัวตน');
  AU.processAll('simulation');
  check(tasks().length === 1, 'ไม่สร้างงานซ้ำหลังไม่อนุมัติ');
}

describe('Risk Signal → Reject เปิดเรื่องพิจารณาความเสี่ยงตามกระบวนการเดิม (ไม่ระงับอัตโนมัติ)');
V2S.fixtureV2Clean();
{
  const a = connect('established_good', 'shopee');
  const b = actAs('merchant', () => V.connectMarketplace(MID, 'lazada', 'price_anomaly'));
  actAs('merchant', () => V.grantConsent(b.id));
  V.completeSync(b.id, true);
  // สร้างสัญญาณ 2 ข้อขึ้นไปด้วยข้อมูลจริงจาก Generator: เปลี่ยนร้านที่สองเป็นรีวิวกระจุกตัว + ร้านแรกยอดขายพุ่ง
  S.useMarketplaceStore.getState().update(a.id, { archetype: 'sales_spike', seed: V.seedFor(MID, 'shopee', 'sales_spike', a.id) });
  AU.processMerchant(MID, 'simulation');
  const r = V.latestAssessment(MID)!.result;
  const t = tasks().find((x) => x.category === 'risk_signal' || x.category === 'evidence_conflict');
  if (r.riskFactors.length >= POL.ROUTING_POLICY.softSignalThreshold || (r.analysis.reviews.platformGap ?? 0) >= POL.ROUTING_POLICY.ratingGapConflict) {
    check(!!t && badge()!.status === 'under_review', `พบประเด็นที่ต้องพิจารณา (${r.riskFactors.map((f) => f.id).join(', ') || 'rating gap'}) → งานเจ้าหน้าที่ + Badge ไม่แสดง`);
    asOfficer();
    const certB = certsJson();
    check(actAs(['officer', 'admin'], () => AU.resolveTask(t!.id, 'reject', 'พบประเด็นที่ต้องให้ร้านชี้แจงเพิ่มเติม')).ok, 'ไม่อนุมัติได้');
    const rsk = S.useRiskStore.getState().items.find((x) => x.merchantId === MID);
    check(!!rsk && tasks().find((x) => x.id === t!.id)!.resolution?.riskCaseId === rsk.id, 'เปิดเรื่องพิจารณาความเสี่ยง (ร้านชี้แจง/อุทธรณ์ได้)');
    check(badge()!.status === 'withheld' && certsJson() === certB, 'Badge ระงับการแสดงระหว่างพิจารณา · ใบรับรองไม่ถูกระงับอัตโนมัติ');
    check(tasks().filter((x) => x.status === 'open').length === 0, 'ประเด็นอื่นที่เปิดอยู่รวมเข้ากับเรื่องพิจารณาความเสี่ยง (ปิดอัตโนมัติพร้อมเหตุผล)');
  } else {
    check(false, `ข้อมูลทดสอบไม่เกิดสัญญาณตามที่คาด (${r.riskFactors.map((f) => f.id).join(', ')})`);
  }
}

// ------------------------------------------------------------------ Suspended / Revoked via v1 workflow
describe('Suspended / Revoked — Workflow เดิมเปลี่ยนสถานะ → Badge อัปเดตทันที');
W.resetAllDemoData();
asOfficer();
{
  const cert = S.useCertificationStore.getState().items.find((c) => c.merchantId === 'M-001' && c.status === 'active')!;
  const nBefore = S.useAssessmentStore.getState().items.length;
  check(actAs(['officer', 'admin'], () => W.setCertStatus(cert.id, 'suspended', 'ทดสอบระงับการรับรองชั่วคราว')).ok, 'เจ้าหน้าที่ระงับใบรับรอง (Workflow เดิม)');
  check(badge('M-001')!.status === 'suspended' && badge('M-001')!.history[0].trigger === 'measure_change', 'Badge เปลี่ยนเป็น Suspended ทันที (ไม่แสดงต่อผู้บริโภค)');
  check(S.useAssessmentStore.getState().items.length === nBefore, 'มาตรการเปลี่ยนไม่สร้างผลประเมินใหม่ (สถานะอ่านจากข้อมูลปัจจุบัน)');
  check(!view('/shop/M-001', { role: 'consumer' }).includes('Trust Assessment Badge Band'), 'ผู้บริโภคไม่เห็น Badge ของร้านที่ถูกระงับ');
  check(actAs(['officer', 'admin'], () => W.setCertStatus(cert.id, 'active', 'คืนสถานะหลังตรวจสอบแล้ว')).ok && badge('M-001')!.status === 'active', 'คืนสถานะ → Badge กลับมาแสดง');
}

// ------------------------------------------------------------------ Consumer visibility
describe('Consumer Visibility');
{
  const page = view('/shop/M-001', { role: 'consumer' });
  check(page.includes('Trust Assessment Badge') && page.includes('ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง'), 'ผู้บริโภคเห็น Assessment Badge พร้อมข้อความว่าไม่ใช่การรับรอง');
  check(!/คะแนนภายใน|คะแนน \d+(\.\d)?\/100/.test(page) && !page.includes('AUTO_PASS') && !page.includes('TSK-'), 'ไม่แสดงคะแนนภายใน เส้นทางของระบบ หรืองานของเจ้าหน้าที่');
  check(view('/shop/M-002', { role: 'consumer' }).includes('ข้อมูลยังไม่เพียงพอสำหรับ Assessment Badge'), 'ร้านที่ข้อมูลไม่พอ: ผู้บริโภคเห็นว่าไม่ใช่ผลลบ');
}

// ------------------------------------------------------------------ Merchant change request (ข้อ 6)
describe('Merchant Profile Change Automation (ข้อ 6)');
W.resetAllDemoData();
asMerchant();
{
  const src = { platform: 'shopee', shopName: 'ร้านต้นฉบับ', description: 'd', category: 'อาหาร' } as unknown as Parameters<typeof AF.importedValues>[0];
  const reg = { shopName: 'ร้านชื่อใหม่ที่อนุมัติแล้ว', description: 'x', category: 'อาหาร', phone: '0', email: 'e', province: 'p', district: 'd', address: '' };
  const rules = AF.profileUpdateRules(src, reg);
  check(AF.fieldStatus('shopName', 'ร้านต้นฉบับ', rules) === 'source_verified', 'ชื่อร้านเปลี่ยนเป็นค่าที่ตรงกับต้นฉบับ Marketplace → ตรวจสอบอัตโนมัติ');
  check(AF.fieldStatus('shopName', 'ชื่ออื่นที่ตรวจไม่ได้', rules) === 'verification_required', 'ค่าที่ไม่ตรงแหล่งอ้างอิง → ส่งเจ้าหน้าที่ (Exception)');
  check(AF.fieldStatus('description', 'คำอธิบายใหม่', rules) === 'user_edited', 'ข้อมูลทั่วไป → บันทึกเองได้');
  check(AF.fieldStatus('shopName', 'ร้านต้นฉบับ', AF.newRegistrationRules(src)) === 'imported', 'เส้นทางสมัครใหม่ไม่เปลี่ยน');
  // ร้านเดิมที่ชื่อร้านต้นฉบับต่างจากชื่อที่ลงทะเบียน (หลังเจ้าหน้าที่อนุมัติเปลี่ยนชื่อ) กลับไปใช้ชื่อต้นฉบับ → บันทึกได้ทันที
  V2S.fixtureV2Clean();
  const c = connect('established_good');
  S.useMarketplaceStore.getState().update(c.id, { sourceShopName: 'ดอยสูงต้นฉบับ' });
  const before = certsJson();
  const values = { ...V.registeredValues(S.useMerchantStore.getState().items.find((m) => m.id === MID)!), shopName: 'ดอยสูงต้นฉบับ' };
  const res = actAs('merchant', () => V.confirmProfileUpdate(c.id, values, 'draft-auto-1'));
  const m = S.useMerchantStore.getState().items.find((x) => x.id === MID)!;
  check(res.ok && m.shopName === 'ดอยสูงต้นฉบับ' && !res.record?.changeRequestId && S.useProfileChangeStore.getState().items.length === 0, 'ตรงกับต้นฉบับ → บันทึกอัตโนมัติ ไม่สร้างคำขอให้เจ้าหน้าที่');
  check(S.useAuditStore.getState().items.some((a) => a.action.startsWith('ตรวจสอบข้อมูลร้านอัตโนมัติ')), 'Audit Log บันทึกการตรวจสอบอัตโนมัติ');
  const res2 = actAs('merchant', () => V.confirmProfileUpdate(c.id, { ...values, shopName: 'ชื่อที่ตรวจไม่ได้' }, 'draft-auto-2'));
  check(res2.ok && !!res2.record?.changeRequestId && S.useMerchantStore.getState().items.find((x) => x.id === MID)!.shopName === 'ดอยสูงต้นฉบับ', 'ชื่อที่ตรวจไม่ได้ → Workflow อนุมัติชื่อร้านเดิม (ข้อมูลเดิมใช้ต่อ)');
  check(certsJson() === before, 'ใบรับรองไม่เปลี่ยน');
  const snapBefore = JSON.stringify(V.latestAssessment(MID)!.result.analysis);
  actAs('merchant', () => V.confirmProfileUpdate(c.id, { ...values, description: 'แก้คำอธิบายเพื่อทดสอบ' }, 'draft-auto-3'));
  AU.processMerchant(MID, 'simulation');
  check(JSON.stringify(V.latestAssessment(MID)!.result.analysis) === snapBefore, 'ร้านแก้โปรไฟล์ไม่เปลี่ยนข้อมูลต้นฉบับ Marketplace และผลวิเคราะห์ที่ใช้ประเมิน');
}

// ------------------------------------------------------------------ KPI
describe('KPI จาก Mock State');
W.resetAllDemoData();
{
  const k = KPI.automationKpis(S.useAutomationRunStore.getState().items, S.useOfficerTaskStore.getState().items, S.useAssessmentBadgeStore.getState().items);
  check(k.processed === 10 && k.autoPass === 5 && k.requestInfo === 1 && k.manual === 4 && k.manualRatio === 40, `KPI ตั้งต้น: ผ่าน ${k.autoPass} · เพิ่มข้อมูลเอง ${k.requestInfo} · ส่งเจ้าหน้าที่ ${k.manual} (${k.manualRatio}%)`);
  const page = view('/o/automation', { role: 'officer', officerId: 'OF-001' });
  check(page.includes('ไม่ใช่ผลการลดภาระงานที่วัดจากการใช้งานจริง') && page.includes('Certification Governance') && page.includes('เจ้าหน้าที่อนุมัติ'), 'หน้ากฎอัตโนมัติ: KPI พร้อมคำเตือน และตาราง Certification Policy');
  check(POL.CERTIFICATION_POLICY.filter((p) => p.level >= 2).every((p) => p.mode === 'officer_approval' && !p.autoApprovalAuthorized) && POL.certNeedsOfficer(3) && !POL.certNeedsOfficer(1), 'Certification Policy คงกฎเดิม: Level 1 อัตโนมัติ (e-KYC) · Level 2–4 เจ้าหน้าที่อนุมัติ');
  const dash = view('/o', { role: 'officer', officerId: 'OF-001' });
  check(['Pending Manual Review', 'High Priority Cases', 'Identity Mismatch', 'Evidence Conflicts', 'Certification Requests', 'Escalated Complaints', 'Completed Reviews'].every((t) => dash.includes(t)), 'Officer Dashboard เน้น Exception Queue ครบ 7 หมวด');
}

// ------------------------------------------------------------------ Restart / Refresh / Reset + Scenario regression
describe('Restart / Refresh / Reset · Scenario Regression');
{
  check(SC.allScenarios.length === 17 && SC.allScenarios.some((s) => s.id === 's14') && SC.allScenarios.some((s) => s.id === 's15'), 'Demo มี 17 Scenario (เดิม 15 + Scenario 14 / 15)');
  check(SC.journeyScenarios('v1').length === 8 && SC.journeyScenarios('v2').length === 5, 'Full Journey เดิมไม่เปลี่ยน (8 + 5 Scenario)');
  const s14 = SC.allScenarios.find((s) => s.id === 's14')!;
  check(!s14.steps.some((st) => st.role === 'officer' || st.role === 'admin'), 'Scenario 14 (เส้นทางปกติ) ไม่มีขั้นตอนของเจ้าหน้าที่');
  const s15 = SC.allScenarios.find((s) => s.id === 's15')!;
  check(s15.steps.some((st) => st.role === 'officer'), 'Scenario 15 (กรณียกเว้น) มีขั้นตอนเจ้าหน้าที่');
  // เล่น Scenario 15 แบบ Logic: เริ่ม → เชื่อมร้านตัวอย่าง → มีงาน 1 งาน → Restart → งานหายและเริ่มใหม่ได้ไม่ซ้ำ
  const nav = () => {};
  C.startScenario('s15', nav as never);
  asMerchant();
  connect('owner_mismatch');
  check(tasks().length === 1, 'เล่น Scenario 15: ระบบสร้างงาน 1 งาน');
  C.restartScenario(nav as never);
  check(tasks().length === 0 && !badge(), 'Restart Scenario → คืนข้อมูลจุดเริ่มต้น (ไม่มีงาน/Badge ค้าง)');
  connect('owner_mismatch');
  check(tasks().length === 1, 'เล่นซ้ำหลัง Restart ได้งานเดียวเหมือนเดิม');
  W.resetAllDemoData();
  check(S.useOfficerTaskStore.getState().items.length === 0 && S.useAssessmentBadgeStore.getState().items.length === 10 && badge()?.status === 'active', 'Reset Demo Data → กลับเป็นสถานะตั้งต้น');
  // Refresh = โหลด State จาก localStorage ใหม่ → ประมวลผลซ้ำไม่สร้างงาน/ประวัติเพิ่ม
  const snapshot = JSON.stringify([S.useOfficerTaskStore.getState().items, S.useAssessmentBadgeStore.getState().items.map((b) => b.history)]);
  AU.processAll('simulation');
  check(JSON.stringify([S.useOfficerTaskStore.getState().items, S.useAssessmentBadgeStore.getState().items.map((b) => b.history)]) === snapshot, 'Run Simulation ซ้ำบนข้อมูลตั้งต้น → ไม่สร้างงานหรือประวัติ Badge ใหม่');
}

// ------------------------------------------------------------------ No external API
describe('No External API Calls');
{
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(ts|tsx)$/.test(f) && files.push(join(d, f))));
  walk('src');
  const bad = files.filter((f) => /\bfetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon|axios/.test(readFileSync(f, 'utf8')));
  check(bad.length === 0, `ไม่มี fetch / XHR / WebSocket ในซอร์สโค้ด${bad.length ? ': ' + bad.join(', ') : ''}`);
  const auto = files.filter((f) => f.includes('automation')).map((f) => readFileSync(f, 'utf8')).join('\n');
  check(!/https?:\/\//.test(auto), 'โมดูลอัตโนมัติไม่อ้าง URL ภายนอก');
}

finish();
