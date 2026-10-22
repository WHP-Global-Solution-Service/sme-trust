import type { Consumer, Officer, Operator } from '@/types';
import { d } from './helpers';

/** PIN สาธิตของบัญชีตัวอย่างทั้งหมด */
export const DEMO_PIN = '123456';

// ชื่อทั้งหมดเป็นชื่อสมมติ ไม่อ้างอิงบุคคลจริง
export const operators: Operator[] = [
  { id: 'OP-001', mockIdentityId: 'MID-A1F3-21', name: 'สมหญิง ทอผ้างาม', phone: '0810000001', email: 'somying@demo.local', province: 'สกลนคร', kycStatus: 'verified', kycVerifiedAt: d('2026-04-02'), demoPin: DEMO_PIN, createdAt: d('2026-04-01') },
  { id: 'OP-002', mockIdentityId: 'MID-B27C-34', name: 'มาลี ครัวดี', phone: '0810000002', email: 'malee@demo.local', province: 'เชียงใหม่', kycStatus: 'verified', kycVerifiedAt: d('2026-10-10'), demoPin: DEMO_PIN, createdAt: d('2026-10-09') },
  { id: 'OP-003', mockIdentityId: 'MID-C9D1-56', name: 'ณัฐวดี สวยสม', phone: '0810000003', email: 'nattawadee@demo.local', province: 'กรุงเทพมหานคร', kycStatus: 'verified', kycVerifiedAt: d('2026-05-03'), demoPin: DEMO_PIN, createdAt: d('2026-05-02') },
  { id: 'OP-004', mockIdentityId: 'MID-D4E8-12', name: 'กิตติพงษ์ แกดเจ็ตเทพ', phone: '0810000004', email: 'kittipong@demo.local', province: 'นนทบุรี', kycStatus: 'verified', kycVerifiedAt: d('2026-04-15'), demoPin: DEMO_PIN, createdAt: d('2026-04-14') },
  { id: 'OP-005', mockIdentityId: 'MID-E5A2-78', name: 'อาทิตย์ ดอยงาม', phone: '0810000005', email: 'arthit@demo.local', province: 'เชียงราย', kycStatus: 'verified', kycVerifiedAt: d('2026-04-20'), demoPin: DEMO_PIN, createdAt: d('2026-04-19') },
  { id: 'OP-006', mockIdentityId: 'MID-F6B3-90', name: 'วรรณา สวนสด', phone: '0810000006', email: 'wanna@demo.local', province: 'จันทบุรี', kycStatus: 'verified', kycVerifiedAt: d('2026-05-18'), demoPin: DEMO_PIN, createdAt: d('2026-05-17') },
  { id: 'OP-007', mockIdentityId: 'MID-G7C4-11', name: 'ประเสริฐ ไม้สวย', phone: '0810000007', email: 'prasert@demo.local', province: 'ขอนแก่น', kycStatus: 'verified', kycVerifiedAt: d('2025-09-01'), demoPin: DEMO_PIN, createdAt: d('2025-08-30') },
  { id: 'OP-008', mockIdentityId: 'MID-H8D5-63', name: 'ชัยวัฒน์ เฮลท์ตี้', phone: '0810000008', email: 'chaiwat@demo.local', province: 'กรุงเทพมหานคร', kycStatus: 'verified', kycVerifiedAt: d('2026-04-05'), demoPin: DEMO_PIN, createdAt: d('2026-04-04') },
  { id: 'OP-009', mockIdentityId: 'MID-J9E6-47', name: 'สุนันทา ไหมทอง', phone: '0810000009', email: 'sunanta@demo.local', province: 'บุรีรัมย์', kycStatus: 'verified', kycVerifiedAt: d('2026-06-02'), demoPin: DEMO_PIN, createdAt: d('2026-06-01') },
  { id: 'OP-010', mockIdentityId: 'MID-K1F7-29', name: 'บุญมี สมุนไพรไทย', phone: '0810000010', email: 'boonmee@demo.local', province: 'นครราชสีมา', kycStatus: 'verified', kycVerifiedAt: d('2026-09-12'), demoPin: DEMO_PIN, createdAt: d('2026-09-11') },
  { id: 'OP-011', mockIdentityId: 'MID-L2A8-85', name: 'ธีรวัฒน์ หนังแท้', phone: '0810000011', email: 'teerawat@demo.local', province: 'ภูเก็ต', kycStatus: 'none', demoPin: DEMO_PIN, createdAt: d('2026-10-15') },
  // ยืนยันตัวตนแล้วแต่ยังไม่ลงทะเบียนร้าน — ใช้เริ่ม Scenario 2
  { id: 'OP-012', mockIdentityId: 'MID-M3B9-40', name: 'ปิยนุช เริ่มขาย', phone: '0810000012', email: 'piyanuch@demo.local', province: 'สงขลา', kycStatus: 'verified', kycVerifiedAt: d('2026-10-18'), demoPin: DEMO_PIN, createdAt: d('2026-10-18') },
];

export const consumers: Consumer[] = [
  { id: 'CS-001', name: 'อรุณี มีสุข', phone: '0820000001', email: 'arunee@demo.local', province: 'กรุงเทพมหานคร' },
  { id: 'CS-002', name: 'ภานุ วงศ์ดี', phone: '0820000002', email: 'panu@demo.local', province: 'เชียงใหม่' },
  { id: 'CS-003', name: 'กนกพร รักษ์ไทย', phone: '0820000003', email: 'kanokporn@demo.local', province: 'ขอนแก่น' },
  { id: 'CS-004', name: 'สมชาย ใจเย็น', phone: '0820000004', email: 'somchai@demo.local', province: 'นนทบุรี' },
  { id: 'CS-005', name: 'จิราพร แสงทอง', phone: '0820000005', email: 'jiraporn@demo.local', province: 'ชลบุรี' },
  { id: 'CS-006', name: 'ปิยะ ศรีสุข', phone: '0820000006', email: 'piya@demo.local', province: 'สงขลา' },
  { id: 'CS-007', name: 'วิไลวรรณ ดีงาม', phone: '0820000007', email: 'wilaiwan@demo.local', province: 'ภูเก็ต' },
  { id: 'CS-008', name: 'ธนวัฒน์ มั่นคง', phone: '0820000008', email: 'thanawat@demo.local', province: 'นครราชสีมา' },
];

export const officers: Officer[] = [
  { id: 'OF-001', name: 'ปรียา ตรวจละเอียด', position: 'เจ้าหน้าที่ตรวจสอบร้านค้า', role: 'officer' },
  { id: 'OF-002', name: 'ธนากร รับเรื่องไว', position: 'เจ้าหน้าที่ดูแลข้อร้องเรียน', role: 'officer' },
  { id: 'OF-003', name: 'กมลชนก ใจเที่ยง', position: 'เจ้าหน้าที่พิจารณาความเสี่ยง', role: 'officer' },
  { id: 'AD-001', name: 'ผู้ดูแลระบบสาธิต', position: 'System Administrator', role: 'admin' },
];
