/**
 * ตัวชี้วัด SME Trust v2 (P7-G) — คำนวณจาก Mock State ทั้งหมด ไม่มีตัวเลขกำหนดตายตัว
 * ใช้ผลประเมินล่าสุดของแต่ละร้าน (ผลเก่าไม่นับซ้ำ) และสถานะการเชื่อมต่อปัจจุบัน
 */
import type { Certification, Merchant } from '@/types';
import type { MarketplaceConnection, Platform } from '@/features/marketplace/types';
import type { BandOrInsufficient, ConfidenceLevel, TrustAssessment } from '@/features/trust-assessment/types';
import { PLATFORMS, PLATFORM_LIST } from '@/features/marketplace/data/platforms';
import { BAND_LABEL, CONFIDENCE_LABEL } from '@/features/trust-assessment/labels';
import { currentCert } from './trust';
import type { Datum } from '@/components/common/Charts';

export interface V2Data {
  merchants: Merchant[];
  connections: MarketplaceConnection[];
  assessments: TrustAssessment[];
  certifications: Certification[];
}

const BANDS: BandOrInsufficient[] = ['A', 'B', 'C', 'D', 'insufficient'];
const LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low'];

export function computeV2Stats({ merchants, connections, assessments, certifications }: V2Data) {
  const live = connections.filter((c) => c.status !== 'disconnected' && merchants.some((m) => m.id === c.merchantId));
  const connectedIds = new Set(live.filter((c) => c.status === 'connected').map((c) => c.merchantId));
  const anyMarketplace = new Set(live.map((c) => c.merchantId));
  const registered = merchants.filter((m) => m.registrationStatus !== 'draft');

  // ผลประเมินล่าสุดของแต่ละร้าน
  const latest = new Map<string, TrustAssessment>();
  for (const a of assessments) {
    const cur = latest.get(a.merchantId);
    if (!cur || a.createdAt > cur.createdAt || (a.createdAt === cur.createdAt && a.id > cur.id)) latest.set(a.merchantId, a);
  }
  const lastResults = [...latest.values()].filter((a) => merchants.some((m) => m.id === a.merchantId));
  const decided = assessments.filter((a) => a.status === 'decided' && a.decision);

  const byPlatform = (p: Platform) => live.filter((c) => c.platform === p);
  const certNow = merchants.map((m) => currentCert(certifications, m.id)).filter((c): c is Certification => !!c);

  const bandData: Datum[] = BANDS.map((b) => ({ name: b === 'insufficient' ? 'Insufficient Data' : `Band ${b}`, value: lastResults.filter((a) => a.result.band === b).length }));
  const confidenceData: Datum[] = LEVELS.map((l) => ({ name: CONFIDENCE_LABEL[l].label.replace('ความเชื่อมั่นของข้อมูล', 'ความเชื่อมั่น'), value: lastResults.filter((a) => a.result.confidence.level === l).length }));
  const platformData: Datum[] = PLATFORM_LIST.map((p) => ({ name: PLATFORMS[p].label, value: byPlatform(p).length }));

  return {
    kpi: {
      connectedMerchants: connectedIds.size,
      selfRegistered: registered.filter((m) => !anyMarketplace.has(m.id)).length,
      connections: live.length,
      connectionSuccess: live.filter((c) => c.status === 'connected').length,
      connectionFailed: live.filter((c) => c.status === 'sync_failed').length,
      connectionPending: live.filter((c) => c.status === 'pending_consent' || c.status === 'syncing').length,
      assessed: lastResults.length,
      insufficient: lastResults.filter((a) => a.result.band === 'insufficient').length,
      avgCoverage: lastResults.length ? Math.round(lastResults.reduce((s, a) => s + a.result.coverage.percent, 0) / lastResults.length) : 0,
      pendingReview: assessments.filter((a) => a.status === 'pending_review').length,
      approved: decided.filter((a) => a.decision!.kind === 'approved').length,
      needInfo: decided.filter((a) => a.decision!.kind === 'need_info').length,
      rejected: decided.filter((a) => a.decision!.kind === 'rejected').length,
      suspended: certNow.filter((c) => c.status === 'suspended').length,
      revoked: certNow.filter((c) => c.status === 'revoked').length,
    },
    platforms: PLATFORM_LIST.map((p) => ({ platform: p, label: PLATFORMS[p].label, total: byPlatform(p).length, success: byPlatform(p).filter((c) => c.status === 'connected').length, failed: byPlatform(p).filter((c) => c.status === 'sync_failed').length })),
    platformData,
    bandData,
    confidenceData,
    bandLabel: (name: string) => BAND_LABEL[(name === 'Insufficient Data' ? 'insufficient' : name.replace('Band ', '')) as BandOrInsufficient]?.label ?? name,
  };
}

export type V2Stats = ReturnType<typeof computeV2Stats>;
