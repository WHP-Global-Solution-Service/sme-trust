/**
 * กรณีเปรียบเทียบสำหรับการสาธิต (Scenario 10) — สร้างจาก Generator และวิเคราะห์ด้วย Engine เดิมของ P3
 * ไม่มีสูตรใหม่: ปรับเฉพาะข้อมูลตั้งต้น (ราคา/ปริมาณ) แล้วส่งให้ analyzePrices / analyzeSales / analyzeReviews ตามปกติ
 */
import type { Listing, MarketplaceSnapshot, Review } from '../types';
import { generateSnapshot } from '../services/generator';
import { hashString } from '../services/prng';
import { productRef, productsOfCategory } from '../data/catalog';
import { analyzePrices } from './price';
import { analyzeSales } from './sales';
import { analyzeReviews } from './reviews';

export type ComparisonCaseId = 'cheap_popular' | 'premium_niche' | 'new_shop' | 'review_burst';

export const COMPARISON_CASES: { id: ComparisonCaseId; title: string; desc: string }[] = [
  { id: 'cheap_popular', title: 'ราคาต่ำ ยอดขายสูง รีวิวมาก', desc: 'ขายต่ำกว่าช่วงอ้างอิงมาก แต่มีคำสั่งซื้อและรีวิวจำนวนมากต่อเนื่อง' },
  { id: 'premium_niche', title: 'ราคาสูง ยอดขายน้อย รีวิวดี', desc: 'สินค้าระดับพรีเมียม ขายได้ไม่มาก ลูกค้าที่ซื้อพอใจ' },
  { id: 'new_shop', title: 'ร้านใหม่ รีวิวและคำสั่งซื้อน้อย', desc: 'เพิ่งเปิดร้านไม่ถึง 2 เดือน' },
  { id: 'review_burst', title: 'คะแนนดี แต่รีวิวผิดธรรมชาติ', desc: 'รีวิว 5 ดาวจำนวนมากเกิดในไม่กี่วัน ข้อความสั้นและซ้ำกัน' },
];

/**
 * หมวดสินค้าของการเปรียบเทียบ (P7-F) — ใช้หมวดของร้านที่เลือกเป็นค่าเริ่มต้น และเปลี่ยนได้
 * ทุกกรณีในการเปรียบเทียบหนึ่งครั้งใช้หมวดเดียวกัน จึงเทียบภายใต้ช่วงราคาอ้างอิงและความเสี่ยงของสินค้าชุดเดียวกัน
 * หมวดที่ไม่มีในแคตตาล็อกใช้สินค้า "ของใช้ในบ้าน" แทน (ตาม productsOfCategory)
 */
export const DEFAULT_COMPARISON_CATEGORY = 'ความงามและสุขภาพ';

/** หมวดที่ใช้สร้างรายการสินค้าจริง (หมวดที่ไม่มีในแคตตาล็อกจะใช้ของใช้ในบ้าน) */
export const effectiveCategory = (category: string) => productsOfCategory(category)[0]?.category ?? category;

const conn = (id: string, archetype: Parameters<typeof generateSnapshot>[0]['archetype']) => ({ id: `CMP-${id}`, platform: 'shopee' as const, seed: hashString(`comparison:${id}`), archetype });

const withPrice = (l: Listing, factor: number): Listing => {
  const price = Math.max(9, Math.round((productRef(l.productKey)?.median ?? l.price) * factor));
  return { ...l, price, priceHistory: l.priceHistory.map(() => price) };
};

/** ย่อปริมาณข้อมูลทั้งชุด (คำสั่งซื้อ รีวิว ยอดขายต่อรายการ) ให้สอดคล้องกัน */
function scaleDown(s: MarketplaceSnapshot, factor: number, keep: (r: Review) => boolean): MarketplaceSnapshot {
  const monthlyOrders = s.monthlyOrders.map((m) => Math.max(m ? 1 : 0, Math.round(m * factor)));
  const ratingHistogram = s.ratingHistogram.map((n) => Math.round(n * factor)) as MarketplaceSnapshot['ratingHistogram'];
  const totalReviews = ratingHistogram.reduce((a, b) => a + b, 0);
  return {
    ...s,
    monthlyOrders,
    ratingHistogram,
    totalReviews,
    reviews: s.reviews.filter(keep).slice(0, Math.min(30, totalReviews)),
    listings: s.listings.map((l) => ({ ...l, unitsSold12m: Math.round(l.unitsSold12m * factor), reviewCount: Math.round(l.reviewCount * factor) })),
  };
}

export function comparisonSnapshot(id: ComparisonCaseId, category: string = DEFAULT_COMPARISON_CATEGORY): MarketplaceSnapshot {
  switch (id) {
    case 'cheap_popular': {
      const s = generateSnapshot(conn('A', 'established_good'), category);
      return { ...s, listings: s.listings.map((l) => withPrice(l, 0.42)) };
    }
    case 'premium_niche': {
      const s = generateSnapshot(conn('B', 'established_good'), category);
      const total = s.monthlyOrders.reduce((a, b) => a + b, 0) || 1;
      const small = scaleDown(s, 72 / total, (r) => r.rating >= 4);
      return { ...small, listings: small.listings.map((l) => withPrice(l, 2.3)) };
    }
    case 'new_shop':
      return generateSnapshot(conn('C', 'new_shop'), category);
    case 'review_burst':
      return generateSnapshot(conn('D', 'review_burst'), category);
  }
}

/** ผลวิเคราะห์ของแต่ละกรณี — ใช้ฟังก์ชันวิเคราะห์ชุดเดียวกับการประเมินจริง */
export function analyzeCase(id: ComparisonCaseId, category: string = DEFAULT_COMPARISON_CATEGORY) {
  const snap = comparisonSnapshot(id, category);
  return { snap, price: analyzePrices([snap]), sales: analyzeSales([snap]), reviews: analyzeReviews([snap]) };
}
