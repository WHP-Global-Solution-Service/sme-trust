/**
 * P7-B — Trust Assessment Model Validation
 * ร้านค้าจำลอง 12 ประเภท + กรณีตรวจความเป็นธรรม — ใช้ Engine จริง (assessTrust) และ Generator จริง
 * ทุกข้อเป็นข้อกำหนดของโมเดล ไม่ใช่ค่าที่บันทึกจากผลลัพธ์ปัจจุบัน
 * VALIDATION_TABLE=1 → พิมพ์ตาราง Markdown สำหรับ docs/assessment-validation.md
 */
import { S, check, describe, finish } from '../harness.mts';

const { assessTrust } = await import('@/features/trust-assessment/engine');
const { MODEL_V2 } = await import('@/features/trust-assessment/model');
const { buildAssessmentInput } = await import('@/features/trust-assessment/inputs');
const { generateSnapshot } = await import('@/features/marketplace/services/generator');
const { hashString } = await import('@/features/marketplace/services/prng');
const { productRef } = await import('@/features/marketplace/data/catalog');
const { BAND_LABEL, CONFIDENCE_LABEL, RECOMMENDATION_LABEL } = await import('@/features/trust-assessment/labels');
type Input = import('@/features/trust-assessment/types').AssessmentInput;
type Result = import('@/features/trust-assessment/types').AssessmentResult;
type Snap = import('@/features/marketplace/types').MarketplaceSnapshot;
type Conn = import('@/features/marketplace/types').MarketplaceConnection;
type Archetype = import('@/features/marketplace/types').Archetype;
type Platform = import('@/features/marketplace/types').Platform;

const ASOF = new Date('2026-10-21T09:00:00+07:00');
const DAY = 86_400_000;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const bundle = () => ({
  operators: S.useOperatorStore.getState().items,
  merchants: S.useMerchantStore.getState().items,
  certifications: S.useCertificationStore.getState().items,
  complaints: S.useComplaintStore.getState().items,
  warnings: S.useWarningStore.getState().items,
  risks: S.useRiskStore.getState().items,
  enrollments: S.useTrainingStore.getState().items,
  connections: [],
});

// ร้านฐาน: M-005 (ยืนยันตัวตน อนุมัติแล้ว ใบรับรอง Level 3 ไม่มีข้อร้องเรียนค้าง) — เปลี่ยนเฉพาะข้อมูลที่โปรไฟล์ต้องการ
const baseInput = (): Input => ({ ...clone(buildAssessmentInput('M-005', bundle(), ASOF)!), asOf: ASOF, marketplace: [] });

const snap = (key: string, archetype: Archetype, category: string, platform: Platform = 'shopee'): Snap =>
  generateSnapshot({ id: `VAL-${key}-${platform}`, platform, archetype, seed: hashString(`validation:${key}:${platform}`) }, category);

const conn = (s: Snap, syncDaysAgo = 5): Conn => ({
  id: s.connectionId,
  merchantId: 'M-005',
  platform: s.platform,
  mockShopId: 'VAL',
  mockShopName: 'ร้านทดสอบ',
  status: 'connected',
  scopes: [],
  archetype: 'established_good',
  seed: 0,
  createdAt: ASOF.toISOString(),
  lastSyncAt: new Date(ASOF.getTime() - syncDaysAgo * DAY).toISOString(),
});

const withMarket = (i: Input, snaps: Snap[], syncDaysAgo = 5): Input => ({ ...i, marketplace: snaps.map((s) => ({ connection: conn(s, syncDaysAgo), snapshot: s })) });

/** ปรับปริมาณข้อมูลทั้งชุดให้สอดคล้องกัน (คำสั่งซื้อ รีวิว ยอดขายต่อรายการ) */
function scale(s: Snap, orders: number, reviews?: number): Snap {
  const total = s.monthlyOrders.reduce((a, b) => a + b, 0) || 1;
  const f = orders / total;
  const monthlyOrders = s.monthlyOrders.map((m) => (m ? Math.max(1, Math.round(m * f)) : 0));
  const rTotal = reviews ?? Math.round(s.totalReviews * f);
  const rf = s.totalReviews ? rTotal / s.totalReviews : 0;
  const ratingHistogram = s.ratingHistogram.map((n) => Math.round(n * rf)) as Snap['ratingHistogram'];
  ratingHistogram[4] += rTotal - ratingHistogram.reduce((a, b) => a + b, 0);
  return {
    ...s,
    monthlyOrders,
    ratingHistogram,
    totalReviews: rTotal,
    reviews: s.reviews.slice(0, Math.min(30, rTotal)),
    listings: s.listings.map((l) => ({ ...l, unitsSold12m: Math.round(l.unitsSold12m * f), reviewCount: Math.round(l.reviewCount * rf) })),
  };
}
const priced = (s: Snap, factor: number): Snap => ({
  ...s,
  listings: s.listings.map((l) => {
    const price = Math.max(9, Math.round((productRef(l.productKey)?.median ?? l.price) * factor));
    return { ...l, price, priceHistory: l.priceHistory.map(() => price) };
  }),
});
/** กำหนดคะแนนรีวิวทั้งชุด (ตัวอย่างรีวิวและ Histogram) */
function rated(s: Snap, stars: 5 | 4 | 3): Snap {
  const n = s.totalReviews;
  const h: Snap['ratingHistogram'] = stars === 5 ? [0, 0, 0, Math.round(n * 0.1), n - Math.round(n * 0.1)] : stars === 4 ? [Math.round(n * 0.04), Math.round(n * 0.06), Math.round(n * 0.12), Math.round(n * 0.38), 0] : [Math.round(n * 0.12), Math.round(n * 0.15), Math.round(n * 0.33), Math.round(n * 0.25), 0];
  h[4] = n - (h[0] + h[1] + h[2] + h[3]);
  const sample = s.reviews.map((r, i) => ({ ...r, rating: (stars === 5 ? 5 : stars === 4 ? (i % 5 === 0 ? 3 : i % 3 === 0 ? 5 : 4) : i % 3 === 0 ? 2 : i % 2 === 0 ? 4 : 3) as 1 | 2 | 3 | 4 | 5, text: 'รีวิวทดสอบ' }));
  return { ...s, ratingHistogram: h, reviews: sample, listings: s.listings.map((l) => ({ ...l, avgRating: stars === 5 ? 4.9 : stars === 4 ? 4.0 : 3.3 })) };
}

const ofComponent = (r: Result, id: string) => r.components.find((c) => c.id === id)!;
const factor = (r: Result, id: string) => [...r.components.flatMap((c) => c.factors), ...r.riskFactors].find((f) => f.id === id);
const orders = (i: Input) => i.marketplace.reduce((s, x) => s + x.snapshot.monthlyOrders.reduce((a, b) => a + b, 0), 0);
const reviewsOf = (i: Input) => i.marketplace.reduce((s, x) => s + x.snapshot.totalReviews, 0);
const priceRange = (i: Input) => {
  const ratios = i.marketplace.flatMap((x) => x.snapshot.listings.map((l) => l.price / (productRef(l.productKey)?.median ?? l.price)));
  if (!ratios.length) return '—';
  const lo = Math.min(...ratios), hi = Math.max(...ratios);
  return `${Math.round(lo * 100)}–${Math.round(hi * 100)}% ของราคากลาง`;
};

const BEAUTY = 'ความงามและสุขภาพ';
const FOOD = 'อาหารและเครื่องดื่ม';
const HOME = 'ของใช้ในบ้าน';
const ELEC = 'อิเล็กทรอนิกส์และแกดเจ็ต';

// ================================================================ โปรไฟล์ 12 ประเภท
interface Profile {
  no: number;
  name: string;
  category: string;
  input: Input;
  cert: string;
  expected: string;
  verify: (r: Result) => boolean;
}

const unverified = (i: Input): Input => ({
  ...i,
  operator: i.operator ? { ...i.operator, kycStatus: 'not_started' as any } : i.operator,
  merchant: { ...i.merchant, registrationStatus: 'submitted' as any, channels: i.merchant.channels.map((c) => ({ ...c, status: 'pending' as any })) },
  cert: undefined,
  currentLevel: 0 as any,
});
const level2 = (i: Input): Input => ({ ...i, cert: i.cert ? { ...i.cert, level: 2 as any } : i.cert, currentLevel: 2 as any });

const big = snap('big', 'established_good', FOOD);
const big2 = snap('big', 'established_good', FOOD, 'lazada');
const newNoReviews: Snap = (() => {
  const s = snap('new', 'new_shop', FOOD);
  return { ...s, ratingHistogram: [0, 0, 0, 0, 0], totalReviews: 0, reviews: [], listings: s.listings.map((l) => ({ ...l, reviewCount: 0, avgRating: 0 })) };
})();
const small = rated(scale(snap('small', 'growing_ok', FOOD), 45, 14), 5);
const largeGood = rated(scale(big, 2400, 840), 5);
const largeGood2 = rated(scale(big2, 1800, 600), 5);
const cheapPopular = priced(scale(snap('cheap', 'established_good', BEAUTY), 2600, 900), 0.42);
const premium = priced(rated(scale(snap('premium', 'established_good', HOME), 72, 24), 5), 2.4);
const burstShop = snap('burst', 'review_burst', BEAUTY);
const midRating = rated(scale(snap('mid', 'growing_ok', FOOD), 400, 120), 4);
const highReturn: Snap = { ...rated(scale(snap('return', 'established_good', FOOD), 1500, 450), 5), returnRate: 0.12 };
const conflictA = rated(scale(snap('conflict', 'established_good', FOOD), 900, 300), 5);
const conflictB = rated(scale(snap('conflict', 'established_good', FOOD, 'lazada'), 700, 220), 3);

const base = baseInput();
const resolvedComplaints = (n: number) =>
  S.useComplaintStore.getState().items.slice(0, n).map((c, k) => ({ ...clone(c), id: `VAL-CMP-${k}`, merchantId: 'M-005', status: 'resolved' as const, createdAt: new Date(ASOF.getTime() - 40 * DAY).toISOString() }));

const profiles: Profile[] = [
  { no: 1, name: 'ร้านใหม่ ไม่มีรีวิว (ยังไม่ยืนยันตัวตน)', category: FOOD, input: unverified(withMarket(base, [newNoReviews])), cert: 'ยังไม่มี', expected: 'Insufficient Data · C3 ไม่มีข้อมูล (ไม่ใช่ 0) · ไม่ใช่ Band D', verify: (r) => r.band === 'insufficient' && ofComponent(r, 'C3').score === null && r.recommendation.kind === 'need_more_data' },
  { no: 2, name: 'ร้านใหม่ ยืนยันตัวตนแล้ว (Level 2)', category: FOOD, input: level2(withMarket(base, [newNoReviews])), cert: 'Level 2 ใช้งานได้', expected: 'Insufficient Data · C1 สูงกว่าโปรไฟล์ 1 · ขอข้อมูลเพิ่ม (ไม่ปฏิเสธ)', verify: (r) => r.band === 'insufficient' && r.recommendation.kind === 'need_more_data' && r.publicSummary.some((x) => x.includes('ยืนยันตัวตนแล้ว')) },
  { no: 3, name: 'ร้านเล็ก ยอดขายน้อย รีวิวดี', category: FOOD, input: level2(withMarket(base, [small])), cert: 'Level 2 ใช้งานได้', expected: 'มี Band (ไม่ถูกลงโทษเพราะร้านเล็ก) · Confidence ต่ำกว่าร้านใหญ่ · ไม่ได้ Band A จากข้อมูลน้อย', verify: (r) => r.band !== 'insufficient' && r.band !== 'A' && r.band !== 'D' },
  { no: 4, name: 'ร้านใหญ่ ยอดขายสูง รีวิวดี (2 แพลตฟอร์ม)', category: FOOD, input: withMarket(base, [largeGood, largeGood2]), cert: 'Level 3 ใช้งานได้', expected: 'Band A · Confidence สูง · ประกอบการพิจารณา Level 4 (เจ้าหน้าที่ตัดสิน)', verify: (r) => r.band === 'A' && r.confidence.level === 'high' && r.recommendation.kind === 'consider_l4' },
  { no: 5, name: 'ร้านราคาต่ำ ยอดขายสูง', category: BEAUTY, input: withMarket(base, [cheapPopular]), cert: 'Level 3 ใช้งานได้', expected: 'ราคาต่ำมีหลักฐานสนับสนุน → ข้อสังเกตเท่านั้น ไม่หักคะแนน', verify: (r) => !factor(r, 'risk.price') && r.analysis.price.findings.some((f) => f.kind === 'below_reference' && f.level === 'info') },
  { no: 6, name: 'ร้านราคาสูง ยอดขายน้อย', category: HOME, input: withMarket(base, [premium]), cert: 'Level 3 ใช้งานได้', expected: 'ราคาสูงไม่หักคะแนน (C4 = 100) · มี Band', verify: (r) => ofComponent(r, 'C4').score === 100 && r.analysis.price.findings.some((f) => f.kind === 'above_reference') && r.band !== 'insufficient' },
  { no: 7, name: 'ร้านดาวสูง แต่รีวิวผิดธรรมชาติ', category: BEAUTY, input: withMarket(base, [burstShop]), cert: 'Level 3 ใช้งานได้', expected: 'สัญญาณรีวิวกระจุกตัว · หักคะแนน · Confidence ลด · ไม่ใช่ Band A', verify: (r) => !!factor(r, 'risk.review-burst') && r.band !== 'A' && r.confidence.reasons.some((x) => x.includes('รีวิวกระจุกตัว')) },
  { no: 8, name: 'ร้านดาวปานกลาง แต่แก้ไขข้อร้องเรียนดี', category: FOOD, input: { ...withMarket(base, [midRating]), complaints: [...base.complaints, ...resolvedComplaints(4)] }, cert: 'Level 3 ใช้งานได้', expected: 'C5 ได้คะแนนเพิ่มจากการแก้ไขข้อร้องเรียน · มี Band', verify: (r) => (factor(r, 'c5.resolved')?.impact ?? 0) > 0 && r.band !== 'insufficient' && r.band !== 'D' },
  { no: 9, name: 'ร้านอัตราคืนสินค้าสูง (12%)', category: FOOD, input: withMarket(base, [highReturn]), cert: 'Level 3 ใช้งานได้', expected: 'C2 ถูกหักจากอัตราคืนสินค้า · มีสัญญาณ "ควรตรวจสอบ" · ไม่ใช่ Band A แม้ด้านอื่นดีมาก', verify: (r) => (factor(r, 'c2.return')?.impact ?? 0) < 0 && !!factor(r, 'risk.high-return') && r.band !== 'A' },
  { no: 10, name: 'ร้านที่ข้อมูล Marketplace หมดอายุ (120 วัน)', category: FOOD, input: withMarket(base, [largeGood, largeGood2], 120), cert: 'Level 3 ใช้งานได้', expected: 'Coverage เท่าเดิม แต่ Confidence ลด · ไม่ใช่ Band A', verify: (r) => r.confidence.reasons.some((x) => x.includes('ซิงก์ล่าสุดนานกว่า 90')) && r.band !== 'A' },
  { no: 11, name: 'ร้านที่ข้อมูลสองแพลตฟอร์มขัดแย้งกัน', category: FOOD, input: withMarket(base, [conflictA, conflictB]), cert: 'Level 3 ใช้งานได้', expected: 'Confidence ลดจากคะแนนรีวิวต่างกันระหว่างแพลตฟอร์ม · ไม่ใช่ Band A', verify: (r) => r.confidence.reasons.some((x) => x.includes('ต่างกันระหว่างแพลตฟอร์ม')) && r.band !== 'A' },
  { no: 12, name: 'ร้านที่ถูกระงับ / เพิกถอนการรับรอง', category: FOOD, input: { ...withMarket(base, [largeGood, largeGood2]), cert: { ...base.cert!, status: 'suspended' } }, cert: 'ระงับชั่วคราว', expected: 'Standing = Suspended แยกจาก Band (Band ไม่ถูกบังคับเป็น D) · ขอ Badge ไม่ได้', verify: (r) => r.standing === 'suspended' && r.band === 'A' && r.recommendation.kind === 'blocked' },
];

const results = profiles.map((p) => ({ p, r: assessTrust(p.input, MODEL_V2) }));
const R = (no: number) => results.find((x) => x.p.no === no)!.r;

describe('โปรไฟล์ร้านค้าจำลอง 12 ประเภท — ผลตรงตามที่คาด');
for (const { p, r } of results) check(p.verify(r), `${p.no}. ${p.name} → ${BAND_LABEL[r.band].label} · Coverage ${r.coverage.percent}% · Confidence ${r.confidence.score} (${CONFIDENCE_LABEL[r.confidence.level].label}) · ${RECOMMENDATION_LABEL[r.recommendation.kind].label}`);

describe('ความเป็นธรรมของโมเดล');
// Missing Data ≠ 0
const r1 = R(1);
check(['C2', 'C3', 'C4'].filter((id) => ofComponent(r1, id).available === false).every((id) => ofComponent(r1, id).score === null), 'ข้อมูลที่ไม่มี = ไม่นับ (null) ไม่ใช่ 0');
const noMkt = assessTrust({ ...base, marketplace: [] }, MODEL_V2);
check(noMkt.band === 'insufficient' && noMkt.recommendation.kind !== 'blocked' && noMkt.recommendation.kind !== 'refer_risk', 'ร้านไม่มี Marketplace → Insufficient Data และขอข้อมูลเพิ่ม (ไม่ถูกปฏิเสธหรือส่งเรื่องความเสี่ยง)');
check(noMkt.riskFactors.length === 0, '  ร้านไม่มี Marketplace ไม่มีสัญญาณความเสี่ยงจากการขาดข้อมูล (Missing Data ≠ ความเสี่ยงสูง)');
check(ofComponent(R(2), 'C1').score! > ofComponent(R(1), 'C1').score!, 'ยืนยันตัวตนแล้วได้ C1 สูงกว่าร้านที่ยังไม่ยืนยัน (ข้อมูลอื่นเท่ากัน)');

// ข้อมูลน้อยไม่ได้ Band สูงผิดปกติ (การกระจายน้ำหนัก)
const minimal = rated(scale(snap('minimal', 'growing_ok', FOOD), MODEL_V2.minimums.orders + 1, MODEL_V2.minimums.reviews), 5);
const rMin = assessTrust(withMarket(base, [minimal]), MODEL_V2);
check(rMin.band !== 'A', `ร้านที่มีข้อมูลเพียงขั้นต่ำ (คำสั่งซื้อ ${MODEL_V2.minimums.orders + 1} รีวิว ${MODEL_V2.minimums.reviews}) ไม่ได้ Band A แม้คะแนนจะสูง (ได้ ${BAND_LABEL[rMin.band].label}, คะแนน ${rMin.score}, Coverage ${rMin.coverage.percent}%)`);
check((rMin.bandCapReasons ?? []).length > 0, `  อธิบายเหตุผลที่จำกัดไว้ที่ B: ${(rMin.bandCapReasons ?? []).join(' · ')}`);
check(rMin.confidence.score < R(4).confidence.score, `  Confidence ของร้านข้อมูลน้อย (${rMin.confidence.score}) ต่ำกว่าร้านข้อมูลครบ (${R(4).confidence.score})`);
check(R(3).band !== 'A' && R(3).confidence.score < R(4).confidence.score, 'ร้านเล็ก: ไม่ได้ Band A จากข้อมูลน้อย และ Confidence ต่ำกว่าร้านใหญ่');

// Coverage ≠ Confidence
const fresh = R(4), stale = R(10);
check(fresh.coverage.percent === stale.coverage.percent && stale.confidence.score < fresh.confidence.score, `Coverage กับ Confidence ต่างกัน: ข้อมูลเก่า Coverage เท่าเดิม (${stale.coverage.percent}%) แต่ Confidence ลด ${fresh.confidence.score} → ${stale.confidence.score}`);
const age = (days: number) => assessTrust(withMarket(base, [largeGood, largeGood2], days), MODEL_V2).confidence.score;
const [a5, a45, a120] = [age(5), age(45), age(120)];
check(a5 > a45 && a45 > a120, `Confidence ลดตามอายุข้อมูล: 5 วัน ${a5} → 45 วัน ${a45} → 120 วัน ${a120}`);
check(age(30) === a5 && age(31) < a5 && age(90) === a45 && age(91) === a120, '  ขอบเขตตามกฎ: ≤30 วันไม่หัก · 31–90 วันหักบางส่วน · >90 วันหักเต็ม');

// รีวิวน้อยไม่แน่นอนกว่ารีวิวมาก
const fewReviews = rated(scale(snap('rev', 'established_good', FOOD), 1500, 15), 5);
const manyReviews = rated(scale(snap('rev', 'established_good', FOOD), 1500, 500), 5);
const cFew = assessTrust(withMarket(base, [fewReviews]), MODEL_V2);
const cMany = assessTrust(withMarket(base, [manyReviews]), MODEL_V2);
check(cFew.confidence.score < cMany.confidence.score, `รีวิว 15 รายการมีความไม่แน่นอนมากกว่า 500 รายการ (Confidence ${cFew.confidence.score} < ${cMany.confidence.score}) แม้คะแนนดาวเท่ากัน`);
check(cFew.confidence.reasons.some((x) => x.includes('รีวิว')), '  เหตุผลของ Confidence ระบุเรื่องจำนวนรีวิว');

// ดาวสูงไม่ลบล้างสัญญาณความเสี่ยง
const burstFiveStar = rated(burstShop, 5);
const rb = assessTrust(withMarket(base, [{ ...burstFiveStar, reviews: burstShop.reviews }]), MODEL_V2);
check(!!factor(rb, 'risk.review-burst') && rb.band !== 'A', 'คะแนนดาว 5 ทั้งชุดไม่ลบล้างสัญญาณรีวิวกระจุกตัว (ยังหักคะแนนและไม่ได้ Band A)');

// ราคา: สูงไม่ถูกหัก ต่ำไม่เท่ากับทุจริต และหมวดสินค้ามีผล
check(!factor(R(6), 'risk.price') && (factor(R(6), 'c4.watch')?.impact ?? 0) === 0, 'ราคาสูงกว่าช่วงอ้างอิง 2.4 เท่าไม่ถูกหักคะแนน');
const lowHome = assessTrust(withMarket(base, [priced(scale(snap('lowhome', 'growing_ok', HOME), 60, 15), 0.4)]), MODEL_V2);
const lowElec = assessTrust(withMarket(base, [priced(scale(snap('lowelec', 'growing_ok', ELEC), 60, 15), 0.4)]), MODEL_V2);
check(!factor(lowHome, 'risk.price') && lowHome.analysis.price.findings.some((f) => f.kind === 'below_reference' && f.level === 'info'), 'ราคา 40% ของราคากลางในสินค้าความเสี่ยงต่ำ (ของใช้ในบ้าน) = ข้อสังเกตเท่านั้น');
check(!!factor(lowElec, 'risk.price'), 'ราคา 40% ในสินค้าความเสี่ยงสูง (อิเล็กทรอนิกส์) ที่ไม่มีหลักฐานสนับสนุน = ควรตรวจสอบเพิ่มเติม');
check([...lowElec.riskFactors].every((f) => f.label.includes('ควรตรวจสอบ') || f.label.includes('ข้อร้องเรียน') || f.label.includes('สัญญาณ')), '  ถ้อยคำเป็น "ควรตรวจสอบ" ไม่ใช่ข้อสรุปว่าทุจริต');
check(lowElec.recommendation.kind !== 'blocked', '  ราคาต่ำอย่างเดียวไม่ทำให้ขอ Badge ไม่ได้ (เจ้าหน้าที่พิจารณา)');

// ปริมาณคำสั่งซื้อไม่เป็นรางวัลร้านใหญ่
const sameRate = (orders: number) => assessTrust(withMarket(base, [rated(scale(snap('vol', 'established_good', FOOD), orders, Math.round(orders * 0.3)), 5)]), MODEL_V2);
const vSmall = sameRate(400), vBig = sameRate(4000);
check(ofComponent(vSmall, 'C2').score === ofComponent(vBig, 'C2').score, `C2 ไม่ขึ้นกับจำนวนคำสั่งซื้อ: 400 รายการ = ${ofComponent(vSmall, 'C2').score} · 4,000 รายการ = ${ofComponent(vBig, 'C2').score}`);
check(Math.abs(vSmall.score - vBig.score) < 1, `  คะแนนรวมเท่ากันเมื่อคุณภาพการขายเท่ากัน (${vSmall.score} vs ${vBig.score})`);

// คืนสินค้าสูง
const normalReturn = assessTrust(withMarket(base, [{ ...highReturn, returnRate: 0.01 }]), MODEL_V2);
check(R(9).score < normalReturn.score, `อัตราคืนสินค้า 12% ทำให้คะแนนต่ำกว่าร้านเดียวกันที่คืน 1% (${R(9).score} < ${normalReturn.score})`);

// แก้ไขข้อร้องเรียนดี
const midNoResolve = assessTrust(withMarket(base, [midRating]), MODEL_V2);
check(R(8).score > midNoResolve.score, `การแก้ไขข้อร้องเรียนสำเร็จทำให้คะแนนสูงขึ้น (${midNoResolve.score} → ${R(8).score})`);

// Standing แยกจาก Band
const revoked = assessTrust({ ...withMarket(base, [largeGood, largeGood2]), cert: { ...base.cert!, status: 'revoked' } }, MODEL_V2);
check(revoked.standing === 'revoked' && revoked.band === R(4).band, `เพิกถอน: Standing = Revoked โดย Band เท่ากับร้านเดียวกันที่สถานะปกติ (${R(4).band}) — ไม่ถูกบังคับเป็น D`);
check(revoked.baseScore - ofComponent(revoked, 'C1').contribution === R(4).baseScore - ofComponent(R(4), 'C1').contribution, '  สถานะใบรับรองมีผลเฉพาะปัจจัย "ใบรับรองปัจจุบัน" ใน C1 ไม่กระทบองค์ประกอบอื่น');
check(revoked.recommendation.kind === 'blocked' && R(12).recommendation.kind === 'blocked', '  ระงับ/เพิกถอน → ขอ Badge ไม่ได้');

// Officer ตัดสินเสมอ — ไม่มีผลใดออก Badge อัตโนมัติ
check(results.every(({ r }) => !('badge' in r) && !('certId' in r)), 'ผลประเมินไม่มีการออก Badge/ใบรับรอง — เป็นข้อเสนอให้เจ้าหน้าที่เท่านั้น');
check(results.every(({ r }) => r.recommendation.reasons.length > 0), 'ทุกข้อเสนอมีเหตุผลประกอบ');

describe('คำอธิบายผลประเมิน (Explainability) ครบทุกโปรไฟล์');
for (const { p, r } of results) {
  const explained =
    r.components.every((c) => !c.available || c.factors.length > 0) && // ใช้ข้อมูลอะไร
    r.components.every((c) => c.factors.every((f) => !!f.source)) && // มาจากแหล่งใด
    Math.abs(r.components.reduce((s, c) => s + c.weight, 0) - 100) < 0.01 && // น้ำหนัก
    r.riskFactors.every((f) => f.label.length > 0 && f.impact < 0) && // ความเสี่ยง
    (r.band !== 'insufficient' || r.insufficientReasons.length > 0) && // ข้อมูลใดไม่พอ
    r.confidence.reasons.length > 0 && // Confidence ลดเพราะอะไร
    r.recommendation.reasons.length > 0; // ทำไมขอ/ไม่ขอ Badge ได้
  check(explained, `${p.no}. อธิบายได้: ข้อมูล แหล่งที่มา น้ำหนัก ความเสี่ยง ข้อมูลที่ขาด เหตุผล Confidence และเหตุผลของข้อเสนอ`);
}

check(R(11).bandCapReasons?.some((x) => x.includes('ขัดแย้ง')) === true, 'ข้อมูลสองแพลตฟอร์มขัดแย้งกัน: เหตุผลของ Band ระบุความขัดแย้ง');

describe('มุมมองผู้บริโภคไม่มีข้อมูลภายใน');
check(results.every(({ r }) => r.publicSummary.every((x) => !/\d+(\.\d+)?\s*คะแนน|คะแนนภายใน|score/i.test(x))), 'สรุปสาธารณะไม่มีคะแนน 0–100');
check(results.every(({ r }) => r.publicSummary.every((x) => !x.includes('ควรตรวจสอบ') && !x.includes('รีวิวกระจุก'))), 'สรุปสาธารณะไม่มีสัญญาณที่ยังไม่มีข้อสรุป');
check(results.every(({ r }) => !r.publicSummary.some((x) => x.includes('สคบ.') && x.includes('อย่างเป็นทางการ'))), 'ไม่อ้างว่าเป็นผลประเมินอย่างเป็นทางการของ สคบ.');

// ---------------------------------------------------------------- ตาราง Markdown
if (process.env.VALIDATION_TABLE) {
  const rows = results.map(({ p, r }) => {
    const risks = r.riskFactors.length ? r.riskFactors.map((f) => f.label.split(' — ')[0]).join('; ') : 'ไม่พบ';
    return `| ${p.no} | ${p.name} | ${p.category} | ${priceRange(p.input)} | ${orders(p.input).toLocaleString('en-US')} | ${reviewsOf(p.input).toLocaleString('en-US')} | ${r.coverage.percent}% | ${r.confidence.score} (${CONFIDENCE_LABEL[r.confidence.level].label}) | ${BAND_LABEL[r.band].label} | ${risks} | ${p.cert} | ${p.expected} | ${RECOMMENDATION_LABEL[r.recommendation.kind].label}; Standing ${r.standing}; คะแนนภายใน ${r.score} | ${p.verify(r) ? 'Pass' : 'Fail'} |`;
  });
  console.log(['| # | Merchant Profile | Product Category | Price Range | Order Volume | Review Volume | Coverage | Confidence | Trust Band | Risk Signals | Certification Status | Expected Result | Actual Result | Pass/Fail |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n'));
}

finish();
