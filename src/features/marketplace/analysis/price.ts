/**
 * วิเคราะห์ราคา (D9) — เทียบช่วงอ้างอิงของประเภทสินค้าเดียวกัน คำนึงถึงความเสี่ยงของสินค้า
 * ปริมาณคำสั่งซื้อ มูลค่าธุรกรรม และจำนวน/คะแนนรีวิว
 * ราคาถูกหรือแพงไม่ใช่หลักฐานว่าร้านทุจริต — ผลสูงสุดคือ "ควรตรวจสอบเพิ่มเติม"
 */
import type { MarketplaceSnapshot } from '../types';
import { productRef, PRODUCT_RISK_LABEL } from '../data/catalog';
import { PLATFORMS } from '../data/platforms';
import type { PriceAnalysis, PriceFinding } from './types';

export const PRICE_RULES = {
  /** ต่ำกว่าราคากลางเกินสัดส่วนนี้ถือว่า "ต่ำกว่าช่วงอ้างอิงมาก" */
  lowRatio: 0.5,
  /** สูงกว่าราคากลางเกินสัดส่วนนี้เป็นข้อสังเกต (ไม่หักคะแนน) */
  highRatio: 2,
  /** ราคาสูงสุด ÷ ต่ำสุดใน 6 เดือน */
  jumpRatio: 1.8,
  /** หลักฐานสนับสนุนที่ช่วยลดความกังวล */
  supportUnits: 200,
  supportValue: 50_000,
  supportReviews: 50,
  supportRating: 4.5,
};

const baht = (n: number) => `${Math.round(n).toLocaleString('th-TH')} บาท`;

export function analyzePrices(snapshots: MarketplaceSnapshot[]): PriceAnalysis {
  const findings: PriceFinding[] = [];
  let listingsAnalyzed = 0;
  for (const snap of snapshots) {
    for (const l of snap.listings) {
      const ref = productRef(l.productKey);
      if (!ref) continue;
      listingsAnalyzed++;
      const ratio = l.price / ref.median;
      const where = PLATFORMS[snap.platform].label;
      const base = { listingId: l.id, productName: l.name, productRisk: l.productRisk, ratio: Math.round(ratio * 100) / 100, platform: snap.platform };

      if (ratio < PRICE_RULES.lowRatio) {
        const value = l.unitsSold12m * l.price;
        const mitigations: string[] = [];
        if (l.unitsSold12m >= PRICE_RULES.supportUnits) mitigations.push(`ขายได้ ${l.unitsSold12m.toLocaleString('th-TH')} ชิ้นใน 12 เดือน`);
        if (value >= PRICE_RULES.supportValue) mitigations.push(`มูลค่าธุรกรรม ${baht(value)}`);
        if (l.reviewCount >= PRICE_RULES.supportReviews && l.avgRating >= PRICE_RULES.supportRating) mitigations.push(`รีวิว ${l.reviewCount} รายการ เฉลี่ย ${l.avgRating} ดาว`);
        // ความเสี่ยงต่ำ → ข้อสังเกตเสมอ · ความเสี่ยงกลาง → ตรวจเพิ่มเมื่อไม่มีหลักฐานสนับสนุน · ความเสี่ยงสูง → ตรวจเพิ่มเว้นแต่มีหลักฐานสนับสนุนอย่างน้อย 2 ข้อ
        const watch = l.productRisk === 'high' ? mitigations.length < 2 : l.productRisk === 'medium' ? mitigations.length === 0 : false;
        findings.push({
          ...base,
          id: `price-low-${l.id}`,
          kind: 'below_reference',
          level: watch ? 'watch' : 'info',
          title: watch ? `ราคาต่ำกว่าช่วงอ้างอิงมาก — ควรตรวจสอบเพิ่มเติม` : 'ราคาต่ำกว่าช่วงอ้างอิง (ข้อสังเกต)',
          detail: `${l.name} บน ${where} ราคา ${baht(l.price)} คิดเป็น ${Math.round(ratio * 100)}% ของราคากลางอ้างอิง (${baht(ref.median)}) · สินค้า${PRODUCT_RISK_LABEL[l.productRisk]}`,
          evidence: [`ราคาปัจจุบัน ${baht(l.price)}`, `ราคากลางอ้างอิงของประเภทสินค้า ${baht(ref.median)}`, `ประวัติราคา 6 เดือน: ${l.priceHistory.map((x) => x.toLocaleString('th-TH')).join(' → ')}`],
          mitigations,
        });
      } else if (ratio > PRICE_RULES.highRatio) {
        findings.push({
          ...base,
          id: `price-high-${l.id}`,
          kind: 'above_reference',
          level: 'info',
          title: 'ราคาสูงกว่าช่วงอ้างอิง (ข้อสังเกต ไม่มีผลต่อคะแนน)',
          detail: `${l.name} ราคา ${baht(l.price)} สูงกว่าราคากลางอ้างอิง ${Math.round(ratio * 100)}% — อาจเป็นสินค้าทำมือหรือคุณภาพพิเศษ`,
          evidence: [`ราคากลางอ้างอิง ${baht(ref.median)}`],
          mitigations: [],
        });
      }

      const max = Math.max(...l.priceHistory);
      const min = Math.min(...l.priceHistory);
      if (min > 0 && max / min >= PRICE_RULES.jumpRatio) {
        findings.push({
          ...base,
          id: `price-jump-${l.id}`,
          kind: 'price_jump',
          level: 'info',
          title: 'ราคาเปลี่ยนแปลงมากใน 6 เดือน (ข้อสังเกต)',
          detail: `${l.name} ราคาต่ำสุด ${baht(min)} สูงสุด ${baht(max)} ใน 6 เดือน`,
          evidence: [`ประวัติราคา: ${l.priceHistory.map((x) => x.toLocaleString('th-TH')).join(' → ')}`],
          mitigations: [],
        });
      }
    }
  }
  return { listingsAnalyzed, findings, watchCount: findings.filter((f) => f.level === 'watch').length };
}
