/**
 * Trust Assessment Model v2 (Configuration) — ค่าทั้งหมดเป็นค่าเริ่มต้นสำหรับการจำลอง
 * น้ำหนักองค์ประกอบปรับได้ที่หน้า "โมเดลการประเมิน" ของผู้ดูแลระบบ (ผลรวมต้องเท่ากับ 100)
 */
export type ComponentId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type Weights = Record<ComponentId, number>;

export const COMPONENTS: Record<ComponentId, { label: string; en: string; source: string; desc: string }> = {
  C1: { label: 'ตัวตนและธุรกิจ', en: 'Identity & Business', source: 'ข้อมูล v1', desc: 'e-KYC, การอนุมัติร้าน, ใบรับรอง และช่องทางขายที่ยืนยันแล้ว' },
  C2: { label: 'ผลการขายและการจัดส่ง', en: 'Sales Performance', source: 'Marketplace (จำลอง)', desc: 'อายุร้าน ความสม่ำเสมอของยอดขาย การยกเลิก/คืนสินค้า การจัดส่งตรงเวลา การตอบแชต' },
  C3: { label: 'เสียงลูกค้า', en: 'Customer Experience', source: 'Marketplace (จำลอง)', desc: 'คะแนนรีวิวถ่วงความใหม่ และประเด็นเชิงลบที่พบบ่อย' },
  C4: { label: 'ความสมเหตุสมผลของราคา', en: 'Price Transparency', source: 'Marketplace (จำลอง)', desc: 'ราคาเทียบช่วงอ้างอิงของประเภทสินค้า โดยคำนึงถึงความเสี่ยงของสินค้าและหลักฐานสนับสนุน' },
  C5: { label: 'การปฏิบัติตามและการแก้ไขปัญหา', en: 'Compliance', source: 'ข้อมูล v1', desc: 'ข้อร้องเรียนที่แก้ไขสำเร็จ/ส่งต่อ คำเตือนที่ค้าง และการอบรม' },
};

export const MODEL_V2 = {
  version: 'v2.1-sim',
  weights: { C1: 25, C2: 25, C3: 20, C4: 10, C5: 20 } as Weights,
  /** คะแนนที่หักจากคะแนนรวมเมื่อพบสัญญาณความเสี่ยง (ไม่ใช่ข้อสรุปว่ากระทำผิด) */
  penalties: {
    priceWatch: 8,
    reviewBurst: 8,
    salesSpike: 5,
    seriousOpenComplaint: 10,
    crossSignal: 5,
    /** อัตราคืนสินค้าสูงผิดปกติ (v2.1) */
    highReturn: 5,
  },
  /** เกณฑ์ของสัญญาณความเสี่ยงที่ไม่ได้มาจากการวิเคราะห์ราคา/รีวิว (v2.1) */
  riskThresholds: { returnRate: 0.1 },
  bands: { A: 80, B: 65, C: 50 },
  /**
   * เงื่อนไขเพิ่มของ Band A (v2.1 — จากการตรวจสอบโมเดล P7-B): ร้านที่มีข้อมูลน้อยหรือข้อมูลขัดแย้งกัน
   * ไม่ได้ Band A จากการกระจายน้ำหนักใหม่ แม้คะแนนจะสูง (สูงสุด B พร้อมเหตุผล)
   */
  bandA: { minCoverage: 70 },
  /** ข้อมูลขั้นต่ำก่อนให้ Band — ต่ำกว่านี้เป็น Insufficient Data (D6) */
  minimums: { orders: 30, reviews: 10, months: 3 },
  /** เป้าหมายของ Data Coverage และน้ำหนักของแต่ละมิติ (D7) */
  coverage: {
    platforms: { target: 2, weight: 20 },
    months: { target: 12, weight: 20 },
    listings: { target: 5, weight: 15 },
    orders: { target: 100, weight: 15 },
    reviews: { target: 30, weight: 15 },
    history: { target: 1, weight: 15 },
  },
  /** Data Confidence (D7) — เริ่ม 100 แล้วหักตามเงื่อนไข */
  confidence: {
    freshFullDays: 30,
    freshPartialDays: 90,
    stalePartial: 15,
    staleFull: 35,
    singleSource: 15,
    smallOrders: 25,
    smallReviews: 15,
    /** ตัวอย่างผ่านขั้นต่ำแล้วแต่ยังต่ำกว่าเป้าหมายของ Coverage (v2.1) — ตัวอย่างน้อยไม่แน่นอนกว่าตัวอย่างมาก */
    moderateOrders: 10,
    moderateReviews: 10,
    platformGap: 15,
    reviewBurst: 30,
    high: 75,
    medium: 50,
  },
} as const;

export type Model = Omit<typeof MODEL_V2, 'weights'> & { weights: Weights; weightSet?: { revision: number; at?: string } };

export const modelWith = (weights: Weights): Model => ({ ...MODEL_V2, weights });

/** ตรวจน้ำหนัก: จำนวนเต็ม 0–100 ทุกองค์ประกอบ และผลรวม = 100 */
export function validateWeights(w: Weights): string | undefined {
  const ids = Object.keys(COMPONENTS) as ComponentId[];
  for (const id of ids) {
    const v = w[id];
    if (!Number.isInteger(v) || v < 0 || v > 100) return `น้ำหนัก ${id} ต้องเป็นจำนวนเต็ม 0–100`;
  }
  const sum = ids.reduce((s, id) => s + w[id], 0);
  if (sum !== 100) return `ผลรวมน้ำหนักต้องเท่ากับ 100 (ปัจจุบัน ${sum})`;
  return undefined;
}
