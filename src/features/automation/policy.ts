/**
 * นโยบายของระบบอัตโนมัติ (Configuration) — อ่านอย่างเดียวใน Prototype
 * - Routing Policy: เกณฑ์ที่ใช้คัดกรอง AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW
 * - Certification Policy: Level ใดดำเนินการอัตโนมัติได้ภายใต้นโยบายที่ได้รับอนุมัติ และ Level ใดต้องให้เจ้าหน้าที่พิจารณา
 *   ค่าเริ่มต้นคงกฎเดิมของระบบทุกข้อ (ไม่เปลี่ยนกฎการอนุมัติ) — การเปิดอนุมัติอัตโนมัติต้องมีนโยบายและอำนาจที่ได้รับอนุมัติก่อน
 */
import type { TrustLevel } from '@/types';
import type { Band } from '@/features/trust-assessment/types';

export const ROUTING_POLICY = {
  version: 'routing-1.0',
  /** สัญญาณที่ต้องให้เจ้าหน้าที่พิจารณาเสมอ แม้พบเพียงข้อเดียว */
  hardSignals: ['risk.cross', 'risk.serious-complaint'] as string[],
  /** สัญญาณทั่วไปตั้งแต่จำนวนนี้ขึ้นไปพร้อมกัน → ส่งเจ้าหน้าที่ (ข้อเดียว = ข้อสังเกต และ Band สูงสุด B ตาม Engine) */
  softSignalThreshold: 2,
  /** คะแนนรีวิวต่างกันระหว่างแพลตฟอร์มตั้งแต่ค่านี้ (ดาว) = หลักฐานขัดแย้งกัน */
  ratingGapConflict: 0.8,
  /** ข้อมูลซิงก์ล่าสุดเก่ากว่านี้ (วัน) = ต้องอัปเดตข้อมูลก่อนแสดง Badge */
  staleDays: 90,
  /** Band ที่แสดง Assessment Badge ได้ (Band D ยังเปิดเผยผลประเมินตามเดิม แต่ไม่ออก Badge) */
  badgeBands: ['A', 'B', 'C'] as Band[],
  /** ความเชื่อมั่นต่ำ = ต้องเพิ่มข้อมูลก่อนแสดง Badge */
  blockLowConfidence: true,
  /** ต้องยืนยันตัวตนเจ้าของร้าน (Level 1) ก่อนแสดง Badge */
  requireIdentityVerified: true,
} as const;

export type CertMode = 'automatic_existing' | 'officer_approval';

export interface CertPolicyRow {
  level: TrustLevel;
  mode: CertMode;
  /** นโยบายอนุญาตให้อนุมัติอัตโนมัติแล้วหรือไม่ (ค่าเริ่มต้นของ Prototype = ไม่) */
  autoApprovalAuthorized: boolean;
  basis: string;
  note: string;
}

/** ค่าเริ่มต้นของ Prototype — ตรงกับกฎเดิมของระบบ */
export const CERTIFICATION_POLICY: CertPolicyRow[] = [
  {
    level: 1,
    mode: 'automatic_existing',
    autoApprovalAuthorized: true,
    basis: 'ผลยืนยันตัวตน e-KYC (จำลอง)',
    note: 'กฎเดิมของระบบ — Level 1 ได้จากการยืนยันตัวตนสำเร็จ ไม่ต้องมีเจ้าหน้าที่',
  },
  {
    level: 2,
    mode: 'officer_approval',
    autoApprovalAuthorized: false,
    basis: 'คำขอลงทะเบียนร้านค้า + เอกสาร',
    note: 'ยังไม่ได้กำหนดสิทธิ์อนุมัติอัตโนมัติ — เจ้าหน้าที่อนุมัติคำขอลงทะเบียนตามกระบวนการเดิม',
  },
  {
    level: 3,
    mode: 'officer_approval',
    autoApprovalAuthorized: false,
    basis: 'เกณฑ์การรับรอง (อบรม ช่องทางขาย ไม่มีคำเตือนค้าง) + ผลประเมินประกอบการพิจารณา',
    note: 'ผลประเมินอัตโนมัติใช้ประกอบเท่านั้น — การออกใบรับรองต้องมีเจ้าหน้าที่อนุมัติ',
  },
  {
    level: 4,
    mode: 'officer_approval',
    autoApprovalAuthorized: false,
    basis: 'เกณฑ์การรับรอง ระดับสูง + Band A ความเชื่อมั่นสูง',
    note: 'ระดับที่เสนอใน Prototype — ต้องมีเจ้าหน้าที่อนุมัติ',
  },
];

export const certPolicyOf = (level: TrustLevel) => CERTIFICATION_POLICY.find((p) => p.level === level);
/** คำขอรับรองระดับนี้ต้องให้เจ้าหน้าที่พิจารณาหรือไม่ (ไม่มีนโยบาย = ต้องพิจารณา) */
export const certNeedsOfficer = (level: TrustLevel) => {
  const p = certPolicyOf(level);
  return !p || p.mode === 'officer_approval' || !p.autoApprovalAuthorized;
};

/** นโยบายการแก้ข้อมูลร้านค้า (ข้อ 6) */
export const PROFILE_CHANGE_POLICY = [
  { kind: 'ข้อมูลทั่วไป', fields: 'คำอธิบาย ช่องทางติดต่อ ที่อยู่', rule: 'บันทึกอัตโนมัติทันที' },
  { kind: 'ข้อมูลที่ผูกกับใบรับรองและตรงกับแหล่งอ้างอิง', fields: 'ชื่อร้าน หมวดธุรกิจ', rule: 'ตรวจสอบอัตโนมัติ — ค่าใหม่ตรงกับข้อมูลต้นฉบับ Marketplace (จำลอง) ที่ร้านยินยอมให้เชื่อม → บันทึกได้โดยไม่ต้องรอเจ้าหน้าที่' },
  { kind: 'ข้อมูลที่ตรวจสอบความถูกต้องอัตโนมัติไม่ได้', fields: 'ชื่อร้าน หมวดธุรกิจ (ค่าที่ไม่ตรงกับแหล่งอ้างอิง)', rule: 'ส่งคำขอเปลี่ยนข้อมูลให้เจ้าหน้าที่ (Exception) — ข้อมูลเดิมใช้ต่อจนกว่าอนุมัติ' },
  { kind: 'ข้อมูลต้นฉบับ Marketplace', fields: 'ยอดขาย รีวิว ราคา ชื่อร้านต้นฉบับ', rule: 'อ่านอย่างเดียว — ร้านค้าแก้ไม่ได้ และไม่เปลี่ยนผลประเมินโดยตรง' },
];
