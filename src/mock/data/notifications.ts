import type { AppNotification, AuditEntry } from '@/types';
import { d } from './helpers';

let n = 0;
const nt = (recipientRole: AppNotification['recipientRole'], recipientId: string | undefined, title: string, body: string, at: string, tone: AppNotification['tone'] = 'info', link?: string, read = false): AppNotification => ({
  id: `NTF-seed-${++n}`, recipientRole, recipientId, title, body, link, tone, read, createdAt: d(at),
});

export const notifications: AppNotification[] = [
  nt('merchant', 'OP-001', 'มีข้อร้องเรียนใหม่', 'CMP-2569-0002: ตะเข็บเสื้อหลุดหลังซักครั้งแรก', '2026-10-15T14:05', 'warning', '/m/complaints/CMP-2569-0002', true),
  nt('merchant', 'OP-001', 'ใบรับรองระดับ Trusted SME', 'ใบรับรอง SMT-2569-000101 ออกให้แล้ว', '2026-06-15T10:00', 'success', '/m/certification', true),
  nt('merchant', 'OP-001', 'หลักสูตรใหม่แนะนำ', 'หลักสูตร "การแสดงราคาสินค้าและเงื่อนไขการขาย" เปิดให้เรียนแล้ว', '2026-10-01T09:00', 'info', '/m/training/CRS-03'),
  nt('merchant', 'OP-002', 'ได้รับคำขอลงทะเบียนแล้ว', 'คำขอ APP-2569-0002 อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบ', '2026-10-12T11:21', 'info', '/m/shop'),
  nt('merchant', 'OP-002', 'มีข้อร้องเรียนใหม่', 'CMP-2569-0019: ฉลากไม่ระบุวันหมดอายุ', '2026-10-19T17:05', 'warning', '/m/complaints/CMP-2569-0019'),
  nt('merchant', 'OP-003', 'คำเตือน: ข้อความโฆษณา', 'WRN-2569-0001 ต้องแก้ไขภายใน 31 ต.ค.', '2026-10-03T10:00', 'error', '/m/warnings/WRN-2569-0001'),
  nt('merchant', 'OP-003', 'มีข้อร้องเรียนใหม่', 'CMP-2569-0005: ได้รับลิปคนละเฉดสี', '2026-10-17T12:05', 'warning', '/m/complaints/CMP-2569-0005'),
  nt('merchant', 'OP-004', 'การรับรองถูกระงับชั่วคราว', 'สามารถชี้แจงหรือยื่นอุทธรณ์ได้ภายใน 30 วัน', '2026-10-01T15:00', 'error', '/m/review'),
  nt('merchant', 'OP-004', 'ข้อร้องเรียนรอการตอบกลับ', 'CMP-2569-0008 รอร้านค้าตอบกลับ', '2026-10-02T11:05', 'warning', '/m/complaints/CMP-2569-0008'),
  nt('merchant', 'OP-007', 'ใบรับรองหมดอายุ', 'SMT-2568-000044 หมดอายุแล้ว กรุณานำ Badge ออกและยื่นต่ออายุ', '2026-09-10T08:00', 'warning', '/m/certification'),
  nt('merchant', 'OP-010', 'ขอเอกสารเพิ่มเติม', 'เจ้าหน้าที่ขอเอกสารเพิ่มเติมสำหรับคำขอ APP-2569-0005', '2026-09-18T11:00', 'warning', '/m/shop'),
  nt('merchant', 'OP-006', 'ข้อร้องเรียนใหม่', 'CMP-2569-0013: มังคุดช้ำทั้งกล่อง', '2026-10-12T10:05', 'warning', '/m/complaints/CMP-2569-0013'),
  nt('consumer', 'CS-001', 'ร้านค้าตอบกลับแล้ว', 'CMP-2569-0001: ร้านเสนอเปลี่ยนสินค้า', '2026-06-02T14:00', 'info', '/consumer/cases/CMP-2569-0001', true),
  nt('consumer', 'CS-002', 'ร้านค้าเสนอแนวทางแก้ไข', 'CMP-2569-0002: ร้านเสนอคืนเงิน 1,290 บาท กรุณายืนยัน', '2026-10-15T20:00', 'info', '/consumer/cases/CMP-2569-0002'),
  nt('consumer', 'CS-005', 'เรื่องถูกส่งต่อเจ้าหน้าที่', 'CMP-2569-0004 อยู่ระหว่างการพิจารณาของเจ้าหน้าที่ (ระบบสาธิต)', '2026-10-02T09:00', 'warning', '/consumer/cases/CMP-2569-0004'),
  nt('officer', undefined, 'คำขอลงทะเบียนใหม่', 'APP-2569-0006 พบ Mock Identity ซ้ำกับร้านที่ถูกเพิกถอน', '2026-10-16T16:01', 'error', '/o/applications/APP-2569-0006'),
  nt('officer', undefined, 'คำขอลงทะเบียนใหม่', 'APP-2569-0002 ครัวแม่มาลี รอตรวจสอบ', '2026-10-12T11:21', 'info', '/o/applications/APP-2569-0002'),
  nt('officer', undefined, 'ผลการแก้ไขรอตรวจ', 'WRN-2569-0006 ร้านผลไม้สดจันทบุรีส่งหลักฐานแล้ว', '2026-10-16T10:00', 'info', '/o/warnings/WRN-2569-0006'),
  nt('officer', undefined, 'เรื่องเร่งด่วน', 'CMP-2569-0015 กรณีเสี่ยงต่อสุขภาพ ส่งต่อทันที', '2026-07-25T18:10', 'error', '/o/complaints/CMP-2569-0015', true),
  nt('admin', undefined, 'สรุปประจำสัปดาห์ (สาธิต)', 'ข้อร้องเรียนที่ร้านค้าแก้ไขสำเร็จเพิ่มขึ้นจากสัปดาห์ก่อน', '2026-10-19T08:00', 'success', '/admin'),
];

let a = 0;
const au = (at: string, actorRole: AuditEntry['actorRole'], actorName: string, action: string, target: string, detail?: string): AuditEntry => ({
  id: `AUD-seed-${++a}`, at: d(at), actorRole, actorName, action, target, detail,
});

export const auditLog: AuditEntry[] = [
  au('2026-10-18T10:00', 'officer', 'ปรียา ตรวจละเอียด', 'ออกคำเตือน', 'WRN-2569-0004', 'M-009 ผ้าไหมบุรีรัมย์'),
  au('2026-10-16T16:01', 'system', 'ระบบ', 'ตรวจพบตัวตนซ้ำ', 'APP-2569-0006', 'Mock Identity ID MID-H8D5-63'),
  au('2026-10-12T11:21', 'system', 'ระบบ', 'รับคำขอลงทะเบียน', 'APP-2569-0002'),
  au('2026-10-03T10:00', 'officer', 'ปรียา ตรวจละเอียด', 'ออกคำเตือน', 'WRN-2569-0001', 'M-003 สวยใสคอสเมติก'),
  au('2026-10-01T15:00', 'officer', 'กมลชนก ใจเที่ยง', 'ระงับการรับรอง', 'SMT-2569-000103', 'M-004 ไอทีแกดเจ็ตช็อป'),
  au('2026-09-20T14:00', 'officer', 'กมลชนก ใจเที่ยง', 'พิจารณาอุทธรณ์ (คงผล) และเพิกถอน', 'SMT-2569-000106'),
  au('2026-09-18T11:00', 'officer', 'ปรียา ตรวจละเอียด', 'ขอเอกสารเพิ่มเติม', 'APP-2569-0005'),
  au('2026-08-09T16:00', 'officer', 'ปรียา ตรวจละเอียด', 'ไม่อนุมัติคำขอรับรอง', 'APP-2569-0009'),
  au('2026-06-28T15:00', 'officer', 'ปรียา ตรวจละเอียด', 'อนุมัติ Trusted SME', 'APP-2569-0004'),
];
