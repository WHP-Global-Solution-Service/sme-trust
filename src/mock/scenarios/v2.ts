/**
 * SME Trust v2 — Marketplace Intelligence (Scenario 9–13 และเส้นทางทางเลือก 9B)
 * ใช้ Workflow, Engine และหน้าจอเดียวกับการใช้งานจริงของต้นแบบ — Demo Controller เปลี่ยนเฉพาะขั้นตอนและบทบาท
 * ข้อมูล Marketplace ทั้งหมดเป็นข้อมูลจำลอง ไม่มีการเชื่อมต่อ API จริง
 */
import { REGISTRATION_STATUS, TRUST_LEVELS } from '@/constants/labels';
import {
  useAssessmentBadgeStore,
  useAutomationRunStore,
  useOfficerTaskStore,
  useAssessmentStore,
  useCertificationStore,
  useImportRecordStore,
  useProfileChangeStore,
  useMarketplaceStore,
  useMerchantStore,
  useNotificationStore,
  useOperatorStore,
  useSessionStore,
  useVerificationStore,
} from '@/stores';
import { seed } from '@/mock/data';
import type { DemoCtx } from '@/stores/demo';
import { attachImportedMarketplaces, changeRequestDraftKey, decideAssessment, importFlowKey, latestAssessment, profileDraftKey, runAssessment, submitAssessment } from '@/stores/workflowsV2';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { BAND_LABEL, CONFIDENCE_LABEL, DECISION_LABEL, RECOMMENDATION_LABEL } from '@/features/trust-assessment/labels';
import { currentCert } from '@/utils/trust';
import { REGISTRATION_ROUTE_LABEL } from '@/features/automation/registration';
import type { ContinuityIssue, GateInput, ScenarioDef, ScenarioOutcome } from '@/demo/types';

/** ร้านค้าตัวอย่างของ Demo v2 — ร้านกาแฟดอยสูง (Level 3 ผ่านเกณฑ์ v1 ของ Level 4) */
export const V2_MERCHANT = 'M-005';
export const V2_OPERATOR = 'OP-005';
/** บัญชีตัวอย่างของเส้นทางทางเลือก — ยืนยันตัวตนแล้ว ยังไม่มีร้าน และไม่มีบัญชี Marketplace */
export const BRANCH_OPERATOR = 'OP-012';
/** บัญชีตัวอย่างของเส้นทางสมัครร้านใหม่ด้วย Auto-Fill (9A) — ยืนยันตัวตนแล้ว ยังไม่มีร้านใน SME Trust แต่มีร้านบน Marketplace (จำลอง) */
export const NEW_SHOP_OPERATOR = 'OP-013';

// ---------- ตัวช่วยอ่านข้อมูล (อ่านอย่างเดียว) ----------
const merchant = (id?: string) => useMerchantStore.getState().items.find((m) => m.id === id);
const operator = (id?: string) => useOperatorStore.getState().items.find((o) => o.id === id);
const connection = (id?: string) => useMarketplaceStore.getState().items.find((c) => c.id === id);
const assessment = (id?: string) => useAssessmentStore.getState().items.find((a) => a.id === id);
const application = (id?: string) => useVerificationStore.getState().items.find((a) => a.id === id);
const certOf = (merchantId?: string) => (merchantId ? currentCert(useCertificationStore.getState().items, merchantId) : undefined);
const shopName = (c: DemoCtx) => merchant(c.merchantId)?.shopName ?? 'ร้านค้า';
const sig = (g: GateInput, k: string) => g.signals[k];
const num = (g: GateInput, k: string) => (typeof g.signals[k] === 'number' ? (g.signals[k] as number) : -1);
const platformOf = (c: DemoCtx) => {
  const x = connection(c.connectionId);
  return x ? PLATFORMS[x.platform].label : 'Marketplace (จำลอง)';
};

/** การเชื่อมต่อที่ร้านเริ่มระหว่างการสาธิตครั้งนี้ (ล่าสุด) */
const newConnection = (g: GateInput) =>
  useMarketplaceStore
    .getState()
    .items.filter((c) => c.merchantId === g.ctx.merchantId && c.createdAt >= g.startedAt && c.status !== 'disconnected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];

/** ผลประเมินที่สร้าง/ประเมินใหม่ระหว่างการสาธิตครั้งนี้ */
const newAssessment = (g: GateInput) => {
  const a = latestAssessment(g.ctx.merchantId ?? '');
  // ผลที่ระบบประเมินอัตโนมัติตอนซิงก์ไม่นับ — ขั้นนี้สาธิตการกดประเมินเอง
  return a && a.createdAt >= g.startedAt && a.origin !== 'automation' ? a : undefined;
};

const connected = (id?: string) => connection(id)?.status === 'connected';

/** ผลประเมินล่าสุดที่เกิดระหว่างการสาธิตครั้งนี้ (รวมผลที่ระบบประเมินอัตโนมัติหลังลงทะเบียน) */
const assessedSince = (g: GateInput) => {
  const a = latestAssessment(g.ctx.merchantId ?? '');
  return a && a.createdAt >= g.startedAt ? a : undefined;
};

/** ผลการตรวจคำขอลงทะเบียนอัตโนมัติ (Automation First) */
/** จำนวนช่องที่ต้องตรวจกับแหล่งอ้างอิง (เช่น ชื่อร้านต่างจากร้านบน Marketplace) — ไม่มีสัญญาณ = 0 */
const verifyCount = (g: GateInput) => Math.max(0, num(g, 'reg.verification'));
const SHOP_NAME_BLOCK = {
  reason: 'ชื่อร้านต่างจากร้านบน Marketplace (จำลอง) — ถ้าส่งคำขอนี้ ระบบจะส่งเจ้าหน้าที่ตรวจเฉพาะกรณี (MANUAL_REVIEW) ซึ่งไม่ใช่เส้นทางปกติของ Demo นี้ · คืนชื่อร้านตามต้นฉบับแล้วแก้ "รายละเอียดสินค้าและบริการ" แทน หรือเปิด Demo เฉพาะกรณี',
  altScenario: 's15',
};
/** คำขอลงทะเบียนไม่ผ่านอัตโนมัติ — อธิบายผลจริงของระบบและทางเลือก (ไม่บังคับผล AUTO_PASS) */
const registrationBlock = (g: GateInput) => {
  const a = application(g.ctx.applicationId);
  if (!a || a.status === 'approved') return undefined;
  const reasons = (a.autoDecision?.reasons ?? []).join(' · ');
  if (a.autoDecision?.route === 'MANUAL_REVIEW')
    return { reason: `ระบบส่งคำขอนี้ให้เจ้าหน้าที่ตรวจเฉพาะกรณี (MANUAL_REVIEW): ${reasons} — ไม่ใช่เส้นทางปกติของ Demo นี้ · Restart Scenario แล้วทำตามคำแนะนำ (คงชื่อร้านตามร้านบน Marketplace) หรือเปิด Demo เฉพาะกรณี`, restart: true, altScenario: 's15' };
  if (a.autoDecision?.route === 'AUTO_REQUEST_INFO')
    return { reason: `ระบบขอข้อมูลเพิ่มเติม (AUTO_REQUEST_INFO): ${reasons} — ร้านค้าแก้ไขเองได้ที่หน้านี้ หรือ Restart Scenario แล้วทำตามคำแนะนำ`, restart: true };
  return undefined;
};

const regLine = (c: DemoCtx) => {
  const a = application(c.applicationId);
  if (!a) return 'ยังไม่มีคำขอ';
  const d = a.autoDecision;
  if (!d) return `สถานะ: ${REGISTRATION_STATUS[a.status].label}`;
  if (d.route === 'AUTO_PASS') return 'ระบบตรวจสอบอัตโนมัติ: ผ่าน (AUTO_PASS) — ลงทะเบียนร้านแล้วโดยไม่ต้องรอเจ้าหน้าที่ · การลงทะเบียนยังไม่ใช่ใบรับรองหรือ Badge';
  return `ระบบตรวจสอบอัตโนมัติ: ${REGISTRATION_ROUTE_LABEL[d.route]} (${d.route}) — ${d.reasons.join(' · ')}`;
};


/** บันทึกการนำเข้า/อัปเดตโปรไฟล์ที่เกิดระหว่างการสาธิตครั้งนี้ (Scenario 9 / 9A) */
const newImport = (g: GateInput, operatorId?: string) =>
  useImportRecordStore
    .getState()
    .items.filter((r) => (operatorId ? r.operatorId === operatorId : r.merchantId === g.ctx.merchantId) && r.createdAt >= g.startedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
const importRecord = (id?: string) => useImportRecordStore.getState().items.find((r) => r.id === id);

// ---------- Fixtures (Idempotent — เรียกซ้ำได้ผลเดิม) ----------
/** ร้านตัวอย่างกลับเป็น "ยังไม่เชื่อมต่อ Marketplace และยังไม่มีผลประเมิน" */
export function fixtureV2Clean(merchantId = V2_MERCHANT) {
  const mk = useMarketplaceStore.getState();
  const session = useSessionStore.getState();
  mk.items
    .filter((c) => c.merchantId === merchantId)
    .forEach((c) => {
      session.saveDraft(profileDraftKey(c.id), undefined);
      mk.remove(c.id);
    });
  const as = useAssessmentStore.getState();
  as.items.filter((a) => a.merchantId === merchantId).forEach((a) => as.remove(a.id));
  // Scenario 9: ล้างบันทึกการนำเข้าและคืนโปรไฟล์ร้านเป็นข้อมูลตั้งต้น (เล่นซ้ำแล้วไม่ซ้อนการอัปเดต) — ใบรับรองไม่ถูกแตะ
  const im = useImportRecordStore.getState();
  im.items.filter((r) => r.merchantId === merchantId).forEach((r) => im.remove(r.id));
  // คำขอเปลี่ยนชื่อร้าน/หมวดที่เกิดจาก Scenario 9 (และฉบับร่างการส่งใหม่)
  const pc = useProfileChangeStore.getState();
  pc.items
    .filter((r) => r.merchantId === merchantId)
    .forEach((r) => {
      session.saveDraft(changeRequestDraftKey(r.id), undefined);
      pc.remove(r.id);
    });
  // Automation First: Badge งานกรณียกเว้น และบันทึกการประมวลผลของร้านนี้ (เล่นซ้ำแล้วเริ่มจาก "ยังไม่เคยประมวลผล")
  const bs = useAssessmentBadgeStore.getState();
  bs.items.filter((b) => b.merchantId === merchantId).forEach((b) => bs.remove(b.id));
  const ts = useOfficerTaskStore.getState();
  ts.items.filter((t) => t.merchantId === merchantId).forEach((t) => ts.remove(t.id));
  useAutomationRunStore.setState({ items: useAutomationRunStore.getState().items.filter((r) => r.merchantId !== merchantId) });
  const original = seed.merchants().find((m) => m.id === merchantId);
  if (original) {
    const { shopName, description, category, phone, email, province, district, address } = original;
    useMerchantStore.getState().update(merchantId, { shopName, description, category, phone, email, province, district, address });
  }
}

/** เชื่อมต่อ Shopee (จำลอง) แบบร้านขายดีให้เรียบร้อยแล้ว (ใช้เมื่อเริ่ม Scenario 10–11 แบบเดี่ยว) */
export function fixtureV2Connected(): DemoCtx {
  fixtureV2Clean();
  const [c] = attachImportedMarketplaces(V2_MERCHANT, [{ platform: 'shopee', archetype: 'established_good' }]);
  return { merchantId: V2_MERCHANT, operatorId: V2_OPERATOR, connectionId: c.id, consumerId: 'CS-001', officerId: 'OF-001' };
}

/** ร้านส่งผลประเมินให้เจ้าหน้าที่พิจารณาแล้ว (Scenario 12 แบบเดี่ยว) */
export function fixtureV2Submitted(): DemoCtx {
  const ctx = fixtureV2Connected();
  // ร้านเป็นผู้ประเมินและส่งผล — สลับเป็นบทบาทผู้ประกอบการชั่วคราว (Action ตรวจสิทธิ์ด้วย authorize)
  const session = useSessionStore.getState();
  const keep = { role: session.role, operatorId: session.operatorId };
  session.set({ role: 'merchant', operatorId: V2_OPERATOR });
  let a: ReturnType<typeof runAssessment>;
  try {
    a = runAssessment(V2_MERCHANT)!;
    submitAssessment(a.id);
  } finally {
    session.set(keep);
  }
  return { ...ctx, assessmentId: a.id, applicationId: assessment(a.id)?.applicationId };
}

/** เจ้าหน้าที่อนุมัติยกระดับตามข้อเสนอและเกณฑ์ v1 แล้ว (Scenario 13 แบบเดี่ยว) */
export function fixtureV2Decided(): DemoCtx {
  const ctx = fixtureV2Submitted();
  const a = assessment(ctx.assessmentId)!;
  const rec = a.result.recommendation;
  const session = useSessionStore.getState();
  const keep = { role: session.role, officerId: session.officerId };
  session.set({ role: 'officer', officerId: 'OF-001' });
  try {
    if (rec.kind === 'consider_l3' || rec.kind === 'consider_l4') decideAssessment(a.id, 'approved', 'ผลประเมินและเกณฑ์การรับรอง ผ่านครบ (ข้อมูลตัวอย่างสำหรับการสาธิต)', rec.level);
    else decideAssessment(a.id, 'need_info', 'ขอข้อมูลเพิ่มเติมก่อนพิจารณา (ข้อมูลตัวอย่างสำหรับการสาธิต)');
  } finally {
    session.set(keep);
  }
  return { ...ctx, certId: certOf(V2_MERCHANT)?.id };
}

/** ร้านของบัญชีเส้นทางทางเลือก (OP-012 / OP-013) — ในข้อมูลตั้งต้นไม่มีร้าน */
export const branchShops = (operatorId = BRANCH_OPERATOR) => useMerchantStore.getState().items.filter((m) => m.operatorId === operatorId);

/**
 * เตรียมเส้นทาง 9B ให้เริ่มได้ทุกครั้ง (Idempotent): ล้างร้านที่ OP-012 สร้างจากการเล่นครั้งก่อน
 * พร้อมคำขอ ใบรับรอง ผลประเมิน การเชื่อมต่อ และการแจ้งเตือนที่เกี่ยวข้อง แล้วคืนบัญชี OP-012 เป็นค่าตั้งต้น
 * ไม่กระทบร้านใน Scenario 9–13 (Audit Log เดิมยังอยู่เพื่อตรวจสอบย้อนหลัง)
 */
export function fixtureBranchClean(operatorId = BRANCH_OPERATOR) {
  const shops = new Set(branchShops(operatorId).map((m) => m.id));
  const drop = <T extends { id: string }>(store: { getState: () => { items: T[]; remove: (id: string) => void } }, hit: (x: T) => boolean) => {
    const st = store.getState();
    st.items.filter(hit).forEach((x) => st.remove(x.id));
  };
  if (shops.size) {
    drop(useVerificationStore, (a) => shops.has(a.merchantId));
    drop(useCertificationStore, (c) => shops.has(c.merchantId));
    drop(useAssessmentStore, (a) => shops.has(a.merchantId));
    drop(useMarketplaceStore, (c) => shops.has(c.merchantId));
    drop(useMerchantStore, (m) => shops.has(m.id));
  }
  drop(useImportRecordStore, (r) => r.operatorId === operatorId);
  drop(useProfileChangeStore, (r) => r.operatorId === operatorId);
  // ฉบับร่างการสมัครและขั้นตอนเชื่อมบัญชีของบัญชีนี้ — เริ่มใหม่จากหน้าแรกของแบบฟอร์ม
  const session = useSessionStore.getState();
  session.saveDraft(operatorId, undefined);
  session.saveDraft(importFlowKey(operatorId), undefined);
  const seedNotes = new Set(seed.notifications().map((n) => n.id));
  drop(useNotificationStore, (n) => n.recipientRole === 'merchant' && n.recipientId === operatorId && !seedNotes.has(n.id));
  const original = seed.operators().find((o) => o.id === operatorId);
  if (original) useOperatorStore.getState().update(operatorId, original);
  return shops.size;
}

// ---------- ความต่อเนื่องของ Full Journey v2 ----------
const sampleShop = `ร้านตัวอย่าง "${'ร้านกาแฟดอยสูง'}" (${V2_MERCHANT})`;

const connectionIssue = (j: DemoCtx): ContinuityIssue | undefined =>
  connected(j.connectionId) && connection(j.connectionId)?.merchantId === j.merchantId
    ? undefined
    : {
        message: j.connectionId ? `การเชื่อมต่อ ${j.connectionId} จาก Scenario 9 ยังซิงก์ข้อมูลไม่สำเร็จ` : 'ยังไม่มีข้อมูล Marketplace ที่เชื่อมต่อสำเร็จจาก Scenario 9',
        fixScenario: 's9',
        fallbackLabel: `ข้อมูล Shopee (จำลอง) ของ${sampleShop}`,
      };

const submittedIssue = (j: DemoCtx): ContinuityIssue | undefined => {
  const a = assessment(j.assessmentId);
  if (a && a.merchantId === j.merchantId && a.status !== 'draft') return undefined;
  return {
    message: a ? `ผลประเมิน ${a.id} จาก Scenario 11 ยังไม่ได้ส่งให้เจ้าหน้าที่พิจารณา` : 'ยังไม่มีผลประเมินจาก Scenario 11',
    fixScenario: 's11',
    fallbackLabel: `ผลประเมินตัวอย่างของ${sampleShop} ที่ส่งพิจารณาแล้ว`,
  };
};

const decidedIssue = (j: DemoCtx): ContinuityIssue | undefined =>
  assessment(j.assessmentId)?.status === 'decided' && merchant(j.merchantId)
    ? undefined
    : { message: 'เจ้าหน้าที่ยังไม่ได้พิจารณาผลประเมินจาก Scenario 12', fixScenario: 's12', fallbackLabel: `${sampleShop} ที่เจ้าหน้าที่พิจารณาแล้ว` };

const base = { consumerId: 'CS-001', officerId: 'OF-001' };
const carryCtx = (j: DemoCtx): DemoCtx => ({ ...base, merchantId: j.merchantId, operatorId: j.operatorId, connectionId: j.connectionId, importId: j.importId, assessmentId: j.assessmentId, applicationId: j.applicationId, certId: j.certId });

/** ผลการพิจารณาจริงของ Scenario 12 — ใช้ทั้งหน้าจบ Scenario 12 และคำอธิบายใน Scenario 13 */
const decisionOf = (c: DemoCtx) => assessment(c.assessmentId)?.decision;
const levelName = (lv?: number) => (lv ? TRUST_LEVELS[lv as 1 | 2 | 3 | 4].name : '-');

/** สิ่งที่ผู้บริโภคเห็นตามผลจริง — ไม่แสดงว่าได้รับอนุมัติเมื่อเจ้าหน้าที่ขอข้อมูลเพิ่มหรือไม่อนุมัติ */
export function decisionOutcome(c: DemoCtx): ScenarioOutcome | undefined {
  const a = assessment(c.assessmentId);
  if (!a) return undefined;
  const d = a.decision;
  const cert = certOf(c.merchantId);
  const active = cert?.status === 'active';
  const certLine = cert ? `ใบรับรองปัจจุบัน ${cert.id} ระดับ ${levelName(cert.level)} (${active ? 'ใช้งานได้' : cert.status})` : 'ร้านยังไม่มีใบรับรองที่ใช้งานได้';
  const app = application(d?.applicationId ?? c.applicationId);
  const appLine = app ? `คำขอ ${app.id}: ${REGISTRATION_STATUS[app.status].label}` : '';
  const keepOld = active ? `ผู้บริโภคเห็นเฉพาะระดับเดิม (${levelName(cert!.level)}) — ไม่มี Badge ระดับใหม่` : 'ผู้บริโภคยังไม่เห็น Badge ของร้านนี้';
  // 9B: เจ้าหน้าที่อาจตัดสินที่คำขอลงทะเบียนโดยตรง (Workflow v1) — แสดงตามสถานะคำขอจริง
  if (!d && app?.status === 'need_info') return { kind: 'need_info', tone: 'warning', title: 'ขอข้อมูลเพิ่มเติม — ยังไม่อนุมัติ', facts: [appLine, certLine], consumerView: keepOld, next: 'ร้านส่งหลักฐานเพิ่มจากหน้า "ร้านของฉัน" แล้วเจ้าหน้าที่พิจารณาอีกครั้ง' };
  if (!d && app?.status === 'rejected') return { kind: 'rejected', tone: 'error', title: 'ไม่อนุมัติคำขอ', facts: [appLine, certLine], consumerView: keepOld, next: 'ร้านปรับปรุงตามเหตุผลแล้วยื่นใหม่ได้' };
  if (!d && app?.status === 'approved') return { kind: 'approved', tone: 'success', title: 'อนุมัติคำขอ', facts: [appLine, certLine], consumerView: active ? `ผู้บริโภคเห็น Badge ระดับ ${levelName(cert!.level)} — Badge ไม่ใช่การรับประกัน` : 'ผู้บริโภคเห็นร้านที่ลงทะเบียนแล้ว', next: 'ร้านเริ่มใช้งานได้ตามระดับที่ได้รับ' };
  if (!d) return { kind: 'pending', tone: 'info', title: 'ยังรอเจ้าหน้าที่พิจารณา', facts: [`ผลประเมิน ${a.id}: ${BAND_LABEL[a.result.band].label}`, appLine, certLine].filter(Boolean), consumerView: keepOld, next: 'ให้เจ้าหน้าที่บันทึกผลการพิจารณาก่อน' };
  const reason = `เหตุผลของเจ้าหน้าที่: ${d.reason}`;
  switch (d.kind) {
    case 'approved':
      return { kind: 'approved', tone: 'success', title: `อนุมัติยกระดับเป็น ${levelName(d.level)}`, facts: [reason, appLine, d.certId ? `ออกใบรับรอง ${d.certId} ผ่าน Certification กระบวนการรับรอง` : certLine].filter(Boolean), consumerView: `ผู้บริโภคเห็น Badge ระดับ ${levelName(d.level)} ที่ตรวจสอบได้ — Badge ไม่ใช่การรับประกัน`, next: 'ดำเนินการต่อ: ผู้บริโภคตรวจสอบร้านและ Badge ใหม่' };
    case 'need_info':
      return { kind: 'need_info', tone: 'warning', title: 'ขอข้อมูลเพิ่มเติม — ยังไม่อนุมัติ', facts: [reason, appLine, 'ไม่มีการออกใบรับรองใหม่', certLine].filter(Boolean), consumerView: `${keepOld} จนกว่าจะได้รับอนุมัติ`, next: 'ร้านส่งข้อมูลเพิ่มจากการแจ้งเตือน แล้วเจ้าหน้าที่พิจารณาอีกครั้ง — หรือดูมุมผู้บริโภคที่ยังไม่มี Badge ใหม่' };
    case 'rejected':
      return { kind: 'rejected', tone: 'error', title: 'ไม่อนุมัติการยกระดับ', facts: [reason, appLine, 'ไม่มีการออกใบรับรองใหม่', certLine].filter(Boolean), consumerView: active ? `${keepOld} — การไม่อนุมัติยกระดับไม่ได้เพิกถอนใบรับรองเดิม` : keepOld, next: 'ร้านปรับปรุงตามเหตุผลแล้วประเมินและยื่นใหม่ได้ — หรือดูมุมผู้บริโภคที่ยังไม่มี Badge ใหม่' };
    case 'escalated':
      return { kind: 'escalated', tone: 'warning', title: 'ส่งเรื่องพิจารณาความเสี่ยง', facts: [reason, d.riskCaseId ? `เปิดเรื่องพิจารณาความเสี่ยง ${d.riskCaseId}` : '', 'ไม่มีการออกใบรับรองใหม่', certLine].filter(Boolean), consumerView: `${keepOld} ระหว่างการพิจารณาความเสี่ยง`, next: 'ร้านชี้แจงผ่านเรื่องพิจารณาความเสี่ยง (กระบวนการรับรอง)' };
  }
}

const bandText = (c: DemoCtx) => {
  const a = assessment(c.assessmentId);
  return a ? `${BAND_LABEL[a.result.band].label} · Coverage ${a.result.coverage.percent}% · ${CONFIDENCE_LABEL[a.result.confidence.level].label}` : '-';
};

export const v2Scenarios: ScenarioDef[] = [
  // ------------------------------------------------------------ 9
  {
    id: 's9',
    no: 9,
    track: 'v2',
    title: 'เชื่อมข้อมูลร้านค้าออนไลน์และเติมโปรไฟล์อัตโนมัติ',
    objective: 'ร้านเดิมให้ความยินยอม (จำลอง) เลือกร้านบน Shopee หรือ Lazada (จำลอง) ตรวจตัวอย่างข้อมูลก่อนนำเข้า แล้วใช้ข้อมูลที่นำเข้าเติมโปรไฟล์ร้านอัตโนมัติ ตรวจ/แก้ไข และยืนยันการอัปเดต — ไม่ใช่การสมัครร้านใหม่',
    keyMessage: 'ร้านค้านำประวัติการขายที่มีอยู่แล้วมาใช้สร้างความน่าเชื่อถือ และลดการกรอกข้อมูลซ้ำ โดยร้านเป็นผู้ยินยอม เห็นข้อมูลก่อน และยืนยันเองเสมอ',
    audience: ['merchant'],
    duration: '≈ 5 นาที',
    caseNote: 'ร้านกาแฟดอยสูง (M-005) ลงทะเบียนและได้รับ Level 3 อยู่แล้ว — Scenario นี้อัปเดตข้อมูลร้านเดิม ไม่สร้างร้านหรือคำขอลงทะเบียนใหม่ และใบรับรองเดิมไม่เปลี่ยน · ร้านใหม่ที่ต้องการสมัครด้วย Auto-Fill ดูเส้นทาง 9A',
    benefits: {
      sme: 'ไม่ต้องกรอกยอดขายหรือข้อมูลร้านซ้ำ ใช้ประวัติจากช่องทางที่ขายอยู่แล้ว และแก้ไขได้ก่อนยืนยัน',
      consumer: 'ผลประเมินอ้างอิงพฤติกรรมการขายจริงของร้าน ไม่ใช่เพียงข้อมูลที่ร้านแจ้งเอง',
      ocpb: 'ได้ข้อมูลประกอบการตรวจสอบที่เป็นระบบ โดยร้านยินยอมและขอบเขตข้อมูลชัดเจน',
    },
    nextCta: 'ดำเนินการต่อ: วิเคราะห์พฤติกรรมการขาย',
    prepare: () => {
      fixtureV2Clean();
      return { ...base, merchantId: V2_MERCHANT, operatorId: V2_OPERATOR };
    },
    exports: (c) => ({ merchantId: c.merchantId, operatorId: c.operatorId, connectionId: c.connectionId, importId: c.importId }),
    steps: [
      { id: 's9-home', role: 'merchant', route: () => '/m', title: 'หน้าหลักผู้ประกอบการ', instruction: (c) => `ร้าน "${shopName(c)}" ได้รับการรับรองแล้ว และขายบน Marketplace ด้วย — ต่อไปนำข้อมูลการขายเข้ามาประกอบการประเมิน`, tip: 'ระบบสาธิตไม่เชื่อมต่อ Shopee หรือ Lazada จริง ข้อมูลทั้งหมดสร้างขึ้นในเบราว์เซอร์', nextLabel: 'ไปที่ Marketplace Connection' },
      {
        id: 's9-platform',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'เลือกแพลตฟอร์ม',
        instruction: 'กด "เชื่อมต่อ Shopee (จำลอง)" หรือ "เชื่อมต่อ Lazada (จำลอง)"',
        tip: 'ป้าย "(จำลอง)" แสดงทุกจุด และไม่ใช้โลโก้ของแพลตฟอร์มจริง',
        gate: { check: (g) => !!newConnection(g), hint: 'กดปุ่มเชื่อมต่อแพลตฟอร์มใดแพลตฟอร์มหนึ่ง' },
      },
      {
        id: 's9-consent',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'อนุญาตเข้าถึงข้อมูล (จำลอง)',
        instruction: 'อ่านขอบเขตข้อมูลที่ขอ ติ๊ก "ยินยอม" แล้วกด "ถัดไป" ในหน้าต่างการเชื่อมต่อ',
        tip: 'ไม่ขอรหัสผ่าน และไม่ขอข้อมูลผู้ซื้อ — ร้านยกเลิกการเชื่อมต่อได้ทุกเมื่อ',
        gate: { check: (g) => num(g, 'mkt.wizard') >= 1 || !!newConnection(g)?.consentAt, hint: 'ติ๊กยินยอมแล้วกด "ถัดไป" ในหน้าต่างการเชื่อมต่อ' },
      },
      {
        id: 's9-shop',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'เลือกร้านค้าตัวอย่าง',
        instruction: 'เลือกร้านบนแพลตฟอร์มที่จะเชื่อมต่อ (แต่ละร้านมีลักษณะข้อมูลต่างกัน) แล้วกด "ดูตัวอย่างข้อมูล"',
        tip: 'ลองเลือกร้านแบบอื่นเพื่อแสดงว่าผลใน Scenario 10–12 เปลี่ยนตามข้อมูล',
        gate: { check: (g) => num(g, 'mkt.wizard') >= 2 || !!newConnection(g)?.consentAt, hint: 'เลือกร้านแล้วกด "ดูตัวอย่างข้อมูล"' },
      },
      {
        id: 's9-preview',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'Preview ข้อมูลที่จะนำเข้า',
        instruction: 'ตรวจสินค้า ราคา คะแนนร้าน รีวิว และยอดขายที่จะนำเข้า แล้วกด "ยืนยันนำเข้าข้อมูล"',
        tip: 'ระบบยังไม่ดึงข้อมูลจนกว่าร้านจะกดยืนยัน',
        gate: { check: (g) => !!newConnection(g)?.consentAt, hint: 'กด "ยืนยันนำเข้าข้อมูล"' },
      },
      {
        id: 's9-success',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'เชื่อมต่อสำเร็จ',
        instruction: 'รอการซิงก์ (ประมาณ 1 วินาที) จนขึ้น "เชื่อมต่อสำเร็จ" — ถ้าซิงก์ไม่สำเร็จ กด "ลองซิงก์ใหม่"',
        gate: { check: (g) => connected(newConnection(g)?.id), hint: 'รอให้ซิงก์สำเร็จ (ถ้าล้มเหลว กด "ลองซิงก์ใหม่")' },
        capture: (g) => ({ connectionId: newConnection(g)?.id }),
      },
      {
        id: 's9-autofill',
        role: 'merchant',
        route: (c) => `/m/marketplace/profile/${c.connectionId}`,
        title: 'Auto-Fill โปรไฟล์ร้านเดิม',
        instruction: (c) => `ระบบเติมโปรไฟล์ร้าน "${shopName(c)}" จากข้อมูลที่นำเข้า — ดูสรุป "นำเข้าสำเร็จ / ต้องกรอกเพิ่ม / ข้อมูลที่แก้ไข" ป้ายที่มาของแต่ละช่อง และข้อมูลต้นฉบับ (อ่านอย่างเดียว)`,
        tip: 'เป็นการอัปเดตร้านเดิม ไม่ใช่การสมัครร้านใหม่ — ใบรับรอง Level 3 เดิมไม่เปลี่ยน',
        gate: { check: (g) => num(g, 'profile.loaded') >= 1, hint: 'รอให้หน้าเติมข้อมูลโปรไฟล์โหลด' },
      },
      {
        id: 's9-edit',
        role: 'merchant',
        route: (c) => `/m/marketplace/profile/${c.connectionId}`,
        title: 'ตรวจและแก้ไขข้อมูลหลัง Auto-Fill',
        instruction: 'แก้ "คำอธิบายธุรกิจ" อย่างน้อย 1 จุด เช่น เพิ่มเวลาเปิดรับคำสั่งซื้อ — ป้ายเปลี่ยนเป็น "ผู้สมัครแก้ไข" และตารางแสดงต้นฉบับให้เทียบ',
        tip: 'การแก้ข้อมูลในแบบฟอร์มไม่เปลี่ยนคะแนน รีวิว ยอดขาย หรือผลประเมินต้นฉบับ',
        gate: { check: (g) => num(g, 'profile.edited') >= 1, hint: 'แก้ไขช่องข้อมูลอย่างน้อย 1 ช่อง' },
      },
      {
        id: 's9-confirm',
        role: 'merchant',
        route: (c) => `/m/marketplace/profile/${c.connectionId}`,
        title: 'ยืนยันการอัปเดตข้อมูลร้าน',
        instruction: 'ตรวจตารางเทียบข้อมูลเดิม / ข้อมูลจาก Marketplace / ข้อมูลที่ส่ง ติ๊กยืนยัน แล้วกด "ยืนยันการอัปเดตข้อมูลร้าน"',
        tip: 'ระบบไม่บันทึกอัตโนมัติ — ชื่อร้านหรือหมวดที่ผูกกับใบรับรอง ถ้าแก้จะรอเจ้าหน้าที่ตรวจ',
        gate: { check: (g) => !!newImport(g), hint: 'ติ๊กยืนยันแล้วกด "ยืนยันการอัปเดตข้อมูลร้าน"' },
        capture: (g) => ({ importId: newImport(g)?.id }),
      },
      { id: 's9-overview', role: 'merchant', route: (c) => `/m/marketplace/data/${c.connectionId}`, title: 'Marketplace Data Overview', instruction: (c) => `ภาพรวมข้อมูลจาก ${platformOf(c)}: Shop ID จำลอง สินค้า ราคา คะแนน รีวิว ยอดขาย วันที่อัปเดต และข้อมูลที่มี/ไม่มี`, tip: 'ข้อมูลผู้ซื้อไม่ถูกนำเข้า — ใช้เฉพาะข้อมูลระดับร้านค้า', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const x = connection(c.connectionId);
      return x
        ? [
            `ร้าน "${shopName(c)}" (${c.merchantId}) เชื่อมต่อ ${PLATFORMS[x.platform].label} — ${x.id} · Shop ID จำลอง ${x.mockShopId}`,
            `ร้านให้ความยินยอม ${x.scopes.length} ขอบเขตข้อมูล และซิงก์สำเร็จ`,
            ...(() => {
              const r = importRecord(c.importId);
              return r
                ? [`อัปเดตโปรไฟล์ร้านเดิมจากข้อมูลที่นำเข้า (${r.id}): นำเข้า ${r.summary.imported} · แก้ไข ${r.summary.edited} · บันทึก ${r.applied.length} ช่อง${r.pending.length ? ` · รอตรวจสอบ ${r.pending.length} ช่อง` : ''}`, 'ไม่สร้างร้านหรือคำขอลงทะเบียนใหม่ และใบรับรองเดิมไม่เปลี่ยน']
                : ['ยังไม่ได้ยืนยันการอัปเดตโปรไฟล์ร้าน'];
            })(),
            'บันทึก Audit Log และแจ้งเตือนร้านค้า',
            'ไม่มีการเรียก API จริง — ข้อมูลสร้างแบบ Deterministic ในเบราว์เซอร์',
          ]
        : ['ยังไม่ได้เชื่อมต่อ Marketplace ใน Scenario นี้'];
    },
  },

  // ------------------------------------------------------------ 10
  {
    id: 's10',
    no: 10,
    track: 'v2',
    title: 'วิเคราะห์พฤติกรรมการขาย',
    objective: 'วิเคราะห์ราคา ยอดขาย และรีวิวด้วยกฎที่อธิบายได้ พร้อมเปรียบเทียบ 4 กรณีตัวอย่างเพื่อแสดงว่าตัวเลขเดียว (เช่น คะแนนดาว) ไม่พอสำหรับการตัดสิน',
    keyMessage: 'ราคาถูกหรือแพงไม่ใช่หลักฐานการทุจริต — ระบบดูบริบททั้งประเภทสินค้า ปริมาณการขาย และรีวิวประกอบกัน',
    audience: ['merchant'],
    duration: '≈ 6 นาที',
    benefits: {
      sme: 'รู้ว่าข้อมูลส่วนใดส่งผลต่อความน่าเชื่อถือ และปรับปรุงได้ตรงจุด',
      consumer: 'ได้สัญญาณเตือนที่มีเหตุผลรองรับ ไม่ใช่การตัดสินจากราคาอย่างเดียว',
      ocpb: 'คัดกรองร้านที่ควรตรวจสอบเพิ่มเติมได้เร็วขึ้น โดยไม่กล่าวหาร้านที่ขายราคาถูกอย่างถูกต้อง',
    },
    nextCta: 'ดำเนินการต่อ: ประเมินความน่าเชื่อถือร้านค้า',
    continuity: connectionIssue,
    prepare: (j, carry) => (carry && !connectionIssue(j) ? carryCtx(j) : fixtureV2Connected()),
    exports: (c) => ({ merchantId: c.merchantId, operatorId: c.operatorId, connectionId: c.connectionId }),
    steps: [
      { id: 's10-select', role: 'merchant', route: (c) => `/m/marketplace/data/${c.connectionId}`, title: 'เลือกข้อมูลร้านค้า', instruction: (c) => `ข้อมูลจาก ${platformOf(c)} พร้อมแล้ว — กด "วิเคราะห์ข้อมูลการขาย" (หรือ "ถัดไป")`, nextLabel: 'เริ่มวิเคราะห์' },
      { id: 's10-price', role: 'merchant', route: () => '/m/marketplace/analysis?tab=price', title: 'Price Analysis', instruction: 'ช่วงราคาสินค้าเทียบช่วงอ้างอิงของประเภทสินค้าเดียวกัน พร้อมระดับความเสี่ยงของสินค้า', tip: 'ราคาต่ำมากในสินค้าความเสี่ยงสูงเป็นเพียง "ควรตรวจสอบเพิ่มเติม" และลดระดับได้เมื่อมีคำสั่งซื้อและรีวิวสนับสนุน' },
      { id: 's10-sales', role: 'merchant', route: () => '/m/marketplace/analysis?tab=sales', title: 'Sales Volume Analysis', instruction: 'คำสั่งซื้อรายเดือน 12 เดือน อัตรายกเลิก คืนสินค้า และการจัดส่งตรงเวลา' },
      { id: 's10-reviews', role: 'merchant', route: () => '/m/marketplace/analysis?tab=reviews', title: 'Review Analysis', instruction: 'คะแนนดาว การกระจายคะแนน ความครอบคลุมของรีวิวเทียบคำสั่งซื้อ และประเด็นเชิงลบที่พบบ่อย' },
      { id: 's10-risk', role: 'merchant', route: () => '/m/marketplace/analysis?tab=risk', title: 'Risk Signals', instruction: 'สัญญาณที่ควรตรวจสอบเพิ่มเติม ความเสี่ยงจากข้อมูลตัวอย่าง และข้อมูลที่ยังประเมินไม่ได้', tip: 'ทุกสัญญาณเป็นข้อสังเกตให้ตรวจสอบ ไม่ใช่ข้อสรุปว่าร้านกระทำผิด' },
      {
        id: 's10-compare',
        role: 'merchant',
        route: () => '/m/marketplace/analysis?tab=compare',
        title: 'เปรียบเทียบ 4 กรณีตัวอย่าง',
        instruction: 'เลือกกรณีอื่นเพื่อเปรียบเทียบ — ดูว่าทำไมคะแนนดาวใกล้เคียงกันจึงให้ผลวิเคราะห์ต่างกัน',
        tip: 'ทุกกรณีวิเคราะห์ด้วย Engine ชุดเดียวกับร้านจริง ไม่มีสูตรพิเศษสำหรับการสาธิต',
        gate: { check: (g) => sig(g, 'analysis.compare') === true, hint: 'เลือกกรณีเปรียบเทียบอย่างน้อย 1 กรณี' },
      },
      { id: 's10-summary', role: 'merchant', route: () => '/m/marketplace/analysis?tab=summary', title: 'Analysis Summary', instruction: 'สรุปผลวิเคราะห์ของร้าน และข้อมูลที่จะใช้ในการประเมินความน่าเชื่อถือขั้นต่อไป', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => [`วิเคราะห์ข้อมูล ${platformOf(c)} ของร้าน "${shopName(c)}" ด้วย Analysis Engine (P3)`, 'เปรียบเทียบ 4 กรณีตัวอย่างด้วยกฎชุดเดียวกัน', 'ไม่มีการเปลี่ยนข้อมูลธุรกิจ (เป็นการวิเคราะห์เท่านั้น)'],
  },

  // ------------------------------------------------------------ 11
  {
    id: 's11',
    no: 11,
    track: 'v2',
    title: 'ประเมินความน่าเชื่อถือร้านค้า',
    objective: 'รวมข้อมูล 5 มิติเป็น Trust Band ที่อธิบายได้ แยก Data Coverage และ Confidence และแสดงผลตามสิทธิ์ของร้านค้า เจ้าหน้าที่ และผู้บริโภค',
    keyMessage: 'ทุกผลประเมินอธิบายได้ ข้อมูลที่ขาดไม่ถูกนับเป็นศูนย์ และใบรับรองไม่ออกให้อัตโนมัติ (Assessment Badge แยกต่างหาก)',
    audience: ['merchant', 'officer', 'consumer'],
    duration: '≈ 7 นาที',
    benefits: {
      sme: 'เห็นว่าต้องเพิ่มข้อมูลหรือปรับปรุงด้านใด โดยไม่เปิดเผยคะแนนภายในต่อสาธารณะ',
      consumer: 'เห็น Band, Coverage และ Confidence ที่เข้าใจง่าย พร้อมเหตุผลที่เปิดเผยได้',
      ocpb: 'เจ้าหน้าที่เห็นวิธีคำนวณทุกขั้น ตรวจสอบและอธิบายต่อได้',
    },
    nextCta: 'ดำเนินการต่อ: เจ้าหน้าที่พิจารณาการรับรอง',
    continuity: connectionIssue,
    prepare: (j, carry) => (carry && !connectionIssue(j) ? carryCtx(j) : fixtureV2Connected()),
    exports: (c) => ({ merchantId: c.merchantId, operatorId: c.operatorId, connectionId: c.connectionId, assessmentId: c.assessmentId, applicationId: c.applicationId }),
    steps: [
      {
        id: 's11-run',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'Trust Assessment',
        instruction: 'ระบบประเมินอัตโนมัติแล้วตอนซิงก์ข้อมูล — กด "ประเมินใหม่" (หรือ "ประเมินความน่าเชื่อถือ") เพื่อสาธิตการประเมินด้วยน้ำหนักจาก Assessment Configuration ปัจจุบัน',
        gate: { check: (g) => !!newAssessment(g), hint: 'กด "ประเมินความน่าเชื่อถือ" (หรือ "ประเมินใหม่")' },
        capture: (g) => ({ assessmentId: newAssessment(g)?.id }),
      },
      { id: 's11-dimensions', role: 'merchant', route: () => '/m/trust', title: '5 Assessment Dimensions', instruction: 'Identity & Business · Sales Performance · Customer Experience · Price Transparency · Compliance — พร้อมน้ำหนักที่ใช้', tip: 'มิติที่ไม่มีข้อมูลไม่ถูกนับเป็นศูนย์ แต่กระจายน้ำหนักไปยังมิติที่มีข้อมูล' },
      { id: 's11-risk', role: 'merchant', route: () => '/m/trust', title: 'Risk Adjustment', instruction: 'สัญญาณที่ควรตรวจสอบเพิ่มเติม (ถ้ามี) จะปรับผลลง และทำให้ไม่ได้ Band A' },
      { id: 's11-quality', role: 'merchant', route: () => '/m/trust', title: 'Data Coverage & Confidence', instruction: 'Coverage = ข้อมูลครบแค่ไหน · Confidence = ข้อมูลที่มีเชื่อถือได้แค่ไหน (แหล่ง ความใหม่ ขนาดตัวอย่าง)', tip: 'สองค่านี้แยกกัน: ข้อมูลครบแต่เก่า Coverage สูงแต่ Confidence ลดลง' },
      { id: 's11-band', role: 'merchant', route: () => '/m/trust', title: 'Trust Band และคำอธิบาย', instruction: 'Band A–D หรือ Insufficient Data พร้อมคำอธิบายทุกปัจจัย (↑ ส่งผลบวก · ↓ ส่งผลลบ) — ร้านค้าไม่เห็นคะแนนภายใน' },
      { id: 's11-improve', role: 'merchant', route: () => '/m/trust', title: 'ข้อมูลที่ควรเพิ่มเติม', instruction: 'สิ่งที่ร้านทำได้เพื่อเพิ่มความครอบคลุมและความน่าเชื่อถือของผลประเมิน' },
      {
        id: 's11-submit',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'Assessment Summary และส่งพิจารณา',
        instruction: 'กด "ส่งให้เจ้าหน้าที่พิจารณา" — ระบบผูกกับคำขอรับรองตาม กระบวนการรับรอง (ไม่ออกใบรับรองอัตโนมัติ)',
        tip: 'ถ้าส่งไม่ได้ เช่น ข้อมูลเปลี่ยนหลังประเมิน ให้กด "ประเมินใหม่" ก่อน — หรือกลับไป Scenario 9 เลือกร้านตัวอย่างอื่น',
        gate: { check: (g) => !!g.ctx.assessmentId && assessment(g.ctx.assessmentId)?.status !== 'draft', hint: 'กด "ส่งให้เจ้าหน้าที่พิจารณา" (ถ้าผลล้าสมัย กด "ประเมินใหม่" ก่อน)' },
        capture: (g) => ({ applicationId: assessment(g.ctx.assessmentId)?.applicationId }),
        nextLabel: 'ดูผลเดียวกันในมุมเจ้าหน้าที่',
      },
      { id: 's11-officer', role: 'officer', route: (c) => `/o/assessments/${c.assessmentId}`, transition: 'ผลประเมินเดียวกันในมุมเจ้าหน้าที่ — เห็นคะแนน น้ำหนัก ข้อมูลที่ใช้ Risk Adjustment และวิธีคำนวณทีละขั้น', title: 'มุมเจ้าหน้าที่: Calculation Breakdown', instruction: 'คะแนน (เฉพาะเจ้าหน้าที่) ตารางคำนวณ C1–C5 การหักสัญญาณความเสี่ยง และข้อเสนอของระบบ', tip: 'การตัดสินอยู่ใน Scenario 12' },
      { id: 's11-consumer', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, transition: 'ผลประเมินเดียวกันในมุมผู้บริโภค — เห็นเฉพาะข้อมูลที่เปิดเผยได้', title: 'มุมผู้บริโภค', instruction: 'Band, Coverage, Confidence และเหตุผลที่เปิดเผยได้ — ไม่มีคะแนน 0–100 และไม่มีสัญญาณที่ยังไม่มีข้อสรุป', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const a = assessment(c.assessmentId);
      return a
        ? [`ผลประเมิน ${a.id}: ${bandText(c)}`, `ข้อเสนอของระบบ: ${RECOMMENDATION_LABEL[a.result.recommendation.kind].label}`, a.applicationId ? `ส่งพิจารณาพร้อมคำขอ ${a.applicationId} (กระบวนการรับรอง)` : a.status === 'draft' ? 'ยังไม่ได้ส่งให้เจ้าหน้าที่พิจารณา' : 'ส่งให้เจ้าหน้าที่พิจารณาแล้ว', 'ไม่มีการออก Badge อัตโนมัติ']
        : ['ยังไม่มีผลประเมินใน Scenario นี้'];
    },
  },

  // ------------------------------------------------------------ 12
  {
    id: 's12',
    no: 12,
    track: 'v2',
    title: 'เจ้าหน้าที่พิจารณาการรับรอง',
    objective: 'เจ้าหน้าที่ตรวจตัวตน หลักฐานจาก Marketplace ผลประเมิน และเกณฑ์การรับรอง แล้วตัดสินเอง — อนุมัติผ่าน Certification Workflow เดิมพร้อม Audit Log',
    keyMessage: 'คะแนนสูงไม่พอ — Badge ออกได้เมื่อเจ้าหน้าที่พิจารณาและร้านผ่านเกณฑ์สำคัญครบเท่านั้น',
    audience: ['officer', 'merchant'],
    duration: '≈ 6 นาที',
    benefits: {
      sme: 'รู้ผลและเหตุผลชัดเจนผ่านการแจ้งเตือน และยื่นข้อมูลเพิ่มได้',
      consumer: 'Badge ระดับสูงผ่านการพิจารณาของคนและเกณฑ์มาตรฐาน ไม่ใช่ผลอัตโนมัติ',
      ocpb: 'มีข้อมูลประกอบครบในหน้าเดียว ตัดสินต่างจากข้อเสนอของระบบได้ และทุกการตัดสินมี Audit Log',
    },
    nextCta: 'ดำเนินการต่อ: ผู้บริโภคตรวจสอบร้านก่อนซื้อ',
    continuity: submittedIssue,
    prepare: (j, carry) => (carry && !submittedIssue(j) ? carryCtx(j) : fixtureV2Submitted()),
    exports: (c) => ({ merchantId: c.merchantId, operatorId: c.operatorId, connectionId: c.connectionId, assessmentId: c.assessmentId, applicationId: c.applicationId, certId: c.certId }),
    steps: [
      { id: 's12-queue', role: 'officer', route: () => '/o/assessments', title: 'Officer Review Queue', instruction: (c) => `คิว "รอพิจารณา" มีผลประเมิน ${c.assessmentId} ของร้าน "${shopName(c)}"` },
      { id: 's12-app', role: 'officer', route: (c) => (c.applicationId ? `/o/applications/${c.applicationId}` : `/o/assessments/${c.assessmentId}`), title: 'Application Detail', instruction: (c) => (c.applicationId ? `คำขอ ${c.applicationId} (${REGISTRATION_STATUS[application(c.applicationId)?.status ?? 'submitted'].label}) — ร้าน ${c.merchantId} และสถานะการยืนยันตัวตน (e-KYC จำลอง)` : 'ผลประเมินนี้ไม่มีคำขอที่ผูกไว้ — พิจารณาจากหน้าผลประเมิน') },
      { id: 's12-evidence', role: 'officer', route: (c) => (c.applicationId ? `/o/applications/${c.applicationId}` : `/o/assessments/${c.assessmentId}`), title: 'Marketplace Evidence', instruction: 'กล่อง "ข้อมูลประกอบ: Trust Assessment" แสดงแพลตฟอร์มที่เชื่อมต่อ Shop ID จำลอง วันที่ซิงก์ และผลประเมิน', tip: 'หลักฐานจาก Marketplace เป็นข้อมูลประกอบ ไม่ใช่เงื่อนไขอนุมัติอัตโนมัติ' },
      { id: 's12-assessment', role: 'officer', route: (c) => `/o/assessments/${c.assessmentId}`, title: 'Trust Assessment', instruction: 'คะแนน วิธีคำนวณ ปัจจัย และข้อเสนอของระบบ — ใช้ Assessment ID เดียวกับ Scenario 11' },
      { id: 's12-eligibility', role: 'officer', route: (c) => `/o/assessments/${c.assessmentId}`, title: 'Certification Eligibility', instruction: 'ตรวจ "เกณฑ์การรับรอง" ของระดับที่จะอนุมัติ — ต้องผ่านครบจึงอนุมัติได้ (ความหมายของ Level 1–4 ไม่เปลี่ยน)', tip: 'ร้านที่ได้ Band A แต่ยังมีคำเตือนค้าง ระบบจะไม่ให้อนุมัติแม้คะแนนสูง' },
      {
        id: 's12-decide',
        role: 'officer',
        route: (c) => `/o/assessments/${c.assessmentId}`,
        title: 'Officer Decision',
        instruction: 'เลือก "อนุมัติยกระดับ" (เลือกระดับ) / "ขอข้อมูลเพิ่มเติม" / "ไม่อนุมัติ" พร้อมเหตุผล แล้วกด "บันทึกผลการพิจารณา"',
        tip: 'ถ้าตัดสินต่างจากข้อเสนอของระบบ ระบบบันทึกไว้ใน Audit Log',
        gate: { check: (g) => assessment(g.ctx.assessmentId)?.status === 'decided', hint: 'เลือกผลการพิจารณา ระบุเหตุผล แล้วกด "บันทึกผลการพิจารณา"' },
        capture: (g) => {
          const d = assessment(g.ctx.assessmentId)?.decision;
          // ใบรับรองใหม่มีเฉพาะเมื่ออนุมัติ — กรณีอื่นอ้างใบรับรองเดิมของร้าน (ถ้ามี) เพื่อให้ผู้บริโภคตรวจสอบสถานะจริง
          return { certId: d?.kind === 'approved' ? d.certId : certOf(g.ctx.merchantId)?.id, applicationId: d?.applicationId ?? g.ctx.applicationId };
        },
        nextLabel: 'ดูผลในมุมผู้ประกอบการ',
      },
      { id: 's12-notify', role: 'merchant', route: () => '/m/notifications', transition: 'เจ้าหน้าที่บันทึกผลแล้ว กลับไปดูการแจ้งเตือนในมุมผู้ประกอบการ (ร้านเดิม)', title: 'Merchant Notification', instruction: 'ร้านได้รับแจ้งผลการพิจารณาพร้อมเหตุผล' },
      { id: 's12-result', role: 'merchant', route: () => '/m/certification', title: 'Certification Result', instruction: (c) => { const cert = certOf(c.merchantId); return cert ? `ใบรับรอง ${cert.id} ระดับ ${TRUST_LEVELS[cert.level].name} — สถานะอัปเดตตาม กระบวนการรับรอง` : 'สถานะคำขอและใบรับรองปัจจุบันของร้าน'; }, nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const a = assessment(c.assessmentId);
      const d = a?.decision;
      const cert = certOf(c.merchantId);
      return d
        ? [`พิจารณา ${a!.id}: ${DECISION_LABEL[d.kind].label}${d.level ? ` Level ${d.level}` : ''} — ${d.reason}`, d.applicationId ? `คำขอ ${d.applicationId}: ${REGISTRATION_STATUS[application(d.applicationId)?.status ?? 'submitted'].label}` : '', d.kind === 'approved' && cert ? `ออกใบรับรอง ${cert.id} ระดับ ${TRUST_LEVELS[cert.level].name} ผ่าน Certification กระบวนการรับรอง` : 'ยังไม่มีการออกใบรับรองใหม่', d.overridesRecommendation ? 'ตัดสินต่างจากข้อเสนอของระบบ (บันทึกเหตุผลแล้ว)' : 'ผลการพิจารณาสอดคล้องกับข้อเสนอของระบบ', 'บันทึก Audit Log และแจ้งเตือนร้านค้า'].filter(Boolean)
        : ['ยังไม่มีผลการพิจารณาใน Scenario นี้'];
    },
    outcome: decisionOutcome,
  },

  // ------------------------------------------------------------ 13
  {
    id: 's13',
    no: 13,
    track: 'v2',
    title: 'ผู้บริโภคตรวจสอบร้านค้าก่อนซื้อ',
    objective: 'ผู้บริโภคค้นหาหรือสแกน QR (จำลอง) แล้วเห็นสถานะการรับรอง ผลประเมิน Coverage Confidence และช่องทางขายที่ยืนยันแล้วของร้านเดียวกับ Scenario 12',
    keyMessage: 'ผู้บริโภคเห็นข้อมูลที่เข้าใจง่ายและตรวจสอบได้ — แต่ Trust Badge ไม่ใช่การรับประกันว่าจะไม่มีปัญหา',
    audience: ['merchant', 'consumer'],
    duration: '≈ 5 นาที',
    benefits: {
      sme: 'ผลประเมินจากประวัติการขายช่วยให้ลูกค้าใหม่มั่นใจมากขึ้น',
      consumer: 'ตรวจสอบได้ทั้งตัวตน ใบรับรอง และพฤติกรรมการขาย ก่อนโอนเงิน',
      ocpb: 'ผู้บริโภคได้ข้อมูลที่มีข้อจำกัดชัดเจน ลดความเข้าใจผิดเรื่องการรับประกัน',
    },
    continuity: decidedIssue,
    prepare: (j, carry) => (carry && !decidedIssue(j) ? carryCtx(j) : fixtureV2Decided()),
    steps: [
      {
        id: 's13-badge',
        role: 'merchant',
        route: () => '/m/toolkit',
        title: 'Trust Badge',
        instruction: (c) => {
          const d = decisionOf(c);
          if (d?.kind === 'approved') return `ร้าน "${shopName(c)}" ได้รับอนุมัติ ${levelName(d.level)} — นำ Badge และ QR ไปแสดงบนช่องทางขาย แล้วดูว่าผู้บริโภคตรวจสอบได้อย่างไร`;
          const cert = certOf(c.merchantId);
          return `ผลการพิจารณา: ${d ? DECISION_LABEL[d.kind].label : 'ยังไม่พิจารณา'} — ยังไม่มี Badge ระดับใหม่ ${cert?.status === 'active' ? `ร้านแสดงได้เฉพาะ Badge ระดับเดิม (${levelName(cert.level)})` : 'และร้านยังไม่มี Badge ที่ใช้งานได้'}`;
        },
        tip: 'Badge ที่แสดงตรงกับสถานะใบรับรองจริงเสมอ — ไม่มี Badge จากคะแนนสูงหรือจากการยื่นคำขอ',
        nextLabel: 'ดำเนินการต่อในมุมผู้บริโภค',
      },
      { id: 's13-search', role: 'consumer', route: (c) => `/check?q=${encodeURIComponent(shopName(c))}`, transition: 'ร้านค้าแสดง Badge แล้ว เปลี่ยนเป็นมุมผู้บริโภคที่กำลังจะซื้อสินค้าจากร้านเดียวกัน', title: 'Consumer Search', instruction: 'ค้นหาร้านจากชื่อ — ไม่ต้องเข้าสู่ระบบ' },
      {
        id: 's13-qr',
        role: 'consumer',
        route: () => '/verify',
        title: 'QR Simulation',
        instruction: (c) => (c.certId ? `เลือก QR ของร้าน "${shopName(c)}" — จำลองการสแกนโดยไม่เปิดกล้อง` : 'ร้านนี้ยังไม่มีใบรับรองใหม่ — ดูวิธีตรวจสอบด้วย QR แล้วกด "ถัดไป"'),
        gate: { check: (g) => !g.ctx.certId || sig(g, 'verify.viewed') === g.ctx.certId, hint: 'เลือก QR ของร้านนี้เพื่อจำลองการสแกน' },
      },
      { id: 's13-profile', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'Merchant Profile', instruction: 'ชื่อร้าน สถานะยืนยันตัวตน ระดับการตรวจสอบ — ไม่แสดงข้อมูลส่วนตัวของเจ้าของร้าน' },
      { id: 's13-assessment', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'Trust Assessment Summary', instruction: 'Trust Band และเหตุผลที่เปิดเผยได้ — ไม่มีคะแนน 0–100' },
      { id: 's13-quality', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'Data Coverage & Confidence', instruction: 'ความครอบคลุมและความเชื่อมั่นของข้อมูล ที่มาของข้อมูล และวันที่ประเมิน' },
      { id: 's13-channels', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'Verified Sales Channels', instruction: 'ช่องทางขายเดิมที่ตรวจความเป็นเจ้าของแล้ว และร้านบน Marketplace (จำลอง) ที่เชื่อมต่อข้อมูล' },
      { id: 's13-cert', role: 'consumer', route: (c) => (c.certId ? `/verify/${c.certId}` : `/shop/${c.merchantId}`), title: 'Certification Status', instruction: (c) => { const d = decisionOf(c); return d && d.kind !== 'approved' ? `สถานะใบรับรองจริงของร้าน — ผลการพิจารณา "${DECISION_LABEL[d.kind].label}" จึงไม่มีระดับใหม่ ผู้บริโภคเห็นเฉพาะระดับเดิม` : 'สถานะใบรับรองปัจจุบัน ระดับ และวันหมดอายุ — ตรงกับที่ร้านค้าและเจ้าหน้าที่เห็น'; } },
      {
        id: 's13-preview',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        title: 'Marketplace Preview',
        instruction: 'กด "ดูตัวอย่างหน้าร้าน" ที่ร้านบน Marketplace (จำลอง) — แสดงภายในแอป ไม่เปิดเว็บไซต์จริง',
        gate: { check: (g) => sig(g, 'marketplace.preview') === true, hint: 'กด "ดูตัวอย่างหน้าร้าน" ในส่วนร้านบน Marketplace' },
        nextLabel: 'จบ Scenario และดูสรุป',
      },
    ],
    summary: (c) => {
      const cert = certOf(c.merchantId);
      const d = decisionOf(c);
      return [`ผู้บริโภคตรวจสอบร้าน "${shopName(c)}" (${c.merchantId})`, `ผลประเมินที่เปิดเผย: ${bandText(c)}`, d && d.kind !== 'approved' ? `ผลการพิจารณา: ${DECISION_LABEL[d.kind].label} — ไม่มี Badge ระดับใหม่` : '', cert?.status === 'active' ? `ใบรับรอง ${cert.id} ระดับ ${TRUST_LEVELS[cert.level].name}` : 'ยังไม่มีใบรับรองที่ใช้งานได้', 'ไม่แสดงคะแนนภายในและข้อมูลส่วนตัวของเจ้าของร้าน · ไม่มีการเปลี่ยนข้อมูลธุรกิจ'].filter(Boolean);
    },
    outcome: decisionOutcome,
  },

  // ------------------------------------------------------------ 9B (ทางเลือก)
  {
    id: 's9a',
    no: 9,
    code: '9A',
    track: 'v2',
    branch: true,
    title: 'ร้านใหม่ — สมัครด้วยข้อมูลจาก Marketplace (Auto-Fill)',
    objective: 'ผู้ประกอบการที่ยังไม่มีร้านใน SME Trust แต่ขายบน Shopee/Lazada (จำลอง) เชื่อมบัญชี เลือกร้าน นำเข้าข้อมูล แล้วแบบฟอร์มลงทะเบียนถูกเติมอัตโนมัติ ตรวจ/แก้ไข กรอกส่วนที่ขาด และกดส่งคำขอเอง',
    keyMessage: 'ร้านใหม่สมัครได้เร็วขึ้นโดยไม่ต้องกรอกข้อมูลซ้ำ — ระบบตรวจและผ่านการลงทะเบียนอัตโนมัติ เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ',
    audience: ['merchant', 'consumer'],
    duration: '≈ 6 นาที',
    caseNote: 'เส้นทางสมัครร้านใหม่ (ไม่ใช่การยกระดับร้านกาแฟดอยสูง M-005) — ใช้บัญชีตัวอย่าง OP-013 แยกจากร้านใน Scenario 9–13 · คำขอที่ได้คือคำขอลงทะเบียน (Level 2 เมื่ออนุมัติ) ไม่ได้ Level 3–4 อัตโนมัติ',
    nextCta: 'กลับสู่ Demo',
    prepare: () => {
      fixtureBranchClean(NEW_SHOP_OPERATOR);
      return { operatorId: NEW_SHOP_OPERATOR, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    replayNote: () => {
      const shops = branchShops(NEW_SHOP_OPERATOR);
      return shops.length ? `บัญชีตัวอย่าง OP-013 มีร้าน ${shops.map((m) => `"${m.shopName}" (${m.id})`).join(', ')} จากการเล่นเส้นทางนี้ครั้งก่อน — เมื่อเริ่มใหม่ ระบบจะล้างร้าน คำขอ การเชื่อมต่อ และบันทึกการนำเข้าของบัญชีนี้ เพื่อไม่ให้มีร้านซ้ำ ข้อมูลของร้านใน Scenario 9–13 ไม่ถูกแตะ` : undefined;
    },
    benefits: {
      sme: 'สมัครร้านได้ในไม่กี่ขั้น ใช้ข้อมูลร้านที่มีอยู่แล้ว และแก้ไขได้ก่อนส่ง',
      consumer: 'ร้านใหม่มีข้อมูลการขายที่ตรวจสอบได้ตั้งแต่วันแรกที่ลงทะเบียน',
      ocpb: 'ร้านปกติผ่านการลงทะเบียนอัตโนมัติ — เจ้าหน้าที่เห็นต้นฉบับเทียบกับข้อมูลที่แก้เฉพาะคำขอที่ระบบส่งตรวจ',
    },
    steps: [
      { id: 's9a-home', role: 'merchant', route: () => '/m', title: 'ผู้ประกอบการรายใหม่ที่ขายบน Marketplace', instruction: (c) => `บัญชี "${operator(c.operatorId)?.name}" ยืนยันตัวตนแล้ว (Level 1) ยังไม่มีร้านใน SME Trust แต่มีร้านบน Shopee/Lazada (จำลอง)`, tip: 'เส้นทางนี้เป็นการสมัครร้านใหม่ — แยกจากการอัปเดตร้านเดิมใน Scenario 9', nextLabel: 'ไปที่ลงทะเบียนร้านค้า' },
      {
        id: 's9a-entry',
        role: 'merchant',
        route: () => '/m/register-shop',
        title: 'เลือกวิธีลงทะเบียน',
        instruction: 'เลือก "A. เชื่อมต่อร้านค้าจาก Marketplace" (ตัวเลือก B คือลงทะเบียนด้วยตนเองสำหรับร้านที่ไม่ได้ใช้แพลตฟอร์มที่รองรับ — ดู 9B)',
        gate: { check: (g) => num(g, 'reg.flow') >= 0, hint: 'กด "A. เชื่อมต่อร้านค้าจาก Marketplace"' },
      },
      {
        id: 's9a-authorize',
        role: 'merchant',
        route: () => '/m/register-shop/marketplace',
        title: 'เลือก Marketplace และอนุญาตเข้าถึง (จำลอง)',
        instruction: 'เลือก Shopee (จำลอง) หรือ Lazada (จำลอง) กด "ถัดไป" อ่านขอบเขตข้อมูล ติ๊กอนุญาต แล้วกด "อนุญาต (จำลอง)"',
        tip: 'ไม่ใช่หน้า Login ของแพลตฟอร์ม — ระบบไม่ขอและไม่เก็บรหัสผ่านหรือ Token',
        gate: { check: (g) => num(g, 'reg.flow') >= 2, hint: 'ติ๊กอนุญาตแล้วกด "อนุญาต (จำลอง)"' },
      },
      {
        id: 's9a-shop',
        role: 'merchant',
        route: () => '/m/register-shop/marketplace',
        title: 'เลือกร้านในบัญชี',
        instruction: 'เลือกร้านที่จะใช้สมัคร (แนะนำร้าน "Official" — ขายมานาน ผลงานดี เพื่อสาธิตกรณีแสดง Badge ได้ · ร้าน "Outlet" ที่เพิ่งเปิดจะได้สถานะข้อมูลยังไม่เพียงพอ) แล้วกด "ดูตัวอย่างข้อมูล"',
        gate: { check: (g) => num(g, 'reg.flow') >= 3, hint: 'เลือกร้านแล้วกด "ดูตัวอย่างข้อมูล"' },
      },
      {
        id: 's9a-import',
        role: 'merchant',
        route: () => '/m/register-shop/marketplace',
        title: 'ตรวจข้อมูลก่อนนำเข้า',
        instruction: 'ดูข้อมูลต้นฉบับ (Shop ID ลิงก์ร้าน คะแนน รีวิว ยอดขาย สินค้าและราคา) และรายการที่ต้องกรอกเพิ่ม แล้วกด "ยืนยันนำเข้าข้อมูล"',
        tip: 'ยืนยันนำเข้าแล้วระบบเติมแบบฟอร์มเท่านั้น — ยังไม่ส่งคำขอ',
        gate: { check: (g) => num(g, 'reg.imported') >= 1, hint: 'กด "ยืนยันนำเข้าข้อมูล"' },
      },
      {
        id: 's9a-review',
        role: 'merchant',
        route: () => '/m/register-shop?from=import',
        title: 'ทบทวนข้อมูลที่นำเข้า (Auto-Fill)',
        instruction: 'แบบฟอร์มถูกเติมอัตโนมัติ — ดูสรุป "นำเข้าสำเร็จ / ต้องกรอกเพิ่ม / ข้อมูลที่แก้ไข" และป้ายที่มาของแต่ละช่อง แล้วแก้ "รายละเอียดสินค้าและบริการ" อย่างน้อย 1 จุด (ถ้าแก้ชื่อร้านให้ต่างจากร้านบน Marketplace ระบบจะส่งเจ้าหน้าที่ตรวจเฉพาะกรณี)',
        tip: 'ช่องที่แก้จะแสดงต้นฉบับให้เทียบ — ข้อมูลต้นฉบับด้านบนไม่เปลี่ยน',
        gate: { check: (g) => num(g, 'reg.edited') - verifyCount(g) >= 1 && verifyCount(g) === 0, hint: 'แก้ "รายละเอียดสินค้าและบริการ" อย่างน้อย 1 จุด โดยคงชื่อร้านตามร้านบน Marketplace', blocked: (g) => (verifyCount(g) > 0 ? SHOP_NAME_BLOCK : undefined) },
      },
      {
        id: 's9a-missing',
        role: 'merchant',
        route: () => '/m/register-shop?from=import',
        title: 'กรอกข้อมูลที่ขาดและแนบเอกสาร',
        instruction: 'กด "ใช้ข้อมูลติดต่อจากบัญชี" กรอกอำเภอ/เขต แล้วกด "ถัดไป" จนถึงขั้นเอกสาร แนบเอกสารจำลอง และไปขั้นตรวจสอบข้อมูล',
        gate: { check: (g) => num(g, 'shop.step') >= 5 && verifyCount(g) === 0, hint: 'ไปให้ถึงขั้น "ตรวจสอบข้อมูล" โดยคงชื่อร้านตามร้านบน Marketplace', blocked: (g) => (verifyCount(g) > 0 ? SHOP_NAME_BLOCK : undefined) },
      },
      {
        id: 's9a-submit',
        role: 'merchant',
        route: () => '/m/register-shop?from=import',
        title: 'ตรวจสอบและส่งคำขอด้วยตนเอง',
        instruction: 'ดูตารางเทียบต้นฉบับกับข้อมูลที่ส่ง ติ๊กยืนยัน แล้วกด "ส่งคำขอ" — ระบบไม่ส่งอัตโนมัติ',
        tip: 'ระบบตรวจคำขออัตโนมัติทันทีหลังส่ง — กรณีปกติไม่มีขั้นตอนเจ้าหน้าที่ · การลงทะเบียนไม่ใช่ใบรับรองหรือ Badge',
        gate: { check: (g) => !!newImport(g, NEW_SHOP_OPERATOR), hint: 'ติ๊กยืนยันแล้วกด "ส่งคำขอ"' },
        capture: (g) => {
          const r = newImport(g, NEW_SHOP_OPERATOR);
          return { importId: r?.id, merchantId: r?.merchantId, applicationId: r?.applicationId, connectionId: r?.connectionId };
        },
      },
      {
        id: 's9a-auto',
        role: 'merchant',
        route: () => '/m/shop',
        title: 'ระบบตรวจสอบอัตโนมัติ → ผ่านการลงทะเบียน',
        instruction: (c) => `คำขอ ${c.applicationId}: ${regLine(c)}`,
        tip: 'เจ้าหน้าที่เข้ามาเฉพาะกรณีพบความผิดปกติ เช่น เจ้าของร้านบน Marketplace ไม่ตรงกับผู้ยืนยันตัวตน (ดู Scenario 15)',
        gate: { check: (g) => application(g.ctx.applicationId)?.status === 'approved', hint: 'คำขอยังไม่ผ่านอัตโนมัติ — ดูสิ่งที่ระบบแจ้งบนหน้านี้', blocked: registrationBlock },
      },
      {
        id: 's9a-assess',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'ประเมินความน่าเชื่อถืออัตโนมัติ',
        instruction: 'ระบบประเมินจากข้อมูลที่เชื่อมต่อทันทีหลังลงทะเบียน — Assessment Badge แสดงเฉพาะเมื่อผ่านเงื่อนไขการแสดง (ข้อมูลเพียงพอ ยืนยันตัวตนแล้ว ข้อมูลเป็นปัจจุบัน)',
        tip: 'แยกสถานะชัดเจน: ลงทะเบียนร้าน ≠ ผลประเมิน ≠ ใบรับรอง',
        nextLabel: 'ดูในมุมผู้บริโภค',
      },
      {
        id: 's9a-consumer',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        transition: 'ร้านลงทะเบียนและได้ผลประเมินอัตโนมัติแล้ว — ผู้บริโภคตรวจสอบร้านเดียวกัน',
        title: 'ผู้บริโภคตรวจสอบ',
        instruction: 'ผู้บริโภคเห็นผลตามสถานะจริง — Badge เมื่อผ่านเงื่อนไข หรือสถานะแทน Badge · ไม่เห็นคะแนนภายใน',
        nextLabel: 'จบเส้นทางสมัครร้านใหม่',
      },
    ],
    summary: (c) => {
      const r = importRecord(c.importId);
      const app = application(c.applicationId);
      return r && app
        ? [
            `สมัครร้านใหม่ "${merchant(r.merchantId)?.shopName}" (${r.merchantId}) ด้วยข้อมูลจาก ${PLATFORMS[r.source.platform].label} — Shop ID จำลอง ${r.source.mockShopId}`,
            `นำเข้า ${r.summary.imported} · ผู้สมัครแก้ไข ${r.summary.edited} · กรอกเอง ${r.summary.manual}${r.summary.verification ? ` · รอตรวจสอบ ${r.summary.verification}` : ''} (${r.id})`,
            `คำขอลงทะเบียน ${app.id} — ${regLine(c)}`,
            `การเชื่อมต่อ ${r.connectionId} ใช้ข้อมูลต้นฉบับเดียวกับที่ผู้สมัครเห็นตอน Preview`,
            'ไม่มีการเรียก API จริง ไม่รับรหัสผ่านหรือ Token',
          ]
        : ['ยังไม่ได้ส่งคำขอในเส้นทางนี้'];
    },
  },
  {
    id: 's9b',
    no: 9,
    code: '9B',
    track: 'v2',
    branch: true,
    title: 'ร้านที่ไม่มีบัญชี Marketplace — ลงทะเบียนด้วยตนเอง',
    objective: 'ร้านที่ขายผ่านช่องทางอื่น (เช่น Facebook, LINE, หน้าร้าน) ลงทะเบียนเองได้และผ่านการตรวจสอบอัตโนมัติ — ได้ผล Insufficient Data ที่ไม่ใช่ผลลบ และระบบแจ้งร้านให้เพิ่มข้อมูลเองโดยไม่ต้องใช้เจ้าหน้าที่',
    keyMessage: 'SME Trust เปิดให้ผู้ประกอบการรายย่อยทุกช่องทางเข้าร่วมได้ — การไม่มีบัญชี Shopee/Lazada ไม่ทำให้เสียคะแนน',
    audience: ['merchant', 'consumer'],
    duration: '≈ 6 นาที',
    caseNote: 'เส้นทางทางเลือกใช้บัญชีตัวอย่างที่ยังไม่มีร้าน (OP-012) แยกจากร้านใน Scenario 9–13 — ข้อมูลของ Journey Marketplace & Trust ยังอยู่ครบ',
    nextCta: 'กลับสู่ Demo',
    prepare: () => {
      fixtureBranchClean();
      return { operatorId: BRANCH_OPERATOR, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    replayNote: () => {
      const shops = branchShops();
      return shops.length ? `บัญชีตัวอย่าง OP-012 มีร้าน ${shops.map((m) => `"${m.shopName}" (${m.id})`).join(', ')} จากการเล่นเส้นทางนี้ครั้งก่อน — เมื่อเริ่มใหม่ ระบบจะล้างร้านเดิมของบัญชีนี้ (รวมคำขอและผลประเมินของร้านนั้น) เพื่อไม่ให้มีร้านซ้ำ ข้อมูลของร้านใน Scenario 9–13 ไม่ถูกแตะ` : undefined;
    },
    benefits: {
      sme: 'ร้านเล็กที่ไม่มีร้านบน Marketplace เริ่มต้นได้ทันที และรู้ว่าต้องเพิ่มหลักฐานอะไร',
      consumer: 'มีข้อมูลตัวตนที่ยืนยันแล้วของร้านจากช่องทางอื่น แทนที่จะไม่มีข้อมูลเลย',
      ocpb: 'ครอบคลุมผู้ประกอบการกลุ่มที่แพลตฟอร์มไม่ได้ดูแล — ระบบตรวจและแจ้งร้านเอง เจ้าหน้าที่ไม่ต้องเข้ามาในกรณีปกติ',
    },
    steps: [
      { id: 's9b-home', role: 'merchant', route: () => '/m', title: 'ผู้ประกอบการที่ไม่มีร้านบน Marketplace', instruction: (c) => `บัญชี "${operator(c.operatorId)?.name}" ยืนยันตัวตนแล้ว (Level 1) ขายผ่าน Facebook/LINE และไม่มีร้านบน Shopee/Lazada`, nextLabel: 'ไปที่ Marketplace Connection' },
      {
        id: 's9b-none',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'เลือก "ไม่มีร้านบน Marketplace"',
        instruction: 'กด "ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง"',
        tip: 'ระบบไม่หักคะแนนร้านที่ไม่มีบัญชี Shopee/Lazada (Missing Data ≠ 0)',
        gate: { check: (g) => sig(g, 'mkt.none') === true, hint: 'กด "ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง"' },
      },
      { id: 's9b-form', role: 'merchant', route: () => '/m/register-shop', title: 'กรอกข้อมูลร้านค้า (Self-Registration)', instruction: 'กรอกข้อมูลร้านและช่องทางขายเดิม (กด "เติมข้อมูลตัวอย่าง" ได้) จนถึงขั้นเอกสาร', gate: { check: (g) => num(g, 'shop.step') >= 4, hint: 'กรอกข้อมูลจนถึงขั้น "เอกสารประกอบ"' } },
      { id: 's9b-identity', role: 'merchant', route: () => '/m/register-shop', title: 'Mock Identity Verification', instruction: 'ร้านผูกกับบัญชีที่ผ่าน e-KYC จำลองแล้ว (Level 1) — แนบเอกสารจำลองแล้วไปขั้นตรวจสอบข้อมูล', tip: 'ไม่เก็บเลขบัตรประชาชนหรือภาพใบหน้า', gate: { check: (g) => num(g, 'shop.step') >= 5, hint: 'แนบเอกสารจำลองแล้วกด "ถัดไป"' } },
      {
        id: 's9b-submit',
        role: 'merchant',
        route: () => '/m/register-shop',
        title: 'ส่งข้อมูล',
        instruction: 'ติ๊กยืนยันความถูกต้อง แล้วกด "ส่งคำขอ"',
        gate: { check: (g) => !!branchApp(g), hint: 'ติ๊กยืนยันแล้วกด "ส่งคำขอ"' },
        capture: (g) => {
          const a = branchApp(g)!;
          return { applicationId: a.id, merchantId: a.merchantId };
        },
      },
      {
        id: 's9b-auto',
        role: 'merchant',
        route: () => '/m/shop',
        title: 'ระบบตรวจสอบอัตโนมัติ → ผ่านการลงทะเบียน',
        instruction: (c) => `คำขอ ${c.applicationId}: ${regLine(c)}`,
        tip: 'การไม่มีบัญชี Shopee/Lazada ไม่ใช่เหตุให้ต้องรอเจ้าหน้าที่',
        gate: { check: (g) => application(g.ctx.applicationId)?.status === 'approved', hint: 'คำขอยังไม่ผ่านอัตโนมัติ — ดูสิ่งที่ระบบแจ้งบนหน้านี้' },
      },
      {
        id: 's9b-assess',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'ประเมินอัตโนมัติ → Insufficient Data',
        instruction: 'ระบบประเมินทันทีหลังลงทะเบียน: ข้อมูลยังไม่เพียงพอ (ไม่ใช่ผลลบ) จึงยังไม่แสดง Badge — ระบบแจ้งร้านว่าควรเพิ่มข้อมูลอะไร (AUTO_REQUEST_INFO) โดยไม่ต้องส่งเจ้าหน้าที่',
        tip: 'Missing Data ≠ 0 — ระบบไม่หักคะแนนร้านที่ไม่มีข้อมูลจาก Marketplace',
        gate: { check: (g) => !!assessedSince(g), hint: 'รอระบบประเมิน หรือกด "ประเมินความน่าเชื่อถือ"' },
        capture: (g) => ({ assessmentId: assessedSince(g)?.id }),
        nextLabel: 'ดูในมุมผู้บริโภค',
      },
      {
        id: 's9b-consumer',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        transition: 'ผู้บริโภคเปิดหน้าร้านเดียวกัน — เส้นทางนี้ไม่มีขั้นตอนเจ้าหน้าที่',
        title: 'ผู้บริโภคเห็นสถานะแทน Badge',
        instruction: 'แสดง "ข้อมูลยังไม่เพียงพอ" แทน Badge — ไม่ได้หมายความว่าร้านมีปัญหา',
        nextLabel: 'จบเส้นทางลงทะเบียนด้วยตนเอง',
      },
    ],
    summary: (c) => {
      const m = merchant(c.merchantId);
      const a = assessment(c.assessmentId);
      const app = application(c.applicationId);
      return m
        ? [`ร้าน "${m.shopName}" (${m.id}) ลงทะเบียนด้วยตนเอง — ไม่มีบัญชี Marketplace`, a ? `ผลประเมิน ${a.id}: ${BAND_LABEL[a.result.band].label} (ไม่ใช่ผลลบ)` : '', app ? `คำขอ ${app.id}: ${REGISTRATION_STATUS[app.status].label}` : '', a?.decision ? `เจ้าหน้าที่: ${DECISION_LABEL[a.decision.kind].label} — ${a.decision.reason}` : ''].filter(Boolean)
        : ['ยังไม่ได้ลงทะเบียนร้านในเส้นทางนี้'];
    },
  },

];

/** คำขอลงทะเบียนที่ส่งระหว่างเส้นทางทางเลือก */
function branchApp(g: GateInput) {
  const shops = useMerchantStore.getState().items.filter((m) => m.operatorId === g.ctx.operatorId).map((m) => m.id);
  return useVerificationStore
    .getState()
    .items.filter((a) => shops.includes(a.merchantId) && a.type === 'registration' && a.submittedAt >= g.startedAt)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
}
