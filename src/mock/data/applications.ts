import type { Certification, VerificationApplication, VerificationCheck } from '@/types';
import { d, tl } from './helpers';

export const standardChecks = (pass: boolean | 'partial' = false): VerificationCheck[] => [
  { id: 'chk-identity', label: 'ยืนยันตัวตนผู้ประกอบการ (Mock e-KYC)', result: pass ? 'pass' : 'pending' },
  { id: 'chk-business', label: 'ข้อมูลธุรกิจตรงกับเอกสารจำลอง', result: pass === true ? 'pass' : 'pending' },
  { id: 'chk-address', label: 'ที่อยู่สถานประกอบการ', result: pass === true ? 'pass' : 'pending' },
  { id: 'chk-channel', label: 'ความเป็นเจ้าของช่องทางขาย', result: pass === true ? 'pass' : 'pending' },
  { id: 'chk-history', label: 'ประวัติข้อร้องเรียน/คำเตือนในระบบสาธิต', result: pass === true ? 'pass' : 'pending' },
];

const certChecks = (pass: boolean): VerificationCheck[] => [
  { id: 'chk-biz-verified', label: 'ผ่านเกณฑ์ธุรกิจ (Level 2)', result: 'pass' },
  { id: 'chk-training', label: 'ผ่านการอบรมอย่างน้อย 1 หลักสูตร', result: pass ? 'pass' : 'pending' },
  { id: 'chk-no-warning', label: 'ไม่มีคำเตือนหรือข้อพิจารณาความเสี่ยงค้าง', result: pass ? 'pass' : 'pending' },
  { id: 'chk-policy', label: 'มีนโยบายคืน/เปลี่ยนสินค้าที่ชัดเจน', result: pass ? 'pass' : 'pending' },
];

const OFF1 = 'ปรียา ตรวจละเอียด';

export const applications: VerificationApplication[] = [
  {
    id: 'APP-2569-0001', merchantId: 'M-001', type: 'registration', requestedLevel: 2, status: 'approved',
    submittedAt: d('2026-04-03'), updatedAt: d('2026-04-10'), assignedOfficerId: 'OF-001', checks: standardChecks(true),
    timeline: [tl('2026-04-03T10:00', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า'), tl('2026-04-06T09:30', 'officer', 'เริ่มตรวจสอบข้อมูล', undefined, OFF1), tl('2026-04-10T14:00', 'officer', 'อนุมัติคำขอ', 'ข้อมูลครบถ้วน', OFF1)],
  },
  {
    id: 'APP-2569-0002', merchantId: 'M-002', type: 'registration', requestedLevel: 2, status: 'pending_review',
    submittedAt: d('2026-10-12'), updatedAt: d('2026-10-12'), checks: standardChecks('partial'),
    timeline: [tl('2026-10-12T11:20', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า'), tl('2026-10-12T11:21', 'system', 'ระบบตรวจสอบความครบถ้วนเบื้องต้นผ่าน', 'เข้าคิวรอเจ้าหน้าที่ตรวจสอบ')],
  },
  {
    id: 'APP-2569-0003', merchantId: 'M-003', type: 'registration', requestedLevel: 2, status: 'approved',
    submittedAt: d('2026-05-04'), updatedAt: d('2026-05-12'), assignedOfficerId: 'OF-001', checks: standardChecks(true),
    timeline: [tl('2026-05-04T13:00', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า (นิติบุคคล)'), tl('2026-05-12T10:00', 'officer', 'อนุมัติคำขอ', undefined, OFF1)],
  },
  {
    id: 'APP-2569-0004', merchantId: 'M-005', type: 'certification', requestedLevel: 3, status: 'approved',
    submittedAt: d('2026-06-20'), updatedAt: d('2026-06-28'), assignedOfficerId: 'OF-001', checks: certChecks(true),
    timeline: [tl('2026-06-20T09:00', 'merchant', 'ยื่นขอรับรอง Trusted SME'), tl('2026-06-28T15:00', 'officer', 'อนุมัติ Trusted SME', undefined, OFF1)],
  },
  {
    id: 'APP-2569-0005', merchantId: 'M-010', type: 'registration', requestedLevel: 2, status: 'need_info',
    submittedAt: d('2026-09-14'), updatedAt: d('2026-09-18'), assignedOfficerId: 'OF-001', checks: standardChecks('partial'),
    infoRequest: 'กรุณาแนบสำเนาทะเบียนพาณิชย์หรือหลักฐานการประกอบกิจการ และระบุที่อยู่สถานที่ผลิตให้ครบถ้วน',
    timeline: [tl('2026-09-14T10:00', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า'), tl('2026-09-18T11:00', 'officer', 'ขอเอกสารเพิ่มเติม', 'ยังไม่มีหลักฐานการประกอบกิจการ', OFF1)],
  },
  {
    id: 'APP-2569-0006', merchantId: 'M-012', type: 'registration', requestedLevel: 2, status: 'submitted',
    submittedAt: d('2026-10-16'), updatedAt: d('2026-10-16'), checks: standardChecks('partial'),
    timeline: [
      tl('2026-10-16T16:00', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า'),
      tl('2026-10-16T16:01', 'system', 'ระบบพบ Mock Identity ID ตรงกับร้านค้าที่ถูกเพิกถอน', 'ส่งให้เจ้าหน้าที่พิจารณาเป็นพิเศษ — ไม่ใช่การปฏิเสธอัตโนมัติ'),
    ],
  },
  {
    id: 'APP-2569-0007', merchantId: 'M-006', type: 'certification', requestedLevel: 3, status: 'under_verification',
    submittedAt: d('2026-10-05'), updatedAt: d('2026-10-08'), assignedOfficerId: 'OF-001', checks: certChecks(false),
    timeline: [tl('2026-10-05T10:00', 'merchant', 'ยื่นขอรับรอง Trusted SME'), tl('2026-10-08T09:00', 'officer', 'เริ่มตรวจสอบ', undefined, OFF1)],
  },
  {
    id: 'APP-2569-0008', merchantId: 'M-007', type: 'certification', requestedLevel: 2, status: 'submitted',
    submittedAt: d('2026-10-14'), updatedAt: d('2026-10-14'), checks: certChecks(false),
    timeline: [tl('2026-10-14T13:30', 'merchant', 'ยื่นขอต่ออายุใบรับรอง')],
  },
  {
    id: 'APP-2569-0009', merchantId: 'M-009', type: 'certification', requestedLevel: 3, status: 'rejected',
    submittedAt: d('2026-08-01'), updatedAt: d('2026-08-09'), assignedOfficerId: 'OF-001', checks: certChecks(false),
    rejectReason: 'อยู่ระหว่างการตรวจสอบข้อร้องเรียนเรื่องสินค้าไม่ตรงตามรายละเอียด สามารถยื่นใหม่ได้หลังการตรวจสอบเสร็จสิ้นและผ่านการอบรมอย่างน้อย 1 หลักสูตร',
    timeline: [tl('2026-08-01T10:00', 'merchant', 'ยื่นขอรับรอง Trusted SME'), tl('2026-08-09T16:00', 'officer', 'ไม่อนุมัติ', 'มีประเด็นอยู่ระหว่างตรวจสอบ', OFF1)],
  },
  {
    id: 'APP-2569-0010', merchantId: 'M-004', type: 'registration', requestedLevel: 2, status: 'approved',
    submittedAt: d('2026-04-16'), updatedAt: d('2026-04-22'), assignedOfficerId: 'OF-001', checks: standardChecks(true),
    timeline: [tl('2026-04-16T10:00', 'merchant', 'ส่งคำขอลงทะเบียนร้านค้า'), tl('2026-04-22T11:00', 'officer', 'อนุมัติคำขอ', undefined, OFF1)],
  },
];

export const certifications: Certification[] = [
  {
    id: 'SMT-2569-000101', merchantId: 'M-001', level: 3, status: 'active', issuedAt: d('2026-06-15'), expiresAt: d('2027-06-14'),
    history: [tl('2026-04-10', 'officer', 'ออกใบรับรอง Business Verified'), tl('2026-06-15', 'officer', 'ยกระดับเป็น Trusted SME หลังผ่านการอบรม')],
  },
  {
    id: 'SMT-2569-000102', merchantId: 'M-003', level: 2, status: 'active', issuedAt: d('2026-05-12'), expiresAt: d('2027-05-11'),
    history: [tl('2026-05-12', 'officer', 'ออกใบรับรอง Business Verified')],
  },
  {
    id: 'SMT-2569-000103', merchantId: 'M-004', level: 2, status: 'suspended', issuedAt: d('2026-04-22'), expiresAt: d('2027-04-21'),
    statusReason: 'อยู่ระหว่างตรวจสอบข้อร้องเรียน "ไม่ได้รับสินค้า" หลายรายการ',
    history: [tl('2026-04-22', 'officer', 'ออกใบรับรอง Business Verified'), tl('2026-10-01', 'officer', 'ระงับการรับรองชั่วคราว', 'ข้อร้องเรียนไม่ได้รับสินค้า 4 เรื่องในช่วงเวลาใกล้กัน')],
  },
  {
    id: 'SMT-2569-000104', merchantId: 'M-005', level: 3, status: 'active', issuedAt: d('2026-06-28'), expiresAt: d('2027-06-27'),
    history: [tl('2026-06-28', 'officer', 'ออกใบรับรอง Trusted SME')],
  },
  {
    id: 'SMT-2569-000105', merchantId: 'M-006', level: 2, status: 'active', issuedAt: d('2026-05-25'), expiresAt: d('2027-05-24'),
    history: [tl('2026-05-25', 'officer', 'ออกใบรับรอง Business Verified')],
  },
  {
    id: 'SMT-2568-000044', merchantId: 'M-007', level: 2, status: 'expired', issuedAt: d('2025-09-10'), expiresAt: d('2026-09-09'),
    history: [tl('2025-09-10', 'officer', 'ออกใบรับรอง Business Verified'), tl('2026-09-10', 'system', 'ใบรับรองหมดอายุ')],
  },
  {
    id: 'SMT-2569-000106', merchantId: 'M-008', level: 3, status: 'revoked', issuedAt: d('2026-05-20'), expiresAt: d('2027-05-19'),
    statusReason: 'โฆษณาอาหารเสริมว่ารักษาโรคได้ และไม่แก้ไขตามคำเตือนภายในกำหนด (กรณีสมมติ)',
    history: [tl('2026-05-20', 'officer', 'ออกใบรับรอง Trusted SME'), tl('2026-08-15', 'officer', 'ระงับการรับรอง'), tl('2026-09-20', 'officer', 'เพิกถอนการรับรองหลังพิจารณาอุทธรณ์')],
  },
  {
    id: 'SMT-2569-000107', merchantId: 'M-009', level: 2, status: 'active', issuedAt: d('2026-06-10'), expiresAt: d('2027-06-09'),
    history: [tl('2026-06-10', 'officer', 'ออกใบรับรอง Business Verified')],
  },
  {
    id: 'SMT-2569-000099', merchantId: 'M-005', level: 2, status: 'expired', issuedAt: d('2026-04-28'), expiresAt: d('2027-04-27'),
    supersededBy: 'SMT-2569-000104', statusReason: 'ถูกแทนที่ด้วยใบรับรองระดับ Trusted SME',
    history: [tl('2026-04-28', 'officer', 'ออกใบรับรอง Business Verified'), tl('2026-06-28', 'system', 'ถูกแทนที่ด้วยใบรับรองใหม่')],
  },
  {
    id: 'SMT-2569-000098', merchantId: 'M-001', level: 2, status: 'expired', issuedAt: d('2026-04-10'), expiresAt: d('2027-04-09'),
    supersededBy: 'SMT-2569-000101', statusReason: 'ถูกแทนที่ด้วยใบรับรองระดับ Trusted SME',
    history: [tl('2026-04-10', 'officer', 'ออกใบรับรอง Business Verified'), tl('2026-06-15', 'system', 'ถูกแทนที่ด้วยใบรับรองใหม่')],
  },
];
