import type { Tone } from '@/constants/labels';
import type { AutomationTrigger, BadgeStatus, Priority, Route, TaskCategory, TaskStatus } from './types';

export const ROUTE_LABEL: Record<Route, { label: string; short: string; tone: Tone; desc: string }> = {
  AUTO_PASS: { label: 'AUTO_PASS — ผ่านอัตโนมัติ', short: 'ผ่านอัตโนมัติ', tone: 'success', desc: 'ข้อมูลครบตามเกณฑ์ ไม่มีประเด็นที่ต้องส่งตรวจ — ระบบอัปเดตผลและ Badge โดยไม่สร้างงานให้เจ้าหน้าที่' },
  AUTO_REQUEST_INFO: { label: 'AUTO_REQUEST_INFO — ร้านค้าเพิ่มข้อมูลเอง', short: 'ร้านค้าเพิ่มข้อมูลเอง', tone: 'warning', desc: 'ข้อมูลไม่ครบ หมดอายุ หรือไม่สอดคล้องในแบบที่ร้านแก้ไขเองได้ — ระบบแจ้งร้านและประเมินซ้ำเมื่อข้อมูลเปลี่ยน' },
  MANUAL_REVIEW: { label: 'MANUAL_REVIEW — ส่งเจ้าหน้าที่ตรวจ', short: 'ส่งเจ้าหน้าที่ตรวจ', tone: 'error', desc: 'ข้อมูลตัวตนขัดแย้ง มีสัญญาณที่ต้องพิจารณา หรือต้องใช้อำนาจอนุมัติ — การคัดกรองนี้ไม่ใช่การตัดสินว่าร้านกระทำผิด' },
};

export const BADGE_STATUS: Record<BadgeStatus, { label: string; tone: Tone; consumer: string }> = {
  active: { label: 'แสดง Badge', tone: 'success', consumer: 'แสดง Trust Assessment Badge จากการประเมินอัตโนมัติ' },
  below_threshold: { label: 'ยังไม่ถึงเกณฑ์แสดง Badge', tone: 'neutral', consumer: 'ผลประเมินยังไม่ถึงเกณฑ์แสดง Assessment Badge' },
  insufficient: { label: 'Insufficient Data', tone: 'neutral', consumer: 'ข้อมูลยังไม่เพียงพอสำหรับ Assessment Badge — ไม่ได้หมายความว่าร้านมีปัญหา' },
  needs_update: { label: 'รอร้านค้าอัปเดตข้อมูล', tone: 'warning', consumer: 'ร้านค้ากำลังอัปเดตข้อมูล — ยังไม่แสดง Assessment Badge' },
  under_review: { label: 'รอเจ้าหน้าที่ตรวจสอบเพิ่มเติม', tone: 'warning', consumer: 'ข้อมูลบางส่วนอยู่ระหว่างตรวจสอบเพิ่มเติม จึงยังไม่แสดง Assessment Badge — ไม่ได้หมายความว่าร้านกระทำผิด' },
  withheld: { label: 'ระงับการแสดงระหว่างพิจารณาความเสี่ยง', tone: 'warning', consumer: 'ระงับการแสดง Assessment Badge ระหว่างเจ้าหน้าที่พิจารณา' },
  suspended: { label: 'Suspended — ไม่แสดง Badge', tone: 'error', consumer: 'การรับรองถูกระงับ จึงไม่แสดง Assessment Badge' },
  revoked: { label: 'Revoked — ไม่แสดง Badge', tone: 'error', consumer: 'การรับรองถูกเพิกถอน จึงไม่แสดง Assessment Badge' },
};

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  identity_mismatch: 'ข้อมูลตัวตนไม่ตรงกัน (Identity Mismatch)',
  evidence_conflict: 'หลักฐานขัดแย้งกัน (Evidence Conflict)',
  risk_signal: 'สัญญาณความเสี่ยงที่ต้องพิจารณา',
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  open: { label: 'รอตรวจสอบ', tone: 'warning' },
  info_requested: { label: 'รอข้อมูลจากร้านค้า', tone: 'info' },
  approved: { label: 'อนุมัติ', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'error' },
  auto_closed: { label: 'ปิดอัตโนมัติ', tone: 'neutral' },
};

export const PRIORITY_LABEL: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: 'เร่งด่วน', tone: 'error' },
  medium: { label: 'ปานกลาง', tone: 'warning' },
  low: { label: 'ต่ำ', tone: 'neutral' },
};

export const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  seed: 'ข้อมูลตั้งต้น',
  import: 'นำเข้าข้อมูล',
  sync: 'ซิงก์ข้อมูล (จำลอง)',
  sync_failed: 'ซิงก์ไม่สำเร็จ',
  data_age: 'จำลองอายุข้อมูล',
  disconnect: 'ยกเลิกการเชื่อมต่อ',
  profile_update: 'อัปเดตโปรไฟล์ร้าน',
  merchant_assessment: 'ร้านค้าประเมินใหม่',
  merchant_response: 'ร้านค้าส่งข้อมูลเพิ่ม',
  officer_decision: 'เจ้าหน้าที่ตัดสินกรณียกเว้น',
  measure_change: 'สถานะการรับรองเปลี่ยน',
  identity_change: 'ผลยืนยันตัวตนเปลี่ยน',
  simulation: 'Run Simulation',
};

export const AUTOMATION_DISCLAIMER =
  'ระบบอัตโนมัติในต้นแบบนี้ประมวลผลเฉพาะเมื่อมีเหตุการณ์ขณะเปิดระบบ (เช่น ซิงก์ นำเข้า หรือกด Run Simulation) ด้วยข้อมูลจำลอง — ไม่ได้ติดตามร้านค้าจริงแบบ Real-time และไม่ได้ตรวจจับการทุจริตได้แน่นอน';
