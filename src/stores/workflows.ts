/**
 * Workflow ข้าม Domain — ทุก Action ที่เปลี่ยนสถานะหลายส่วนพร้อมกันอยู่ที่นี่
 * เพื่อให้ Merchant / Consumer / Officer / Admin เห็นข้อมูลชุดเดียวกันเสมอ
 */
import { emitMerchantChanged } from './events';
import type {
  AppNotification,
  CertStatus,
  ChannelStatus,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  Merchant,
  MockDocument,
  OfferStatus,
  Operator,
  Priority,
  ResolutionOffer,
  RiskCase,
  RiskCaseStatus,
  Role,
  SalesChannel,
  TimelineEvent,
  TrustLevel,
  VerificationApplication,
  WarningKind,
  WarningRecord,
} from '@/types';
import { consumers, courses, officers } from '@/mock/data';
import { standardChecks } from '@/mock/data/applications';
import { nextRef, nowISO, uid, mockIdentityId } from '@/utils/id';
import { screenComplaint } from '@/utils/screening';
import { currentCert } from '@/utils/trust';
import { COMPLAINT_CATEGORY, TRUST_LEVELS } from '@/constants/labels';
import type { AiHistoryEntry } from '@/features/ai-assistant/types/ai.types';
import { useAiWorkspaceStore } from './aiWorkspace';
import { useDemoStore } from './demo';
import { useAssessmentConfigStore } from './assessmentConfig';
import {
  domainStores,
  useAiHistoryStore,
  useAuditStore,
  useCertificationStore,
  useComplaintStore,
  useMerchantStore,
  useNotificationStore,
  useOperatorStore,
  useRiskStore,
  useSessionStore,
  useTrainingStore,
  useVerificationStore,
  useWarningStore,
} from './index';

// ---------- helpers ----------
const ms = () => useMerchantStore.getState();
const merchantOf = (id: string) => ms().items.find((m) => m.id === id);
const operatorOf = (id: string) => useOperatorStore.getState().items.find((o) => o.id === id);

export function currentActor(): { role: Role; name: string } {
  const s = useSessionStore.getState();
  if (s.role === 'officer' || s.role === 'admin') return { role: s.role, name: officers.find((o) => o.id === s.officerId)?.name ?? 'เจ้าหน้าที่' };
  if (s.role === 'merchant') return { role: 'merchant', name: operatorOf(s.operatorId)?.name ?? 'ผู้ประกอบการ' };
  return { role: 'consumer', name: consumers.find((c) => c.id === s.consumerId)?.name ?? 'ผู้บริโภค' };
}

function ev(title: string, note?: string, actor?: TimelineEvent['actor']): TimelineEvent {
  const a = currentActor();
  return { id: uid('tl'), at: nowISO(), actor: actor ?? a.role, actorName: actor === 'system' ? 'ระบบ' : a.name, title, note };
}

export function notify(recipientRole: Role, recipientId: string | undefined, title: string, body: string, link?: string, tone: AppNotification['tone'] = 'info') {
  useNotificationStore.getState().add({ id: uid('NTF'), recipientRole, recipientId, title, body, link, tone, read: false, createdAt: nowISO() });
}

export function audit(action: string, target: string, detail?: string, system = false) {
  const a = currentActor();
  useAuditStore.getState().add({
    id: uid('AUD'),
    at: nowISO(),
    actorRole: system ? 'system' : a.role,
    actorName: system ? 'ระบบ' : a.name,
    action,
    target,
    detail,
  });
}

export const notifyMerchant = (merchantId: string, title: string, body: string, link?: string, tone?: AppNotification['tone']) => {
  const m = merchantOf(merchantId);
  if (m) notify('merchant', m.operatorId, title, body, link, tone);
};

// ---------- Demo reset ----------
export function resetAllDemoData() {
  domainStores.forEach((s) => s.getState().reset());
  useSessionStore.getState().reset();
  useAiWorkspaceStore.getState().reset();
  useDemoStore.getState().reset();
  useAssessmentConfigStore.getState().reset();
}

// ---------- AI Simulation history ----------
const AI_HISTORY_LIMIT = 20;

/** บันทึกประวัติการวิเคราะห์ (เก็บล่าสุด 20 รายการ) — ไม่บันทึกข้อความที่ผู้ใช้พิมพ์เอง */
export function recordAiAnalysis(entry: Omit<AiHistoryEntry, 'id' | 'createdAt'>) {
  const store = useAiHistoryStore.getState();
  store.add({ ...entry, id: uid('AIH'), createdAt: nowISO() });
  const items = useAiHistoryStore.getState().items;
  if (items.length > AI_HISTORY_LIMIT) useAiHistoryStore.setState({ items: items.slice(0, AI_HISTORY_LIMIT) });
}

export function clearAiHistory() {
  useAiHistoryStore.setState({ items: [] });
}

// ---------- Onboarding ----------
export function registerOperator(input: { name: string; phone: string; email: string; province: string; pin: string }): Operator {
  const op: Operator = {
    id: nextRef('OP', useOperatorStore.getState().items.map((o) => o.id), 3).replace(/-\d{4}-/, '-'),
    mockIdentityId: mockIdentityId(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    province: input.province,
    kycStatus: 'none',
    demoPin: input.pin,
    createdAt: nowISO(),
  };
  useOperatorStore.getState().add(op);
  audit('ลงทะเบียนผู้ใช้ใหม่', op.id, op.name, true);
  notify('merchant', op.id, 'ยินดีต้อนรับสู่ SME Trust', 'เริ่มต้นลงทะเบียนร้านค้าเพื่อรับสถานะตรวจสอบได้ทุกเมื่อ', '/m/register-shop', 'success');
  return op;
}

export function setKycResult(operatorId: string, ok: boolean) {
  useOperatorStore.getState().update(operatorId, { kycStatus: ok ? 'verified' : 'failed', kycVerifiedAt: ok ? nowISO() : undefined });
  audit(ok ? 'ยืนยันตัวตนจำลองสำเร็จ' : 'ยืนยันตัวตนจำลองไม่สำเร็จ', operatorId, undefined, true);
  if (ok) notify('merchant', operatorId, 'ยืนยันตัวตนสำเร็จ', 'คุณได้รับสถานะ Level 1 — Identity Verified (ไม่ใช่การรับรองคุณภาพสินค้า)', '/m', 'success');
  ms().items.filter((m) => m.operatorId === operatorId).forEach((m) => emitMerchantChanged(m.id, 'identity_change'));
}

export function resetPin(operatorId: string, pin: string) {
  useOperatorStore.getState().update(operatorId, { demoPin: pin });
  audit('ตั้ง PIN ใหม่ (จำลอง)', operatorId, undefined, true);
}

// ---------- Shop registration ----------
export interface ShopForm {
  businessType: Merchant['businessType'];
  ownerName: string;
  juristic?: Merchant['juristic'];
  shopName: string;
  category: string;
  province: string;
  district: string;
  address?: string;
  phone: string;
  email: string;
  description: string;
  channels: { type: SalesChannel['type']; handle: string }[];
  documents: MockDocument[];
}

export function submitShopRegistration(operatorId: string, f: ShopForm, opts: { draftId?: string } = {}): { merchant: Merchant; app: VerificationApplication; duplicate?: boolean } {
  // ส่งซ้ำจากฉบับร่างเดิม (กดซ้ำ / Refresh / Back) → คืนคำขอเดิม ไม่สร้างร้านหรือคำขอซ้ำ
  if (opts.draftId) {
    const prev = useVerificationStore.getState().items.find((a) => a.sourceDraftId === opts.draftId);
    const prevMerchant = prev && ms().items.find((m) => m.id === prev.merchantId);
    if (prev && prevMerchant) return { merchant: prevMerchant, app: prev, duplicate: true };
  }
  const merchants = ms().items;
  const id = `M-${String(Math.max(...merchants.map((m) => Number(m.id.slice(2)))) + 1).padStart(3, '0')}`;
  const priorFlagged = merchants.filter((m) => m.operatorId === operatorId && ['suspended', 'revoked'].includes(m.riskStatus));
  const flag = priorFlagged.length
    ? `Mock Identity ID เดียวกับเจ้าของร้าน "${priorFlagged[0].shopName}" (${priorFlagged[0].id}) ซึ่งมีสถานะ${priorFlagged[0].riskStatus === 'revoked' ? 'เพิกถอน' : 'ระงับ'}การรับรอง`
    : undefined;

  const merchant: Merchant = {
    id,
    operatorId,
    shopName: f.shopName,
    businessType: f.businessType,
    ownerName: f.ownerName,
    juristic: f.juristic,
    category: f.category,
    province: f.province,
    district: f.district,
    address: f.address,
    phone: f.phone,
    email: f.email,
    description: f.description,
    channels: f.channels.map((c) => ({ id: uid('CH'), type: c.type, handle: c.handle, status: 'pending' as ChannelStatus })),
    documents: f.documents,
    registrationStatus: 'submitted',
    riskStatus: flag ? 'allegation' : 'none',
    createdAt: nowISO(),
    identityFlag: flag,
  };
  ms().add(merchant);

  const op = operatorOf(operatorId);
  const app: VerificationApplication = {
    id: nextRef('APP', useVerificationStore.getState().items.map((a) => a.id)),
    merchantId: id,
    type: 'registration',
    requestedLevel: 2,
    status: 'submitted',
    submittedAt: nowISO(),
    updatedAt: nowISO(),
    checks: standardChecks(op?.kycStatus === 'verified' ? 'partial' : false),
    ...(opts.draftId ? { sourceDraftId: opts.draftId } : {}),
    timeline: [
      ev('ส่งคำขอลงทะเบียนร้านค้า', `${f.businessType === 'juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา'} · เอกสาร ${f.documents.length} รายการ`, 'merchant'),
      ev(
        flag ? 'ระบบพบ Mock Identity ID ตรงกับร้านค้าที่ถูกระงับ/เพิกถอน' : 'ระบบตรวจสอบความครบถ้วนเบื้องต้นแล้ว',
        flag ? 'ส่งให้เจ้าหน้าที่พิจารณาเป็นพิเศษ — ไม่ใช่การปฏิเสธอัตโนมัติ' : f.documents.length ? 'เข้าคิวรอเจ้าหน้าที่' : 'ยังไม่มีเอกสารประกอบ เจ้าหน้าที่อาจขอเพิ่มเติม',
        'system',
      ),
    ],
  };
  useVerificationStore.getState().add(app);

  if (flag) {
    useRiskStore.getState().add({
      id: nextRef('RSK', useRiskStore.getState().items.map((r) => r.id)),
      merchantId: id,
      status: 'allegation',
      reason: `ผู้ประกอบการยื่นลงทะเบียนร้านใหม่ ขณะที่ร้านเดิม (${priorFlagged[0].id}) มีสถานะ${priorFlagged[0].riskStatus === 'revoked' ? 'เพิกถอน' : 'ระงับ'}การรับรอง`,
      evidenceSummary: [`Mock Identity ID: ${op?.mockIdentityId}`, `ร้านเดิม: ${priorFlagged[0].shopName}`],
      relatedComplaintIds: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      timeline: [ev('ระบบตรวจพบตัวตนซ้ำกับร้านที่ถูกระงับ/เพิกถอน', 'ข้อสังเกตเพื่อพิจารณา ไม่ใช่ข้อสรุปว่ากระทำผิด', 'system')],
    });
  }
  audit('ส่งคำขอลงทะเบียนร้านค้า', app.id, `${merchant.shopName} (${merchant.id})`);
  notify('officer', undefined, 'คำขอลงทะเบียนใหม่', `${app.id} ${merchant.shopName}${flag ? ' — พบตัวตนซ้ำ' : ''}`, `/o/applications/${app.id}`, flag ? 'error' : 'info');
  notify('merchant', operatorId, 'ส่งคำขอลงทะเบียนแล้ว', `${app.id} อยู่ระหว่างรอตรวจสอบ`, '/m/shop', 'success');
  useSessionStore.getState().set({ activeMerchantId: id });
  return { merchant, app };
}

export function resubmitApplication(appId: string, note: string, docs: MockDocument[]) {
  const app = useVerificationStore.getState().items.find((a) => a.id === appId);
  if (!app) return;
  useVerificationStore.getState().update(appId, (a) => ({
    status: 'submitted',
    updatedAt: nowISO(),
    infoRequest: undefined,
    rejectReason: undefined,
    timeline: [...a.timeline, ev(a.status === 'rejected' ? 'ยื่นคำขอใหม่' : 'ส่งข้อมูลเพิ่มเติม', note || `แนบเอกสาร ${docs.length} รายการ`, 'merchant')],
  }));
  ms().update(app.merchantId, (m) => ({ documents: [...m.documents, ...docs], registrationStatus: app.type === 'registration' ? 'submitted' : m.registrationStatus }));
  audit('ส่งข้อมูลเพิ่มเติม/ยื่นใหม่', appId);
  notify('officer', undefined, 'ร้านค้าส่งข้อมูลเพิ่มเติม', `${appId} พร้อมตรวจสอบอีกครั้ง`, `/o/applications/${appId}`);
}

export function addChannel(merchantId: string, type: SalesChannel['type'], handle: string) {
  ms().update(merchantId, (m) => ({ channels: [...m.channels, { id: uid('CH'), type, handle, status: 'pending' }] }));
  audit('เพิ่มช่องทางขาย', merchantId, handle);
  notify('officer', undefined, 'ช่องทางขายรอตรวจสอบ', `${merchantOf(merchantId)?.shopName}: ${handle}`, '/o/verification');
}

export function setChannelStatus(merchantId: string, channelId: string, status: ChannelStatus, note?: string) {
  ms().update(merchantId, (m) => ({
    channels: m.channels.map((c) => (c.id === channelId ? { ...c, status, note, verifiedAt: status === 'verified' ? nowISO() : c.verifiedAt } : c)),
  }));
  const ch = merchantOf(merchantId)?.channels.find((c) => c.id === channelId);
  audit(status === 'verified' ? 'ยืนยันช่องทางขาย' : 'ไม่ผ่านการตรวจช่องทางขาย', merchantId, ch?.handle);
  notifyMerchant(merchantId, status === 'verified' ? 'ช่องทางขายผ่านการตรวจสอบ' : 'ช่องทางขายไม่ผ่านการตรวจสอบ', `${ch?.handle}${note ? ` — ${note}` : ''}`, '/m/passport', status === 'verified' ? 'success' : 'warning');
}

// ---------- Officer: applications ----------
function setApp(appId: string, patch: Partial<VerificationApplication>, title: string, note?: string) {
  useVerificationStore.getState().update(appId, (a) => ({
    ...patch,
    updatedAt: nowISO(),
    assignedOfficerId: a.assignedOfficerId ?? useSessionStore.getState().officerId,
    timeline: [...a.timeline, ev(title, note)],
  }));
}

export function startReview(appId: string) {
  const app = useVerificationStore.getState().items.find((a) => a.id === appId)!;
  setApp(appId, { status: 'under_verification' }, 'เริ่มตรวจสอบข้อมูล');
  if (app.type === 'registration') ms().update(app.merchantId, { registrationStatus: 'under_verification' });
  audit('เริ่มตรวจสอบคำขอ', appId);
  notifyMerchant(app.merchantId, 'เจ้าหน้าที่เริ่มตรวจสอบคำขอ', appId, '/m/shop');
}

export function setCheck(appId: string, checkId: string, result: 'pass' | 'fail' | 'pending') {
  useVerificationStore.getState().update(appId, (a) => ({ checks: a.checks.map((c) => (c.id === checkId ? { ...c, result } : c)) }));
}

export function requestInfo(appId: string, message: string) {
  const app = useVerificationStore.getState().items.find((a) => a.id === appId)!;
  setApp(appId, { status: 'need_info', infoRequest: message }, 'ขอข้อมูล/เอกสารเพิ่มเติม', message);
  if (app.type === 'registration') ms().update(app.merchantId, { registrationStatus: 'need_info' });
  audit('ขอเอกสารเพิ่มเติม', appId, message);
  notifyMerchant(app.merchantId, 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม', message, '/m/shop', 'warning');
}

export type WorkflowResult = { ok: true } | { ok: false; error: string };

/** เงื่อนไขก่อนอนุมัติ — ป้องกันการออกใบรับรองที่ขัดกับระดับการตรวจสอบ */
export function approvalBlocker(appId: string): string | undefined {
  const app = useVerificationStore.getState().items.find((a) => a.id === appId);
  if (!app) return 'ไม่พบคำขอ';
  if (['approved', 'rejected'].includes(app.status)) return 'คำขอนี้พิจารณาเสร็จแล้ว';
  if (app.checks.some((c) => c.result === 'fail')) return 'มีรายการตรวจที่ไม่ผ่าน';
  const m = merchantOf(app.merchantId);
  if (operatorOf(m?.operatorId ?? '')?.kycStatus !== 'verified') return 'ผู้ประกอบการยังไม่ผ่านการยืนยันตัวตน (Level 1) จึงยังออกใบรับรองไม่ได้';
  const cert = currentCert(useCertificationStore.getState().items, app.merchantId);
  if (cert && (cert.status === 'suspended' || cert.status === 'revoked')) return 'ใบรับรองปัจจุบันถูกระงับ/เพิกถอน ต้องพิจารณาผ่าน Risk Review ก่อน';
  return undefined;
}

export function approveApplication(appId: string, note?: string): WorkflowResult {
  const blocker = approvalBlocker(appId);
  if (blocker) return { ok: false, error: blocker };
  const app = useVerificationStore.getState().items.find((a) => a.id === appId)!;
  setApp(appId, { status: 'approved', checks: app.checks.map((c) => ({ ...c, result: c.result === 'fail' ? 'fail' : 'pass' })) }, 'อนุมัติคำขอ', note);
  if (app.type === 'registration') {
    ms().update(app.merchantId, { registrationStatus: 'approved', approvedAt: nowISO() });
  }
  const cert = issueCertificate(app.merchantId, app.type === 'registration' ? 2 : app.requestedLevel);
  audit('อนุมัติคำขอ', appId, `ออกใบรับรอง ${cert.id}`);
  notifyMerchant(
    app.merchantId,
    app.type === 'registration' ? 'คำขอลงทะเบียนได้รับอนุมัติ' : 'คำขอรับรองได้รับอนุมัติ',
    `ใบรับรอง ${cert.id} ระดับ ${TRUST_LEVELS[cert.level].name}`,
    '/m/certification',
    'success',
  );
  return { ok: true };
}

export function rejectApplication(appId: string, reason: string) {
  const app = useVerificationStore.getState().items.find((a) => a.id === appId)!;
  setApp(appId, { status: 'rejected', rejectReason: reason }, 'ไม่อนุมัติคำขอ', reason);
  if (app.type === 'registration') ms().update(app.merchantId, { registrationStatus: 'rejected' });
  audit('ไม่อนุมัติคำขอ', appId, reason);
  notifyMerchant(app.merchantId, 'คำขอไม่ได้รับอนุมัติ', `${reason} — สามารถแก้ไขและยื่นใหม่ได้`, app.type === 'registration' ? '/m/shop' : '/m/certification', 'error');
}

// ---------- Certification ----------
function issueCertificate(merchantId: string, level: TrustLevel) {
  const store = useCertificationStore.getState();
  const prev = currentCert(store.items, merchantId);
  const now = new Date();
  const exp = new Date(now);
  exp.setFullYear(exp.getFullYear() + 1);
  const id = nextRef('SMT', store.items.map((c) => c.id), 6);
  if (prev && (prev.status === 'active' || prev.status === 'expired')) {
    store.update(prev.id, (c) => ({ status: 'expired', supersededBy: id, statusReason: 'ถูกแทนที่ด้วยใบรับรองใหม่', history: [...c.history, ev('ถูกแทนที่ด้วยใบรับรองใหม่', id, 'system')] }));
  }
  const cert = { id, merchantId, level, status: 'active' as CertStatus, issuedAt: now.toISOString(), expiresAt: exp.toISOString(), history: [ev(`ออกใบรับรอง ${TRUST_LEVELS[level].name}`)] };
  store.add(cert);
  return cert;
}

export function applyCertification(merchantId: string, level: TrustLevel, renewal = false) {
  const app: VerificationApplication = {
    id: nextRef('APP', useVerificationStore.getState().items.map((a) => a.id)),
    merchantId,
    type: 'certification',
    requestedLevel: level,
    status: 'submitted',
    submittedAt: nowISO(),
    updatedAt: nowISO(),
    checks: [
      { id: 'chk-biz-verified', label: 'ผ่านเกณฑ์ธุรกิจ (Level 2)', result: 'pass' },
      { id: 'chk-training', label: 'ผ่านการอบรมตามเกณฑ์', result: 'pending' },
      { id: 'chk-no-warning', label: 'ไม่มีคำเตือนหรือข้อพิจารณาความเสี่ยงค้าง', result: 'pending' },
      { id: 'chk-policy', label: 'มีนโยบายคืน/เปลี่ยนสินค้าที่ชัดเจน', result: 'pending' },
    ],
    timeline: [ev(renewal ? 'ยื่นขอต่ออายุใบรับรอง' : `ยื่นขอรับรอง ${TRUST_LEVELS[level].name}`, undefined, 'merchant')],
  };
  useVerificationStore.getState().add(app);
  audit(renewal ? 'ยื่นต่ออายุใบรับรอง' : 'ยื่นขอรับรอง', app.id, TRUST_LEVELS[level].name);
  notify('officer', undefined, renewal ? 'คำขอต่ออายุใบรับรอง' : 'คำขอรับรองใหม่', `${app.id} ${merchantOf(merchantId)?.shopName}`, `/o/applications/${app.id}`);
  return app;
}

/** เรื่องพิจารณาความเสี่ยงที่ยังเปิดอยู่ของร้าน (ถ้ามี) */
export function openRiskCaseOf(merchantId: string): RiskCase | undefined {
  return useRiskStore.getState().items.find((r) => r.merchantId === merchantId && !['dismissed', 'appeal_reviewed'].includes(r.status));
}

/** การคืนสถานะ/เพิกถอนต้องทำผ่าน Risk Review หากมีเรื่องเปิดอยู่ เพื่อไม่ให้สถานะใบรับรองกับเรื่องพิจารณาขัดกัน */
export function certStatusBlocker(certId: string, status: CertStatus): string | undefined {
  const cert = useCertificationStore.getState().items.find((c) => c.id === certId);
  if (!cert) return 'ไม่พบใบรับรอง';
  const risk = openRiskCaseOf(cert.merchantId);
  if (risk && (status === 'active' || status === 'revoked')) return `ร้านค้ามีเรื่องพิจารณา ${risk.id} เปิดอยู่ — กรุณาดำเนินการผ่าน Risk Review`;
  return undefined;
}

export function setCertStatus(certId: string, status: CertStatus, reason: string): WorkflowResult {
  const blocker = certStatusBlocker(certId, status);
  if (blocker) return { ok: false, error: blocker };
  const cert = useCertificationStore.getState().items.find((c) => c.id === certId)!;
  const labels: Record<CertStatus, string> = { active: 'คืนสถานะใบรับรอง', suspended: 'ระงับใบรับรอง', revoked: 'เพิกถอนใบรับรอง', expired: 'ตั้งสถานะหมดอายุ' };
  useCertificationStore.getState().update(certId, (c) => ({ status, statusReason: status === 'active' ? undefined : reason, history: [...c.history, ev(labels[status], reason)] }));
  if (status === 'suspended' || status === 'revoked') ms().update(cert.merchantId, { riskStatus: status });
  if (status === 'active') recomputeRisk(cert.merchantId);
  audit(labels[status], certId, reason);
  notifyMerchant(cert.merchantId, labels[status], `${certId}: ${reason}`, '/m/certification', status === 'active' ? 'success' : 'error');
  emitMerchantChanged(cert.merchantId, 'measure_change');
  return { ok: true };
}

export function renewCertificate(certId: string) {
  const exp = new Date();
  exp.setFullYear(exp.getFullYear() + 1);
  const cert = useCertificationStore.getState().items.find((c) => c.id === certId)!;
  useCertificationStore.getState().update(certId, (c) => ({ status: 'active', expiresAt: exp.toISOString(), statusReason: undefined, history: [...c.history, ev('ต่ออายุใบรับรอง 1 ปี')] }));
  audit('ต่ออายุใบรับรอง', certId);
  notifyMerchant(cert.merchantId, 'ต่ออายุใบรับรองแล้ว', certId, '/m/certification', 'success');
  emitMerchantChanged(cert.merchantId, 'measure_change');
}

export function expireCertificate(certId: string) {
  const cert = useCertificationStore.getState().items.find((c) => c.id === certId)!;
  useCertificationStore.getState().update(certId, (c) => ({ status: 'expired', expiresAt: nowISO(), history: [...c.history, ev('จำลองใบรับรองหมดอายุ', undefined, 'system')] }));
  audit('จำลองใบรับรองหมดอายุ', certId);
  notifyMerchant(cert.merchantId, 'ใบรับรองหมดอายุ', `${certId} กรุณานำ Badge ออกจากช่องทางขายและยื่นต่ออายุ`, '/m/certification', 'warning');
  emitMerchantChanged(cert.merchantId, 'measure_change');
}

// ---------- Complaints ----------
export interface ComplaintForm {
  merchantId: string;
  consumerId: string;
  category: ComplaintCategory;
  title: string;
  description: string;
  incidentDate: string;
  orderRef: string;
  orderAmount: number;
  channel: Complaint['channel'];
  evidence: MockDocument[];
  escalateNow?: boolean;
}

export function submitComplaint(f: ComplaintForm): Complaint {
  const store = useComplaintStore.getState();
  const screening = screenComplaint({ ...f, evidenceCount: f.evidence.length }, store.items);
  const id = nextRef('CMP', store.items.map((c) => c.id));
  const now = nowISO();
  const direct = f.escalateNow || false;
  const timeline: TimelineEvent[] = [
    ev('ผู้บริโภคยื่นเรื่อง', `${COMPLAINT_CATEGORY[f.category]}`, 'consumer'),
    ev('คัดกรองเบื้องต้นโดย Screening Assistant (จำลอง)', `ความสำคัญ: ${screening.priority} · ความครบถ้วน ${screening.completeness}%`, 'system'),
  ];
  let status: ComplaintStatus = 'awaiting_merchant';
  if (direct) {
    status = 'escalated';
    timeline.push(ev('ส่งต่อเจ้าหน้าที่ทันที', screening.severe ? 'กรณีเสี่ยงต่อสุขภาพ/ความปลอดภัย' : 'ผู้บริโภคเลือกส่งต่อโดยไม่รอร้านค้า', 'consumer'));
  } else {
    timeline.push(ev('แจ้งร้านค้าเพื่อแก้ไขเบื้องต้น', 'Merchant First Resolution — ร้านค้าควรตอบภายใน 3 วัน', 'system'));
  }
  const c: Complaint = {
    id,
    merchantId: f.merchantId,
    consumerId: f.consumerId,
    category: f.category,
    title: f.title,
    description: f.description,
    incidentDate: f.incidentDate,
    orderRef: f.orderRef,
    orderAmount: f.orderAmount,
    channel: f.channel,
    evidence: f.evidence,
    status,
    createdAt: now,
    updatedAt: now,
    messages: [{ id: uid('msg'), from: 'consumer', text: f.description, at: now }],
    offers: [],
    timeline,
    screening,
    escalationReason: direct ? (screening.severe ? 'กรณีเสี่ยงต่อสุขภาพ/ความปลอดภัย' : 'ผู้บริโภคขอส่งต่อทันที') : undefined,
  };
  store.add(c);
  const m = merchantOf(f.merchantId);
  notifyMerchant(f.merchantId, direct ? 'มีข้อร้องเรียนที่ส่งต่อเจ้าหน้าที่' : 'มีข้อร้องเรียนใหม่', `${id}: ${f.title}`, `/m/complaints/${id}`, 'warning');
  notify('consumer', f.consumerId, 'ยื่นเรื่องสำเร็จ', `${id} — ติดตามสถานะได้ที่หน้าเรื่องของฉัน`, `/consumer/cases/${id}`, 'success');
  if (direct || screening.priority === 'urgent') notify('officer', undefined, 'เรื่องเร่งด่วน', `${id} ${m?.shopName}`, `/o/complaints/${id}`, 'error');
  audit('ยื่นข้อร้องเรียน', id, m?.shopName);
  return c;
}

function updComplaint(id: string, patch: Partial<Complaint> | ((c: Complaint) => Partial<Complaint>)) {
  useComplaintStore.getState().update(id, (c) => ({ updatedAt: nowISO(), ...(typeof patch === 'function' ? patch(c) : patch) }));
}

const TERMINAL_OR_ESCALATED: ComplaintStatus[] = ['escalated', 'resolved', 'closed'];

/**
 * สถานะระหว่างการเจรจา คำนวณจากข้อเสนอ — กฎเดียวที่ใช้ทุก Action ฝั่งร้านค้า/ผู้บริโภค
 * - ส่งต่อแล้ว / ปิดแล้ว: คงเดิม (ต้องให้เจ้าหน้าที่ดำเนินการ ไม่ถูกดึงกลับโดยการเจรจา)
 * - มีข้อเสนอที่ยอมรับแล้ว: รอผู้บริโภคยืนยันผล (ไม่หายไปแม้ร้านส่งคำชี้แจงเพิ่ม)
 * - มีข้อเสนอแก้ไขที่รอตอบ: รอผู้บริโภค
 */
export function negotiationStatus(x: Complaint): ComplaintStatus {
  if (TERMINAL_OR_ESCALATED.includes(x.status)) return x.status;
  if (x.offers.some((o) => o.status === 'accepted')) return 'waiting_consumer';
  if (x.offers.some((o) => o.status === 'pending' && o.type !== 'explain')) return 'waiting_consumer';
  if (x.firstMerchantResponseAt) return 'merchant_responded';
  return x.status;
}

export function merchantRespond(caseId: string, offer: { type: ResolutionOffer['type']; amount?: number; note: string; attachment?: MockDocument }) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  if (c.status === 'resolved' || c.status === 'closed') return;
  const isOffer = ['refund', 'replace', 'reship'].includes(offer.type);
  const newOffer: ResolutionOffer = { id: uid('offer'), type: offer.type, amount: offer.amount, note: offer.note, status: 'pending', createdAt: nowISO() };
  const labels: Record<string, string> = { refund: 'ร้านค้าเสนอคืนเงิน', replace: 'ร้านค้าเสนอเปลี่ยนสินค้า', reship: 'ร้านค้าเสนอจัดส่งใหม่', explain: 'ร้านค้าแนบคำชี้แจง', request_info: 'ร้านค้าขอข้อมูลเพิ่มเติม' };
  updComplaint(caseId, (x) => {
    const next = {
      ...x,
      firstMerchantResponseAt: x.firstMerchantResponseAt ?? nowISO(),
      offers: isOffer || offer.type === 'explain' ? [...x.offers, newOffer] : x.offers,
    };
    return {
      status: negotiationStatus(next),
      firstMerchantResponseAt: next.firstMerchantResponseAt,
      offers: next.offers,
      messages: [...x.messages, { id: uid('msg'), from: 'merchant', text: offer.note, at: nowISO(), attachment: offer.attachment }],
      timeline: [...x.timeline, ev(labels[offer.type], offer.amount ? `${offer.note} (${offer.amount.toLocaleString()} บาท)` : offer.note, 'merchant')],
    };
  });
  notify('consumer', c.consumerId, labels[offer.type], `${caseId}: ${offer.note}`, `/consumer/cases/${caseId}`, 'info');
  audit(labels[offer.type], caseId);
}

export function consumerMessage(caseId: string, text: string) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  updComplaint(caseId, (x) => ({
    status: x.status === 'merchant_responded' && !x.offers.some((o) => o.status === 'pending' || o.status === 'accepted') ? 'awaiting_merchant' : x.status,
    messages: [...x.messages, { id: uid('msg'), from: 'consumer', text, at: nowISO() }],
    timeline: [...x.timeline, ev('ผู้บริโภคส่งข้อมูลเพิ่มเติม', text, 'consumer')],
  }));
  notifyMerchant(c.merchantId, 'ผู้บริโภคตอบกลับ', `${caseId}: ${text}`, `/m/complaints/${caseId}`);
}

export function consumerReplyOffer(caseId: string, offerId: string, reply: Exclude<OfferStatus, 'pending'>, note: string) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  const titles = { accepted: 'ผู้บริโภคยอมรับข้อเสนอ', rejected: 'ผู้บริโภคปฏิเสธข้อเสนอ', negotiate: 'ผู้บริโภคขอเจรจาเพิ่มเติม' };
  if (!c.offers.some((o) => o.id === offerId && o.status === 'pending')) return;
  updComplaint(caseId, (x) => {
    const offers = x.offers.map((o) => (o.id === offerId ? { ...o, status: reply, consumerReply: note } : o));
    return {
      status: negotiationStatus({ ...x, offers }),
      offers,
      messages: note ? [...x.messages, { id: uid('msg'), from: 'consumer', text: note, at: nowISO() }] : x.messages,
      timeline: [...x.timeline, ev(titles[reply], note || undefined, 'consumer')],
    };
  });
  notifyMerchant(c.merchantId, titles[reply], `${caseId}${note ? `: ${note}` : ''}`, `/m/complaints/${caseId}`, reply === 'accepted' ? 'success' : 'warning');
  audit(titles[reply], caseId);
}

/** ยืนยันผลได้เมื่อมีข้อเสนอที่ยอมรับแล้วเท่านั้น (รวมกรณีส่งต่อแล้วแต่ร้านค้าแก้ไขสำเร็จภายหลัง) */
export function canConfirmResolved(c: Complaint): boolean {
  return ['waiting_consumer', 'escalated'].includes(c.status) && c.offers.some((o) => o.status === 'accepted');
}

export function consumerConfirmResolved(caseId: string) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  if (!canConfirmResolved(c)) return;
  updComplaint(caseId, (x) => ({
    status: 'resolved',
    resolvedAt: nowISO(),
    timeline: [...x.timeline, ev('ผู้บริโภคยืนยันว่าได้รับการแก้ไขแล้ว', undefined, 'consumer'), ev('ปิดเรื่อง: ร้านค้าแก้ไขสำเร็จ', 'ไม่ต้องส่งต่อเจ้าหน้าที่', 'system')],
  }));
  notifyMerchant(c.merchantId, 'ข้อร้องเรียนแก้ไขสำเร็จ', `${caseId} ผู้บริโภคยืนยันผลแล้ว`, `/m/complaints/${caseId}`, 'success');
  audit('ยืนยันผลการแก้ไข (Resolved)', caseId);
}

export function escalateComplaint(caseId: string, reason: string, by: 'consumer' | 'system' | 'officer' = 'consumer') {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  updComplaint(caseId, (x) => ({
    status: 'escalated',
    escalationReason: reason,
    timeline: [...x.timeline, ev('ส่งต่อเจ้าหน้าที่ (ภายในระบบสาธิต)', reason, by)],
  }));
  notify('officer', undefined, 'เรื่องถูกส่งต่อ', `${caseId}: ${reason}`, `/o/complaints/${caseId}`, 'warning');
  notifyMerchant(c.merchantId, 'ข้อร้องเรียนถูกส่งต่อเจ้าหน้าที่', `${caseId}: ${reason}`, `/m/complaints/${caseId}`, 'warning');
  notify('consumer', c.consumerId, 'เรื่องถูกส่งต่อเจ้าหน้าที่แล้ว', `${caseId} — อยู่ระหว่างพิจารณาในระบบสาธิต`, `/consumer/cases/${caseId}`);
  audit('ส่งต่อเจ้าหน้าที่', caseId, reason);
}

export function officerClassify(caseId: string, category: ComplaintCategory, priority: Priority, note: string) {
  updComplaint(caseId, (x) => ({
    officerCategory: category,
    officerPriority: priority,
    officerNote: note,
    timeline: [...x.timeline, ev('เจ้าหน้าที่ปรับผลการจัดประเภท', `${COMPLAINT_CATEGORY[category]} · ${note}`)],
  }));
  audit('ปรับผลการจัดประเภทข้อร้องเรียน', caseId, `${COMPLAINT_CATEGORY[category]} / ${priority}`);
}

export function officerRemand(caseId: string, note: string) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  updComplaint(caseId, (x) => ({ status: 'awaiting_merchant', timeline: [...x.timeline, ev('เจ้าหน้าที่ส่งกลับให้ร้านค้าแก้ไขเบื้องต้น', note)] }));
  notifyMerchant(c.merchantId, 'เจ้าหน้าที่ขอให้ร้านค้าดำเนินการ', `${caseId}: ${note}`, `/m/complaints/${caseId}`, 'warning');
  audit('ส่งกลับให้ร้านค้า', caseId, note);
}

export function officerClose(caseId: string, note: string) {
  const c = useComplaintStore.getState().items.find((x) => x.id === caseId)!;
  updComplaint(caseId, (x) => ({ status: 'closed', resolvedAt: nowISO(), officerNote: note, timeline: [...x.timeline, ev('เจ้าหน้าที่ปิดเรื่อง', note)] }));
  notify('consumer', c.consumerId, 'เจ้าหน้าที่ปิดเรื่องแล้ว', `${caseId}: ${note}`, `/consumer/cases/${caseId}`);
  notifyMerchant(c.merchantId, 'เจ้าหน้าที่ปิดเรื่อง', `${caseId}: ${note}`, `/m/complaints/${caseId}`);
  audit('ปิดเรื่องร้องเรียน', caseId, note);
}

// ---------- Warnings & corrective action ----------
function recomputeRisk(merchantId: string) {
  const openRisk = useRiskStore
    .getState()
    .items.filter((r) => r.merchantId === merchantId && !['dismissed', 'appeal_reviewed'].includes(r.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const cert = currentCert(useCertificationStore.getState().items, merchantId);
  if (openRisk) return ms().update(merchantId, { riskStatus: openRisk.status as Merchant['riskStatus'] });
  if (cert?.status === 'revoked' || cert?.status === 'suspended') return ms().update(merchantId, { riskStatus: cert.status });
  const openWarning = useWarningStore.getState().items.some((w) => w.merchantId === merchantId && w.kind === 'warning' && w.status !== 'completed');
  ms().update(merchantId, { riskStatus: openWarning ? 'warning' : 'none' });
}

export function issueWarning(input: { merchantId: string; kind: WarningKind; title: string; issue: string; guidance: string; items: string[]; courseIds: string[]; dueDate: string; relatedComplaintIds: string[] }) {
  const store = useWarningStore.getState();
  const w: WarningRecord = {
    id: nextRef('WRN', store.items.map((x) => x.id)),
    merchantId: input.merchantId,
    kind: input.kind,
    status: input.kind === 'advisory' ? 'advisory' : 'warning_issued',
    title: input.title,
    issue: input.issue,
    guidance: input.guidance,
    items: input.items.filter(Boolean).map((t) => ({ id: uid('wi'), text: t, done: false })),
    courseIds: input.courseIds,
    dueDate: input.dueDate,
    evidence: [],
    officerId: useSessionStore.getState().officerId,
    relatedComplaintIds: input.relatedComplaintIds,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    timeline: [ev(input.kind === 'advisory' ? 'ออกคำแนะนำ (ไม่ใช่มาตรการลงโทษ)' : 'ออกคำเตือน', input.title)],
  };
  store.add(w);
  const m = merchantOf(input.merchantId);
  if (input.kind === 'warning' && m && ['none', 'allegation'].includes(m.riskStatus)) ms().update(m.id, { riskStatus: 'warning' });
  notifyMerchant(input.merchantId, input.kind === 'advisory' ? 'คุณได้รับคำแนะนำ' : 'คุณได้รับคำเตือน', `${w.id}: ${w.title}`, `/m/warnings/${w.id}`, input.kind === 'advisory' ? 'info' : 'error');
  audit(input.kind === 'advisory' ? 'ออกคำแนะนำ' : 'ออกคำเตือน', w.id, m?.shopName);
  return w;
}

function updWarning(id: string, patch: (w: WarningRecord) => Partial<WarningRecord>) {
  useWarningStore.getState().update(id, (w) => ({ updatedAt: nowISO(), ...patch(w) }));
}

export function acknowledgeWarning(id: string) {
  updWarning(id, (w) => ({
    status: w.items.length ? 'correction_required' : 'acknowledged',
    timeline: [...w.timeline, ev('ร้านค้ารับทราบ', undefined, 'merchant'), ...(w.items.length ? [ev('กำหนดรายการที่ต้องแก้ไข', `${w.items.length} รายการ`, 'system')] : [])],
  }));
  audit('รับทราบคำเตือน/คำแนะนำ', id);
  notify('officer', undefined, 'ร้านค้ารับทราบคำเตือน', id, `/o/warnings/${id}`);
}

export function toggleWarningItem(id: string, itemId: string) {
  updWarning(id, (w) => ({ items: w.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }));
}

export function submitCorrection(id: string, note: string, docs: MockDocument[]) {
  updWarning(id, (w) => ({
    status: 'correction_submitted',
    merchantNote: note,
    evidence: [...w.evidence, ...docs],
    timeline: [...w.timeline, ev('ส่งหลักฐานการแก้ไข', `${note} · แนบ ${docs.length} ไฟล์`, 'merchant')],
  }));
  audit('ส่งหลักฐานการแก้ไข', id);
  notify('officer', undefined, 'ผลการแก้ไขรอตรวจ', id, `/o/warnings/${id}`);
}

export function reviewCorrection(id: string, action: 'start' | 'approve' | 'return' | 'close', note = '') {
  const w = useWarningStore.getState().items.find((x) => x.id === id)!;
  const map = {
    start: { status: 'under_review' as const, title: 'เริ่มตรวจผลการแก้ไข' },
    approve: { status: 'completed' as const, title: 'ตรวจผลผ่าน — เสร็จสิ้น' },
    return: { status: 'correction_required' as const, title: 'ส่งกลับให้แก้ไขเพิ่มเติม' },
    close: { status: 'completed' as const, title: 'ปิดคำแนะนำ' },
  }[action];
  updWarning(id, (x) => ({ status: map.status, timeline: [...x.timeline, ev(map.title, note || undefined)] }));
  if (map.status === 'completed') recomputeRisk(w.merchantId);
  notifyMerchant(w.merchantId, map.title, `${id}${note ? `: ${note}` : ''}`, `/m/warnings/${id}`, action === 'return' ? 'warning' : 'info');
  audit(map.title, id, note);
}

// ---------- Risk, suspension & appeal ----------
export function openRiskCase(merchantId: string, reason: string, complaintIds: string[]) {
  const store = useRiskStore.getState();
  const r: RiskCase = {
    id: nextRef('RSK', store.items.map((x) => x.id)),
    merchantId,
    status: 'allegation',
    reason,
    evidenceSummary: complaintIds.map((c) => `ข้อร้องเรียน ${c}`),
    relatedComplaintIds: complaintIds,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    timeline: [ev('บันทึกข้อกล่าวหา', 'ยังไม่ใช่ข้อสรุปว่ากระทำผิด')],
  };
  store.add(r);
  ms().update(merchantId, { riskStatus: 'allegation' });
  audit('เปิดเรื่องพิจารณาความเสี่ยง', r.id, reason);
  emitMerchantChanged(merchantId, 'measure_change');
  return r;
}

export function riskAction(caseId: string, status: RiskCaseStatus, note: string) {
  const r = useRiskStore.getState().items.find((x) => x.id === caseId)!;
  const titles: Record<RiskCaseStatus, string> = {
    allegation: 'บันทึกข้อกล่าวหา',
    under_investigation: 'เปิดการตรวจสอบ และเปิดให้ร้านค้าชี้แจง',
    warning: 'มีมติออกคำเตือน',
    suspended: 'ระงับการรับรองชั่วคราว',
    revoked: 'เพิกถอนการรับรอง',
    appeal_submitted: 'ยื่นอุทธรณ์',
    appeal_reviewed: 'พิจารณาอุทธรณ์แล้ว',
    dismissed: 'ยุติเรื่อง — ไม่พบมูล',
  };
  useRiskStore.getState().update(caseId, (x) => ({ status, updatedAt: nowISO(), timeline: [...x.timeline, ev(titles[status], note)] }));
  const cert = currentCert(useCertificationStore.getState().items, r.merchantId);
  if ((status === 'suspended' || status === 'revoked') && cert && cert.status !== 'revoked') {
    useCertificationStore.getState().update(cert.id, (c) => ({ status, statusReason: note, history: [...c.history, ev(titles[status], note)] }));
  }
  if (status === 'dismissed' && cert?.status === 'suspended') {
    useCertificationStore.getState().update(cert.id, (c) => ({ status: 'active', statusReason: undefined, history: [...c.history, ev('คืนสถานะใบรับรอง (ยุติเรื่อง)', note)] }));
  }
  if (status === 'dismissed') recomputeRisk(r.merchantId);
  else ms().update(r.merchantId, { riskStatus: status as Merchant['riskStatus'] });
  notifyMerchant(r.merchantId, titles[status], `${caseId}: ${note}`, '/m/review', ['suspended', 'revoked'].includes(status) ? 'error' : 'warning');
  audit(titles[status], caseId, note);
  emitMerchantChanged(r.merchantId, 'measure_change');
}

export function merchantStatement(caseId: string, text: string) {
  useRiskStore.getState().update(caseId, (x) => ({ merchantStatement: text, updatedAt: nowISO(), timeline: [...x.timeline, ev('ร้านค้าส่งคำชี้แจง', text, 'merchant')] }));
  audit('ร้านค้าส่งคำชี้แจง', caseId);
  notify('officer', undefined, 'ร้านค้าส่งคำชี้แจง', caseId, `/o/risk/${caseId}`);
}

export function submitAppeal(caseId: string, text: string) {
  const r = useRiskStore.getState().items.find((x) => x.id === caseId)!;
  useRiskStore.getState().update(caseId, (x) => ({
    status: 'appeal_submitted',
    appeal: { text, submittedAt: nowISO() },
    updatedAt: nowISO(),
    timeline: [...x.timeline, ev('ร้านค้ายื่นอุทธรณ์', text, 'merchant')],
  }));
  ms().update(r.merchantId, { riskStatus: 'appeal_submitted' });
  audit('ยื่นอุทธรณ์', caseId);
  notify('officer', undefined, 'มีคำอุทธรณ์ใหม่', `${caseId} ${merchantOf(r.merchantId)?.shopName}`, `/o/risk/${caseId}`, 'warning');
}

export function reviewAppeal(caseId: string, result: 'upheld' | 'overturned', note: string) {
  const r = useRiskStore.getState().items.find((x) => x.id === caseId)!;
  useRiskStore.getState().update(caseId, (x) => ({
    status: 'appeal_reviewed',
    appeal: x.appeal ? { ...x.appeal, result, resultNote: note } : undefined,
    updatedAt: nowISO(),
    timeline: [...x.timeline, ev(result === 'overturned' ? 'พิจารณาอุทธรณ์: รับอุทธรณ์ ยกเลิกคำสั่งระงับ' : 'พิจารณาอุทธรณ์: ยกอุทธรณ์ คงผลเดิม', note)],
  }));
  const cert = currentCert(useCertificationStore.getState().items, r.merchantId);
  if (result === 'overturned' && cert && (cert.status === 'suspended' || cert.status === 'revoked')) {
    useCertificationStore.getState().update(cert.id, (c) => ({ status: 'active', statusReason: undefined, history: [...c.history, ev('คืนสถานะใบรับรองตามผลอุทธรณ์', note)] }));
  }
  recomputeRisk(r.merchantId);
  notifyMerchant(r.merchantId, 'ผลการพิจารณาอุทธรณ์', `${result === 'overturned' ? 'คืนสถานะการรับรอง' : 'คงผลเดิม'}: ${note}`, '/m/review', result === 'overturned' ? 'success' : 'warning');
  audit('พิจารณาอุทธรณ์', caseId, `${result} — ${note}`);
  emitMerchantChanged(r.merchantId, 'measure_change');
}

// ---------- Training ----------
export function startCourse(operatorId: string, courseId: string) {
  const store = useTrainingStore.getState();
  if (store.items.some((e) => e.operatorId === operatorId && e.courseId === courseId)) return;
  store.add({ id: uid('ENR'), operatorId, courseId, completedLessonIds: [], attempts: 0, passed: false, startedAt: nowISO() });
}

export function completeLesson(operatorId: string, courseId: string, lessonId: string) {
  const e = useTrainingStore.getState().items.find((x) => x.operatorId === operatorId && x.courseId === courseId);
  if (!e || e.completedLessonIds.includes(lessonId)) return;
  useTrainingStore.getState().update(e.id, { completedLessonIds: [...e.completedLessonIds, lessonId] });
}

export function submitQuiz(operatorId: string, courseId: string, answers: number[]) {
  const course = courses.find((c) => c.id === courseId)!;
  const correct = course.quiz.filter((q, i) => answers[i] === q.answer).length;
  const score = Math.round((correct / course.quiz.length) * 100);
  const passed = score >= course.passScore;
  startCourse(operatorId, courseId); // ไม่ทำอะไรหากลงทะเบียนเรียนไว้แล้ว
  const e = useTrainingStore.getState().items.find((x) => x.operatorId === operatorId && x.courseId === courseId)!;
  const certNo = passed && !e.certificateNo ? nextRef('TRN', useTrainingStore.getState().items.map((x) => x.certificateNo ?? 'x-0')) : e.certificateNo;
  useTrainingStore.getState().update(e.id, {
    attempts: e.attempts + 1,
    bestScore: Math.max(score, e.bestScore ?? 0),
    passed: e.passed || passed,
    completedAt: passed && !e.passed ? nowISO() : e.completedAt,
    certificateNo: certNo,
  });
  if (passed && !e.passed) {
    notify('merchant', operatorId, 'ผ่านการอบรม', `${course.title} — คะแนน ${score}%`, `/m/training/${courseId}`, 'success');
    audit('ผ่านการอบรม', courseId, `${operatorOf(operatorId)?.name} คะแนน ${score}%`);
    // เชื่อมกับคำเตือนที่แนบหลักสูตรนี้
    const myMerchants = ms().items.filter((m) => m.operatorId === operatorId).map((m) => m.id);
    useWarningStore
      .getState()
      .items.filter((w) => myMerchants.includes(w.merchantId) && w.courseIds.includes(courseId) && w.status !== 'completed')
      .forEach((w) =>
        updWarning(w.id, (x) => ({
          items: x.items.map((i) => (i.text.includes('อบรม') ? { ...i, done: true } : i)),
          timeline: [...x.timeline, ev('ผ่านการอบรมหลักสูตรที่แนบ', course.title, 'system')],
        })),
      );
  }
  return { score, passed, correct, total: course.quiz.length };
}

// ---------- Notifications ----------
export function markNotificationsRead(ids: string[]) {
  const st = useNotificationStore.getState();
  ids.forEach((id) => st.update(id, { read: true }));
}
