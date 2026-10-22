import type { Complaint, ComplaintCategory, Priority, ScreeningResult } from '@/types';
import { COMPLAINT_CATEGORY } from '@/constants/labels';

/**
 * Complaint Screening Assistant (จำลอง)
 * ใช้กฎแบบ Rule-based เท่านั้น ไม่เรียก AI ภายนอก
 * ผลลัพธ์เป็นคำแนะนำเบื้องต้น ไม่ใช่คำวินิจฉัยทางกฎหมาย
 */

export interface ScreeningInput {
  merchantId: string;
  consumerId: string;
  category: ComplaintCategory;
  description: string;
  orderRef: string;
  incidentDate: string;
  orderAmount: number;
  evidenceCount: number;
  excludeId?: string;
}

const KEYWORDS: { cat: ComplaintCategory; words: string[] }[] = [
  { cat: 'not_received', words: ['ไม่ได้รับ', 'ไม่ส่ง', 'ยังไม่ได้ของ', 'ติดต่อไม่ได้', 'บล็อก', 'เลขพัสดุ', 'หาย'] },
  { cat: 'not_as_described', words: ['ไม่ตรง', 'ปลอม', 'คนละสี', 'คนละรุ่น', 'ผิดไซซ์', 'ไม่เหมือนรูป'] },
  { cat: 'refund_refused', words: ['คืนเงิน', 'ไม่คืน', 'ไม่ยอมคืน', 'โอนคืน'] },
  { cat: 'misleading_ad', words: ['โฆษณา', 'เกินจริง', 'หายขาด', 'รักษา', 'ลดน้ำหนัก', 'การันตี', 'ได้ผล 100'] },
  { cat: 'defective', words: ['ชำรุด', 'เสีย', 'แตก', 'พัง', 'ใช้ไม่ได้', 'รั่ว'] },
  { cat: 'service_breach', words: ['นัด', 'ไม่มาตามนัด', 'บริการ', 'ข้อตกลง', 'สัญญา', 'ติดตั้ง'] },
];

const SEVERE_WORDS = ['แพ้', 'บาดเจ็บ', 'อันตราย', 'โรงพยาบาล', 'ไฟไหม้', 'ระเบิด', 'ช็อต', 'เด็กกลืน', 'เป็นพิษ', 'ผื่น'];

export function suggestCategory(text: string, fallback: ComplaintCategory): { cat: ComplaintCategory; hits: string[] } {
  let best: { cat: ComplaintCategory; hits: string[] } = { cat: fallback, hits: [] };
  for (const k of KEYWORDS) {
    const hits = k.words.filter((w) => text.includes(w));
    if (hits.length > best.hits.length) best = { cat: k.cat, hits };
  }
  return best;
}

export function screenComplaint(input: ScreeningInput, existing: Complaint[]): ScreeningResult {
  const reasons: string[] = [];
  const missing: string[] = [];
  const desc = input.description.trim();

  const { cat, hits } = suggestCategory(desc, input.category);
  if (hits.length && cat !== input.category) {
    reasons.push(`พบคำสำคัญ "${hits.join('", "')}" ซึ่งสอดคล้องกับหมวด "${COMPLAINT_CATEGORY[cat]}"`);
  }

  if (desc.length < 40) missing.push('รายละเอียดเหตุการณ์ (ควรมีอย่างน้อย 40 ตัวอักษร)');
  if (!input.orderRef.trim()) missing.push('เลขที่คำสั่งซื้อหรือหลักฐานการชำระเงิน');
  if (!input.incidentDate) missing.push('วันที่เกิดเหตุ');
  if (input.evidenceCount === 0) missing.push('หลักฐานประกอบ เช่น ภาพแชต สลิปโอนเงิน ภาพสินค้า');
  if (!input.orderAmount) missing.push('มูลค่าสินค้าหรือบริการ');

  const severeHits = SEVERE_WORDS.filter((w) => desc.includes(w));
  const severe = severeHits.length > 0;
  if (severe) reasons.push(`พบคำที่บ่งชี้ความเสี่ยงต่อสุขภาพหรือความปลอดภัย: ${severeHits.join(', ')}`);

  const duplicateOf = existing
    .filter((c) => c.id !== input.excludeId)
    .filter(
      (c) =>
        c.merchantId === input.merchantId &&
        ((input.orderRef.trim() && c.orderRef.trim().toLowerCase() === input.orderRef.trim().toLowerCase()) ||
          (c.consumerId === input.consumerId && c.category === input.category && !['resolved', 'closed'].includes(c.status))),
    )
    .map((c) => c.id);
  if (duplicateOf.length) reasons.push(`อาจซ้ำกับเรื่องเดิม: ${duplicateOf.join(', ')}`);

  const sameMerchantOpen = existing.filter(
    (c) => c.merchantId === input.merchantId && c.id !== input.excludeId && !['resolved', 'closed'].includes(c.status),
  ).length;
  if (sameMerchantOpen >= 3) reasons.push(`ร้านค้านี้มีเรื่องที่ยังไม่ปิดอีก ${sameMerchantOpen} เรื่อง`);

  let priority: Priority = 'low';
  if (input.orderAmount >= 2000 || sameMerchantOpen >= 2) priority = 'medium';
  if (input.orderAmount >= 10000 || sameMerchantOpen >= 3 || input.category === 'misleading_ad') priority = 'high';
  if (severe) priority = 'urgent';

  let nextStep: string;
  if (severe) nextStep = 'กรณีเสี่ยงต่อสุขภาพ/ความปลอดภัย แนะนำส่งต่อเจ้าหน้าที่ทันทีโดยไม่ต้องรอร้านค้า';
  else if (duplicateOf.length) nextStep = 'ตรวจสอบกับเรื่องเดิมก่อน หากเป็นเหตุการณ์เดียวกันให้เพิ่มข้อมูลในเรื่องเดิมแทนการยื่นใหม่';
  else if (missing.length >= 2) nextStep = 'ขอข้อมูลเพิ่มเติมจากผู้บริโภคก่อนส่งให้ร้านค้า';
  else nextStep = 'ส่งให้ร้านค้าแก้ไขเบื้องต้น (Merchant First Resolution) ภายใน 3 วัน';

  const total = 5;
  const completeness = Math.round(((total - missing.length) / total) * 100);

  return { suggestedCategory: cat, missing, nextStep, priority, duplicateOf, severe, reasons, completeness };
}
