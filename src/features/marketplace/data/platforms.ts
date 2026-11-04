import type { Archetype, Platform } from '../types';

/**
 * ชื่อแพลตฟอร์มที่แสดงใน UI — มีป้าย "(จำลอง)" ทุกครั้ง ไม่ใช้โลโก้หรือสีแบรนด์จริง
 * เปลี่ยนชื่อที่นี่ที่เดียวหากต้องใช้ชื่อกลาง
 */
export const PLATFORMS: Record<Platform, { label: string; short: string; idPrefix: string }> = {
  shopee: { label: 'Shopee (จำลอง)', short: 'Shopee', idPrefix: 'SPE' },
  lazada: { label: 'Lazada (จำลอง)', short: 'Lazada', idPrefix: 'LZD' },
};

export const PLATFORM_LIST: Platform[] = ['shopee', 'lazada'];

export const MARKETPLACE_DISCLAIMER =
  'ยังไม่มีการเชื่อมต่อ API จริงกับ Shopee หรือ Lazada — การเชื่อมต่อ ความยินยอม และข้อมูลการขายทั้งหมดเป็นข้อมูลสมมติที่สร้างในเบราว์เซอร์เพื่อการสาธิต และไม่ได้รับความร่วมมือจากแพลตฟอร์มใด';

/** ขอบเขตข้อมูลที่ขอความยินยอม (จำลอง) */
export const CONSENT_SCOPES = [
  'ข้อมูลร้าน (ชื่อร้าน อายุร้าน หมวดสินค้า)',
  'รายการสินค้าและราคา (ย้อนหลัง 6 เดือน)',
  'สรุปคำสั่งซื้อรายเดือน (ไม่มีข้อมูลผู้ซื้อ)',
  'อัตรายกเลิก คืนสินค้า และการจัดส่งตรงเวลา',
  'คะแนนและรีวิว (ไม่มีชื่อผู้รีวิว)',
];

export const ARCHETYPE_LABEL: Record<Archetype, { label: string; desc: string }> = {
  established_good: { label: 'ร้านที่ขายมานาน ผลงานดี', desc: 'ยอดขายสม่ำเสมอ รีวิวดี คืนสินค้าน้อย' },
  growing_ok: { label: 'ร้านที่กำลังเติบโต', desc: 'ขายมาไม่ถึงปี ยอดโตปกติ รีวิวดีแต่ยังไม่มาก' },
  new_shop: { label: 'ร้านเปิดใหม่', desc: 'คำสั่งซื้อและรีวิวยังน้อยมาก' },
  price_anomaly: { label: 'มีสินค้าราคาต่ำกว่าช่วงอ้างอิงมาก', desc: 'สินค้าความเสี่ยงสูงบางรายการราคาต่ำผิดปกติ' },
  review_burst: { label: 'รีวิวกระจุกตัวผิดธรรมชาติ', desc: 'รีวิว 5 ดาวจำนวนมากในเวลาสั้น ข้อความสั้นและซ้ำกัน' },
  fulfillment_issue: { label: 'มีปัญหาการจัดส่ง', desc: 'ยกเลิกและคืนสินค้าสูง จัดส่งล่าช้า' },
  sales_spike: { label: 'ยอดขายพุ่งผิดปกติ', desc: 'ยอดขายเดือนล่าสุดสูงกว่าปกติหลายเท่า' },
};
