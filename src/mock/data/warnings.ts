import type { RiskCase, WarningRecord } from '@/types';
import { d, doc, tl } from './helpers';

const OF1 = 'ปรียา ตรวจละเอียด';
const OF3 = 'กมลชนก ใจเที่ยง';

export const warnings: WarningRecord[] = [
  {
    id: 'WRN-2569-0001', merchantId: 'M-003', kind: 'warning', status: 'correction_required',
    title: 'ข้อความโฆษณาที่อาจทำให้เข้าใจผิด',
    issue: 'โพสต์และไลฟ์ขายใช้ข้อความ "ขาวใน 3 วัน การันตีผล 100%" และ "รักษาฝ้าหายขาด" ซึ่งอาจทำให้ผู้บริโภคเข้าใจผิดเกี่ยวกับคุณสมบัติสินค้า',
    guidance: 'ปรับข้อความโฆษณาให้สอดคล้องกับข้อมูลผลิตภัณฑ์ที่ตรวจสอบได้ หลีกเลี่ยงคำว่ารักษา หายขาด การันตี และระบุว่าผลลัพธ์ขึ้นกับแต่ละบุคคล',
    items: [
      { id: 'wi-1', text: 'ลบหรือแก้ไขโพสต์ที่มีคำว่า "การันตีผล 100%"', done: false },
      { id: 'wi-2', text: 'แก้ไขคำบรรยายสินค้าในทุกช่องทางขาย', done: false },
      { id: 'wi-3', text: 'เข้าอบรมหลักสูตรการโฆษณาสินค้าออนไลน์อย่างเหมาะสม', done: false },
    ],
    courseIds: ['CRS-02'], dueDate: d('2026-10-31'), evidence: [], officerId: 'OF-001', relatedComplaintIds: ['CMP-2569-0003', 'CMP-2569-0004'],
    createdAt: d('2026-10-03'), updatedAt: d('2026-10-05'),
    timeline: [tl('2026-10-03T10:00', 'officer', 'ออกคำเตือน', 'อ้างอิงข้อร้องเรียน 2 เรื่อง', OF1), tl('2026-10-05T09:00', 'merchant', 'ร้านค้ารับทราบคำเตือน'), tl('2026-10-05T09:00', 'system', 'กำหนดรายการที่ต้องแก้ไข 3 รายการ')],
  },
  {
    id: 'WRN-2569-0002', merchantId: 'M-003', kind: 'advisory', status: 'completed',
    title: 'คำแนะนำการแสดงราคาและค่าจัดส่ง', issue: 'ราคาที่แสดงในไลฟ์ไม่รวมค่าจัดส่งและไม่ได้แจ้งชัดเจน',
    guidance: 'แสดงราคาสินค้า ค่าจัดส่ง และเงื่อนไขโปรโมชันให้ชัดเจนก่อนการชำระเงิน',
    items: [{ id: 'wi-1', text: 'เพิ่มข้อความค่าจัดส่งในโพสต์ขาย', done: true }], courseIds: ['CRS-03'], dueDate: d('2026-07-15'),
    evidence: [doc('ภาพโพสต์หลังแก้ไข (จำลอง).png', 'หลักฐานการแก้ไข', '2026-07-08')], merchantNote: 'แก้ไขเรียบร้อยแล้วค่ะ', officerId: 'OF-001', relatedComplaintIds: [],
    createdAt: d('2026-07-01'), updatedAt: d('2026-07-10'),
    timeline: [tl('2026-07-01', 'officer', 'ออกคำแนะนำ', undefined, OF1), tl('2026-07-02', 'merchant', 'รับทราบ'), tl('2026-07-08', 'merchant', 'ส่งหลักฐานการแก้ไข'), tl('2026-07-10', 'officer', 'ตรวจผลผ่าน — เสร็จสิ้น', undefined, OF1)],
  },
  {
    id: 'WRN-2569-0003', merchantId: 'M-004', kind: 'warning', status: 'acknowledged',
    title: 'การจัดส่งสินค้าล่าช้าและไม่แจ้งเลขพัสดุ', issue: 'มีข้อร้องเรียนไม่ได้รับสินค้าหลายรายการในช่วงเวลาใกล้กัน',
    guidance: 'แจ้งกำหนดส่งที่ชัดเจน ให้เลขพัสดุที่ตรวจสอบได้ และคืนเงินเมื่อไม่สามารถจัดส่งได้',
    items: [{ id: 'wi-1', text: 'ส่งรายการคำสั่งซื้อค้างส่งพร้อมแผนการจัดส่ง', done: false }, { id: 'wi-2', text: 'ติดต่อผู้บริโภคที่ร้องเรียนทุกราย', done: false }],
    courseIds: ['CRS-05'], dueDate: d('2026-10-25'), evidence: [], officerId: 'OF-003', relatedComplaintIds: ['CMP-2569-0006', 'CMP-2569-0007'],
    createdAt: d('2026-09-25'), updatedAt: d('2026-09-27'),
    timeline: [tl('2026-09-25', 'officer', 'ออกคำเตือน', undefined, OF3), tl('2026-09-27', 'merchant', 'ร้านค้ารับทราบคำเตือน')],
  },
  {
    id: 'WRN-2569-0004', merchantId: 'M-009', kind: 'warning', status: 'warning_issued',
    title: 'การระบุวัสดุสินค้าไม่ชัดเจน', issue: 'คำบรรยายระบุว่า "ไหมแท้ 100%" แต่มีข้อร้องเรียนว่าสินค้าอาจเป็นผ้าผสม',
    guidance: 'ระบุส่วนประกอบของผ้าให้ตรงตามจริง และแสดงวิธีตรวจสอบหรือหลักฐานรับรองวัสดุ',
    items: [{ id: 'wi-1', text: 'ปรับคำบรรยายส่วนประกอบผ้าทุกรายการ', done: false }],
    courseIds: ['CRS-02'], dueDate: d('2026-11-05'), evidence: [], officerId: 'OF-001', relatedComplaintIds: ['CMP-2569-0017'],
    createdAt: d('2026-10-18'), updatedAt: d('2026-10-18'),
    timeline: [tl('2026-10-18', 'officer', 'ออกคำเตือน', undefined, OF1)],
  },
  {
    id: 'WRN-2569-0005', merchantId: 'M-007', kind: 'advisory', status: 'advisory',
    title: 'คำแนะนำการต่ออายุใบรับรอง', issue: 'ใบรับรองหมดอายุแล้ว แต่ช่องทางขายยังแสดง Badge รับรอง',
    guidance: 'นำ Badge ออกจากช่องทางขายจนกว่าการต่ออายุจะได้รับอนุมัติ',
    items: [{ id: 'wi-1', text: 'นำ Badge ออกจากเพจ Facebook ชั่วคราว', done: false }],
    courseIds: ['CRS-06'], dueDate: d('2026-10-30'), evidence: [], officerId: 'OF-001', relatedComplaintIds: [],
    createdAt: d('2026-10-12'), updatedAt: d('2026-10-12'),
    timeline: [tl('2026-10-12', 'officer', 'ออกคำแนะนำ', 'ไม่ใช่มาตรการลงโทษ', OF1)],
  },
  {
    id: 'WRN-2569-0006', merchantId: 'M-006', kind: 'warning', status: 'correction_submitted',
    title: 'เงื่อนไขการเคลมสินค้าไม่ชัดเจน', issue: 'โพสต์ระบุ "รับประกันเนื้อ" แต่ไม่ระบุวิธีและระยะเวลาเคลม',
    guidance: 'ระบุเงื่อนไขการเคลม ระยะเวลา และช่องทางติดต่อให้ชัดเจน',
    items: [{ id: 'wi-1', text: 'เพิ่มนโยบายเคลมในโพสต์ปักหมุด', done: true }, { id: 'wi-2', text: 'แนบภาพตัวอย่างนโยบายที่แก้ไขแล้ว', done: true }],
    courseIds: ['CRS-04'], dueDate: d('2026-10-20'), evidence: [doc('ภาพนโยบายเคลมใหม่ (จำลอง).png', 'หลักฐานการแก้ไข', '2026-10-16')],
    merchantNote: 'เพิ่มนโยบายเคลมภายใน 24 ชม. พร้อมขั้นตอนถ่ายภาพแล้วค่ะ', officerId: 'OF-002', relatedComplaintIds: ['CMP-2569-0012'],
    createdAt: d('2026-10-01'), updatedAt: d('2026-10-16'),
    timeline: [tl('2026-10-01', 'officer', 'ออกคำเตือน', undefined, 'ธนากร รับเรื่องไว'), tl('2026-10-02', 'merchant', 'รับทราบ'), tl('2026-10-16', 'merchant', 'ส่งหลักฐานการแก้ไข')],
  },
  {
    id: 'WRN-2569-0007', merchantId: 'M-005', kind: 'advisory', status: 'completed',
    title: 'คำแนะนำการระบุวันคั่วและวันหมดอายุ', issue: 'บางรายการไม่ระบุวันหมดอายุบนหน้าร้านออนไลน์', guidance: 'ระบุวันคั่วและวันควรบริโภคก่อนในทุกรายการ',
    items: [{ id: 'wi-1', text: 'ปรับข้อมูลสินค้าในเว็บไซต์', done: true }], courseIds: [], dueDate: d('2026-06-30'),
    evidence: [doc('ภาพหน้าสินค้า (จำลอง).png', 'หลักฐานการแก้ไข', '2026-06-20')], officerId: 'OF-001', relatedComplaintIds: [],
    createdAt: d('2026-06-10'), updatedAt: d('2026-06-22'),
    timeline: [tl('2026-06-10', 'officer', 'ออกคำแนะนำ', undefined, OF1), tl('2026-06-20', 'merchant', 'ส่งหลักฐานการแก้ไข'), tl('2026-06-22', 'officer', 'เสร็จสิ้น', undefined, OF1)],
  },
  {
    id: 'WRN-2569-0008', merchantId: 'M-008', kind: 'warning', status: 'correction_required',
    title: 'โฆษณาอาหารเสริมว่ารักษาโรค', issue: 'โฆษณาว่าผลิตภัณฑ์ลดน้ำหนักและรักษาเบาหวานได้', guidance: 'ยุติการโฆษณาที่อ้างสรรพคุณทางการรักษา',
    items: [{ id: 'wi-1', text: 'ลบโพสต์ที่อ้างสรรพคุณรักษาโรคทั้งหมด', done: false }], courseIds: ['CRS-02'], dueDate: d('2026-08-10'), evidence: [],
    officerId: 'OF-003', relatedComplaintIds: ['CMP-2569-0015', 'CMP-2569-0016'], createdAt: d('2026-07-28'), updatedAt: d('2026-07-30'),
    timeline: [tl('2026-07-28', 'officer', 'ออกคำเตือน', undefined, OF3), tl('2026-07-30', 'merchant', 'รับทราบ'), tl('2026-08-11', 'system', 'เลยกำหนดแก้ไข — ส่งพิจารณาความเสี่ยง')],
  },
];

export const riskCases: RiskCase[] = [
  {
    id: 'RSK-2569-0001', merchantId: 'M-004', status: 'suspended',
    reason: 'ข้อร้องเรียน "ไม่ได้รับสินค้า" 4 เรื่องภายใน 3 เดือน และ 2 เรื่องร้านค้าไม่ดำเนินการตามข้อเสนอของตนเอง',
    evidenceSummary: ['ข้อร้องเรียน 4 เรื่อง (CMP-0006, 0007, 0008, 0009)', 'คำเตือน WRN-2569-0003 ยังไม่แก้ไขครบ', 'ร้านค้าตอบกลับเฉลี่ยเกิน 72 ชั่วโมง'],
    relatedComplaintIds: ['CMP-2569-0006', 'CMP-2569-0007', 'CMP-2569-0008', 'CMP-2569-0009'],
    createdAt: d('2026-09-20'), updatedAt: d('2026-10-01'),
    timeline: [tl('2026-09-20', 'system', 'ระบบแจ้งเตือนความเสี่ยง (ข้อกล่าวหา)', 'ไม่ใช่ข้อสรุปว่ากระทำผิด'), tl('2026-09-22', 'officer', 'เปิดการตรวจสอบ', undefined, OF3), tl('2026-09-25', 'officer', 'ออกคำเตือน', undefined, OF3), tl('2026-10-01', 'officer', 'ระงับการรับรองชั่วคราว', 'เปิดให้ร้านค้าชี้แจงหรืออุทธรณ์ภายใน 30 วัน', OF3)],
  },
  {
    id: 'RSK-2569-0002', merchantId: 'M-008', status: 'appeal_reviewed',
    reason: 'โฆษณาอาหารเสริมว่ารักษาโรคได้ มีผู้บริโภคแจ้งอาการแพ้ และไม่แก้ไขตามคำเตือน',
    evidenceSummary: ['ข้อร้องเรียน CMP-0015 (กรณีเสี่ยงต่อสุขภาพ)', 'ข้อร้องเรียน CMP-0016', 'คำเตือน WRN-2569-0008 เลยกำหนด'],
    relatedComplaintIds: ['CMP-2569-0015', 'CMP-2569-0016'], merchantStatement: 'ทางร้านได้ลบโพสต์บางส่วนแล้ว',
    appeal: { text: 'ขอให้ทบทวนการระงับ เนื่องจากลบโพสต์แล้ว', submittedAt: d('2026-08-25'), result: 'upheld', resultNote: 'ยังพบโพสต์อ้างสรรพคุณรักษาโรคในช่องทาง TikTok จึงคงผลและเพิกถอนการรับรอง' },
    createdAt: d('2026-08-12'), updatedAt: d('2026-09-20'),
    timeline: [tl('2026-08-12', 'officer', 'เปิดการตรวจสอบ', undefined, OF3), tl('2026-08-15', 'officer', 'ระงับการรับรอง', undefined, OF3), tl('2026-08-25', 'merchant', 'ยื่นอุทธรณ์'), tl('2026-09-20', 'officer', 'พิจารณาอุทธรณ์: คงผล และเพิกถอนการรับรอง', undefined, OF3)],
  },
  {
    id: 'RSK-2569-0003', merchantId: 'M-009', status: 'under_investigation',
    reason: 'ข้อร้องเรียนว่าสินค้าไม่ใช่ผ้าไหมแท้ตามที่ระบุ', evidenceSummary: ['ข้อร้องเรียน CMP-0017', 'ภาพสินค้าจากผู้บริโภค (จำลอง)'],
    relatedComplaintIds: ['CMP-2569-0017'], createdAt: d('2026-08-05'), updatedAt: d('2026-10-18'),
    timeline: [tl('2026-08-05', 'system', 'รับข้อกล่าวหาจากเรื่องที่ส่งต่อ'), tl('2026-08-07', 'officer', 'เปิดการตรวจสอบ', 'ขอให้ร้านค้าชี้แจงและส่งหลักฐานวัสดุ', OF3), tl('2026-10-18', 'officer', 'ออกคำเตือนเรื่องการระบุวัสดุ', undefined, OF1)],
  },
  {
    id: 'RSK-2569-0004', merchantId: 'M-012', status: 'allegation',
    reason: 'ผู้ประกอบการที่ถูกเพิกถอนการรับรอง (M-008) ยื่นลงทะเบียนร้านใหม่ ตรวจพบผ่าน Mock Identity ID เดียวกัน',
    evidenceSummary: ['Mock Identity ID: MID-H8D5-63 ตรงกับเจ้าของร้าน M-008', 'หมวดสินค้าเดียวกัน (อาหารเสริม)'],
    relatedComplaintIds: [], createdAt: d('2026-10-16'), updatedAt: d('2026-10-16'),
    timeline: [tl('2026-10-16T16:01', 'system', 'ระบบตรวจพบตัวตนซ้ำกับร้านที่ถูกเพิกถอน', 'เป็นข้อสังเกตเพื่อให้เจ้าหน้าที่พิจารณา ไม่ใช่การปฏิเสธอัตโนมัติ')],
  },
];
