/**
 * Risk-Adjusted Trust Assessment Engine (Pure Function — Rule-based Simulation)
 * ไม่ใช่คะแนนเครดิต ไม่ใช่การรับรองทางกฎหมาย ไม่ใช่บัญชีดำ และไม่ใช้ข้อมูลจริงจากแพลตฟอร์มใด
 *
 * ขั้นตอน: องค์ประกอบ C1–C5 → กระจายน้ำหนักใหม่เฉพาะองค์ประกอบที่มีข้อมูล (D6) → หักสัญญาณความเสี่ยง
 *          → Band / Insufficient Data → Coverage และ Confidence (แยกกัน D7) → Standing (แยกจาก Band D8) → ข้อเสนอ
 */
import { analyzePrices } from '@/features/marketplace/analysis/price';
import { analyzeSales } from '@/features/marketplace/analysis/sales';
import { analyzeReviews } from '@/features/marketplace/analysis/reviews';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { COMPONENTS, MODEL_V2, type ComponentId, type Model } from './model';
import type { AssessmentInput, AssessmentResult, Band, ComponentResult, ConfidenceLevel, CoverageItem, Recommendation, Standing, TrustFactor } from './types';

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const DAY = 86_400_000;

const factor = (f: Omit<TrustFactor, 'direction'>): TrustFactor => ({ ...f, direction: f.impact > 0 ? 'positive' : f.impact < 0 ? 'negative' : 'neutral' });

// ---------------------------------------------------------------- C1
function identity(i: AssessmentInput): TrustFactor[] {
  const kyc = i.operator?.kycStatus === 'verified';
  const approved = i.merchant.registrationStatus === 'approved';
  const certPts = i.cert?.status === 'active' ? 20 : i.cert?.status === 'expired' ? 5 : 0;
  const ch = i.merchant.channels;
  const verified = ch.filter((c) => c.status === 'verified').length;
  const chPts = ch.length ? Math.round((verified / ch.length) * 15) : 0;
  return [
    factor({ id: 'c1.kyc', component: 'C1', label: 'ยืนยันตัวตนเจ้าของร้าน (e-KYC จำลอง)', value: kyc ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน', impact: kyc ? 35 : 0, evidence: [], source: 'identity', improve: kyc ? undefined : 'ยืนยันตัวตนที่หน้าหลักผู้ประกอบการ' }),
    factor({ id: 'c1.registration', component: 'C1', label: 'คำขอลงทะเบียนร้านค้า', value: approved ? 'อนุมัติแล้ว' : 'ยังไม่อนุมัติ', impact: approved ? 30 : 0, evidence: [], source: 'identity', improve: approved ? undefined : 'ติดตามคำขอลงทะเบียนร้านค้าให้ได้รับอนุมัติ' }),
    factor({ id: 'c1.cert', component: 'C1', label: 'ใบรับรองปัจจุบัน', value: i.cert ? `${i.cert.id} (${i.cert.status})` : 'ยังไม่มี', impact: certPts, evidence: [], source: 'identity', improve: certPts < 20 ? 'ต่ออายุหรือขอรับรองให้ใบรับรองอยู่ในสถานะใช้งานได้' : undefined }),
    factor({ id: 'c1.channels', component: 'C1', label: 'ช่องทางขายที่ยืนยันความเป็นเจ้าของ', value: `${verified}/${ch.length} ช่องทาง`, impact: chPts, evidence: ch.map((c) => `${c.type}: ${c.handle} (${c.status})`), source: 'identity', improve: chPts < 15 ? 'ส่งช่องทางขายที่เหลือให้เจ้าหน้าที่ตรวจสอบ' : undefined }),
  ];
}

// ---------------------------------------------------------------- C2
function sales(a: AssessmentResult['analysis']['sales']): TrustFactor[] {
  const f: TrustFactor[] = [];
  const pen = (id: string, label: string, value: string, impact: number, improve: string) =>
    f.push(factor({ id, component: 'C2', label, value, impact: -Math.round(impact), evidence: [], source: 'marketplace', improve: impact > 0 ? improve : undefined }));
  f.push(factor({ id: 'c2.base', component: 'C2', label: 'คะแนนตั้งต้นของผลการขาย', value: `${a.totalOrders.toLocaleString('th-TH')} คำสั่งซื้อใน ${a.monthsOfData} เดือน`, impact: 100, evidence: [`คำสั่งซื้อรายเดือน: ${a.monthlyOrders.join(', ')}`], source: 'marketplace' }));
  pen('c2.cancel', 'อัตรายกเลิกคำสั่งซื้อ', pct(a.cancelRate), a.cancelRate > 0.03 ? Math.min(25, (a.cancelRate - 0.03) * 400) : 0, 'ตรวจสต็อกก่อนรับคำสั่งซื้อ และปิดรายการที่สินค้าหมด');
  pen('c2.return', 'อัตราคืนสินค้า', pct(a.returnRate), a.returnRate > 0.03 ? Math.min(25, (a.returnRate - 0.03) * 400) : 0, 'ตรวจคุณภาพและรายละเอียดสินค้าให้ตรงกับประกาศขาย');
  pen('c2.ontime', 'จัดส่งตรงเวลา', pct(a.onTimeShipRate), a.onTimeShipRate < 0.95 ? Math.min(25, (0.95 - a.onTimeShipRate) * 150) : 0, 'กำหนดเวลาเตรียมจัดส่งให้ทำได้จริง และแจ้งเลขพัสดุทุกคำสั่งซื้อ');
  pen('c2.chat', 'อัตราตอบแชต', pct(a.chatResponseRate), a.chatResponseRate < 0.9 ? Math.min(10, (0.9 - a.chatResponseRate) * 50) : 0, 'ตอบข้อความลูกค้าภายใน 24 ชั่วโมง');
  pen('c2.variability', 'ความสม่ำเสมอของยอดขาย', a.variability.toFixed(2), a.variability > 0.6 && !a.spike ? 10 : 0, 'วางแผนสต็อกและโปรโมชันให้ยอดขายสม่ำเสมอ');
  return f;
}

// ---------------------------------------------------------------- C3
function reviews(a: AssessmentResult['analysis']['reviews']): TrustFactor[] {
  const blended = (a.avgRating + a.recentRating) / 2;
  const base = Math.round(((blended - 1) / 4) * 100);
  const themePenalty = Math.min(15, a.negativeThemes.length * 5);
  return [
    factor({ id: 'c3.rating', component: 'C3', label: 'คะแนนรีวิว (ถ่วงน้ำหนักรีวิวใหม่)', value: `${a.avgRating.toFixed(2)} ดาว จาก ${a.totalReviews.toLocaleString('th-TH')} รีวิว · ล่าสุด ${a.recentRating.toFixed(2)} ดาว`, impact: base, evidence: [`การกระจายคะแนน 1–5 ดาว: ${a.histogram.join(' / ')}`], source: 'marketplace', improve: blended < 4.5 ? 'ติดตามปัญหาที่ลูกค้ารีวิวและแก้ไขให้เร็ว' : undefined }),
    factor({ id: 'c3.themes', component: 'C3', label: 'ประเด็นเชิงลบที่พบบ่อย', value: a.negativeThemes.length ? a.negativeThemes.map((t) => `${t.label} (${t.count})`).join(', ') : 'ไม่พบประเด็นซ้ำ', impact: -themePenalty, evidence: [], source: 'marketplace', improve: themePenalty ? 'แก้ไขประเด็นที่ลูกค้าแจ้งซ้ำ และตอบรีวิวเชิงลบอย่างสุภาพ' : undefined }),
  ];
}

// ---------------------------------------------------------------- C4
function price(a: AssessmentResult['analysis']['price']): TrustFactor[] {
  const watch = a.findings.filter((f) => f.level === 'watch');
  return [
    factor({ id: 'c4.base', component: 'C4', label: 'ราคาเทียบช่วงอ้างอิงของประเภทสินค้า', value: `วิเคราะห์ ${a.listingsAnalyzed} รายการ`, impact: 100, evidence: a.findings.filter((f) => f.level === 'info').map((f) => f.title + ' — ' + f.productName), source: 'marketplace' }),
    factor({ id: 'c4.watch', component: 'C4', label: 'สินค้าความเสี่ยงสูง/กลางที่ราคาต่ำกว่าช่วงอ้างอิงมากโดยไม่มีหลักฐานสนับสนุน', value: watch.length ? watch.map((w) => w.productName).join(', ') : 'ไม่พบ', impact: -Math.min(100, watch.length * 25), evidence: watch.flatMap((w) => w.evidence), source: 'marketplace', improve: watch.length ? 'แสดงที่มาของสินค้า/ใบรับรองผลิตภัณฑ์ หรืออธิบายเหตุผลของราคา (เช่น ล้างสต็อก)' : undefined }),
  ];
}

// ---------------------------------------------------------------- C5
function compliance(i: AssessmentInput): TrustFactor[] {
  const mine = i.complaints.filter((c) => c.merchantId === i.merchant.id);
  const since = i.asOf.getTime() - 182 * DAY;
  const resolved = mine.filter((c) => c.status === 'resolved').length;
  const escalated = mine.filter((c) => c.status === 'escalated' && new Date(c.createdAt).getTime() > since).length;
  const openWarnings = i.warnings.filter((w) => w.merchantId === i.merchant.id && w.kind === 'warning' && w.status !== 'completed');
  const doneWarnings = i.warnings.filter((w) => w.merchantId === i.merchant.id && w.status === 'completed').length;
  const passed = i.enrollments.filter((e) => e.operatorId === i.merchant.operatorId && e.passed).length;
  return [
    factor({ id: 'c5.base', component: 'C5', label: 'คะแนนตั้งต้นของการปฏิบัติตาม', value: `ข้อร้องเรียนทั้งหมด ${mine.length} เรื่อง`, impact: 80, evidence: [], source: 'complaints' }),
    factor({ id: 'c5.resolved', component: 'C5', label: 'ข้อร้องเรียนที่แก้ไขสำเร็จกับลูกค้าโดยตรง', value: `${resolved} เรื่อง`, impact: Math.min(12, resolved * 3), evidence: [], source: 'complaints' }),
    factor({ id: 'c5.escalated', component: 'C5', label: 'ข้อร้องเรียนที่ส่งต่อเจ้าหน้าที่ (6 เดือน)', value: `${escalated} เรื่อง`, impact: -Math.min(30, escalated * 8), evidence: [], source: 'complaints', improve: escalated ? 'ตอบข้อร้องเรียนภายใน 3 วันและเสนอทางเลือกที่เป็นธรรม' : undefined }),
    factor({ id: 'c5.warnings', component: 'C5', label: 'คำเตือนที่ยังไม่แก้ไข', value: openWarnings.length ? openWarnings.map((w) => w.id).join(', ') : 'ไม่มี', impact: -Math.min(24, openWarnings.length * 12), evidence: [], source: 'warnings', improve: openWarnings.length ? 'ดำเนินการตามรายการแก้ไขและส่งหลักฐานให้เจ้าหน้าที่' : undefined }),
    factor({ id: 'c5.warnings-done', component: 'C5', label: 'คำเตือน/คำแนะนำที่แก้ไขเสร็จแล้ว', value: `${doneWarnings} รายการ`, impact: 0, evidence: [], source: 'warnings' }),
    factor({ id: 'c5.training', component: 'C5', label: 'หลักสูตรอบรมที่ผ่านแล้ว', value: `${passed} หลักสูตร`, impact: Math.min(12, passed * 4), evidence: [], source: 'training', improve: passed < 3 ? 'เข้าอบรมที่ศูนย์อบรมผู้ประกอบการ' : undefined }),
  ];
}

const sumImpact = (fs: TrustFactor[]) => clamp(fs.reduce((s, f) => s + f.impact, 0));

// ---------------------------------------------------------------- Standing (D8)
function standingOf(i: AssessmentInput): { standing: Standing; reason?: string } {
  if (i.cert?.status === 'revoked' || i.merchant.riskStatus === 'revoked') return { standing: 'revoked', reason: 'การรับรองถูกเพิกถอน' };
  if (i.cert?.status === 'suspended' || i.merchant.riskStatus === 'suspended') return { standing: 'suspended', reason: 'การรับรองถูกระงับชั่วคราว' };
  const open = i.risks.find((r) => r.merchantId === i.merchant.id && !['dismissed', 'appeal_reviewed'].includes(r.status));
  if (open) return { standing: 'under_review', reason: `มีเรื่องพิจารณาความเสี่ยงที่ยังเปิดอยู่ (${open.id})` };
  return { standing: 'normal' };
}

export function bandOf(score: number, model: Model = MODEL_V2): Band {
  return score >= model.bands.A ? 'A' : score >= model.bands.B ? 'B' : score >= model.bands.C ? 'C' : 'D';
}

// ---------------------------------------------------------------- Main
export function assessTrust(input: AssessmentInput, model: Model = MODEL_V2): AssessmentResult {
  const snaps = input.marketplace.map((x) => x.snapshot);
  const analysis = { price: analyzePrices(snaps), sales: analyzeSales(snaps), reviews: analyzeReviews(snaps) };
  const s = analysis.sales;
  const rv = analysis.reviews;

  // องค์ประกอบ — ไม่มีข้อมูล = ไม่นับ (ไม่ใช่ 0)
  const raw: Record<ComponentId, TrustFactor[] | null> = {
    C1: identity(input),
    C2: snaps.length && s.totalOrders > 0 ? sales(s) : null,
    C3: rv.totalReviews > 0 ? reviews(rv) : null,
    C4: analysis.price.listingsAnalyzed > 0 ? price(analysis.price) : null,
    C5: compliance(input),
  };
  const ids = Object.keys(COMPONENTS) as ComponentId[];
  const availWeight = ids.reduce((sum, id) => sum + (raw[id] ? model.weights[id] : 0), 0);
  const components: ComponentResult[] = ids.map((id) => {
    const fs = raw[id];
    const effectiveWeight = fs && availWeight > 0 ? (model.weights[id] / availWeight) * 100 : 0;
    const score = fs ? sumImpact(fs) : null;
    return {
      id,
      label: COMPONENTS[id].label,
      weight: model.weights[id],
      effectiveWeight: r1(effectiveWeight),
      available: !!fs,
      score,
      contribution: score === null ? 0 : (score * effectiveWeight) / 100,
      factors: fs ?? [],
    };
  });
  const baseScore = components.reduce((sum, c) => sum + c.contribution, 0);

  // สัญญาณความเสี่ยง — หักจากคะแนนรวม (ข้อสังเกตให้ตรวจสอบ ไม่ใช่ข้อสรุปว่ากระทำผิด)
  const P = model.penalties;
  const riskFactors: TrustFactor[] = [];
  const watchPrices = analysis.price.findings.filter((f) => f.level === 'watch');
  if (watchPrices.length) riskFactors.push(factor({ id: 'risk.price', component: 'risk', label: 'ราคาต่ำกว่าช่วงอ้างอิงมากในสินค้าความเสี่ยงสูง/กลาง — ควรตรวจสอบเพิ่มเติม', value: watchPrices.map((w) => w.productName).join(', '), impact: -P.priceWatch, evidence: watchPrices.flatMap((w) => [w.detail, ...w.mitigations.map((m) => `หลักฐานสนับสนุน: ${m}`)]), source: 'marketplace', improve: 'แสดงที่มา/ใบรับรองผลิตภัณฑ์ หรือชี้แจงเหตุผลของราคา' }));
  if (rv.burst) riskFactors.push(factor({ id: 'risk.review-burst', component: 'risk', label: 'รีวิวกระจุกตัวผิดธรรมชาติ — ควรตรวจสอบเพิ่มเติม', value: `${rv.burst.count} รีวิวใน 7 วัน (${Math.round(rv.burst.share * 100)}% ของตัวอย่าง)`, impact: -P.reviewBurst, evidence: analysis.reviews.findings.find((f) => f.id === 'review-burst')?.evidence ?? [], source: 'marketplace', improve: 'ไม่จูงใจให้รีวิวด้วยของแถมหรือส่วนลด' }));
  if (s.spike) riskFactors.push(factor({ id: 'risk.sales-spike', component: 'risk', label: 'ยอดขายพุ่งผิดปกติ — ควรตรวจสอบเพิ่มเติม', value: `เดือนล่าสุดสูงกว่าปกติ ${s.spike.factor} เท่า`, impact: -P.salesSpike, evidence: [`คำสั่งซื้อรายเดือน: ${s.monthlyOrders.join(', ')}`], source: 'marketplace' }));
  const mine = input.complaints.filter((c) => c.merchantId === input.merchant.id);
  const seriousOpen = mine.filter((c) => c.screening.priority === 'urgent' && !['resolved', 'closed'].includes(c.status));
  if (seriousOpen.length) riskFactors.push(factor({ id: 'risk.serious-complaint', component: 'risk', label: 'มีข้อร้องเรียนเร่งด่วนที่ยังไม่ปิด', value: seriousOpen.map((c) => c.id).join(', '), impact: -P.seriousOpenComplaint, evidence: seriousOpen.map((c) => `${c.id}: ${c.title}`), source: 'complaints' }));
  const nonDelivery = rv.negativeThemes.some((t) => t.kind === 'non_delivery') || mine.some((c) => c.category === 'not_received' && !['resolved', 'closed'].includes(c.status));
  const crossSignal = watchPrices.some((w) => w.productRisk === 'high') && nonDelivery;
  if (crossSignal) riskFactors.push(factor({ id: 'risk.cross', component: 'risk', label: 'สัญญาณหลายข้อร่วมกัน: ราคาต่ำผิดปกติในสินค้าความเสี่ยงสูง และมีปัญหาไม่ได้รับสินค้า', value: 'แนะนำให้เจ้าหน้าที่พิจารณา', impact: -P.crossSignal, evidence: [], source: 'risk' }));
  const riskPenalty = -riskFactors.reduce((sum, f) => sum + f.impact, 0);
  const score = r1(clamp(baseScore - riskPenalty));

  // Insufficient Data (D6)
  const M = model.minimums;
  const insufficientReasons: string[] = [];
  if (!snaps.length) insufficientReasons.push('ยังไม่มีการเชื่อมต่อ Marketplace (จำลอง) ที่ซิงก์ข้อมูลแล้ว');
  else {
    if (s.totalOrders < M.orders) insufficientReasons.push(`คำสั่งซื้อ ${s.totalOrders} รายการ (ขั้นต่ำ ${M.orders})`);
    if (rv.totalReviews < M.reviews) insufficientReasons.push(`รีวิว ${rv.totalReviews} รายการ (ขั้นต่ำ ${M.reviews})`);
    if (s.monthsOfData < M.months) insufficientReasons.push(`ข้อมูลการขาย ${s.monthsOfData} เดือน (ขั้นต่ำ ${M.months})`);
  }

  // Data Coverage — ความครบถ้วน (D7)
  const C = model.coverage;
  const cov = (key: keyof typeof C, label: string, have: number): CoverageItem => ({ key, label, have, target: C[key].target, ratio: Math.min(1, have / C[key].target), weight: C[key].weight });
  const coverageItems = [
    cov('platforms', 'แพลตฟอร์มที่เชื่อมต่อ', snaps.length),
    cov('months', 'เดือนที่มีข้อมูลการขาย', s.monthsOfData),
    cov('listings', 'รายการสินค้าที่มีราคา', analysis.price.listingsAnalyzed),
    cov('orders', 'คำสั่งซื้อ (12 เดือน)', s.totalOrders),
    cov('reviews', 'รีวิว', rv.totalReviews),
    cov('history', 'ข้อมูลตัวตนและประวัติในระบบ', 1),
  ];
  const wSum = coverageItems.reduce((a, c) => a + c.weight, 0);
  const coveragePercent = Math.round((coverageItems.reduce((a, c) => a + c.ratio * c.weight, 0) / wSum) * 100);

  // Data Confidence — ความน่าเชื่อถือของข้อมูลที่มี (D7)
  const K = model.confidence;
  let conf = 100;
  const confReasons: string[] = [];
  const minus = (n: number, reason: string) => {
    conf -= n;
    confReasons.push(`${reason} (−${n})`);
  };
  if (!snaps.length) minus(50, 'มีแหล่งข้อมูลเดียว คือข้อมูลในระบบ — ยังไม่มีข้อมูล Marketplace');
  else if (snaps.length === 1) minus(K.singleSource, `ข้อมูล Marketplace จากแหล่งเดียว (${PLATFORMS[input.marketplace[0].connection.platform].label})`);
  const syncAges = input.marketplace.map((x) => (x.connection.lastSyncAt ? (input.asOf.getTime() - new Date(x.connection.lastSyncAt).getTime()) / DAY : Infinity));
  const oldest = syncAges.length ? Math.max(...syncAges) : 0;
  if (oldest > K.freshPartialDays) minus(K.staleFull, `ข้อมูลซิงก์ล่าสุดนานกว่า ${K.freshPartialDays} วัน`);
  else if (oldest > K.freshFullDays) minus(K.stalePartial, `ข้อมูลซิงก์ล่าสุดนานกว่า ${K.freshFullDays} วัน`);
  if (snaps.length && s.totalOrders < M.orders) minus(K.smallOrders, `ตัวอย่างคำสั่งซื้อน้อย (${s.totalOrders})`);
  if (snaps.length && rv.totalReviews < M.reviews) minus(K.smallReviews, `ตัวอย่างรีวิวน้อย (${rv.totalReviews})`);
  if (rv.platformGap !== null && rv.platformGap >= 0.8) minus(K.platformGap, `คะแนนรีวิวต่างกันระหว่างแพลตฟอร์ม ${rv.platformGap.toFixed(1)} ดาว`);
  if (rv.burst) minus(K.reviewBurst, 'พบรีวิวกระจุกตัวผิดธรรมชาติ — ข้อมูลรีวิวอาจไม่สะท้อนความจริง');
  conf = clamp(conf);
  if (!confReasons.length) confReasons.push('ข้อมูลจากหลายแหล่ง เป็นปัจจุบัน และมีตัวอย่างเพียงพอ');
  const confidenceLevel: ConfidenceLevel = conf >= K.high ? 'high' : conf >= K.medium ? 'medium' : 'low';

  // Band — A ต้องมีความเชื่อมั่นสูงและไม่มีสัญญาณที่ควรตรวจสอบ (มิฉะนั้นสูงสุด B)
  const scoreBand = bandOf(score, model);
  const insufficient = insufficientReasons.length > 0;
  const band = insufficient ? 'insufficient' : scoreBand === 'A' && (confidenceLevel !== 'high' || riskFactors.length > 0) ? 'B' : scoreBand;

  const { standing, reason: standingReason } = standingOf(input);

  // ข้อเสนอประกอบการพิจารณาของเจ้าหน้าที่ — ไม่ออก Badge อัตโนมัติ (D3)
  let recommendation: Recommendation;
  if (standing !== 'normal') recommendation = { kind: 'blocked', reasons: [standingReason!, 'ไม่สามารถใช้หรือขอ Badge ได้จนกว่าสถานะการรับรองจะกลับเป็นปกติ'] };
  else if (crossSignal) recommendation = { kind: 'refer_risk', reasons: ['พบสัญญาณความเสี่ยงหลายข้อร่วมกัน ควรเปิดเรื่องพิจารณาความเสี่ยงเพื่อให้ร้านชี้แจง'] };
  else if (band === 'insufficient') recommendation = { kind: 'need_more_data', reasons: insufficientReasons };
  else if (confidenceLevel === 'low') recommendation = { kind: 'need_more_data', reasons: ['ความเชื่อมั่นของข้อมูลต่ำ', ...confReasons] };
  else if (band === 'A' && confidenceLevel === 'high' && input.currentLevel >= 3) recommendation = { kind: 'consider_l4', level: 4, reasons: ['Band A และความเชื่อมั่นสูง — ประกอบการพิจารณา Level 4 (ต้องผ่านเกณฑ์ v1 ด้วย)'] };
  else if ((band === 'A' || band === 'B') && input.currentLevel < 3) recommendation = { kind: 'consider_l3', level: 3, reasons: [`Band ${band} และความเชื่อมั่น${confidenceLevel === 'high' ? 'สูง' : 'ปานกลาง'} — ประกอบการพิจารณา Level 3 (ต้องผ่านเกณฑ์ v1 ด้วย)`] };
  else recommendation = { kind: 'not_yet', reasons: [input.currentLevel >= 3 ? 'มี Level 3 แล้ว — ผลประเมินยังไม่ถึงเกณฑ์ประกอบการพิจารณา Level 4' : `Band ${band} ยังไม่ถึงเกณฑ์ประกอบการพิจารณา Level 3`] };

  // สรุปสำหรับผู้บริโภค (D2) — ไม่มีคะแนน ยอดขาย หรือสัญญาณที่ยังไม่มีข้อสรุป
  const dataSources = input.marketplace.map((x) => x.connection.platform);
  const publicSummary: string[] = [];
  if (dataSources.length) publicSummary.push(`ใช้ข้อมูลจาก ${dataSources.map((p) => PLATFORMS[p].label).join(' และ ')} ย้อนหลัง ${s.monthsOfData} เดือน ร่วมกับข้อมูลในระบบ`);
  else publicSummary.push('ร้านยังไม่ได้เชื่อมต่อข้อมูล Marketplace — ประเมินจากข้อมูลในระบบเท่านั้น');
  if (insufficient) publicSummary.push('ข้อมูลการขายยังไม่เพียงพอสำหรับการประเมิน ซึ่งไม่ได้หมายความว่าร้านมีปัญหา');
  if (input.operator?.kycStatus === 'verified') publicSummary.push('เจ้าของร้านยืนยันตัวตนแล้ว');
  if (rv.totalReviews >= M.reviews) publicSummary.push(rv.avgRating >= 4.5 ? 'คะแนนรีวิวจากลูกค้าอยู่ในเกณฑ์ดีมาก' : rv.avgRating >= 4 ? 'คะแนนรีวิวจากลูกค้าอยู่ในเกณฑ์ดี' : 'คะแนนรีวิวจากลูกค้าอยู่ในระดับปานกลาง');
  if (snaps.length && s.onTimeShipRate >= 0.95) publicSummary.push('จัดส่งตรงเวลาอย่างสม่ำเสมอ');
  if (mine.some((c) => c.status === 'resolved')) publicSummary.push('มีประวัติแก้ไขข้อร้องเรียนกับลูกค้าโดยตรงผ่านระบบ');

  return {
    modelVersion: model.version,
    weights: { ...model.weights },
    computedAt: input.asOf.toISOString(),
    score,
    baseScore: r1(baseScore),
    riskPenalty,
    components,
    riskFactors,
    band,
    scoreBand,
    insufficientReasons,
    standing,
    standingReason,
    coverage: { percent: coveragePercent, items: coverageItems },
    confidence: { level: confidenceLevel, score: conf, reasons: confReasons },
    recommendation,
    publicSummary: publicSummary.slice(0, 5),
    dataSources,
    monthsOfData: s.monthsOfData,
    analysis,
  };
}
