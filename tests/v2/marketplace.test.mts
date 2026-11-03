/** v2 — Generator ข้อมูล Marketplace (จำลอง) และ Analysis Engines (ราคา ยอดขาย รีวิว) */
import { check, describe, finish } from '../harness.mts';

const { generateSnapshot } = await import('@/features/marketplace/services/generator');
const { analyzePrices } = await import('@/features/marketplace/analysis/price');
const { analyzeSales } = await import('@/features/marketplace/analysis/sales');
const { analyzeReviews } = await import('@/features/marketplace/analysis/reviews');
const { PLATFORMS, MARKETPLACE_DISCLAIMER } = await import('@/features/marketplace/data/platforms');
const { productRef } = await import('@/features/marketplace/data/catalog');
type Snap = import('@/features/marketplace/types').MarketplaceSnapshot;
type Arch = import('@/features/marketplace/types').Archetype;

const mk = (archetype: Arch, seed = 12345, platform: 'shopee' | 'lazada' = 'shopee', category = 'ความงามและสุขภาพ') =>
  generateSnapshot({ id: `T-${archetype}-${platform}`, platform, seed, archetype }, category);

describe('ชื่อแพลตฟอร์มและข้อจำกัด (D1)');
check(PLATFORMS.shopee.label === 'Shopee (จำลอง)' && PLATFORMS.lazada.label === 'Lazada (จำลอง)', 'ชื่อแพลตฟอร์มมีป้าย "(จำลอง)" ทุกครั้ง');
check(MARKETPLACE_DISCLAIMER.includes('ยังไม่มีการเชื่อมต่อ API จริง'), 'ข้อความแจ้งว่ายังไม่มีการเชื่อมต่อ API จริง');

describe('Generator — Deterministic');
check(JSON.stringify(mk('established_good')) === JSON.stringify(mk('established_good')), 'Seed เดิมได้ข้อมูลเดิมทุกไบต์');
check(JSON.stringify(mk('established_good', 1)) !== JSON.stringify(mk('established_good', 2)), 'Seed ต่างกันได้ข้อมูลต่างกัน');
const all: Arch[] = ['established_good', 'growing_ok', 'new_shop', 'price_anomaly', 'review_burst', 'fulfillment_issue', 'sales_spike'];
const valid = all.every((a) => {
  const s = mk(a);
  return s.monthlyOrders.length === 12 && s.monthlyOrders.every((m) => Number.isInteger(m) && m >= 0) && s.reviews.length <= 30 && s.ratingHistogram.reduce((x, y) => x + y, 0) === s.totalReviews && s.listings.every((l) => l.price > 0 && l.priceHistory.length === 6);
});
check(valid, 'ทุก Archetype: 12 เดือน, จำนวนไม่ติดลบ, รีวิวตัวอย่าง ≤ 30, Histogram รวม = จำนวนรีวิว, ราคา > 0');
check(mk('new_shop').shopAgeMonths <= 2 && mk('new_shop').monthlyOrders.slice(0, 9).every((m) => m === 0), 'ร้านใหม่: อายุ ≤ 2 เดือน ไม่มีคำสั่งซื้อก่อนเปิดร้าน');
check(mk('established_good').shopAgeMonths >= 26 && mk('established_good').monthlyOrders.every((m) => m > 0), 'ร้านขายนาน: มีข้อมูลครบ 12 เดือน');
check(mk('fulfillment_issue').cancelRate > 0.05 && mk('fulfillment_issue').onTimeShipRate < 0.85, 'ร้านมีปัญหาการจัดส่ง: ยกเลิกสูง จัดส่งตรงเวลาต่ำ');

describe('วิเคราะห์ยอดขาย');
const spike = analyzeSales([mk('sales_spike')]);
check(!!spike.spike && spike.spike.factor >= 5 && spike.findings.some((f) => f.id === 'sales-spike' && f.level === 'watch'), `ยอดขายพุ่ง ${spike.spike?.factor} เท่า → ควรตรวจสอบเพิ่มเติม`);
check(spike.findings.find((f) => f.id === 'sales-spike')!.detail.includes('อาจเกิดจากโปรโมชัน'), '  ข้อความระบุเหตุผลที่เป็นไปได้ ไม่สรุปว่าผิด');
const good = analyzeSales([mk('established_good')]);
check(!good.spike && good.monthsOfData === 12 && good.findings.every((f) => f.level !== 'watch'), 'ร้านขายนาน ผลงานดี: ไม่มีสัญญาณที่ควรตรวจสอบ');
const two = analyzeSales([mk('established_good', 1, 'shopee'), mk('established_good', 2, 'lazada')]);
check(two.totalOrders === analyzeSales([mk('established_good', 1, 'shopee')]).totalOrders + analyzeSales([mk('established_good', 2, 'lazada')]).totalOrders, 'รวมคำสั่งซื้อจากหลายแพลตฟอร์ม');
check(analyzeSales([]).totalOrders === 0 && analyzeSales([]).monthsOfData === 0, 'ไม่มีข้อมูล → 0 คำสั่งซื้อ 0 เดือน (ไม่เกิด Error)');

describe('วิเคราะห์รีวิว');
const burst = analyzeReviews([mk('review_burst')]);
check(!!burst.burst && burst.burst.share >= 0.5 && burst.findings.some((f) => f.id === 'review-burst'), `รีวิวกระจุกตัว ${Math.round((burst.burst?.share ?? 0) * 100)}% ใน 7 วัน → ตรวจพบ`);
check(!analyzeReviews([mk('established_good')]).burst, 'ร้านปกติ: ไม่ตรวจพบรีวิวกระจุกตัว');
const bad = analyzeReviews([mk('fulfillment_issue')]);
check(bad.negativeThemes.length > 0 && bad.negativeThemes.every((t) => !!t.label), `ประเด็นเชิงลบจากรีวิว (ใช้คำสำคัญ AI-02): ${bad.negativeThemes.map((t) => t.label).join(', ')}`);
const custom = (rating: 1 | 2 | 3 | 4 | 5, text: string) => ({ id: text, rating, text, daysAgo: 40 });
const themed: Snap = { ...mk('established_good'), reviews: [custom(1, 'โอนเงินแล้วไม่ได้รับสินค้า'), custom(2, 'ยังไม่ได้รับของเลย'), custom(1, 'ยังไม่ได้รับคำตอบจากร้าน')] };
const themes = analyzeReviews([themed]).negativeThemes;
check(themes.some((t) => t.kind === 'non_delivery' && t.count === 2), '"ยังไม่ได้รับคำตอบ" ไม่นับเป็นไม่ได้รับสินค้า (ใช้กฎชุดเดียวกับ AI-02)');

describe('วิเคราะห์ราคา (D9) — ไม่ใช้ราคาเป็นหลักฐานทุจริต');
const base = mk('established_good');
const listing = (productKey: string, price: number, units: number, reviewCount = 0, avgRating = 0) => {
  const ref = productRef(productKey)!;
  return { id: `L-${productKey}-${price}-${units}`, productKey, name: ref.name, category: ref.category, productRisk: ref.risk, price, priceHistory: [price, price, price, price, price, price], unitsSold12m: units, reviewCount, avgRating };
};
const priceOf = (l: ReturnType<typeof listing>) => analyzePrices([{ ...base, listings: [l] }]).findings;
const highRiskLow = priceOf(listing('power-bank', 240, 20));
check(highRiskLow[0]?.level === 'watch' && highRiskLow[0].kind === 'below_reference', 'สินค้าความเสี่ยงสูง ราคา 35% ของราคากลาง ไม่มีหลักฐานสนับสนุน → ควรตรวจสอบเพิ่มเติม');
const supported = priceOf(listing('power-bank', 240, 600, 120, 4.8));
check(supported[0]?.level === 'info' && supported[0].mitigations.length >= 2, `สินค้าเดียวกัน แต่ขาย 600 ชิ้น มูลค่าสูง รีวิวดี → ลดเป็นข้อสังเกต (${supported[0]?.mitigations.length} หลักฐานสนับสนุน)`);
check(priceOf(listing('scarf', 120, 10))[0]?.level === 'info', 'สินค้าความเสี่ยงต่ำ ราคาต่ำมาก → เป็นเพียงข้อสังเกต');
check(priceOf(listing('wood-toy', 150, 10))[0]?.level === 'watch' && priceOf(listing('wood-toy', 150, 300))[0]?.level === 'info', 'สินค้าความเสี่ยงปานกลาง: ไม่มีหลักฐาน → ตรวจสอบเพิ่ม · มีคำสั่งซื้อจำนวนมาก → ข้อสังเกต');
const expensive = priceOf(listing('silk-mudmee', 9000, 5));
check(expensive.length === 1 && expensive[0].kind === 'above_reference' && expensive[0].level === 'info', 'ราคาสูงกว่าช่วงอ้างอิงมาก → ข้อสังเกตเท่านั้น (ไม่หักคะแนน)');
check(priceOf(listing('serum', 590, 10)).length === 0, 'ราคาอยู่ในช่วงอ้างอิง → ไม่มีข้อสังเกต');
const anomaly = analyzePrices([mk('price_anomaly')]);
check(anomaly.watchCount >= 1 && anomaly.findings.some((f) => f.level === 'watch' && f.productRisk === 'high'), 'Archetype price_anomaly: ตรวจพบสินค้าความเสี่ยงสูงราคาต่ำผิดปกติ');
const allText = [...anomaly.findings, ...highRiskLow, ...expensive].map((f) => f.title + f.detail).join(' ');
check(!/ทุจริต|ฉ้อโกง|หลอกลวง|ของปลอม/.test(allText), 'ข้อความวิเคราะห์ราคาไม่สรุปว่าทุจริต/ปลอม');

finish();
