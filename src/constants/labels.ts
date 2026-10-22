import type {
  CertStatus,
  ChannelStatus,
  ChannelType,
  ComplaintCategory,
  ComplaintStatus,
  OfferStatus,
  OfferType,
  Priority,
  RegistrationStatus,
  RiskCaseStatus,
  RiskStatus,
  TrustLevel,
  WarningStatus,
} from '@/types';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  draft: { label: 'ฉบับร่าง', tone: 'neutral' },
  submitted: { label: 'ส่งคำขอแล้ว', tone: 'info' },
  pending_review: { label: 'รอตรวจสอบ', tone: 'warning' },
  need_info: { label: 'ขอข้อมูลเพิ่มเติม', tone: 'warning' },
  under_verification: { label: 'กำลังตรวจสอบ', tone: 'info' },
  approved: { label: 'อนุมัติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'error' },
};

export const RISK_STATUS: Record<RiskStatus | RiskCaseStatus, { label: string; tone: Tone; desc: string }> = {
  none: { label: 'ปกติ', tone: 'success', desc: 'ไม่มีประเด็นความเสี่ยงที่เปิดอยู่' },
  allegation: { label: 'มีข้อกล่าวหา', tone: 'warning', desc: 'ได้รับข้อมูลที่ต้องตรวจสอบ ยังไม่มีข้อสรุปว่ากระทำผิด' },
  under_investigation: { label: 'อยู่ระหว่างตรวจสอบ', tone: 'warning', desc: 'เจ้าหน้าที่กำลังตรวจสอบข้อเท็จจริง ยังไม่มีข้อสรุป' },
  warning: { label: 'มีคำเตือน', tone: 'warning', desc: 'ได้รับคำเตือนและต้องปรับปรุงตามคำแนะนำ' },
  suspended: { label: 'ระงับการรับรอง', tone: 'error', desc: 'ระงับการรับรองชั่วคราว ระหว่างรอผลการแก้ไขหรืออุทธรณ์' },
  revoked: { label: 'เพิกถอนการรับรอง', tone: 'error', desc: 'เพิกถอนการรับรองแล้ว' },
  appeal_submitted: { label: 'ยื่นอุทธรณ์แล้ว', tone: 'info', desc: 'ร้านค้ายื่นอุทธรณ์ รอเจ้าหน้าที่พิจารณา' },
  appeal_reviewed: { label: 'พิจารณาอุทธรณ์แล้ว', tone: 'neutral', desc: 'เจ้าหน้าที่พิจารณาอุทธรณ์เสร็จสิ้น' },
  dismissed: { label: 'ยุติเรื่อง (ไม่พบมูล)', tone: 'success', desc: 'ตรวจสอบแล้วไม่พบมูลตามข้อกล่าวหา' },
};

export const TRUST_LEVELS: Record<TrustLevel, { name: string; th: string; desc: string; meaningNot: string }> = {
  0: {
    name: 'Not Verified',
    th: 'ยังไม่ยืนยันตัวตน',
    desc: 'ยังไม่ผ่านการยืนยันตัวตนผู้ประกอบการ',
    meaningNot: 'ไม่ได้หมายความว่าร้านค้ากระทำผิด',
  },
  1: {
    name: 'Identity Verified',
    th: 'ยืนยันตัวตนแล้ว',
    desc: 'ยืนยันตัวตนเจ้าของร้านแบบจำลองแล้ว',
    meaningNot: 'ไม่ใช่การรับรองคุณภาพสินค้าหรือบริการ',
  },
  2: {
    name: 'Business Verified',
    th: 'ผ่านเกณฑ์ธุรกิจ',
    desc: 'ตรวจสอบข้อมูลธุรกิจ ที่อยู่ และเอกสารประกอบแล้ว',
    meaningNot: 'ไม่ใช่การรับประกันคุณภาพสินค้าทุกรายการ',
  },
  3: {
    name: 'Trusted SME',
    th: 'ได้รับการรับรอง',
    desc: 'ผ่านเกณฑ์ธุรกิจ ผ่านการอบรม และไม่มีคำเตือนค้าง',
    meaningNot: 'ผู้บริโภคยังควรตรวจสอบรายละเอียดสินค้าก่อนซื้อ',
  },
  4: {
    name: 'Trusted SME Plus',
    th: 'รับรองระดับสูง (ระดับที่เสนอ)',
    desc: 'ระดับที่เสนอใน Prototype: ช่องทางขายตรวจสอบครบ อบรมครบ และประวัติแก้ไขข้อร้องเรียนดี',
    meaningNot: 'เป็นระดับแนวคิดเพื่อการสาธิตเท่านั้น',
  },
};

export const CERT_STATUS: Record<CertStatus, { label: string; tone: Tone; usable: boolean }> = {
  active: { label: 'ใช้งานได้', tone: 'success', usable: true },
  expired: { label: 'หมดอายุ', tone: 'neutral', usable: false },
  suspended: { label: 'ถูกระงับ', tone: 'error', usable: false },
  revoked: { label: 'ถูกเพิกถอน', tone: 'error', usable: false },
};

export const CHANNEL_TYPES: Record<ChannelType, { label: string; prefix: string }> = {
  facebook: { label: 'Facebook', prefix: 'facebook.com/' },
  tiktok: { label: 'TikTok', prefix: 'tiktok.com/@' },
  line: { label: 'LINE OA', prefix: 'LINE @' },
  website: { label: 'Website', prefix: 'https://' },
  marketplace: { label: 'E-Commerce Marketplace', prefix: 'ร้านบน Marketplace: ' },
};

export const CHANNEL_STATUS: Record<ChannelStatus, { label: string; tone: Tone }> = {
  unverified: { label: 'ยังไม่ตรวจสอบ', tone: 'neutral' },
  pending: { label: 'รอตรวจสอบ', tone: 'warning' },
  verified: { label: 'ตรวจสอบแล้ว', tone: 'success' },
  rejected: { label: 'ไม่ผ่าน', tone: 'error' },
};

export const COMPLAINT_CATEGORY: Record<ComplaintCategory, string> = {
  not_received: 'ไม่ได้รับสินค้า',
  not_as_described: 'สินค้าไม่ตรงตามรายละเอียด',
  refund_refused: 'ปฏิเสธการคืนเงิน',
  misleading_ad: 'โฆษณาเกินจริง',
  defective: 'สินค้าชำรุด',
  service_breach: 'การบริการไม่เป็นไปตามข้อตกลง',
  other: 'อื่น ๆ',
};

export const COMPLAINT_STATUS: Record<ComplaintStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'ยื่นเรื่องแล้ว', tone: 'info' },
  awaiting_merchant: { label: 'รอร้านค้าตอบกลับ', tone: 'warning' },
  merchant_responded: { label: 'ร้านค้าตอบกลับแล้ว', tone: 'info' },
  waiting_consumer: { label: 'รอผู้บริโภคยืนยัน', tone: 'primary' },
  resolved: { label: 'แก้ไขสำเร็จ', tone: 'success' },
  escalated: { label: 'ส่งต่อเจ้าหน้าที่', tone: 'error' },
  closed: { label: 'ปิดเรื่อง', tone: 'neutral' },
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  low: { label: 'ต่ำ', tone: 'neutral' },
  medium: { label: 'ปานกลาง', tone: 'info' },
  high: { label: 'สูง', tone: 'warning' },
  urgent: { label: 'เร่งด่วน', tone: 'error' },
};

export const OFFER_TYPE: Record<OfferType, string> = {
  refund: 'เสนอคืนเงิน',
  replace: 'เสนอเปลี่ยนสินค้า',
  reship: 'เสนอจัดส่งใหม่',
  explain: 'คำชี้แจง',
  request_info: 'ขอข้อมูลเพิ่มเติม',
};

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอผู้บริโภคตอบ', tone: 'warning' },
  accepted: { label: 'ยอมรับแล้ว', tone: 'success' },
  rejected: { label: 'ปฏิเสธ', tone: 'error' },
  negotiate: { label: 'ขอเจรจาเพิ่ม', tone: 'info' },
};

export const WARNING_STATUS: Record<WarningStatus, { label: string; tone: Tone }> = {
  advisory: { label: 'คำแนะนำ', tone: 'info' },
  warning_issued: { label: 'ออกคำเตือนแล้ว', tone: 'warning' },
  acknowledged: { label: 'รับทราบแล้ว', tone: 'primary' },
  correction_required: { label: 'ต้องแก้ไข', tone: 'warning' },
  correction_submitted: { label: 'ส่งผลการแก้ไขแล้ว', tone: 'info' },
  under_review: { label: 'กำลังตรวจผล', tone: 'info' },
  completed: { label: 'เสร็จสิ้น', tone: 'success' },
};

export const BUSINESS_CATEGORIES = [
  'อาหารและเครื่องดื่ม',
  'แฟชั่นและเครื่องแต่งกาย',
  'ความงามและสุขภาพ',
  'ของใช้ในบ้าน',
  'อิเล็กทรอนิกส์และแกดเจ็ต',
  'หัตถกรรมและของที่ระลึก',
  'ของเล่นและสินค้าเด็ก',
  'เกษตรและผลไม้',
  'บริการ',
];

export const PROVINCES = [
  'กรุงเทพมหานคร',
  'นนทบุรี',
  'เชียงใหม่',
  'เชียงราย',
  'ขอนแก่น',
  'นครราชสีมา',
  'บุรีรัมย์',
  'สกลนคร',
  'จันทบุรี',
  'ภูเก็ต',
  'สงขลา',
  'ชลบุรี',
];

export const COMPANY_TYPES = ['บริษัทจำกัด', 'ห้างหุ้นส่วนจำกัด', 'ห้างหุ้นส่วนสามัญนิติบุคคล', 'บริษัทมหาชนจำกัด'];

export const ROLE_LABEL: Record<string, string> = {
  merchant: 'ผู้ประกอบการ',
  consumer: 'ผู้บริโภค',
  officer: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  system: 'ระบบ',
};

export const DEMO_CERT_LABEL = 'ตัวอย่างใบรับรองสำหรับสาธิต';
export const PROTOTYPE_LABEL = 'ระบบสาธิต (Prototype)';
