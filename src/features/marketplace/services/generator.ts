/**
 * สร้างข้อมูลการขายจำลอง (Deterministic) — Seed + Archetype + หมวดสินค้าเดิม ได้ผลเดิมทุกครั้ง
 * ไม่เก็บใน localStorage (คำนวณซ้ำเมื่อต้องใช้) และไม่มีการเรียก Network
 */
import type { Listing, MarketplaceConnection, MarketplaceSnapshot, Review } from '../types';
import { ARCHETYPES } from '../data/archetypes';
import { productsOfCategory } from '../data/catalog';
import { between, intBetween, mulberry32, pick, type Rng } from './prng';

const GOOD_TEXTS = ['สินค้าตรงปก คุณภาพดี', 'ส่งไว แพ็กมาดีมาก', 'ร้านตอบแชตเร็ว แนะนำเลย', 'ใช้ดี คุ้มราคา จะกลับมาซื้ออีก', 'ของถึงครบ สภาพดี', 'สีสวยตามรูป ชอบมาก', 'ซื้อเป็นครั้งที่สามแล้ว ไม่ผิดหวัง', 'แม่ค้าใจดี ห่อของมาอย่างดี', 'ได้ของเร็วกว่าที่คิด', 'คุณภาพเกินราคา ประทับใจ', 'สั่งไปฝากคนที่บ้าน ทุกคนชอบ', 'รายละเอียดตรงกับที่ลงไว้ทุกอย่าง'];
const MID_TEXTS = ['โดยรวมโอเค แต่ส่งช้านิดหน่อย', 'สินค้าใช้ได้ กล่องบุบเล็กน้อย', 'พอใช้ได้ตามราคา'];
const BAD_TEXTS = ['ยังไม่ได้รับสินค้าเลย ทักไปไม่ตอบ', 'ส่งช้ามาก เลยกำหนดไปหลายวัน', 'สินค้าชำรุด ใช้งานไม่ได้', 'ได้ของไม่ตรงปก คนละรุ่นกับที่สั่ง', 'ขอคืนเงินแล้วยังไม่ได้รับเงินคืน'];
const BURST_TEXTS = ['ดีมาก', 'ดีมากค่ะ', 'ดี', 'สินค้าดี', 'ดีมาก'];

type ConnLike = Pick<MarketplaceConnection, 'id' | 'platform' | 'seed' | 'archetype'> & { sourceCategory?: string };

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

function ratingHistogram(rng: Rng, total: number, mean: number, burst: boolean): [number, number, number, number, number] {
  // สัดส่วนคะแนน 1–5 จากค่าเฉลี่ยเป้าหมาย
  const five = Math.min(0.95, Math.max(0.1, (mean - 3) / 2 + between(rng, -0.05, 0.05)));
  const rest = 1 - five;
  const four = rest * (mean >= 4 ? 0.6 : 0.35);
  const three = rest * (mean >= 4 ? 0.2 : 0.25);
  const two = rest * (mean >= 4 ? 0.1 : 0.2);
  const one = rest - four - three - two;
  const shares = burst ? [0.03, 0.02, 0.03, 0.07, 0.85] : [one, two, three, four, five];
  const counts = shares.map((s) => Math.round(s * total));
  counts[4] += total - counts.reduce((a, b) => a + b, 0);
  return counts as [number, number, number, number, number];
}

function sampleReviews(rng: Rng, conn: ConnLike, hist: number[], shopAgeDays: number, burst: boolean): Review[] {
  const total = hist.reduce((a, b) => a + b, 0);
  const n = Math.min(30, total);
  const reviews: Review[] = [];
  for (let i = 0; i < n; i++) {
    let rating: Review['rating'];
    let text: string;
    let daysAgo: number;
    if (burst && i < Math.round(n * 0.7)) {
      rating = 5;
      text = pick(rng, BURST_TEXTS);
      daysAgo = intBetween(rng, 0, 4);
    } else {
      // สุ่มคะแนนตามสัดส่วน Histogram
      let r = rng() * total;
      let k = 0;
      while (k < 4 && r >= hist[k]) r -= hist[k++];
      rating = (k + 1) as Review['rating'];
      text = rating >= 4 ? pick(rng, GOOD_TEXTS) : rating === 3 ? pick(rng, MID_TEXTS) : pick(rng, BAD_TEXTS);
      daysAgo = intBetween(rng, 0, Math.max(1, shopAgeDays - 1));
    }
    reviews.push({ id: `${conn.id}-R${i + 1}`, rating, text, daysAgo });
  }
  return reviews.sort((a, b) => a.daysAgo - b.daysAgo);
}

export function generateSnapshot(conn: ConnLike, profileCategory: string): MarketplaceSnapshot {
  // Raw Source: ใช้หมวดที่บันทึกตอนนำเข้า (ถ้ามี) — การแก้หมวดในโปรไฟล์ร้านไม่เปลี่ยนข้อมูลต้นฉบับ
  const category = conn.sourceCategory ?? profileCategory;
  const p = ARCHETYPES[conn.archetype];
  const rng = mulberry32(conn.seed);
  const shopAgeMonths = intBetween(rng, p.shopAgeMonths[0], p.shopAgeMonths[1]);
  const base = between(rng, p.baseMonthlyOrders[0], p.baseMonthlyOrders[1]);

  const monthlyOrders = Array.from({ length: 12 }, (_, i) => {
    const monthsAgo = 11 - i;
    if (monthsAgo >= shopAgeMonths) return 0;
    const age = shopAgeMonths - monthsAgo;
    const trend = base * Math.pow(1 + p.growth, Math.min(age, 12) - 6);
    return Math.max(0, Math.round(trend * (1 + between(rng, -p.volatility, p.volatility))));
  });
  if (p.salesSpike) monthlyOrders[11] = Math.round(monthlyOrders[11] * 10);
  const totalOrders = monthlyOrders.reduce((a, b) => a + b, 0);

  // รายการสินค้า
  const products = productsOfCategory(category);
  const count = Math.min(products.length, intBetween(rng, 3, 5));
  // Fisher–Yates — ผลเหมือนกันทุก JS Engine (sort แบบสุ่มให้ผลต่างกันระหว่าง Chrome/Safari)
  const shuffled = [...products];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, count);
  const anomalyKey = p.lowPricedHighRiskItem ? (chosen.find((c) => c.risk === 'high') ?? chosen.find((c) => c.risk === 'medium') ?? chosen[0])?.key ?? '' : '';
  const weights = chosen.map(() => between(rng, 0.5, 1.5));
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;

  const histogramTotal = Math.round(totalOrders * p.reviewRate);
  const ratingHist = ratingHistogram(rng, histogramTotal, p.ratingMean, !!p.reviewBurst);
  const avgRating = histogramTotal ? ratingHist.reduce((s, c, i) => s + c * (i + 1), 0) / histogramTotal : 0;

  const listings: Listing[] = chosen.map((ref, i) => {
    const isAnomaly = ref.key === anomalyKey;
    const price = Math.max(9, Math.round(ref.median * (isAnomaly ? between(rng, 0.3, 0.4) : between(rng, p.priceFactor[0], p.priceFactor[1]))));
    const priceHistory = Array.from({ length: 6 }, (_, m) => {
      if (isAnomaly && m < 3) return Math.round(ref.median * between(rng, 0.85, 1.0));
      return m === 5 ? price : Math.round(price * (1 + between(rng, -0.05, 0.05)));
    });
    const unitsSold12m = Math.round((totalOrders * weights[i]) / wSum);
    return {
      id: `${conn.id}-P${i + 1}`,
      productKey: ref.key,
      name: ref.name,
      category: ref.category,
      productRisk: ref.risk,
      price,
      priceHistory,
      unitsSold12m,
      reviewCount: Math.round((histogramTotal * weights[i]) / wSum),
      avgRating: round(Math.min(5, Math.max(1, avgRating + between(rng, -0.2, 0.2))), 1),
    };
  });
  const avgOrderValue = listings.length ? Math.round(listings.reduce((s, l) => s + l.price, 0) / listings.length) : 0;

  return {
    connectionId: conn.id,
    platform: conn.platform,
    shopAgeMonths,
    monthlyOrders,
    avgOrderValue,
    cancelRate: round(between(rng, p.cancelRate[0], p.cancelRate[1]), 3),
    returnRate: round(between(rng, p.returnRate[0], p.returnRate[1]), 3),
    onTimeShipRate: round(between(rng, p.onTimeShipRate[0], p.onTimeShipRate[1]), 3),
    chatResponseRate: round(between(rng, p.chatResponseRate[0], p.chatResponseRate[1]), 3),
    ratingHistogram: ratingHist,
    totalReviews: histogramTotal,
    reviews: sampleReviews(rng, conn, ratingHist, shopAgeMonths * 30, !!p.reviewBurst),
    listings,
  };
}

// Snapshot คำนวณซ้ำได้ — Cache ตาม Seed/Archetype/หมวดสินค้า
const cache = new Map<string, MarketplaceSnapshot>();
export function snapshotOf(conn: ConnLike, category: string): MarketplaceSnapshot {
  const key = `${conn.id}|${conn.seed}|${conn.archetype}|${conn.sourceCategory ?? category}`;
  let s = cache.get(key);
  if (!s) {
    s = generateSnapshot(conn, category);
    cache.set(key, s);
  }
  return s;
}
