/**
 * Decision Router (Pure Function) — คัดกรองผลประเมินเป็น AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW
 * - เป็นการคัดกรองเพื่อจัดเส้นทางงาน ไม่ใช่การตัดสินว่าร้านค้ากระทำผิดหรือทุจริต
 * - ประเด็นที่อยู่ในกระบวนการเดิมของเจ้าหน้าที่แล้ว (มาตรการ/เรื่องพิจารณาความเสี่ยง) ไม่สร้างงานใหม่
 * - ประเด็นที่เจ้าหน้าที่ตรวจแล้ว (Fingerprint เดิม) ไม่ส่งตรวจซ้ำ จนกว่าจะมีข้อมูลใหม่
 */
import type { AssessmentResult, Standing } from '@/features/trust-assessment/types';
import type { Platform } from '@/features/marketplace/types';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { ROUTING_POLICY } from './policy';
import type { BadgeStatus, Priority, Route, RoutingDecision, RoutingIssue } from './types';

const DAY = 86_400_000;

export interface RoutingConnection {
  id: string;
  platform: Platform;
  status: string;
  lastSyncAt?: string;
  mockShopId: string;
  mockShopName: string;
  /** ชื่อเจ้าของบัญชีร้านบน Marketplace (Raw Source จำลอง) */
  ownerName: string;
  ownerMismatch: boolean;
  identityReview?: 'verified' | 'rejected';
  /** ร้านเดียวกันบน Marketplace เชื่อมกับร้านอื่นในระบบอยู่แล้ว */
  claimedBy?: string;
}

export interface RoutingContext {
  merchantId: string;
  result: AssessmentResult;
  /** สถานะการรับรอง ณ ปัจจุบัน (อ่านจากข้อมูลล่าสุด ไม่ใช่จากผลประเมินที่บันทึกไว้) */
  standing: Standing;
  standingReason?: string;
  /** เรื่องที่เจ้าหน้าที่ดูแลอยู่แล้ว (มาตรการ/พิจารณาความเสี่ยง) */
  measureRef?: { kind: 'risk_case' | 'certification'; id: string; to: string };
  kycVerified: boolean;
  /** สถานะคำขอลงทะเบียนร้าน (ร้านที่คำขอไม่ผ่านต้องไม่แสดง Badge) */
  registrationStatus?: string;
  /** การเชื่อมต่อทั้งหมดที่ยังไม่ยกเลิก */
  connections: RoutingConnection[];
  /** Fingerprint ที่เจ้าหน้าที่ตรวจแล้วว่าไม่ต้องดำเนินการ → รหัสงาน */
  cleared: Record<string, string>;
  asOf: Date;
}

const issue = (i: Omit<RoutingIssue, 'evidence'> & { evidence?: string[] }): RoutingIssue => ({ evidence: [], ...i });

export function routeAssessment(ctx: RoutingContext): RoutingDecision {
  const P = ROUTING_POLICY;
  const r = ctx.result;
  const issues: RoutingIssue[] = [];
  const m = ctx.merchantId;

  // ---- มาตรการ / เรื่องพิจารณาความเสี่ยงที่เจ้าหน้าที่ดูแลอยู่ (อำนาจของเจ้าหน้าที่ — ระบบไม่เปลี่ยนเอง)
  const measure = ctx.standing !== 'normal';
  if (measure) {
    issues.push(
      issue({
        category: 'measure',
        kind: 'manual',
        title: ctx.standing === 'under_review' ? 'อยู่ระหว่างพิจารณาความเสี่ยง' : ctx.standing === 'suspended' ? 'การรับรองถูกระงับ (Suspended)' : 'การรับรองถูกเพิกถอน (Revoked)',
        detail: `${ctx.standingReason ?? 'สถานะการรับรองไม่ปกติ'} — อยู่ในกระบวนการของเจ้าหน้าที่แล้ว ระบบไม่สร้างงานซ้ำ และไม่แสดง Badge ระหว่างนี้`,
        priority: 'high',
        fingerprint: `measure:${m}:${ctx.standing}`,
        handledBy: ctx.measureRef,
      }),
    );
  }

  // ---- ร้านค้าแก้ไขเองได้
  if (ctx.registrationStatus === 'rejected') {
    issues.push(issue({ category: 'registration_rejected', kind: 'merchant_fixable', title: 'คำขอลงทะเบียนร้านไม่ผ่าน', detail: 'แก้ไขข้อมูลและยื่นคำขอใหม่ — ระหว่างนี้ไม่แสดง Assessment Badge (ผลการพิจารณาคำขอเป็นอำนาจของเจ้าหน้าที่)', action: { label: 'แก้ไขและยื่นคำขอใหม่', to: '/m/shop' }, priority: 'medium', fingerprint: `registration:${m}` }));
  }
  if (P.requireIdentityVerified && !ctx.kycVerified) {
    issues.push(issue({ category: 'identity_unverified', kind: 'merchant_fixable', title: 'ยังไม่ได้ยืนยันตัวตนเจ้าของร้าน', detail: 'ยืนยันตัวตนด้วย e-KYC (จำลอง) ก่อน ระบบจึงแสดง Assessment Badge ได้', action: { label: 'ยืนยันตัวตน', to: '/m/kyc' }, priority: 'medium', fingerprint: `kyc:${m}` }));
  }
  if (r.band === 'insufficient') {
    issues.push(
      issue({
        category: 'insufficient_data',
        kind: 'merchant_fixable',
        title: 'ข้อมูลยังไม่เพียงพอ (Insufficient Data)',
        detail: `${r.insufficientReasons.join(' · ')}${ctx.connections.length ? '' : ' — ร้านที่ไม่มีบัญชี Marketplace ไม่ถูกหักคะแนน เพิ่มหลักฐานหรือเชื่อมช่องทางขายเมื่อพร้อม'}`,
        action: { label: ctx.connections.some((c) => c.status === 'connected') ? 'ซิงก์หรือเชื่อมต่อแพลตฟอร์มเพิ่ม' : 'เชื่อมต่อ Marketplace (จำลอง)', to: '/m/marketplace' },
        priority: 'medium',
        fingerprint: `insufficient:${m}`,
        evidence: r.insufficientReasons,
      }),
    );
  } else if (P.blockLowConfidence && r.confidence.level === 'low') {
    issues.push(issue({ category: 'low_confidence', kind: 'merchant_fixable', title: 'ความเชื่อมั่นของข้อมูลต่ำ', detail: r.confidence.reasons.join(' · '), action: { label: 'เพิ่มแหล่งข้อมูลหรือซิงก์ข้อมูลล่าสุด', to: '/m/marketplace' }, priority: 'medium', fingerprint: `confidence:${m}`, evidence: r.confidence.reasons }));
  }
  const usable = ctx.connections.filter((c) => c.status === 'connected' && c.lastSyncAt && c.identityReview !== 'rejected');
  const ages = usable.map((c) => (ctx.asOf.getTime() - new Date(c.lastSyncAt!).getTime()) / DAY);
  if (ages.length && Math.max(...ages) > P.staleDays) {
    const old = usable.filter((_, i) => ages[i] > P.staleDays).map((c) => PLATFORMS[c.platform].label);
    issues.push(issue({ category: 'stale_data', kind: 'merchant_fixable', title: 'ข้อมูลหมดอายุ', detail: `ข้อมูลจาก ${old.join(', ')} ซิงก์ล่าสุดนานกว่า ${P.staleDays} วัน — ซิงก์ใหม่เพื่อให้ผลประเมินเป็นปัจจุบัน`, action: { label: 'ซิงก์ข้อมูลใหม่', to: '/m/marketplace' }, priority: 'medium', fingerprint: `stale:${m}` }));
  }
  const failed = ctx.connections.filter((c) => c.status === 'sync_failed');
  if (failed.length && usable.length) {
    issues.push(issue({ category: 'sync_failed', kind: 'advisory', title: 'การซิงก์บางแพลตฟอร์มไม่สำเร็จ', detail: `${failed.map((c) => PLATFORMS[c.platform].label).join(', ')} — ข้อมูลจากแพลตฟอร์มนี้ไม่ถูกใช้ประเมินจนกว่าจะซิงก์สำเร็จ`, action: { label: 'ซิงก์ใหม่', to: '/m/marketplace' }, priority: 'low', fingerprint: `syncfail:${failed.map((c) => c.id).join('+')}` }));
  }

  // ---- ต้องใช้เจ้าหน้าที่ (เฉพาะเมื่อยังไม่มีเรื่องเดิมดูแลอยู่ — ไม่สร้างงานซ้ำ)
  if (!measure) {
    for (const c of ctx.connections.filter((x) => x.status === 'connected' && x.claimedBy && !x.identityReview)) {
      const fp = `ownership:${c.id}:${c.claimedBy}`;
      issues.push(
        issue({
          category: 'identity_mismatch',
          kind: 'manual',
          title: 'ร้านบน Marketplace ถูกอ้างโดยร้านอื่นในระบบ',
          detail: `${c.mockShopName} (Shop ID จำลอง ${c.mockShopId}) บน ${PLATFORMS[c.platform].label} เชื่อมกับร้าน ${c.claimedBy} อยู่แล้ว — ระบบไม่รวมหรือเลือกเจ้าของแทนเจ้าหน้าที่`,
          priority: 'high',
          fingerprint: fp,
          clearedByTask: ctx.cleared[fp],
          evidence: [`Shop ID จำลอง ${c.mockShopId}`, `ร้านที่เชื่อมอยู่ก่อน: ${c.claimedBy}`],
        }),
      );
    }
    for (const c of ctx.connections.filter((x) => x.status === 'connected' && x.ownerMismatch && !x.identityReview && !x.claimedBy)) {
      const fp = `identity:${c.id}:${c.ownerName}`;
      issues.push(
        issue({
          category: 'identity_mismatch',
          kind: 'manual',
          title: 'ข้อมูลตัวตนสำคัญไม่ตรงกัน',
          detail: `ชื่อเจ้าของบัญชีร้าน ${c.mockShopName} บน ${PLATFORMS[c.platform].label} คือ "${c.ownerName}" ไม่ตรงกับผู้ที่ยืนยันตัวตนในระบบ — ระบบตัดสินเองไม่ได้ว่าเป็นร้านเดียวกันหรือไม่`,
          priority: 'high',
          fingerprint: fp,
          clearedByTask: ctx.cleared[fp],
          evidence: [`Shop ID จำลอง ${c.mockShopId}`, `เจ้าของบัญชี (ต้นฉบับ Marketplace): ${c.ownerName}`],
        }),
      );
    }
    const hard = r.riskFactors.filter((f) => P.hardSignals.includes(f.id));
    const soft = r.riskFactors.filter((f) => !P.hardSignals.includes(f.id));
    if (hard.length || soft.length >= P.softSignalThreshold) {
      const all = [...hard, ...soft];
      const fp = `risk:${all.map((f) => f.id).sort().join('+')}`;
      const priority: Priority = hard.length ? 'high' : 'medium';
      issues.push(
        issue({
          category: 'risk_signal',
          kind: 'manual',
          title: hard.length ? 'สัญญาณความเสี่ยงที่ต้องพิจารณา' : `สัญญาณที่ควรตรวจสอบ ${all.length} รายการพร้อมกัน`,
          detail: `${all.map((f) => f.label.replace(/ — ควรตรวจสอบเพิ่มเติม$/, '')).join(' · ')} — เป็นข้อสังเกตจากข้อมูล ไม่ใช่ข้อสรุปว่ากระทำผิด`,
          priority,
          fingerprint: fp,
          clearedByTask: ctx.cleared[fp],
          evidence: all.map((f) => `${f.label}: ${f.value}`),
        }),
      );
    } else if (soft.length === 1) {
      const f = soft[0];
      issues.push(issue({ category: 'advisory', kind: 'advisory', title: 'ข้อสังเกต 1 รายการ', detail: `${f.label.replace(/ — ควรตรวจสอบเพิ่มเติม$/, '')} — Band สูงสุด B ตามเกณฑ์ ยังไม่ต้องส่งเจ้าหน้าที่`, action: f.improve ? { label: f.improve, to: '/m/trust' } : undefined, priority: 'low', fingerprint: `advisory:${f.id}` }));
    }
    const gap = r.analysis.reviews.platformGap;
    if (gap !== null && gap >= P.ratingGapConflict) {
      const fp = `conflict:rating-gap:${r.dataSources.slice().sort().join('+')}`;
      issues.push(
        issue({
          category: 'evidence_conflict',
          kind: 'manual',
          title: 'หลักฐานจากหลายแหล่งขัดแย้งกัน',
          detail: `คะแนนรีวิวระหว่างแพลตฟอร์มต่างกัน ${gap.toFixed(1)} ดาว — ต้องให้เจ้าหน้าที่พิจารณาว่าแหล่งใดสะท้อนร้านจริง`,
          priority: 'medium',
          fingerprint: fp,
          clearedByTask: ctx.cleared[fp],
        }),
      );
    }
  }

  const active = issues.filter((i) => !i.clearedByTask);
  const route: Route = active.some((i) => i.kind === 'manual') ? 'MANUAL_REVIEW' : active.some((i) => i.kind === 'merchant_fixable') ? 'AUTO_REQUEST_INFO' : 'AUTO_PASS';
  const reasons =
    route === 'MANUAL_REVIEW'
      ? active.filter((i) => i.kind === 'manual').map((i) => i.title)
      : route === 'AUTO_REQUEST_INFO'
        ? active.filter((i) => i.kind === 'merchant_fixable').map((i) => i.title)
        : ['ข้อมูลครบตามเกณฑ์ และไม่พบประเด็นที่ต้องส่งเจ้าหน้าที่'];
  return { route, reasons, issues };
}

/** เงื่อนไขการแสดง Assessment Badge — มาตรการ (ระงับ/เพิกถอน) มาก่อนเสมอ */
export function badgeStatusFor(decision: RoutingDecision, result: AssessmentResult, standing: Standing): BadgeStatus {
  if (standing === 'revoked') return 'revoked';
  if (standing === 'suspended') return 'suspended';
  if (standing === 'under_review') return 'withheld';
  if (decision.route === 'MANUAL_REVIEW') return 'under_review';
  if (result.band === 'insufficient') return 'insufficient';
  if (decision.route === 'AUTO_REQUEST_INFO') return 'needs_update';
  if (!ROUTING_POLICY.badgeBands.includes(result.band)) return 'below_threshold';
  return 'active';
}

/** ผู้บริโภคเห็นอะไร — Badge แสดงเฉพาะสถานะ active · ระหว่างตรวจสอบข้อมูลตัวตน/หลักฐาน ไม่แสดง Band */
export const publicBadgeView = (status: BadgeStatus) => ({ showBadge: status === 'active', showBand: status !== 'under_review' });
