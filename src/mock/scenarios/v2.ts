/**
 * SME Trust v2 — Marketplace Intelligence (Scenario 9–13 และเส้นทางทางเลือก 9B)
 * ใช้ Workflow, Engine และหน้าจอเดียวกับการใช้งานจริงของต้นแบบ — Demo Controller เปลี่ยนเฉพาะขั้นตอนและบทบาท
 * ข้อมูล Marketplace ทั้งหมดเป็นข้อมูลจำลอง ไม่มีการเชื่อมต่อ API จริง
 */
import { REGISTRATION_STATUS } from '@/constants/labels';
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
import { BAND_LABEL, DECISION_LABEL } from '@/features/trust-assessment/labels';
import { currentCert } from '@/utils/trust';
import { REGISTRATION_ROUTE_LABEL } from '@/features/automation/registration';
import type { GateInput, ScenarioDef } from '@/demo/types';

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
const assessment = (id?: string) => useAssessmentStore.getState().items.find((a) => a.id === id);
const application = (id?: string) => useVerificationStore.getState().items.find((a) => a.id === id);
const certOf = (merchantId?: string) => (merchantId ? currentCert(useCertificationStore.getState().items, merchantId) : undefined);
const sig = (g: GateInput, k: string) => g.signals[k];
const num = (g: GateInput, k: string) => (typeof g.signals[k] === 'number' ? (g.signals[k] as number) : -1);




/** ผลประเมินล่าสุดที่เกิดระหว่างการสาธิตครั้งนี้ (รวมผลที่ระบบประเมินอัตโนมัติหลังลงทะเบียน) */
const assessedSince = (g: GateInput) => {
  const a = latestAssessment(g.ctx.merchantId ?? '');
  return a && a.createdAt >= g.startedAt ? a : undefined;
};

/** ผลการตรวจคำขอลงทะเบียนอัตโนมัติ (Automation First) */
/** จำนวนช่องที่ต้องตรวจกับแหล่งอ้างอิง (เช่น ชื่อร้านต่างจากร้านบน Marketplace) — ไม่มีสัญญาณ = 0 */
const verifyCount = (g: GateInput) => Math.max(0, num(g, 'reg.verification'));
const SHOP_NAME_BLOCK = {
  reason: 'ชื่อร้านต่างจากร้านบน Marketplace (จำลอง) — ถ้าส่งคำขอนี้ ระบบจะส่งเจ้าหน้าที่ตรวจเฉพาะกรณี (MANUAL_REVIEW) ซึ่งไม่ใช่เส้นทางปกติของ Demo นี้ · คืนชื่อร้านตามต้นฉบับแล้วแก้ "รายละเอียดสินค้าและบริการ" แทน หรือเปิดกรณีพิเศษ',
  altScenario: 's15',
};
/** คำขอลงทะเบียนไม่ผ่านอัตโนมัติ — อธิบายผลจริงของระบบและทางเลือก (ไม่บังคับผล AUTO_PASS) */
const registrationBlock = (g: GateInput) => {
  const a = application(g.ctx.applicationId);
  if (!a || a.status === 'approved') return undefined;
  const reasons = (a.autoDecision?.reasons ?? []).join(' · ');
  if (a.autoDecision?.route === 'MANUAL_REVIEW')
    return { reason: `ระบบส่งคำขอนี้ให้เจ้าหน้าที่ตรวจเฉพาะกรณี (MANUAL_REVIEW): ${reasons} — ไม่ใช่เส้นทางปกติของ Demo นี้ · กด "เริ่มใหม่" แล้วทำตามคำแนะนำ (คงชื่อร้านตามร้านบน Marketplace) หรือเปิดกรณีพิเศษ`, restart: true, altScenario: 's15' };
  if (a.autoDecision?.route === 'AUTO_REQUEST_INFO')
    return { reason: `ระบบขอข้อมูลเพิ่มเติม (AUTO_REQUEST_INFO): ${reasons} — ร้านค้าแก้ไขเองได้ที่หน้านี้ หรือกด "เริ่มใหม่" แล้วทำตามคำแนะนำ`, restart: true };
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

export const v2Scenarios: ScenarioDef[] = [
  // ------------------------------------------------------------ 9B (ทางเลือก)
  {
    id: 's9a',
    no: 9,
    code: '9A',
    track: 'v2',
    branch: true,
    title: 'ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ',
    objective: 'ผู้ประกอบการที่ยังไม่มีร้านใน SME Trust แต่ขายบน Shopee/Lazada (จำลอง) เชื่อมบัญชี เลือกร้าน นำเข้าข้อมูล แล้วแบบฟอร์มลงทะเบียนถูกเติมอัตโนมัติ ตรวจ/แก้ไข กรอกส่วนที่ขาด และกดส่งคำขอเอง',
    keyMessage: 'ร้านใหม่สมัครได้เร็วขึ้นโดยไม่ต้องกรอกข้อมูลซ้ำ — ระบบตรวจและผ่านการลงทะเบียนอัตโนมัติ เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ',
    audience: ['merchant', 'consumer'],
    duration: '≈ 6 นาที',
    caseNote: 'ใช้บัญชีตัวอย่าง OP-013 ซึ่งยืนยันตัวตนแล้วแต่ยังไม่มีร้านใน SME Trust · การผ่านการลงทะเบียนไม่ใช่ใบรับรอง — ใบรับรองทุกระดับยังต้องให้เจ้าหน้าที่อนุมัติ',
    nextCta: 'กลับสู่ Demo',
    prepare: () => {
      fixtureBranchClean(NEW_SHOP_OPERATOR);
      return { operatorId: NEW_SHOP_OPERATOR, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    replayNote: () => {
      const shops = branchShops(NEW_SHOP_OPERATOR);
      return shops.length ? `บัญชีตัวอย่าง OP-013 มีร้าน ${shops.map((m) => `"${m.shopName}" (${m.id})`).join(', ')} จากการเล่นเส้นทางนี้ครั้งก่อน — เมื่อเริ่มใหม่ ระบบจะล้างร้าน คำขอ การเชื่อมต่อ และบันทึกการนำเข้าของบัญชีนี้ เพื่อไม่ให้มีร้านซ้ำ ข้อมูลร้านตัวอย่างอื่นไม่ถูกแตะ` : undefined;
    },
    benefits: {
      sme: 'สมัครร้านได้ในไม่กี่ขั้น ใช้ข้อมูลร้านที่มีอยู่แล้ว และแก้ไขได้ก่อนส่ง',
      consumer: 'ร้านใหม่มีข้อมูลการขายที่ตรวจสอบได้ตั้งแต่วันแรกที่ลงทะเบียน',
      ocpb: 'ร้านปกติผ่านการลงทะเบียนอัตโนมัติ — เจ้าหน้าที่เห็นต้นฉบับเทียบกับข้อมูลที่แก้เฉพาะคำขอที่ระบบส่งตรวจ',
    },
    steps: [
      { id: 's9a-home', role: 'merchant', route: () => '/m', title: 'ผู้ประกอบการรายใหม่ที่ขายบน Marketplace', instruction: (c) => `บัญชี "${operator(c.operatorId)?.name}" ยืนยันตัวตนแล้ว (Level 1) ยังไม่มีร้านใน SME Trust แต่มีร้านบน Shopee/Lazada (จำลอง)`, tip: 'ทุกขั้นต่อจากนี้ใช้ร้านค้าเดียวกันที่สร้างจากข้อมูล Marketplace (จำลอง)', nextLabel: 'ไปที่ลงทะเบียนร้านค้า' },
      {
        id: 's9a-entry',
        role: 'merchant',
        route: () => '/m/register-shop',
        title: 'เลือกวิธีลงทะเบียน',
        instruction: 'เลือก "A. เชื่อมต่อร้านค้าจาก Marketplace" (ตัวเลือก B คือลงทะเบียนด้วยตนเองสำหรับร้านที่ไม่ได้ขายบนแพลตฟอร์มที่รองรับ — ดูได้ในกรณีพิเศษบนหน้า Demo)',
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
        tip: 'เจ้าหน้าที่เข้ามาเฉพาะกรณีพบความผิดปกติ เช่น เจ้าของร้านบน Marketplace ไม่ตรงกับผู้ยืนยันตัวตน (ดูได้ในกรณีพิเศษบนหน้า Demo)',
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
    title: 'กรณีร้านค้าไม่มี Marketplace และข้อมูลยังไม่พอ',
    objective: 'ร้านที่ขายผ่านช่องทางอื่น (เช่น Facebook, LINE, หน้าร้าน) ลงทะเบียนเองได้และผ่านการตรวจสอบอัตโนมัติ — ได้ผล Insufficient Data ที่ไม่ใช่ผลลบ และระบบแจ้งร้านให้เพิ่มข้อมูลเองโดยไม่ต้องใช้เจ้าหน้าที่',
    keyMessage: 'SME Trust เปิดให้ผู้ประกอบการรายย่อยทุกช่องทางเข้าร่วมได้ — การไม่มีบัญชี Shopee/Lazada ไม่ทำให้เสียคะแนน',
    audience: ['merchant', 'consumer'],
    duration: '≈ 6 นาที',
    caseNote: 'ใช้บัญชีตัวอย่างที่ยืนยันตัวตนแล้วแต่ยังไม่มีร้าน (OP-012)',
    nextCta: 'กลับสู่ Demo',
    prepare: () => {
      fixtureBranchClean();
      return { operatorId: BRANCH_OPERATOR, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    replayNote: () => {
      const shops = branchShops();
      return shops.length ? `บัญชีตัวอย่าง OP-012 มีร้าน ${shops.map((m) => `"${m.shopName}" (${m.id})`).join(', ')} จากการเล่นเส้นทางนี้ครั้งก่อน — เมื่อเริ่มใหม่ ระบบจะล้างร้านเดิมของบัญชีนี้ (รวมคำขอและผลประเมินของร้านนั้น) เพื่อไม่ให้มีร้านซ้ำ ข้อมูลร้านตัวอย่างอื่นไม่ถูกแตะ` : undefined;
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
