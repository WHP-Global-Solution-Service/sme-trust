/**
 * Automation First — ตรวจคำขอลงทะเบียนร้านค้าอัตโนมัติ (Pure Function)
 * - AUTO_PASS: ข้อมูลครบและไม่พบความผิดปกติ → ลงทะเบียนร้านค้าแล้ว โดยไม่ต้องให้เจ้าหน้าที่กดอนุมัติ
 *   (การลงทะเบียนไม่ใช่ใบรับรองหรือ Assessment Badge — ใบรับรองยังเป็นไปตาม Certification Policy เดิม)
 * - AUTO_REQUEST_INFO: ข้อมูลไม่ครบ → ส่งกลับให้ร้านค้าแก้ไขเอง ไม่เข้าคิวเจ้าหน้าที่
 * - MANUAL_REVIEW: พบความผิดปกติที่ระบบตัดสินเองไม่ได้ → ส่งเจ้าหน้าที่ตรวจเฉพาะกรณี (Exception Queue)
 * ใช้ข้อมูลที่ระบบมีอยู่แล้วเท่านั้น (e-KYC จำลอง · เอกสารจำลอง · ช่องทางขาย · ตัวตนซ้ำกับร้านที่ถูกระงับ/เพิกถอน · เจ้าของร้านบน Marketplace จำลอง)
 * ไม่ได้ตรวจกับ DBD / e-KYC หรือ Marketplace API จริง
 */
export type RegistrationRoute = 'AUTO_PASS' | 'AUTO_REQUEST_INFO' | 'MANUAL_REVIEW';

export interface RegistrationInput {
  /** เจ้าของร้านยืนยันตัวตนแล้ว (e-KYC จำลอง) */
  kycVerified: boolean;
  documents: number;
  channels: number;
  /** ตัวตนซ้ำกับเจ้าของร้านที่ถูกระงับ/เพิกถอน (ตรวจตอนส่งคำขอ) */
  identityFlag?: string;
  /** ร้านบน Marketplace (จำลอง) ที่ใช้เติมข้อมูล — ชื่อเจ้าของไม่ตรง หรือถูกอ้างโดยร้านอื่น และเจ้าหน้าที่ยังไม่ยืนยัน */
  ownershipIssues?: string[];
}

export interface RegistrationDecision {
  route: RegistrationRoute;
  reasons: string[];
}

export function decideRegistration(i: RegistrationInput): RegistrationDecision {
  const anomalies = [...(i.identityFlag ? [i.identityFlag] : []), ...(i.ownershipIssues ?? [])];
  if (anomalies.length) return { route: 'MANUAL_REVIEW', reasons: anomalies };
  const missing = [
    ...(i.kycVerified ? [] : ['ยังไม่ได้ยืนยันตัวตนเจ้าของร้าน (e-KYC จำลอง)']),
    ...(i.documents > 0 ? [] : ['ยังไม่มีเอกสารประกอบ (จำลอง)']),
    ...(i.channels > 0 ? [] : ['ยังไม่มีช่องทางขาย']),
  ];
  if (missing.length) return { route: 'AUTO_REQUEST_INFO', reasons: missing };
  return { route: 'AUTO_PASS', reasons: ['ข้อมูลครบตามเกณฑ์ และไม่พบความผิดปกติ'] };
}

export const REGISTRATION_ROUTE_LABEL: Record<RegistrationRoute, string> = {
  AUTO_PASS: 'ผ่านการตรวจสอบอัตโนมัติ',
  AUTO_REQUEST_INFO: 'ส่งกลับให้ร้านค้าเพิ่มข้อมูล',
  MANUAL_REVIEW: 'ส่งเจ้าหน้าที่ตรวจสอบเฉพาะกรณี',
};
