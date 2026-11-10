/**
 * Public projection ของผลประเมิน — ข้อมูลชุดเดียวที่หน้าสาธารณะ (ผู้บริโภค / ไม่เข้าสู่ระบบ) ได้รับ
 *
 * ส่งเฉพาะ Band, สถานะการรับรอง, Coverage (%), ระดับ Confidence, สรุปสาธารณะ และแหล่งข้อมูล
 * ไม่ส่ง: คะแนนตัวเลข 0–100 · คะแนนรายองค์ประกอบ · Risk Signal และหลักฐาน · เหตุผลของ Confidence
 * (มีจำนวนคำสั่งซื้อ/รีวิว และสัญญาณที่ยังไม่มีข้อสรุป) · ข้อมูลการขายและรีวิวดิบ · ข้อเสนอของระบบ
 * คะแนนตัวเลขและรายละเอียดเป็นสิทธิ์ assessment.score.view (เจ้าหน้าที่ / ผู้ดูแลระบบ)
 */
import type { AssessmentResult, BandOrInsufficient, ConfidenceLevel, Standing } from './types';
import type { Platform } from '@/features/marketplace/types';

export interface PublicAssessmentView {
  band: BandOrInsufficient;
  standing: Standing;
  standingReason?: string;
  publicSummary: string[];
  coverage: { percent: number };
  confidence: { level: ConfidenceLevel };
  dataSources: Platform[];
  computedAt: string;
  modelVersion: string;
  weightSet?: { revision: number; at?: string };
}

/** ฟิลด์ที่ห้ามปรากฏในข้อมูลสาธารณะ — ใช้ในชุดทดสอบ */
export const PUBLIC_FORBIDDEN_KEYS = ['score', 'baseScore', 'riskPenalty', 'scoreBand', 'components', 'riskFactors', 'analysis', 'recommendation', 'insufficientReasons', 'bandCapReasons', 'reasons', 'items'] as const;

/**
 * ตัดคะแนนที่หักภายใน เช่น "(−15)" ออกจากข้อความเหตุผล — ใช้กับมุมมองของร้านค้า
 * ร้านค้าเห็นเหตุผลเพื่อปรับปรุงได้ แต่ไม่เห็นตัวเลขภายในของโมเดล (สิทธิ์ assessment.score.view)
 */
export const withoutInternalPoints = (text: string) => text.replace(/\s*\([−+-]\d+(?:\.\d+)?\)/g, '');

export function publicAssessmentView(r: AssessmentResult): PublicAssessmentView {
  return {
    band: r.band,
    standing: r.standing,
    ...(r.standingReason ? { standingReason: r.standingReason } : {}),
    publicSummary: [...r.publicSummary],
    coverage: { percent: r.coverage.percent },
    confidence: { level: r.confidence.level },
    dataSources: [...r.dataSources],
    computedAt: r.computedAt,
    modelVersion: r.modelVersion,
    ...(r.weightSet ? { weightSet: { ...r.weightSet } } : {}),
  };
}
