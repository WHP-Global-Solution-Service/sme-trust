/**
 * Workflow ของ v2 — การเชื่อมต่อ Marketplace (จำลอง), Trust Assessment และการพิจารณาของเจ้าหน้าที่
 * ทุกการเปลี่ยนแปลงบันทึก Audit และแจ้งเตือนผู้เกี่ยวข้องเหมือน Workflow v1
 * ไม่มีการออก Badge, ลดระดับ หรือระงับอัตโนมัติจากผลประเมิน (D3)
 */
import type { MarketplaceConnection, Platform, Archetype, FailKind } from '@/features/marketplace/types';
import type { Merchant } from '@/types';
import { buildImportSource, fieldRows, FIELD_KEYS, newRegistrationRules, profileUpdateRules, summarize, type FieldValues, type ImportSource, type MarketplaceImportRecord } from '@/features/marketplace/autofill';
import type { OfficerDecisionKind, TrustAssessment } from '@/features/trust-assessment/types';
import { isOpenChange, PROFILE_CHANGE_FIELD_LABEL, type ProfileChange, type ProfileChangeAction, type ProfileChangeField, type ProfileChangeRequest } from '@/features/profile-change/types';
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
  useImportRecordStore,
  useMerchantStore,
  useOperatorStore,
  useProfileChangeStore,
  useRiskStore,
  useSessionStore,
  useTrainingStore,
  useVerificationStore,
  useWarningStore,
} from '.';
import { currentModel } from './assessmentConfig';
import { processMerchant } from './automation';
import { applyCertification, approveApplication, audit, currentActor, notify, notifyMerchant, openRiskCase, rejectApplication, requestInfo, submitShopRegistration, type ShopForm, type WorkflowResult } from './workflows';

const mk = () => useMarketplaceStore.getState();
const conn = (id: string) => mk().items.find((c) => c.id === id);
const merchantOf = (id: string) => useMerchantStore.getState().items.find((m) => m.id === id);

// ================================================================ Marketplace Connection (จำลอง)

/** Seed ของข้อมูลจำลอง — ใช้แสดงตัวอย่างข้อมูลก่อนยืนยันนำเข้า (ได้ข้อมูลเดียวกับที่จะนำเข้าจริง) */
export const seedFor = (merchantId: string, platform: Platform, archetype: Archetype, connectionId: string) => hashString(`${merchantId}:${platform}:${archetype}:${connectionId}`);

/** ข้อมูลต้นฉบับที่ผู้ใช้เห็นตอน Preview — ใช้สร้างการเชื่อมต่อให้ได้ Snapshot เดียวกันทุกตัวเลข */
export interface PinnedSource {
  seed: number;
  mockShopId: string;
  mockShopName: string;
  sourceCategory: string;
}

/** เริ่มเชื่อมต่อ — สร้างคำขอความยินยอม (ยังไม่ดึงข้อมูล) */
export function connectMarketplace(merchantId: string, platform: Platform, archetype: Archetype = 'established_good', pinned?: PinnedSource): MarketplaceConnection {
  const existing = mk().items.find((c) => c.merchantId === merchantId && c.platform === platform && c.status !== 'disconnected');
  if (existing) return existing;
  const id = nextRef('MKC', mk().items.map((c) => c.id), 3);
  const c: MarketplaceConnection = {
    id,
    merchantId,
    platform,
    mockShopId: pinned?.mockShopId ?? mockShopId(`${merchantId}:${id}`, platform),
    mockShopName: pinned?.mockShopName ?? `${merchantOf(merchantId)?.shopName ?? merchantId} (${PLATFORMS[platform].label})`,
    status: 'pending_consent',
    scopes: [],
    archetype,
    seed: pinned?.seed ?? seedFor(merchantId, platform, archetype, id),
    createdAt: nowISO(),
    ...(pinned ? { sourceCategory: pinned.sourceCategory } : {}),
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
    // บันทึกหมวดสินค้าต้นฉบับ ณ ตอนนำเข้า — แก้หมวดในโปรไฟล์ร้านภายหลังไม่เปลี่ยน Raw Source
    sourceCategory: c.sourceCategory ?? merchantOf(c.merchantId)?.category,
    ...(archetype && archetype !== c.archetype ? { archetype, seed: seedFor(c.merchantId, c.platform, archetype, c.id) } : {}),
  });
  audit('ให้ความยินยอมเชื่อมต่อ Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
}

/** ข้อความเมื่อการเชื่อมต่อจำลองล้มเหลวแต่ละจุด */
export const FAIL_REASON: Record<FailKind, string> = {
  connect: 'เชื่อมต่อ Marketplace ไม่สำเร็จ (จำลอง) — แพลตฟอร์มไม่ตอบรับคำขอเชื่อมต่อ กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง',
  import: 'นำเข้าข้อมูลไม่สำเร็จ (จำลอง) — ข้อมูลร้านค้าที่ได้รับไม่ครบ กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง',
  sync: 'การเชื่อมต่อหมดเวลา (จำลอง) — กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง',
};
const FAIL_TITLE: Record<FailKind, string> = { connect: 'เชื่อมต่อ Marketplace ไม่สำเร็จ', import: 'นำเข้าข้อมูล Marketplace ไม่สำเร็จ', sync: 'ซิงก์ข้อมูล Marketplace ไม่สำเร็จ' };

/**
 * ผลการซิงก์ (จำลอง) — ok=false จำลองความล้มเหลว (เชื่อมต่อ/นำเข้า/ซิงก์)
 * ซิงก์สำเร็จ: อัปเดตวันที่ซิงก์และที่มา (Source Context) โดยใช้รหัสการเชื่อมต่อและ Seed เดิม — ไม่สร้างข้อมูลซ้ำ
 */
export function completeSync(connectionId: string, ok = true, failKind: FailKind = 'sync') {
  const c = conn(connectionId);
  if (!c) return;
  const syncCount = (c.syncCount ?? 0) + 1;
  if (ok) {
    mk().update(connectionId, { status: 'connected', lastSyncAt: nowISO(), syncSource: 'sync', syncCount, failReason: undefined, failKind: undefined });
    audit('ซิงก์ข้อมูล Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
    notifyMerchant(c.merchantId, `ซิงก์ข้อมูล ${PLATFORMS[c.platform].label} สำเร็จ`, 'ระบบประเมินความน่าเชื่อถือใหม่อัตโนมัติด้วยข้อมูลล่าสุด', '/m/trust', 'success');
    // Automation First: นำเข้า/ซิงก์สำเร็จ → ประเมินใหม่ → Decision Router → Badge (ขณะผู้ใช้เปิดระบบเท่านั้น)
    processMerchant(c.merchantId, syncCount === 1 ? 'import' : 'sync');
  } else {
    mk().update(connectionId, { status: 'sync_failed', syncCount, failKind, failReason: FAIL_REASON[failKind] });
    audit(`${FAIL_TITLE[failKind]} (จำลอง)`, connectionId, PLATFORMS[c.platform].label);
    processMerchant(c.merchantId, 'sync_failed');
  }
}

export function resyncMarketplace(connectionId: string) {
  const c = conn(connectionId);
  if (!c || c.status === 'disconnected' || c.status === 'pending_consent') return;
  mk().update(connectionId, { status: 'syncing', failReason: undefined });
}

/** Fixture จำลองอายุข้อมูล (P7-D) — ใช้สาธิตผลของข้อมูลเก่าต่อ Data Confidence เท่านั้น */
export type DataAgePreset = 'fresh' | 'd30' | 'd90' | 'stale' | 'sync_failed';
export const DATA_AGE_PRESETS: Record<DataAgePreset, { label: string; days?: number; desc: string }> = {
  fresh: { label: 'ข้อมูลใหม่', days: 0, desc: 'ซิงก์วันนี้ — Confidence ไม่ถูกหักเรื่องอายุข้อมูล' },
  d30: { label: 'ข้อมูลเกิน 30 วัน', days: 31, desc: 'ซิงก์ล่าสุด 31 วันก่อน — หักความเชื่อมั่นบางส่วน' },
  d90: { label: 'ข้อมูลเกิน 90 วัน', days: 91, desc: 'ซิงก์ล่าสุด 91 วันก่อน — หักความเชื่อมั่นเต็มจำนวน' },
  stale: { label: 'ข้อมูลหมดอายุ (180 วัน)', days: 180, desc: 'ไม่ได้ซิงก์ครึ่งปี — ข้อมูลไม่สะท้อนปัจจุบัน' },
  sync_failed: { label: 'ซิงก์ไม่สำเร็จ', desc: 'การซิงก์ล่าสุดล้มเหลว — ข้อมูลจากแพลตฟอร์มนี้ไม่ถูกใช้ประเมินจนกว่าจะซิงก์สำเร็จ' },
};

export function simulateDataAge(connectionId: string, preset: DataAgePreset) {
  const c = conn(connectionId);
  if (!c || c.status === 'disconnected' || c.status === 'pending_consent') return;
  const p = DATA_AGE_PRESETS[preset];
  if (preset === 'sync_failed') completeSync(connectionId, false, 'sync');
  else mk().update(connectionId, { status: 'connected', lastSyncAt: new Date(Date.now() - p.days! * 86_400_000).toISOString(), syncSource: 'simulated_age', failReason: undefined, failKind: undefined });
  audit('จำลองอายุข้อมูล Marketplace (สำหรับการสาธิต)', connectionId, p.label);
  if (preset !== 'sync_failed') processMerchant(c.merchantId, 'data_age');
}

/** ยกเลิกการเชื่อมต่อ — ข้อมูลจากแพลตฟอร์มนี้จะไม่ถูกใช้ประเมินอีก */
export function disconnectMarketplace(connectionId: string) {
  const c = conn(connectionId);
  if (!c) return;
  mk().update(connectionId, { status: 'disconnected', disconnectedAt: nowISO() });
  // ฉบับร่างอัปเดตโปรไฟล์จากการเชื่อมต่อนี้ใช้ต่อไม่ได้ (ไม่มีสิทธิ์เข้าถึงข้อมูลต้นฉบับแล้ว) — ข้อมูลที่ยืนยันบันทึกไปแล้วยังอยู่
  useSessionStore.getState().saveDraft(profileDraftKey(connectionId), undefined);
  audit('ยกเลิกการเชื่อมต่อ Marketplace (จำลอง)', connectionId, PLATFORMS[c.platform].label);
  processMerchant(c.merchantId, 'disconnect');
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
export function attachImportedMarketplaces(merchantId: string, imports: { platform: Platform; archetype: Archetype; pinned?: PinnedSource }[]) {
  return imports.map((im) => {
    const c = connectMarketplace(merchantId, im.platform, im.archetype, im.pinned);
    grantConsent(c.id);
    completeSync(c.id, true);
    return conn(c.id)!;
  });
}

// ================================================================ Marketplace-Assisted Registration / Auto-Fill

/** คีย์ฉบับร่าง (ใน Session ของ v2): สมัครร้านใหม่ใช้รหัสผู้ประกอบการ, ขั้นตอนเชื่อมบัญชีและการอัปเดตโปรไฟล์ร้านเดิมแยกคีย์ */
export const profileDraftKey = (connectionId: string) => `upd:${connectionId}`;
export const importFlowKey = (operatorId: string) => `flow:${operatorId}`;

const imp = () => useImportRecordStore.getState();
const operatorName = (id: string) => useOperatorStore.getState().items.find((o) => o.id === id)?.name ?? id;

/** ข้อมูลที่ลงทะเบียนไว้ของร้าน (ช่องที่แก้ไขได้) */
export function registeredValues(m: Merchant): FieldValues {
  return { shopName: m.shopName, description: m.description, category: m.category, phone: m.phone, email: m.email, province: m.province, district: m.district, address: m.address ?? '' };
}

/** Raw Source ของการเชื่อมต่อที่ซิงก์แล้ว (ร้านเดิม) — Snapshot เดียวกับที่ใช้ประเมิน */
export function sourceOfConnection(c: MarketplaceConnection, m: Merchant): ImportSource {
  return buildImportSource({
    key: c.id,
    platform: c.platform,
    archetype: c.archetype,
    seed: c.seed,
    mockShopId: c.mockShopId,
    shopName: c.sourceShopName ?? m.shopName,
    category: c.sourceCategory ?? m.category,
    lastSyncAt: c.lastSyncAt,
  });
}

export const importRecordsOf = (merchantId: string) =>
  imp()
    .items.filter((r) => r.merchantId === merchantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

/**
 * สมัครร้านใหม่ด้วยข้อมูลที่นำเข้า — ผู้ใช้กดส่งเองเท่านั้น (ไม่ Auto-Submit)
 * - คำขอลงทะเบียนตาม Workflow v1 เดิม (Level 2 หลังอนุมัติ) · ไม่ออก Badge อัตโนมัติ
 * - การเชื่อมต่อใช้ Seed/หมวดต้นฉบับเดียวกับที่ผู้ใช้เห็นตอน Preview → ประเมินจาก Raw Source
 * - ส่งซ้ำจากฉบับร่างเดิมได้คำขอ/การเชื่อมต่อ/บันทึกเดิม
 */
export function submitMarketplaceRegistration(operatorId: string, form: ShopForm, draft: { draftId: string; source: ImportSource; juristic?: boolean }) {
  const before = imp().items.find((r) => r.draftId === draft.draftId);
  const { merchant, app, duplicate } = submitShopRegistration(operatorId, form, { draftId: draft.draftId });
  if (duplicate && before) return { merchant, app, record: before, connection: conn(before.connectionId ?? ''), duplicate: true };
  const src = draft.source;
  const [connection] = attachImportedMarketplaces(merchant.id, [
    { platform: src.platform, archetype: src.archetype, pinned: { seed: src.seed, mockShopId: src.mockShopId, mockShopName: src.shopName, sourceCategory: src.category } },
  ]);
  const submitted: FieldValues = { shopName: form.shopName, description: form.description, category: form.category, phone: form.phone, email: form.email, province: form.province, district: form.district, address: form.address ?? '' };
  const rows = fieldRows(submitted, newRegistrationRules(src, !!draft.juristic));
  const summary = summarize(rows);
  const record: MarketplaceImportRecord = {
    id: nextRef('IMP', imp().items.map((r) => r.id), 3),
    mode: 'new_registration',
    operatorId,
    merchantId: merchant.id,
    connectionId: connection?.id,
    applicationId: app.id,
    draftId: draft.draftId,
    source: src,
    submitted,
    rows,
    summary,
    applied: FIELD_KEYS.filter((k) => submitted[k]),
    pending: rows.filter((r) => r.status === 'verification_required').map((r) => r.key),
    createdAt: nowISO(),
  };
  imp().add(record);
  useVerificationStore.getState().update(app.id, (x) => ({
    importId: record.id,
    timeline: [
      ...x.timeline,
      {
        id: `tl-${Date.now()}-imp`,
        at: nowISO(),
        actor: 'merchant',
        actorName: operatorName(operatorId),
        title: `เติมแบบฟอร์มจาก ${PLATFORMS[src.platform].label}`,
        note: `นำเข้า ${summary.imported} · ผู้สมัครแก้ไข ${summary.edited} · กรอกเอง ${summary.manual}${summary.verification ? ` · รอตรวจสอบ ${summary.verification}` : ''} (${record.id})`,
      },
    ],
  }));
  audit('ลงทะเบียนร้านด้วยข้อมูลที่นำเข้าจาก Marketplace (จำลอง)', record.id, `${PLATFORMS[src.platform].label} · ${merchant.id}`);
  return { merchant, app: useVerificationStore.getState().items.find((a) => a.id === app.id)!, record, connection, duplicate: false };
}

/**
 * ร้านเดิมยืนยันอัปเดตโปรไฟล์จากข้อมูลที่นำเข้า (Scenario 9)
 * - ไม่สร้างร้านหรือคำขอลงทะเบียนใหม่ และไม่แตะใบรับรองเดิม
 * - คำอธิบาย/ช่องทางติดต่อ/ที่อยู่ บันทึกลงโปรไฟล์ทันที · ชื่อร้านและหมวดที่ผูกกับใบรับรองถ้าเปลี่ยน → รอเจ้าหน้าที่ตรวจ (ยังไม่เปลี่ยน)
 * - ไม่เปลี่ยนข้อมูลต้นฉบับจาก Marketplace (คะแนน รีวิว ยอดขาย) และไม่เปลี่ยนผลประเมิน
 */
export function confirmProfileUpdate(connectionId: string, values: FieldValues, draftId: string): WorkflowResult & { record?: MarketplaceImportRecord; duplicate?: boolean } {
  const done = imp().items.find((r) => r.draftId === draftId);
  if (done) return { ok: true, record: done, duplicate: true };
  const c = conn(connectionId);
  const m = c && merchantOf(c.merchantId);
  if (!c || !m) return { ok: false, error: 'ไม่พบการเชื่อมต่อหรือร้านค้า' };
  if (c.status !== 'connected') return { ok: false, error: 'การเชื่อมต่อยังไม่พร้อม (ต้องซิงก์สำเร็จก่อน)' };
  const registered = registeredValues(m);
  const src = sourceOfConnection(c, m);
  const rows = fieldRows(values, profileUpdateRules(src, registered));
  const missing = rows.filter((r) => r.status === 'missing');
  if (missing.length) return { ok: false, error: `กรุณากรอก: ${missing.map((r) => r.label).join(', ')}` };
  const pending = rows.filter((r) => r.status === 'verification_required').map((r) => r.key);
  const applied = FIELD_KEYS.filter((k) => !pending.includes(k) && values[k].trim() !== registered[k].trim());
  if (applied.length) useMerchantStore.getState().update(m.id, Object.fromEntries(applied.map((k) => [k, values[k].trim()])) as Partial<Merchant>);
  const record: MarketplaceImportRecord = {
    id: nextRef('IMP', imp().items.map((r) => r.id), 3),
    mode: 'profile_update',
    operatorId: m.operatorId,
    merchantId: m.id,
    connectionId: c.id,
    draftId,
    source: src,
    registered,
    submitted: { ...values },
    rows,
    summary: summarize(rows),
    applied,
    pending,
    createdAt: nowISO(),
  };
  imp().add(record);
  const autoVerified = rows.filter((r) => r.status === 'source_verified').map((r) => r.label);
  if (autoVerified.length) audit('ตรวจสอบข้อมูลร้านอัตโนมัติ: ตรงกับข้อมูลต้นฉบับ Marketplace', record.id, `${m.id} · ${autoVerified.join(', ')} — บันทึกโดยไม่ต้องรอเจ้าหน้าที่`, true);
  audit('อัปเดตโปรไฟล์ร้านจากข้อมูลที่นำเข้า (จำลอง)', record.id, `${m.id} · บันทึก ${applied.length} ช่อง${pending.length ? ` · รอตรวจสอบ ${pending.length} ช่อง` : ''}`);
  if (pending.length) {
    const changes: ProfileChange[] = (pending as ProfileChangeField[]).map((f) => ({ field: f, from: registered[f], to: values[f].trim(), source: src[f] }));
    const req = fileChangeRequest(m, changes, { connectionId: c.id, importId: record.id, source: { platform: src.platform, mockShopId: src.mockShopId } });
    imp().update(record.id, { changeRequestId: req.id });
    record.changeRequestId = req.id;
  }
  processMerchant(m.id, 'profile_update');
  return { ok: true, record };
}

// ================================================================ คำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง (KI-V2-15)
// Merchant Edit → Change Request → Officer Review → Approve / Reject / Request Info → แจ้งร้าน → อัปเดตโปรไฟล์ → Audit Log
// ข้อมูลเดิมไม่เปลี่ยนจนกว่าอนุมัติ · ไม่อนุมัติอัตโนมัติ · ไม่แตะใบรับรอง (ระดับ/สถานะ) · ข้อมูลต้นฉบับ Marketplace คงเดิม

const pcs = () => useProfileChangeStore.getState();
const byNewest = (a: ProfileChangeRequest, b: ProfileChangeRequest) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export const changeRequestsOf = (merchantId: string) => pcs().items.filter((r) => r.merchantId === merchantId).sort(byNewest);
export const openChangeRequest = (merchantId: string) => pcs().items.find((r) => r.merchantId === merchantId && isOpenChange(r));
export const changeRequestDraftKey = (id: string) => `pcr:${id}`;

const describeChanges = (changes: ProfileChange[]) => changes.map((x) => `${PROFILE_CHANGE_FIELD_LABEL[x.field]}: "${x.from}" → "${x.to}"`).join(' · ');

function changeEvent(req: Pick<ProfileChangeRequest, 'operatorId'>, action: ProfileChangeAction, note?: string, changes?: ProfileChange[]) {
  const merchantSide = action === 'submitted' || action === 'updated' || action === 'resubmitted';
  const a = currentActor();
  const actorName = merchantSide ? useOperatorStore.getState().items.find((o) => o.id === req.operatorId)?.name ?? 'ผู้ประกอบการ' : a.role === 'officer' || a.role === 'admin' ? a.name : 'เจ้าหน้าที่';
  return { at: nowISO(), actorRole: merchantSide ? ('merchant' as const) : ('officer' as const), actorName, action, ...(note ? { note } : {}), ...(changes ? { changes } : {}) };
}

/** ยื่นคำขอ (หรือปรับคำขอที่ยังเปิดอยู่ของร้านเดียวกัน — ไม่สร้างรายการซ้ำ) */
function fileChangeRequest(m: Merchant, changes: ProfileChange[], extra: Pick<ProfileChangeRequest, 'connectionId' | 'importId' | 'source'>): ProfileChangeRequest {
  const open = openChangeRequest(m.id);
  const now = nowISO();
  if (open) {
    pcs().update(open.id, { ...extra, changes, status: 'pending', revision: open.revision + 1, updatedAt: now, history: [...open.history, changeEvent(open, 'updated', undefined, changes)] });
    audit('ร้านปรับคำขอเปลี่ยนข้อมูลร้าน', open.id, `${m.id} · ${describeChanges(changes)}`);
    notify('officer', 'OF-001', 'ร้านค้าปรับคำขอเปลี่ยนข้อมูลร้าน', `${m.shopName} (${m.id}) · ${open.id}`, `/o/profile-changes/${open.id}`, 'warning');
    return pcs().items.find((r) => r.id === open.id)!;
  }
  const req: ProfileChangeRequest = {
    id: nextRef('PCR', pcs().items.map((r) => r.id), 3),
    merchantId: m.id,
    operatorId: m.operatorId,
    ...extra,
    status: 'pending',
    changes,
    revision: 1,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  req.history = [changeEvent(req, 'submitted', undefined, changes)];
  pcs().add(req);
  audit('ร้านยื่นคำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง', req.id, `${m.id} · ${describeChanges(changes)}`);
  notify('officer', 'OF-001', 'ร้านค้าขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง', `${m.shopName} (${m.id}): ${changes.map((x) => PROFILE_CHANGE_FIELD_LABEL[x.field]).join(', ')} — ${req.id}`, `/o/profile-changes/${req.id}`, 'warning');
  return req;
}

/** บันทึกชื่อร้าน/หมวดต้นฉบับลงการเชื่อมต่อของร้าน ก่อนเปลี่ยนโปรไฟล์ — ข้อมูลต้นฉบับและ Snapshot ไม่เปลี่ยนตามโปรไฟล์ใหม่ */
function pinMarketplaceSource(m: Merchant) {
  mk()
    .items.filter((c) => c.merchantId === m.id)
    .forEach((c) => {
      const patch: Partial<MarketplaceConnection> = {};
      if (c.sourceShopName === undefined) patch.sourceShopName = m.shopName;
      if (c.sourceCategory === undefined) patch.sourceCategory = m.category;
      if (Object.keys(patch).length) mk().update(c.id, patch);
    });
}

const pendingReq = (id: string): { req?: ProfileChangeRequest; error?: string } => {
  const req = pcs().items.find((r) => r.id === id);
  if (!req) return { error: 'ไม่พบคำขอเปลี่ยนข้อมูล' };
  if (req.status !== 'pending') return { req, error: 'คำขอนี้ไม่ได้อยู่ในสถานะรอพิจารณา' };
  return { req };
};

/** เจ้าหน้าที่อนุมัติ — เปลี่ยนเฉพาะช่องในคำขอ ไม่เปลี่ยนระดับ/สถานะใบรับรอง */
export function approveProfileChange(id: string, note?: string): WorkflowResult {
  const { req, error } = pendingReq(id);
  if (error || !req) return { ok: false, error: error ?? 'ไม่พบคำขอเปลี่ยนข้อมูล' };
  const m = merchantOf(req.merchantId);
  if (!m) return { ok: false, error: 'ไม่พบร้านค้า' };
  pinMarketplaceSource(m);
  useMerchantStore.getState().update(m.id, Object.fromEntries(req.changes.map((x) => [x.field, x.to])) as Partial<Merchant>);
  const now = nowISO();
  const n = note?.trim() || undefined;
  const ev = changeEvent(req, 'approved', n);
  pcs().update(id, { status: 'approved', officerNote: n, decidedAt: now, decidedBy: ev.actorName, updatedAt: now, history: [...req.history, ev] });
  audit('อนุมัติการเปลี่ยนข้อมูลร้าน', id, `${m.id} · ${describeChanges(req.changes)} · ใบรับรองไม่เปลี่ยน`);
  notifyMerchant(m.id, 'อนุมัติการเปลี่ยนข้อมูลร้านแล้ว', `${describeChanges(req.changes)} — ระดับใบรับรองไม่เปลี่ยน`, `/m/profile-changes/${id}`, 'success');
  processMerchant(m.id, 'profile_update');
  return { ok: true };
}

/** เจ้าหน้าที่ไม่อนุมัติ (ต้องมีเหตุผล) — ข้อมูลเดิมไม่เปลี่ยน */
export function rejectProfileChange(id: string, reason: string): WorkflowResult {
  if (!reason.trim()) return { ok: false, error: 'กรุณาระบุเหตุผลการไม่อนุมัติ' };
  const { req, error } = pendingReq(id);
  if (error || !req) return { ok: false, error: error ?? 'ไม่พบคำขอเปลี่ยนข้อมูล' };
  const now = nowISO();
  const ev = changeEvent(req, 'rejected', reason.trim());
  pcs().update(id, { status: 'rejected', officerNote: reason.trim(), decidedAt: now, decidedBy: ev.actorName, updatedAt: now, history: [...req.history, ev] });
  audit('ไม่อนุมัติการเปลี่ยนข้อมูลร้าน', id, `${req.merchantId} · ${reason.trim()}`);
  notifyMerchant(req.merchantId, 'ไม่อนุมัติการเปลี่ยนข้อมูลร้าน', `${reason.trim()} — ข้อมูลร้านยังเป็นข้อมูลเดิม`, `/m/profile-changes/${id}`, 'error');
  return { ok: true };
}

/** เจ้าหน้าที่ขอข้อมูลเพิ่ม (ต้องระบุสิ่งที่ต้องการ) — ร้านแก้ไขและส่งใหม่ได้ */
export function requestProfileChangeInfo(id: string, message: string): WorkflowResult {
  if (!message.trim()) return { ok: false, error: 'กรุณาระบุข้อมูลที่ต้องการเพิ่มเติม' };
  const { req, error } = pendingReq(id);
  if (error || !req) return { ok: false, error: error ?? 'ไม่พบคำขอเปลี่ยนข้อมูล' };
  pcs().update(id, { status: 'info_requested', officerNote: message.trim(), updatedAt: nowISO(), history: [...req.history, changeEvent(req, 'info_requested', message.trim())] });
  audit('ขอข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', id, `${req.merchantId} · ${message.trim()}`);
  notifyMerchant(req.merchantId, 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม (คำขอเปลี่ยนข้อมูลร้าน)', message.trim(), `/m/profile-changes/${id}`, 'warning');
  return { ok: true };
}

/**
 * ร้านแก้ไขและส่งใหม่หลังเจ้าหน้าที่ขอข้อมูลเพิ่ม — `revision` คือฉบับที่ร้านเห็นตอนแก้
 * ส่งซ้ำ/Refresh หลังส่งแล้ว (ฉบับเปลี่ยนแล้ว) คืนผลเดิมโดยไม่บันทึกซ้ำ
 */
export function resubmitProfileChange(id: string, values: Partial<Record<ProfileChangeField, string>>, note: string, revision: number): WorkflowResult & { duplicate?: boolean } {
  const req = pcs().items.find((r) => r.id === id);
  if (!req) return { ok: false, error: 'ไม่พบคำขอเปลี่ยนข้อมูล' };
  if (req.revision !== revision) return { ok: true, duplicate: true };
  if (req.status !== 'info_requested') return { ok: false, error: 'คำขอนี้ไม่ได้รอข้อมูลเพิ่มเติม' };
  const changes = req.changes.map((x) => ({ ...x, to: (values[x.field] ?? x.to).trim() }));
  if (changes.some((x) => !x.to)) return { ok: false, error: 'กรุณากรอกข้อมูลใหม่ให้ครบ' };
  if (changes.every((x) => x.to === x.from)) return { ok: false, error: 'ข้อมูลใหม่เหมือนข้อมูลเดิม — ไม่มีสิ่งที่ต้องเปลี่ยน' };
  if (!note.trim()) return { ok: false, error: 'กรุณาอธิบายข้อมูลเพิ่มเติมที่เจ้าหน้าที่ขอ' };
  pcs().update(id, { changes, merchantNote: note.trim(), status: 'pending', revision: req.revision + 1, updatedAt: nowISO(), history: [...req.history, changeEvent(req, 'resubmitted', note.trim(), changes)] });
  useSessionStore.getState().saveDraft(changeRequestDraftKey(id), undefined);
  audit('ร้านส่งข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', id, `${req.merchantId} · ${describeChanges(changes)}`);
  notify('officer', 'OF-001', 'ร้านค้าส่งข้อมูลเพิ่มเติม (คำขอเปลี่ยนข้อมูลร้าน)', `${merchantOf(req.merchantId)?.shopName} (${req.merchantId}) · ${id}`, `/o/profile-changes/${id}`, 'warning');
  return { ok: true };
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

/**
 * ประเมินใหม่ — ถ้าผลล่าสุดยังเป็นร่างจะแทนที่ร่างนั้น (ไม่สร้างร่างซ้ำ)
 * origin: automation = ระบบประเมินเองเมื่อข้อมูลเปลี่ยน · merchant = ร้านกดประเมินเอง (แล้วระบบจัดเส้นทางและอัปเดต Badge ต่อ)
 */
export function runAssessment(merchantId: string, origin: 'merchant' | 'automation' = 'merchant'): TrustAssessment | undefined {
  const cur = currentInputs(merchantId);
  if (!cur) return undefined;
  const result = assessTrust(cur.input, currentModel());
  const store = useAssessmentStore.getState();
  const last = latestAssessment(merchantId);
  const system = origin === 'automation';
  let out: TrustAssessment | undefined;
  if (last && last.status === 'draft') {
    store.update(last.id, { result, inputsKey: cur.key, createdAt: nowISO(), origin });
    audit(system ? 'ระบบประเมินความน่าเชื่อถือใหม่อัตโนมัติ' : 'ประเมินความน่าเชื่อถือใหม่', last.id, result.band, system);
    out = useAssessmentStore.getState().items.find((a) => a.id === last.id);
  } else {
    out = { id: nextRef('TAS', store.items.map((x) => x.id)), merchantId, createdAt: nowISO(), status: 'draft', inputsKey: cur.key, result, origin };
    store.add(out);
    audit(system ? 'ระบบประเมินความน่าเชื่อถืออัตโนมัติ' : 'ประเมินความน่าเชื่อถือ', out.id, result.band, system);
  }
  if (!system) processMerchant(merchantId, 'merchant_assessment', { reassess: false });
  return out;
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
  processMerchant(a.merchantId, 'officer_decision', { reassess: false });
  return { ok: true };
}
