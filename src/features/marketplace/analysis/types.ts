import type { Platform, ProductRisk } from '../types';

/** info = ข้อสังเกต (ไม่หักคะแนน) · watch = ควรตรวจสอบเพิ่มเติม (เป็นสัญญาณความเสี่ยง) */
export type FindingLevel = 'info' | 'watch';

export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  detail: string;
  evidence: string[];
  platform?: Platform;
}

export interface PriceFinding extends Finding {
  kind: 'below_reference' | 'above_reference' | 'price_jump';
  listingId: string;
  productName: string;
  productRisk: ProductRisk;
  /** ราคา ÷ ราคากลางอ้างอิง */
  ratio: number;
  /** หลักฐานที่ทำให้ลดระดับความกังวล เช่น คำสั่งซื้อจำนวนมาก รีวิวดี */
  mitigations: string[];
}

export interface PriceAnalysis {
  listingsAnalyzed: number;
  findings: PriceFinding[];
  /** สินค้าความเสี่ยงสูง/กลางที่ราคาต่ำมากโดยไม่มีหลักฐานสนับสนุน */
  watchCount: number;
}

export interface SalesAnalysis {
  totalOrders: number;
  monthsOfData: number;
  /** คำสั่งซื้อรายเดือนรวมทุกแพลตฟอร์ม (เก่า → ใหม่) */
  monthlyOrders: number[];
  /** ค่าสัมประสิทธิ์การแปรผันของยอดรายเดือน (เดือนที่มีข้อมูล) */
  variability: number;
  spike: { monthIndex: number; factor: number } | null;
  shopAgeMonths: number;
  cancelRate: number;
  returnRate: number;
  onTimeShipRate: number;
  chatResponseRate: number;
  transactionValue: number;
  findings: Finding[];
}

export interface ReviewAnalysis {
  totalReviews: number;
  avgRating: number;
  /** คะแนนเฉลี่ยจากตัวอย่างรีวิว ถ่วงน้ำหนักให้รีวิวใหม่มากกว่า */
  recentRating: number;
  histogram: [number, number, number, number, number];
  burst: { share: number; count: number } | null;
  /** สัดส่วนรีวิว 5 ดาวที่ข้อความสั้นมาก/ซ้ำกัน */
  lowQualityShare: number;
  negativeThemes: { kind: string; label: string; count: number }[];
  /** ผลต่างคะแนนเฉลี่ยระหว่างแพลตฟอร์ม (ถ้ามีมากกว่า 1) */
  platformGap: number | null;
  findings: Finding[];
}
