/** v2 — Trust Assessment Engine: Invariants และข้อสรุป D2, D5–D8 */
import { S, check, describe, finish } from '../harness.mts';

const { assessTrust } = await import('@/features/trust-assessment/engine');
const { MODEL_V2, modelWith, validateWeights } = await import('@/features/trust-assessment/model');
const { buildAssessmentInput } = await import('@/features/trust-assessment/inputs');
type Input = import('@/features/trust-assessment/types').AssessmentInput;
type Result = import('@/features/trust-assessment/types').AssessmentResult;

const ASOF = new Date('2026-10-21T09:00:00+07:00');
const bundle = () => ({
  operators: S.useOperatorStore.getState().items,
  merchants: S.useMerchantStore.getState().items,
  certifications: S.useCertificationStore.getState().items,
  complaints: S.useComplaintStore.getState().items,
  warnings: S.useWarningStore.getState().items,
  risks: S.useRiskStore.getState().items,
  enrollments: S.useTrainingStore.getState().items,
  connections: S.useMarketplaceStore.getState().items,
});
const input = (merchantId: string, asOf = ASOF) => buildAssessmentInput(merchantId, bundle(), asOf)!;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const withDates = (i: Input): Input => ({ ...clone(i), asOf: i.asOf });
const ids = S.useMerchantStore.getState().items.map((m) => m.id);
const results = ids.map((id) => [id, assessTrust(input(id))] as const);

describe('Invariants — ทุกร้านตัวอย่าง');
check(results.every(([, r]) => r.score >= 0 && r.score <= 100), 'คะแนนอยู่ระหว่าง 0–100 เสมอ');
check(
  results.every(([, r]) => Math.abs(r.components.reduce((s, c) => s + c.contribution, 0) - r.baseScore) < 0.1),
  'คะแนนตั้งต้น = ผลรวม (คะแนนองค์ประกอบ × น้ำหนักหลังกระจายใหม่) — อธิบายได้ทุกขั้น',
);
check(results.every(([, r]) => Math.abs(Math.max(0, r.baseScore - r.riskPenalty) - r.score) < 0.11), 'คะแนนสุดท้าย = คะแนนตั้งต้น − คะแนนที่หักจากสัญญาณความเสี่ยง');
check(
  results.every(([, r]) => r.riskPenalty === -r.riskFactors.reduce((s, f) => s + f.impact, 0)),
  'คะแนนที่หักเท่ากับผลรวมของปัจจัยความเสี่ยงที่แสดง',
);
check(
  results.every(([, r]) => Math.abs(r.components.filter((c) => c.available).reduce((s, c) => s + c.effectiveWeight, 0) - 100) < 0.2),
  'น้ำหนักหลังกระจายใหม่ขององค์ประกอบที่มีข้อมูลรวมเป็น 100',
);
check(results.every(([, r]) => r.components.every((c) => c.factors.length > 0 || !c.available)), 'ทุกองค์ประกอบที่มีข้อมูลมีรายการปัจจัยอธิบาย');
check(JSON.stringify(assessTrust(input('M-001'))) === JSON.stringify(assessTrust(input('M-001'))), 'Input เดิม → ผลเดิม (Deterministic)');

describe('Missing Data ≠ 0 และ Insufficient Data (D6)');
const none = assessTrust(input('M-010')); // ไม่มีการเชื่อมต่อ Marketplace
const missing = none.components.filter((c) => ['C2', 'C3', 'C4'].includes(c.id));
check(missing.every((c) => !c.available && c.score === null && c.contribution === 0 && c.effectiveWeight === 0), 'ร้านที่ไม่มีข้อมูล Marketplace: C2–C4 = ไม่มีข้อมูล (null) ไม่ใช่ 0');
const c1 = none.components.find((c) => c.id === 'C1')!;
const c5 = none.components.find((c) => c.id === 'C5')!;
const ifZero = (c1.score! * 25 + c5.score! * 20) / 100;
check(none.baseScore > ifZero + 1, `คะแนนไม่ถูกดึงลงเพราะข้อมูลขาด (ได้ ${none.baseScore} แทน ${ifZero.toFixed(1)} หากนับเป็น 0)`);
check(none.band === 'insufficient' && none.insufficientReasons.length > 0, 'ไม่มีข้อมูล Marketplace → Insufficient Data');
check(none.publicSummary.some((x) => x.includes('ไม่ได้หมายความว่าร้านมีปัญหา')), '  สรุปสาธารณะบอกว่าไม่ใช่ผลลบ');
const fresh = assessTrust(input('M-002')); // new_shop
check(fresh.band === 'insufficient' && fresh.recommendation.kind === 'need_more_data', `ร้านเปิดใหม่ (ข้อมูลน้อย) → Insufficient Data ไม่ใช่ Band D (คะแนนภายใน ${fresh.score})`);

describe('Data Coverage แยกจาก Data Confidence (D7)');
const m1 = input('M-001');
const stale = withDates(m1);
stale.marketplace = m1.marketplace.map((x) => ({ ...x, connection: { ...x.connection, lastSyncAt: '2026-05-01T00:00:00.000Z' } }));
const rFresh = assessTrust(m1);
const rStale = assessTrust(stale);
check(rStale.coverage.percent === rFresh.coverage.percent && rStale.confidence.score < rFresh.confidence.score, `ข้อมูลเก่า (ซิงก์นาน): Coverage เท่าเดิม ${rFresh.coverage.percent}% แต่ Confidence ลดลง ${rFresh.confidence.score} → ${rStale.confidence.score}`);
check(rStale.confidence.reasons.some((x) => x.includes('ซิงก์ล่าสุดนานกว่า')), '  Confidence ระบุเหตุผลเรื่องความใหม่ของข้อมูล');
const single = withDates(m1);
single.marketplace = m1.marketplace.slice(0, 1);
const rSingle = assessTrust(single);
check(rSingle.coverage.percent < rFresh.coverage.percent && rSingle.confidence.score < rFresh.confidence.score, 'ยกเลิก 1 แพลตฟอร์ม: Coverage และ Confidence ไม่เพิ่มขึ้น');
const burst = assessTrust(input('M-003'));
check(burst.confidence.reasons.some((x) => x.includes('รีวิวกระจุกตัว')) && burst.band !== 'A', `รีวิวกระจุกตัว: ลด Confidence (${burst.confidence.level}) และ Band ไม่เป็น A (ได้ ${burst.band})`);
check(['high', 'medium', 'low'].includes(rFresh.confidence.level) && rFresh.coverage.items.length === 6, 'มีรายการ Coverage 6 มิติ และระดับ Confidence สูง/กลาง/ต่ำ');

describe('Standing แยกจาก Band (D8)');
const revoked = assessTrust(input('M-008'));
check(revoked.standing === 'revoked' && revoked.band !== 'D' && revoked.band !== 'insufficient', `ร้านถูกเพิกถอน: Standing = Revoked แต่ Band ไม่ถูกบังคับเป็น D (ได้ ${revoked.band})`);
check(revoked.recommendation.kind === 'blocked', '  ข้อเสนอ = ไม่สามารถพิจารณา Badge');
const revokedHigh = withDates(m1);
revokedHigh.cert = { ...revokedHigh.cert!, status: 'revoked' };
const rr = assessTrust(revokedHigh);
check(rr.standing === 'revoked' && rr.recommendation.kind === 'blocked' && ['A', 'B'].includes(rr.band), `Band สูง (${rr.band}) แต่ถูกเพิกถอน → ใช้/ขอ Badge ไม่ได้`);
check(assessTrust(input('M-004')).standing === 'suspended' && assessTrust(input('M-009')).standing === 'under_review', 'ถูกระงับ → Suspended · มีเรื่องพิจารณาความเสี่ยงเปิด → Under Review');

describe('ทิศทางของผล (Monotonic)');
const esc = withDates(input('M-005'));
const base5 = assessTrust(esc);
esc.complaints = [...esc.complaints, { ...clone(esc.complaints[0]), id: 'CMP-T1', merchantId: 'M-005', status: 'escalated', createdAt: '2026-10-10T00:00:00.000Z' }];
check(assessTrust(esc).score <= base5.score, 'เพิ่มข้อร้องเรียนที่ส่งต่อ → คะแนนไม่เพิ่ม');
const trn = withDates(input('M-005'));
trn.enrollments = [...trn.enrollments, { ...clone(trn.enrollments[0]), id: 'ENR-T1', operatorId: 'OP-005', courseId: 'CRS-T', passed: true }];
check(assessTrust(trn).score >= base5.score, 'ผ่านการอบรมเพิ่ม → คะแนนไม่ลด');

describe('Configuration (D5)');
check(validateWeights(MODEL_V2.weights) === undefined, 'น้ำหนักเริ่มต้น 25/25/20/10/20 ผ่านการตรวจ');
check(!!validateWeights({ C1: 30, C2: 25, C3: 20, C4: 10, C5: 20 }) && !!validateWeights({ C1: -5, C2: 35, C3: 20, C4: 30, C5: 20 }) && !!validateWeights({ C1: 25.5, C2: 24.5, C3: 20, C4: 10, C5: 20 }), 'ผลรวม ≠ 100 / ติดลบ / ไม่เป็นจำนวนเต็ม → ไม่ผ่าน');
const onlyC1 = assessTrust(m1, modelWith({ C1: 100, C2: 0, C3: 0, C4: 0, C5: 0 }));
check(Math.abs(onlyC1.baseScore - onlyC1.components[0].score!) < 0.1 && onlyC1.weights.C1 === 100, 'ปรับน้ำหนัก → ผลเปลี่ยนตาม และบันทึกน้ำหนักที่ใช้ไว้ในผลประเมิน');

describe('การเปิดเผยข้อมูล (D2)');
const leaks = results.flatMap(([, r]: readonly [string, Result]) => r.publicSummary.filter((x) => x.includes(String(r.score)) || /คะแนน\s*\d|คำสั่งซื้อ|ยอดขาย|ควรตรวจสอบ|ราคาต่ำ|รีวิวกระจุก/.test(x)));
check(leaks.length === 0, `สรุปสาธารณะไม่มีคะแนนตัวเลข ยอดขาย หรือสัญญาณที่ยังไม่มีข้อสรุป${leaks.length ? ' — ' + leaks[0] : ''}`);

describe('ข้อเสนอประกอบการพิจารณา (D3)');
check(assessTrust(input('M-006')).recommendation.kind === 'consider_l3', 'ร้าน Level 2 ผลดี → ประกอบการพิจารณา Level 3');
check(assessTrust(input('M-001')).recommendation.kind === 'consider_l4', 'ร้าน Level 3 Band A ความเชื่อมั่นสูง → ประกอบการพิจารณา Level 4');
check(results.every(([, r]) => !['consider_l3', 'consider_l4'].includes(r.recommendation.kind) || r.standing === 'normal'), 'ไม่เสนอยกระดับร้านที่สถานะการรับรองไม่ปกติ');

finish();
