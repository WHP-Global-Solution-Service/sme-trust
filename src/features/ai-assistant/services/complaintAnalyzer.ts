import type { ComplaintAnalysis, ComplaintKind, ExtractedFacts, FollowUpLevel } from '../types/ai.types';
import {
  ATTENTION_AMOUNT,
  ATTENTION_PATTERNS,
  COMPLAINT_KEYWORDS,
  COMPLAINT_MAX_LENGTH,
  COMPLAINT_MIN_LENGTH,
  INFO_LABEL,
  RECOMMENDATIONS,
  REQUIRED_INFO,
  URGENT_PATTERNS,
  type InfoKey,
} from '../rules/complaintRules';

/**
 * AI-02 Complaint Resolution Assistant — Rule-based Engine (Pure Functions)
 * สรุปเฉพาะข้อมูลที่พบในข้อความ ไม่เติมข้อเท็จจริงที่ไม่มีอยู่ และไม่ตัดสินว่าฝ่ายใดผิด
 */

export function validateComplaintInput(text: string): string | null {
  const t = text.trim();
  if (!t) return 'กรุณากรอกหรือเลือกข้อร้องเรียนก่อนวิเคราะห์';
  if (t.length < COMPLAINT_MIN_LENGTH) return `ข้อความสั้นเกินไป (อย่างน้อย ${COMPLAINT_MIN_LENGTH} ตัวอักษร)`;
  if (text.length > COMPLAINT_MAX_LENGTH) return `ข้อความยาวเกิน ${COMPLAINT_MAX_LENGTH.toLocaleString()} ตัวอักษร`;
  return null;
}

const TH_MONTH = '(?:ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)';

/** ดึงเฉพาะข้อเท็จจริงที่ปรากฏในข้อความ */
export function extractFacts(text: string): ExtractedFacts {
  const order =
    text.match(/(?:เลข(?:ที่)?(?:คำสั่งซื้อ|ออเดอร์)|คำสั่งซื้อ|ออเดอร์|order(?:\s*(?:no\.?|number|id|#))?)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/i) ??
    text.match(/\b([A-Z]{2,5}-\d{3,}(?:-\d+)?)\b/);
  const amount = text.match(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:บาท|฿|baht|THB)/i) ?? text.match(/฿\s*(\d[\d,]*)/);
  const date =
    text.match(new RegExp(`\\d{1,2}\\s*${TH_MONTH}(?:\\s*\\d{2,4})?`)) ??
    text.match(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/) ??
    text.match(/เมื่อ(?:วาน|วันที่\s*\d{1,2}|\s*\d+\s*วัน(?:ก่อน|ที่แล้ว))|สัปดาห์ที่แล้ว|เดือนที่แล้ว/);
  return {
    orderRef: order?.[1],
    amount: amount ? `${amount[0].trim()}` : undefined,
    date: date?.[0].trim(),
    mentionsPayment: /โอน(?:เงิน)?|ชำระ|จ่ายเงิน|สลิป|ตัดบัตร|\bpaid\b|\bpayment\b|\btransfer/i.test(text),
    mentionsPhoto: /รูป|ภาพ|ถ่าย|คลิป|วิดีโอ|\bphoto|\bpicture|\bimage|\bvideo/i.test(text),
    mentionsTracking: /เลขพัสดุ|เลขแทร็ก|tracking|kerry|flash|ems|ไปรษณีย์|ขนส่ง\S*\s*[A-Z0-9]{8,}/i.test(text),
  };
}

export function detectKinds(text: string): { primary: ComplaintKind; kinds: ComplaintKind[]; hits: Record<string, number> } {
  const hits: Record<string, number> = {};
  for (const [kind, patterns] of Object.entries(COMPLAINT_KEYWORDS)) {
    const n = patterns.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0);
    if (n) hits[kind] = n;
  }
  // "ไม่ได้รับเงินคืน" เป็นเรื่องคืนเงิน ไม่ใช่การไม่ได้รับสินค้า
  if (hits.refund && hits.non_delivery && /ไม่ได้รับ(?:เงิน|การคืนเงิน)|ได้รับเงินคืน/.test(text) && !/ไม่ได้รับ(?:สินค้า|ของ|พัสดุ)/.test(text)) delete hits.non_delivery;
  const kinds = (Object.keys(hits) as ComplaintKind[]).sort((a, b) => hits[b] - hits[a]);
  return { primary: kinds[0] ?? 'other', kinds: kinds.length ? kinds : ['other'], hits };
}

const has = (facts: ExtractedFacts, key: InfoKey, text: string): boolean => {
  switch (key) {
    case 'orderRef':
      return !!facts.orderRef;
    case 'date':
      return !!facts.date;
    case 'payment':
      return /สลิป|หลักฐาน(?:การ)?(?:โอน|ชำระ)|\breceipt\b|\bslip\b/i.test(text);
    case 'photo':
      return facts.mentionsPhoto;
    case 'tracking':
      return facts.mentionsTracking;
    case 'advertised':
      return /ลิงก์|โพสต์|ภาพ(?:ใน|ตาม)?(?:โฆษณา|ประกาศ)|\blink\b|\bpost\b/i.test(text);
    case 'refundRequest':
      return /ขอคืน(?:เงิน)?(?:ไป)?(?:เมื่อ|ตั้งแต่)|แจ้งขอคืน|\brequested\s+(?:a\s+)?refund\b/i.test(text);
    case 'chat':
      return /แชต|แชท|ไลน์|line|inbox|ข้อความ|โทร/i.test(text);
  }
};

function keyIssues(kinds: ComplaintKind[], facts: ExtractedFacts): string[] {
  const out: string[] = [];
  for (const k of kinds) {
    if (k === 'non_delivery') out.push(facts.mentionsPayment ? 'ลูกค้าแจ้งว่าชำระเงินแล้ว แต่ยังไม่ได้รับสินค้า' : 'ลูกค้าแจ้งว่ายังไม่ได้รับสินค้า');
    if (k === 'mismatch') out.push('ลูกค้าแจ้งว่าสินค้าที่ได้รับไม่ตรงกับรายละเอียดที่คาดหวังหรือที่โฆษณาไว้');
    if (k === 'damaged') out.push('ลูกค้าแจ้งว่าสินค้าชำรุดหรือใช้งานไม่ได้');
    if (k === 'refund') out.push('ลูกค้าแจ้งปัญหาเกี่ยวกับการคืนเงิน');
    if (k === 'delay') out.push('ลูกค้าแจ้งว่าการจัดส่งล่าช้ากว่าที่คาดไว้');
    if (k === 'service') out.push('ลูกค้าไม่พอใจการบริการหรือต้องการคำชี้แจงจากร้าน');
    if (k === 'other') out.push('ลูกค้าแจ้งปัญหาที่ยังจัดประเภทไม่ได้ ควรสอบถามรายละเอียดเพิ่มเติม');
  }
  // ระบุเฉพาะข้อมูลที่พบในข้อความจริง
  if (facts.orderRef) out.push(`ข้อความระบุเลขคำสั่งซื้อ: ${facts.orderRef}`);
  if (facts.amount) out.push(`ข้อความระบุมูลค่า: ${facts.amount}`);
  if (facts.date) out.push(`ข้อความระบุช่วงเวลา: ${facts.date}`);
  return out;
}

function followUp(text: string, kinds: ComplaintKind[], facts: ExtractedFacts): { level: FollowUpLevel; reasons: string[] } {
  const urgent = URGENT_PATTERNS.filter((u) => u.pattern.test(text)).map((u) => u.reason);
  if (urgent.length) return { level: 'urgent', reasons: urgent };
  const reasons = ATTENTION_PATTERNS.filter((a) => a.pattern.test(text)).map((a) => a.reason);
  const amount = facts.amount ? Number(facts.amount.replace(/[^\d.]/g, '')) : 0;
  if (amount >= ATTENTION_AMOUNT) reasons.push(`มูลค่าที่ระบุสูง (${facts.amount})`);
  if (kinds.filter((k) => k !== 'other').length >= 2) reasons.push('พบหลายประเด็นในเรื่องเดียว');
  return { level: reasons.length ? 'attention' : 'normal', reasons };
}

export function analyzeComplaint(text: string, now = new Date()): ComplaintAnalysis {
  const facts = extractFacts(text);
  const { primary, kinds } = detectKinds(text);
  const needed = [...new Set(kinds.flatMap((k) => REQUIRED_INFO[k]))];
  const missing = needed.filter((k) => !has(facts, k, text)).map((k) => INFO_LABEL[k]);
  const { level, reasons } = followUp(text, kinds, facts);
  const recommendations = [...new Set(kinds.flatMap((k) => RECOMMENDATIONS[k]))];
  if (level === 'urgent') recommendations.unshift('แนะนำให้แจ้งเจ้าหน้าที่ตรวจสอบโดยเร็ว และไม่ควรรอผลการเจรจาเพียงอย่างเดียว');
  return {
    input: text,
    primary,
    kinds,
    keyIssues: keyIssues(kinds, facts),
    facts,
    missing,
    level,
    levelReasons: reasons,
    recommendations,
    officerReviewSuggested: level === 'urgent',
    checkedAt: now.toISOString(),
  };
}

export const FOLLOW_UP_LABEL: Record<FollowUpLevel, { label: string; tone: 'neutral' | 'warning' | 'error' }> = {
  normal: { label: 'Normal — ติดตามตามปกติ', tone: 'neutral' },
  attention: { label: 'Attention — ควรติดตามใกล้ชิด', tone: 'warning' },
  urgent: { label: 'Urgent Review — ควรให้เจ้าหน้าที่ตรวจสอบโดยเร็ว', tone: 'error' },
};
