/** วิเคราะห์คะแนนและรีวิว — ใช้คำสำคัญจัดประเภทชุดเดียวกับ AI-02 (Complaint Assistant) */
import type { MarketplaceSnapshot } from '../types';
import { PLATFORMS } from '../data/platforms';
import { detectKinds } from '@/features/ai-assistant/services/complaintAnalyzer';
import { COMPLAINT_KINDS } from '@/features/ai-assistant/rules/complaintRules';
import type { Finding, ReviewAnalysis } from './types';

export const REVIEW_RULES = {
  /** สัดส่วนรีวิวตัวอย่างที่เกิดใน burstDays วันล่าสุด */
  burstShare: 0.5,
  burstDays: 7,
  burstMinCount: 10,
  /** ข้อความสั้นกว่านี้ (ตัวอักษร) ถือว่าสั้นมาก */
  shortText: 8,
  lowQualityShare: 0.4,
  /** ข้อความสั้น (< templatedText ตัวอักษร) ที่ซ้ำกันเกินสัดส่วนนี้ของรีวิว 5 ดาว ถือว่าเป็นรีวิวแบบเดียวกันผิดปกติ */
  duplicateShare: 0.25,
  templatedText: 12,
  /** ประเด็นเชิงลบที่พบอย่างน้อยกี่ครั้งจึงรายงาน */
  themeMin: 2,
  platformGap: 0.8,
};

export function analyzeReviews(snapshots: MarketplaceSnapshot[]): ReviewAnalysis {
  const histogram = [0, 1, 2, 3, 4].map((i) => snapshots.reduce((s, x) => s + x.ratingHistogram[i], 0)) as ReviewAnalysis['histogram'];
  const totalReviews = histogram.reduce((a, b) => a + b, 0);
  const avgRating = totalReviews ? histogram.reduce((s, c, i) => s + c * (i + 1), 0) / totalReviews : 0;
  const sample = snapshots.flatMap((s) => s.reviews);

  // รีวิวใหม่มีน้ำหนักมากกว่า (ครึ่งชีวิต 180 วัน)
  const w = sample.map((r) => Math.pow(0.5, r.daysAgo / 180));
  const wSum = w.reduce((a, b) => a + b, 0);
  const recentRating = wSum ? sample.reduce((s, r, i) => s + r.rating * w[i], 0) / wSum : avgRating;

  const findings: Finding[] = [];
  const recent = sample.filter((r) => r.daysAgo < REVIEW_RULES.burstDays);
  let burst: ReviewAnalysis['burst'] = null;
  if (sample.length >= REVIEW_RULES.burstMinCount && recent.length / sample.length >= REVIEW_RULES.burstShare) {
    burst = { share: recent.length / sample.length, count: recent.length };
    findings.push({
      id: 'review-burst',
      level: 'watch',
      title: 'รีวิวกระจุกตัวในช่วงเวลาสั้น — ควรตรวจสอบเพิ่มเติม',
      detail: `${recent.length} จาก ${sample.length} รีวิวตัวอย่าง (${Math.round(burst.share * 100)}%) เกิดใน ${REVIEW_RULES.burstDays} วันล่าสุด`,
      evidence: recent.slice(0, 5).map((r) => `${r.rating} ดาว "${r.text}" (${r.daysAgo} วันก่อน)`),
    });
  }
  const fives = sample.filter((r) => r.rating === 5);
  const textCount = new Map<string, number>();
  fives.forEach((r) => textCount.set(r.text, (textCount.get(r.text) ?? 0) + 1));
  // ข้อความสั้นมาก หรือข้อความสั้นแบบเดียวกันคิดเป็นสัดส่วนสูงของรีวิว 5 ดาว — รีวิวยาวที่บังเอิญตรงกันไม่นับ
  const lowQuality = fives.filter((r) => r.text.length < REVIEW_RULES.shortText || (r.text.length < REVIEW_RULES.templatedText && (textCount.get(r.text) ?? 0) / fives.length > REVIEW_RULES.duplicateShare)).length;
  const lowQualityShare = fives.length ? lowQuality / fives.length : 0;
  if (fives.length >= 5 && lowQualityShare >= REVIEW_RULES.lowQualityShare) {
    findings.push({ id: 'review-quality', level: 'info', title: 'รีวิว 5 ดาวจำนวนมากข้อความสั้นหรือซ้ำกัน', detail: `${Math.round(lowQualityShare * 100)}% ของรีวิว 5 ดาวในตัวอย่าง`, evidence: [] });
  }

  // ประเด็นเชิงลบจากรีวิว 1–2 ดาว
  const counts = new Map<string, number>();
  sample.filter((r) => r.rating <= 2).forEach((r) => detectKinds(r.text).kinds.filter((k) => k !== 'other').forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1)));
  const negativeThemes = [...counts.entries()]
    .filter(([, n]) => n >= REVIEW_RULES.themeMin)
    .map(([kind, count]) => ({ kind, label: COMPLAINT_KINDS[kind as keyof typeof COMPLAINT_KINDS].th, count }))
    .sort((a, b) => b.count - a.count);
  if (negativeThemes.length) {
    findings.push({ id: 'review-themes', level: 'info', title: 'ประเด็นที่ลูกค้าแจ้งบ่อยในรีวิวเชิงลบ', detail: negativeThemes.map((t) => `${t.label} ${t.count} ครั้ง`).join(' · '), evidence: [] });
  }

  let platformGap: number | null = null;
  const avgs = snapshots.filter((s) => s.totalReviews > 0).map((s) => ({ p: s.platform, avg: s.ratingHistogram.reduce((a, c, i) => a + c * (i + 1), 0) / s.totalReviews }));
  if (avgs.length > 1) {
    platformGap = Math.max(...avgs.map((a) => a.avg)) - Math.min(...avgs.map((a) => a.avg));
    if (platformGap >= REVIEW_RULES.platformGap) {
      findings.push({ id: 'review-gap', level: 'info', title: 'คะแนนแต่ละแพลตฟอร์มต่างกันมาก', detail: avgs.map((a) => `${PLATFORMS[a.p].label} ${a.avg.toFixed(1)} ดาว`).join(' · '), evidence: [] });
    }
  }

  return { totalReviews, avgRating, recentRating, histogram, burst, lowQualityShare, negativeThemes, platformGap, findings };
}
