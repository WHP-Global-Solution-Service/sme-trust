/** SME Trust v2 — การเชื่อมต่อ Marketplace แบบจำลอง (ไม่มีการเชื่อมต่อ API จริง) */
import type { ISODate } from '@/types';

export type Platform = 'shopee' | 'lazada';
export type ConnectionStatus = 'pending_consent' | 'syncing' | 'connected' | 'sync_failed' | 'disconnected';
/** จุดที่การเชื่อมต่อจำลองล้มเหลว */
export type FailKind = 'connect' | 'import' | 'sync';
export type ProductRisk = 'low' | 'medium' | 'high';

/** โปรไฟล์ข้อมูลจำลองของร้าน — กำหนดลักษณะข้อมูลที่ Generator สร้าง */
export type Archetype = 'established_good' | 'growing_ok' | 'new_shop' | 'price_anomaly' | 'review_burst' | 'fulfillment_issue' | 'sales_spike' | 'owner_mismatch';

export interface MarketplaceConnection {
  id: string;
  merchantId: string;
  platform: Platform;
  /** รหัสร้านจำลอง เช่น SPE-482913 — ไม่ใช่รหัสร้านจริงบนแพลตฟอร์ม */
  mockShopId: string;
  mockShopName: string;
  status: ConnectionStatus;
  /** ขอบเขตข้อมูลที่ร้านให้ความยินยอม (จำลอง) */
  scopes: string[];
  archetype: Archetype;
  /** Seed ของ Generator — Seed เดิมได้ข้อมูลเดิมทุกครั้ง */
  seed: number;
  createdAt: ISODate;
  consentAt?: ISODate;
  lastSyncAt?: ISODate;
  /** ที่มาของวันที่ซิงก์ล่าสุด (Source Context) — seed = ข้อมูลตัวอย่าง, sync = ผู้ใช้กดซิงก์ (จำลอง), simulated_age = Fixture จำลองอายุข้อมูล */
  syncSource?: 'seed' | 'sync' | 'simulated_age';
  /** ผลการซิงก์ล่าสุด (สำหรับ KPI Connection Success/Failed) */
  syncCount?: number;
  /** ประเภทความล้มเหลวที่จำลอง */
  failKind?: FailKind;
  disconnectedAt?: ISODate;
  failReason?: string;
  /**
   * หมวดสินค้าของร้านบนแพลตฟอร์ม ณ ตอนนำเข้า (Raw Source) — ถ้ามี Generator ใช้ค่านี้แทนหมวดในโปรไฟล์ร้าน
   * เพื่อให้การแก้ข้อมูลลงทะเบียน (เช่นหมวดธุรกิจ) ไม่เปลี่ยนข้อมูลต้นฉบับจาก Marketplace
   */
  sourceCategory?: string;
  /**
   * ชื่อร้านต้นฉบับบน Marketplace (จำลอง) — บันทึกไว้เมื่อเจ้าหน้าที่อนุมัติการเปลี่ยนชื่อร้าน
   * เพื่อให้ข้อมูลต้นฉบับไม่เปลี่ยนตามชื่อร้านใหม่ในโปรไฟล์ (ไม่มีค่า = ใช้ชื่อร้านในโปรไฟล์ตามเดิม)
   */
  sourceShopName?: string;
  /**
   * ผลการตรวจข้อมูลตัวตนโดยเจ้าหน้าที่ (เมื่อชื่อเจ้าของบัญชีร้านบน Marketplace ไม่ตรงกับผู้ยืนยันตัวตน)
   * verified = ยืนยันว่าเป็นร้านเดียวกัน · rejected = ไม่ใช่ร้านของผู้ประกอบการ → ข้อมูลจากการเชื่อมต่อนี้ไม่ถูกใช้ประเมิน
   */
  identityReview?: { status: 'verified' | 'rejected'; by: string; at: ISODate; taskId: string };
  /** ร้านบน Marketplace (Shop ID เดียวกัน) ถูกเชื่อมกับร้านอื่นในระบบอยู่แล้วตอนเชื่อมต่อ — ส่งเจ้าหน้าที่ตรวจความเป็นเจ้าของ */
  ownershipConflict?: { merchantId: string; detectedAt: ISODate };
}

export interface Listing {
  id: string;
  productKey: string;
  name: string;
  category: string;
  productRisk: ProductRisk;
  price: number;
  /** ราคา 6 เดือนล่าสุด (เก่า → ใหม่) */
  priceHistory: number[];
  unitsSold12m: number;
  reviewCount: number;
  avgRating: number;
}

export interface Review {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  daysAgo: number;
}

/** ข้อมูลการขายจำลองของร้านบนแพลตฟอร์มหนึ่ง (คำนวณซ้ำได้ ไม่เก็บใน localStorage) */
export interface MarketplaceSnapshot {
  connectionId: string;
  platform: Platform;
  shopAgeMonths: number;
  /** คำสั่งซื้อรายเดือน 12 เดือน (เก่า → ใหม่) — เดือนก่อนเปิดร้านเป็น 0 */
  monthlyOrders: number[];
  avgOrderValue: number;
  cancelRate: number;
  returnRate: number;
  onTimeShipRate: number;
  chatResponseRate: number;
  /** จำนวนรีวิวต่อคะแนน 1–5 */
  ratingHistogram: [number, number, number, number, number];
  totalReviews: number;
  /** ตัวอย่างรีวิว (ไม่เกิน 30 รายการ) */
  reviews: Review[];
  listings: Listing[];
}
