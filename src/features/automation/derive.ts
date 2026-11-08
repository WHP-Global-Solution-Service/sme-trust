/**
 * สร้าง Context ของ Decision Router จากข้อมูลชุดใดก็ได้ (Store จริง หรือ Seed) — Pure Function ใช้ร่วมกันทั้งแอป Seed และ Test
 */
import type { DataBundle } from '@/features/trust-assessment/inputs';
import type { Standing, TrustAssessment } from '@/features/trust-assessment/types';
import { currentCert } from '@/utils/trust';
import { ownerMismatchOf, sourceOwnerName } from '@/features/marketplace/services/owner';
import { badgeStatusFor, routeAssessment, type RoutingContext } from './router';
import type { AssessmentBadge, AutomationRun, AutomationTrigger, BadgeStatus, EvidenceSnapshot, OfficerTask, RoutingDecision } from './types';

/** สถานะการรับรอง ณ ปัจจุบัน — กฎเดียวกับ Engine (D8) แต่อ่านจากข้อมูลล่าสุด */
export function liveStanding(bundle: DataBundle, merchantId: string): { standing: Standing; reason?: string; ref?: RoutingContext['measureRef'] } {
  const m = bundle.merchants.find((x) => x.id === merchantId);
  const cert = currentCert(bundle.certifications, merchantId);
  const risk = bundle.risks.filter((r) => r.merchantId === merchantId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const riskRef = (id: string) => ({ kind: 'risk_case' as const, id, to: `/o/risk/${id}` });
  const certRef = cert ? { kind: 'certification' as const, id: cert.id, to: '/o/certification' } : undefined;
  if (cert?.status === 'revoked' || m?.riskStatus === 'revoked') return { standing: 'revoked', reason: 'การรับรองถูกเพิกถอน', ref: risk[0] ? riskRef(risk[0].id) : certRef };
  if (cert?.status === 'suspended' || m?.riskStatus === 'suspended') return { standing: 'suspended', reason: 'การรับรองถูกระงับชั่วคราว', ref: risk[0] ? riskRef(risk[0].id) : certRef };
  const open = risk.find((r) => !['dismissed', 'appeal_reviewed'].includes(r.status));
  if (open) return { standing: 'under_review', reason: `มีเรื่องพิจารณาความเสี่ยงที่ยังเปิดอยู่ (${open.id})`, ref: riskRef(open.id) };
  return { standing: 'normal' };
}

export function routingContext(bundle: DataBundle, merchantId: string, assessment: TrustAssessment, tasks: OfficerTask[], asOf: Date): RoutingContext | undefined {
  const m = bundle.merchants.find((x) => x.id === merchantId);
  if (!m) return undefined;
  const op = bundle.operators.find((o) => o.id === m.operatorId);
  const st = liveStanding(bundle, merchantId);
  const cleared: Record<string, string> = {};
  tasks.filter((t) => t.merchantId === merchantId && t.status === 'approved').forEach((t) => (cleared[t.fingerprint] = t.id));
  return {
    merchantId,
    result: assessment.result,
    standing: st.standing,
    standingReason: st.reason,
    measureRef: st.ref,
    kycVerified: op?.kycStatus === 'verified',
    connections: bundle.connections
      .filter((c) => c.merchantId === merchantId && c.status !== 'disconnected')
      .map((c) => ({
        id: c.id,
        platform: c.platform,
        status: c.status,
        lastSyncAt: c.lastSyncAt,
        mockShopId: c.mockShopId,
        mockShopName: c.mockShopName,
        ownerName: sourceOwnerName(c, op?.name),
        ownerMismatch: ownerMismatchOf(c),
        identityReview: c.identityReview?.status,
      })),
    cleared,
    asOf,
  };
}

export interface Evaluation {
  ctx: RoutingContext;
  decision: RoutingDecision;
  status: BadgeStatus;
}

export function evaluate(bundle: DataBundle, merchantId: string, assessment: TrustAssessment, tasks: OfficerTask[], asOf: Date): Evaluation | undefined {
  const ctx = routingContext(bundle, merchantId, assessment, tasks, asOf);
  if (!ctx) return undefined;
  const decision = routeAssessment(ctx);
  return { ctx, decision, status: badgeStatusFor(decision, assessment.result, ctx.standing) };
}

/** หลักฐาน ณ เวลาที่ส่งตรวจ (สำเนา — ไม่เปลี่ยนตามข้อมูลภายหลัง) */
export function evidenceSnapshot(ev: Evaluation, assessment: TrustAssessment, kycName: string | undefined, items: string[], at: string): EvidenceSnapshot {
  const r = assessment.result;
  return {
    capturedAt: at,
    assessmentId: assessment.id,
    modelVersion: r.modelVersion,
    band: r.band,
    scoreBand: r.scoreBand,
    score: r.score,
    confidence: { level: r.confidence.level, score: r.confidence.score },
    coverage: r.coverage.percent,
    standing: ev.ctx.standing,
    riskSignals: r.riskFactors.map((f) => ({ id: f.id, label: f.label, value: f.value })),
    connections: ev.ctx.connections.map((c) => ({ id: c.id, platform: c.platform, mockShopId: c.mockShopId, mockShopName: c.mockShopName, ownerName: c.ownerName, lastSyncAt: c.lastSyncAt })),
    kycName,
    items,
  };
}

/** Badge ถัดไป — บันทึกประวัติเมื่อสถานะ/Band/ความเชื่อมั่นเปลี่ยนเท่านั้น (ประเมินซ้ำด้วยข้อมูลเดิมไม่สร้างประวัติซ้ำ) */
export function nextBadge(prev: AssessmentBadge | undefined, merchantId: string, assessment: TrustAssessment, ev: Evaluation, trigger: AutomationTrigger, at: string): { badge: AssessmentBadge; changed: boolean } {
  const r = assessment.result;
  const event = { at, status: ev.status, band: r.band, confidence: r.confidence.level, coverage: r.coverage.percent, route: ev.decision.route, assessmentId: assessment.id, modelVersion: r.modelVersion, trigger };
  const changed = !prev || prev.status !== ev.status || prev.band !== r.band || prev.confidence !== r.confidence.level;
  const base = {
    id: prev?.id ?? `TAB-${merchantId}`,
    merchantId,
    status: ev.status,
    band: r.band,
    confidence: r.confidence.level,
    coverage: r.coverage.percent,
    route: ev.decision.route,
    assessmentId: assessment.id,
    modelVersion: r.modelVersion,
    dataSources: r.dataSources,
    checkedAt: at,
  };
  if (!prev) return { badge: { ...base, issuedAt: at, updatedAt: at, history: [event] }, changed: true };
  return { badge: { ...prev, ...base, updatedAt: changed ? at : prev.updatedAt, history: changed ? [event, ...prev.history] : prev.history }, changed };
}

/** ผลประเมินล่าสุดของแต่ละร้าน */
export const latestPerMerchant = (assessments: TrustAssessment[]) => {
  const out = new Map<string, TrustAssessment>();
  [...assessments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .forEach((a) => !out.has(a.merchantId) && out.set(a.merchantId, a));
  return out;
};

/**
 * สถานะเริ่มต้นของระบบอัตโนมัติ (Seed) — คำนวณจากผลประเมินตัวอย่างด้วยกฎเดียวกับแอป
 * ไม่สร้างผลประเมินใหม่ (ใช้ผลประเมินตัวอย่าง) · ประเด็นที่มีเรื่องเดิมดูแลอยู่ไม่สร้างงานใหม่
 */
export function buildSeedAutomation(bundle: DataBundle, assessments: TrustAssessment[], anchor: Date): { badges: AssessmentBadge[]; runs: AutomationRun[] } {
  const at = anchor.toISOString();
  const badges: AssessmentBadge[] = [];
  const runs: AutomationRun[] = [];
  [...latestPerMerchant(assessments).values()]
    .sort((a, b) => a.merchantId.localeCompare(b.merchantId))
    .forEach((a, i) => {
      const ev = evaluate(bundle, a.merchantId, a, [], anchor);
      if (!ev) return;
      badges.push(nextBadge(undefined, a.merchantId, a, ev, 'seed', at).badge);
      runs.push({ id: `RUN-SEED-${String(i + 1).padStart(3, '0')}`, merchantId: a.merchantId, at, trigger: 'seed', route: ev.decision.route, badgeStatus: ev.status, band: a.result.band, assessmentId: a.id, modelVersion: a.result.modelVersion, reassessed: false, taskIds: [], reasons: ev.decision.reasons });
    });
  return { badges, runs };
}
