/**
 * Workflow ของ v2 — การเชื่อมต่อ Marketplace (จำลอง), Trust Assessment และการพิจารณาของเจ้าหน้าที่
 * ทุกการเปลี่ยนแปลงบันทึก Audit และแจ้งเตือนผู้เกี่ยวข้องเหมือน Workflow v1
 * ไม่มีการออก Badge, ลดระดับ หรือระงับอัตโนมัติจากผลประเมิน (D3)
 */
import type { MarketplaceConnection, Platform, Archetype } from '@/features/marketplace/types';
import type { OfficerDecisionKind, TrustAssessment } from '@/features/trust-assessment/types';
import { CONSENT_SCOPES, PLATFORMS } from '@/features/marketplace/data/platforms';
import { productsOfCategory } from '@/features/marketplace/data/catalog';
import { hashString, mulberry32, pick } from '@/features/marketplace/services/prng';
import { assessTrust } from '@/features/trust-assessment/engine';
import { buildAssessmentInput, inputsKey, type DataBundle } from '@/features/trust-assessment/inputs';
import { DECISION_LABEL } from '@/features/trust-assessment/labels';
import { BUSINESS_CATEGORIES } from '@/constants/labels';
import { levelCriteria } from '@/utils/criteria';
import { currentCert } from '@/utils/trust';
import { nextRef, nowISO } from '@/utils/id';
import { mockShopId } from '@/mock/data/marketplace';
import {
  useAssessmentStore,
  useCertificationStore,
  useComplaintStore,
  useMarketplaceStore,
  useMerchantStore,
  useOperatorStore,
  useRiskStore,
  useSessionStore,
  useTrainingStore,
  useVerificationStore,
  useWarningStore,
} from '.';
import { currentModel } from './assessmentConfig';
import { applyCertification, approveApplication, audit, currentActor, notify, notifyMerchant, openRiskCase, rejectApplication, requestInfo, type WorkflowResult } from './workflows';

const mk = () => useMarketplaceStore.getState();
const conn = (id: string) => mk().items.find((c) => c.id === id);
const merchantOf = (id: string) => useMerchantStore.getState().items.find((m) => m.id === id);

// ================================================================ Marketplace Connection (จำลอง)

/** Seed ของข้อมูลจำลอง — ใช้แสดงตัวอย่างข้อมูลก่อนยืนยันนำเข้า (ได้ข้อมูลเดียวกับที่จะนำเข้าจริง) */
export const seedFor = (merchantId: string, platform: Platform, archetype: Archetype, connectionId: string) => hashString(`${merchantId}:${platform}:${archetype}:${connectionId}`);

/** เริ่มเชื่อมต่อ — สร้างคำขอความยินยอม (ยังไม่ดึงข้อมูล) */
export function connectMarketplace(merchantId: string, platform: Platform, archetype: Archetype = 'established_good'): MarketplaceConnection {
  const existing = mk().items.find((c) => c.merchantId === merchantId && c.platform === platform && c.status !== 'disconnected');
  if (existing) return existing;
  const id = nextRef('MKC', mk().items.map((c) => c.id), 3);
  const c: MarketplaceConnection = {
    id,
    merchantId,
    platform,
    mockShopId: mockShopId(`${merchantId}:${id}`, platform),
    mockShopName: `${merchantOf(merchantId)?.shopName ?? merchantId} (${PLATFORMS[platform].label})`,
    status: 'pending_consent',
    scopes: [],
    archetype,
    seed: seedFor(merchantId, platform, archetype, id),
    createdAt: nowISO(),
  };
  mk().add(c);
  return c;
}

/** ร้านให้ความยินยอม (จำลอง) → เริ่มซิงก์ */
export function grantConsent(connectionId: string, archetype?: Archetype) {
  const c = conn(connectionId);
  if (!c) return;
  mk().update(connectionId, {
    status: 'syncing',
    scopes: [...CONSENT_SCOPES],
    consentAt: nowISO(),
    failReason: undefined,
    ...(archetype && archetype !== c.archetype ? { archetype, seed: seedFor(c.merchantId, c.platform, archetype, c.id) } : {}),
  });
  audit('ให้ความยินยอมเชื่อมต่อ Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
}

/** ผลการซิงก์ (จำลอง) — ok=false จำลองการซิงก์ล้มเหลว */
export function completeSync(connectionId: string, ok = true) {
  const c = conn(connectionId);
  if (!c) return;
  if (ok) {
    mk().update(connectionId, { status: 'connected', lastSyncAt: nowISO(), failReason: undefined });
    audit('ซิงก์ข้อมูล Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
    notifyMerchant(c.merchantId, `ซิงก์ข้อมูล ${PLATFORMS[c.platform].label} สำเร็จ`, 'ประเมินความน่าเชื่อถือใหม่เพื่อใช้ข้อมูลล่าสุด', '/m/trust', 'success');
  } else {
    mk().update(connectionId, { status: 'sync_failed', failReason: 'การเชื่อมต่อหมดเวลา (จำลอง) — กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง' });
    audit('ซิงก์ข้อมูล Marketplace ไม่สำเร็จ (จำลอง)', connectionId, PLATFORMS[c.platform].label);
  }
}

export function resyncMarketplace(connectionId: string) {
  const c = conn(connectionId);
  if (!c || c.status === 'disconnected' || c.status === 'pending_consent') return;
  mk().update(connectionId, { status: 'syncing', failReason: undefined });
}

/** ยกเลิกการเชื่อมต่อ — ข้อมูลจากแพลตฟอร์มนี้จะไม่ถูกใช้ประเมินอีก */
export function disconnectMarketplace(connectionId: string) {
  const c = conn(connectionId);
  if (!c) return;
  mk().update(connectionId, { status: 'disconnected', disconnectedAt: nowISO() });
  audit('ยกเลิกการเชื่อมต่อ Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
}

/** ข้อมูลร้านจำลองสำหรับ "นำเข้าจาก Marketplace" ตอนลงทะเบียนร้าน (Self-Registration) */
export function mockShopProfile(operatorId: string, platform: Platform) {
  const op = useOperatorStore.getState().items.find((o) => o.id === operatorId);
  const rng = mulberry32(hashString(`${operatorId}:${platform}:profile`));
  const category = pick(rng, BUSINESS_CATEGORIES.filter((c) => c !== 'บริการ'));
  const products = productsOfCategory(category).slice(0, 3).map((p) => p.name);
  const first = op?.name.split(' ')[0] ?? 'ใหม่';
  return {
    platform,
    mockShopId: mockShopId(operatorId, platform),
    shopName: `ร้าน${first}${pick(rng, ['ช็อป', 'สโตร์', 'มาร์เก็ต'])}`,
    category,
    description: `จำหน่าย${products.join(' ')} ส่งทั่วประเทศ เปลี่ยนสินค้าได้ภายใน 7 วันหากสินค้าเสียหายจากการขนส่ง (ข้อมูลนำเข้าจาก ${PLATFORMS[platform].label})`,
    handle: `${PLATFORMS[platform].short.toLowerCase()}-${mockShopId(operatorId, platform).toLowerCase()} (จำลอง)`,
  };
}

/** หลังส่งคำขอลงทะเบียน: สร้างการเชื่อมต่อจากแพลตฟอร์มที่ร้านนำเข้าข้อมูล (ร้านให้ความยินยอมแล้วตอนนำเข้า) */
export function attachImportedMarketplaces(merchantId: string, imports: { platform: Platform; archetype: Archetype }[]) {
  return imports.map((im) => {
    const c = connectMarketplace(merchantId, im.platform, im.archetype);
    grantConsent(c.id, im.archetype);
    completeSync(c.id, true);
    return conn(c.id)!;
  });
}

// ================================================================ Trust Assessment

export function dataBundle(): DataBundle {
  return {
    operators: useOperatorStore.getState().items,
    merchants: useMerchantStore.getState().items,
    certifications: useCertificationStore.getState().items,
    complaints: useComplaintStore.getState().items,
    warnings: useWarningStore.getState().items,
    risks: useRiskStore.getState().items,
    enrollments: useTrainingStore.getState().items,
    connections: mk().items,
  };
}

/** ข้อมูลปัจจุบันของร้าน → Input + ลายนิ้วมือ (ใช้ตรวจว่าผลประเมินล่าสุดล้าสมัยหรือไม่) */
export function currentInputs(merchantId: string) {
  const input = buildAssessmentInput(merchantId, dataBundle(), new Date());
  return input ? { input, key: inputsKey(input, currentModel().weights) } : undefined;
}

export const latestAssessment = (merchantId: string, items = useAssessmentStore.getState().items) =>
  items.filter((a) => a.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];

/** ประเมินใหม่ — ถ้าผลล่าสุดยังเป็นร่างจะแทนที่ร่างนั้น (ไม่สร้างร่างซ้ำ) */
export function runAssessment(merchantId: string): TrustAssessment | undefined {
  const cur = currentInputs(merchantId);
  if (!cur) return undefined;
  const result = assessTrust(cur.input, currentModel());
  const store = useAssessmentStore.getState();
  const last = latestAssessment(merchantId);
  if (last && last.status === 'draft') {
    store.update(last.id, { result, inputsKey: cur.key, createdAt: nowISO() });
    audit('ประเมินความน่าเชื่อถือใหม่', last.id, result.band);
    return useAssessmentStore.getState().items.find((a) => a.id === last.id);
  }
  const a: TrustAssessment = { id: nextRef('TAS', store.items.map((x) => x.id)), merchantId, createdAt: nowISO(), status: 'draft', inputsKey: cur.key, result };
  store.add(a);
  audit('ประเมินความน่าเชื่อถือ', a.id, result.band);
  return a;
}

/** ร้านส่งผลประเมินให้เจ้าหน้าที่พิจารณา (ประกอบการพิจารณา Level 3–4) */
export function submitAssessment(assessmentId: string): WorkflowResult {
  const a = useAssessmentStore.getState().items.find((x) => x.id === assessmentId);
  if (!a) return { ok: false, error: 'ไม่พบผลประเมิน' };
  if (a.status !== 'draft') return { ok: false, error: 'ผลประเมินนี้ส่งพิจารณาแล้ว' };
  const cur = currentInputs(a.merchantId);
  if (cur && cur.key !== a.inputsKey) return { ok: false, error: 'ข้อมูลเปลี่ยนแปลงหลังการประเมิน — กรุณาประเมินใหม่ก่อนส่ง' };
  if (a.result.standing !== 'normal') return { ok: false, error: 'สถานะการรับรองไม่ปกติ จึงยังส่งพิจารณาไม่ได้' };
  const applicationId = linkApplication(a);
  useAssessmentStore.getState().update(assessmentId, { status: 'pending_review', submittedAt: nowISO(), applicationId });
  audit('ส่งผลประเมินให้เจ้าหน้าที่พิจารณา', assessmentId, applicationId ? `คำขอ ${applicationId}` : undefined);
  notify('officer', undefined, 'ผลประเมินความน่าเชื่อถือรอพิจารณา', `${assessmentId} ${merchantOf(a.merchantId)?.shopName}`, `/o/assessments/${assessmentId}`);
  return { ok: true };
}

const appOf = (id?: string) => useVerificationStore.getState().items.find((x) => x.id === id);
const isOpen = (status?: string) => !!status && !['approved', 'rejected'].includes(status);

/**
 * ผูกผลประเมินกับคำขอ v1 เดิม (ใช้ Application ID เดียวกันตลอดการพิจารณา)
 * - มีคำขอที่ยังค้างอยู่ (ลงทะเบียน/ขอรับรอง) → ใช้คำขอนั้น
 * - ร้านมี Level 2 ขึ้นไป และผลประเมินอยู่ในเกณฑ์ประกอบการพิจารณา → ยื่นคำขอรับรองระดับที่แนะนำผ่าน Workflow v1
 * - นอกนั้นไม่สร้างคำขอ (เจ้าหน้าที่ยังพิจารณาผลประเมินได้ตามปกติ)
 */
function linkApplication(a: TrustAssessment): string | undefined {
  const open = useVerificationStore
    .getState()
    .items.filter((x) => x.merchantId === a.merchantId && isOpen(x.status))
    .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))[0];
  if (open) return open.id;
  const rec = a.result.recommendation;
  if (rec.kind === 'consider_l3' || rec.kind === 'consider_l4') return applyCertification(a.merchantId, rec.level).id;
  return undefined;
}

/** เกณฑ์ v1 ของระดับที่จะยกระดับ (ต้องผ่านด้วย — D3) */
export function v1CriteriaFor(merchantId: string, level: 3 | 4) {
  const m = merchantOf(merchantId);
  if (!m) return [];
  const op = useOperatorStore.getState().items.find((o) => o.id === m.operatorId);
  return levelCriteria(m, op, {
    enrollments: useTrainingStore.getState().items,
    warnings: useWarningStore.getState().items,
    complaints: useComplaintStore.getState().items,
    risks: useRiskStore.getState().items,
    cert: currentCert(useCertificationStore.getState().items, merchantId),
  })[level];
}

const EXPECTED: Record<OfficerDecisionKind, string[]> = {
  approved: ['consider_l3', 'consider_l4'],
  need_info: ['need_more_data'],
  escalated: ['refer_risk'],
  rejected: ['not_yet', 'blocked'],
};

/** เจ้าหน้าที่ตัดสิน — การยกระดับออกใบรับรองผ่าน Workflow v1 เดิม และต้องผ่านเกณฑ์ v1 ด้วย */
export function decideAssessment(assessmentId: string, kind: OfficerDecisionKind, reason: string, level?: 3 | 4): WorkflowResult {
  const a = useAssessmentStore.getState().items.find((x) => x.id === assessmentId);
  if (!a) return { ok: false, error: 'ไม่พบผลประเมิน' };
  if (a.status !== 'pending_review') return { ok: false, error: 'ผลประเมินนี้ไม่ได้อยู่ในสถานะรอพิจารณา' };
  if (reason.trim().length < 5) return { ok: false, error: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' };
  const s = useSessionStore.getState();
  const actor = currentActor();
  let applicationId: string | undefined;
  let certId: string | undefined;
  let riskCaseId: string | undefined;

  if (kind === 'approved') {
    if (!level) return { ok: false, error: 'กรุณาเลือกระดับที่อนุมัติ' };
    if (a.result.standing !== 'normal') return { ok: false, error: 'สถานะการรับรองไม่ปกติ จึงอนุมัติ Badge ไม่ได้' };
    const unmet = v1CriteriaFor(a.merchantId, level).filter((c) => !c.met);
    if (unmet.length) return { ok: false, error: `ยังไม่ผ่านเกณฑ์ v1 ของ Level ${level}: ${unmet.map((c) => c.label).join(', ')}` };
    const cert = currentCert(useCertificationStore.getState().items, a.merchantId);
    if (cert?.status === 'active' && cert.level >= level) return { ok: false, error: `ร้านมีใบรับรองระดับ ${cert.level} อยู่แล้ว` };
    // ใช้คำขอที่ผูกไว้ตอนส่งพิจารณา (ถ้าเป็นคำขอรับรองที่ยังค้าง) — ไม่สร้างคำขอซ้ำ
    const linked = appOf(a.applicationId);
    const useLinked = linked && linked.type === 'certification' && isOpen(linked.status);
    if (useLinked && linked.requestedLevel !== level) {
      useVerificationStore.getState().update(linked.id, (x) => ({ requestedLevel: level, timeline: [...x.timeline, { id: `tl-${Date.now()}`, at: nowISO(), actor: 'officer', actorName: actor.name, title: `ปรับระดับที่พิจารณาเป็น Level ${level}`, note: assessmentId }] }));
    }
    const app = useLinked ? linked : applyCertification(a.merchantId, level);
    const r = approveApplication(app.id, `อนุมัติจากการพิจารณาผลประเมิน ${assessmentId}`);
    if (!r.ok) return r;
    applicationId = app.id;
    certId = currentCert(useCertificationStore.getState().items, a.merchantId)?.id;
  } else if (kind === 'escalated') {
    const open = useComplaintStore.getState().items.filter((c) => c.merchantId === a.merchantId && !['resolved', 'closed'].includes(c.status)).map((c) => c.id);
    riskCaseId = openRiskCase(a.merchantId, `จากการพิจารณาผลประเมิน ${assessmentId}: ${reason}`, open).id;
  } else if (isOpen(appOf(a.applicationId)?.status)) {
    // คำขอ v1 ที่ผูกไว้: ขอข้อมูลเพิ่ม/ไม่อนุมัติผ่าน Workflow เดิม (แจ้งร้านค้าและบันทึก Timeline ของคำขอ)
    applicationId = a.applicationId;
    if (kind === 'need_info') requestInfo(a.applicationId!, `${reason.trim()} (ผลประเมิน ${assessmentId})`);
    else rejectApplication(a.applicationId!, `${reason.trim()} (ผลประเมิน ${assessmentId})`);
  } else {
    notifyMerchant(
      a.merchantId,
      kind === 'need_info' ? 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติมสำหรับผลประเมิน' : 'ผลประเมินยังไม่ผ่านการพิจารณายกระดับ',
      reason,
      '/m/trust',
      kind === 'need_info' ? 'warning' : 'error',
    );
  }

  useAssessmentStore.getState().update(assessmentId, {
    status: 'decided',
    decision: {
      kind,
      level: kind === 'approved' ? level : undefined,
      reason: reason.trim(),
      officerId: s.officerId,
      officerName: actor.name,
      at: nowISO(),
      overridesRecommendation: !EXPECTED[kind].includes(a.result.recommendation.kind),
      applicationId,
      certId,
      riskCaseId,
    },
  });
  audit('พิจารณาผลประเมินความน่าเชื่อถือ', assessmentId, `${DECISION_LABEL[kind].label}${level ? ` Level ${level}` : ''} — ${reason.trim()}`);
  return { ok: true };
}
