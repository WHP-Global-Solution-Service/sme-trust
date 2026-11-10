/**
 * Role & Permission Policy — แหล่งข้อมูลเดียวของสิทธิ์ในระบบ SME Trust
 *
 * ทุกรายการอ้างอิงสิ่งที่มีอยู่จริงในระบบ:
 * - routes  = เส้นทางที่ RoleGate ใน AppRoutes ตรวจสิทธิ์ (ทดสอบอัตโนมัติว่าตรงกับตารางนี้ — tests/v2/permissions.test.mts)
 * - actions = ฟังก์ชันใน Store/Workflow ที่เรียก authorize() ก่อนเปลี่ยนข้อมูล (guarded) หรือที่บทบาทนั้นใช้งาน
 *
 * ข้อจำกัด: ระบบเป็น Frontend Prototype ไม่มี Backend — การบังคับสิทธิ์ทำในชั้น Store/Workflow ซึ่งทุกหน้าจอเรียกใช้
 * ไม่ใช่การป้องกันฝั่งเซิร์ฟเวอร์ (ข้อมูลทั้งหมดอยู่ใน Browser ของผู้ใช้) — ระบบจริงต้องบังคับซ้ำที่ API
 */
import type { Role } from '@/types';

export const ROLES: Role[] = ['consumer', 'merchant', 'officer', 'admin'];

export type PermissionGroup = 'public' | 'consumer' | 'merchant' | 'officer' | 'admin';

export const PERMISSION_GROUP_LABEL: Record<PermissionGroup, string> = {
  public: 'สาธารณะ (ไม่ต้องเข้าสู่ระบบ)',
  consumer: 'ผู้บริโภค',
  merchant: 'ผู้ประกอบการ (เจ้าของร้าน)',
  officer: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
};

export interface PermissionDef {
  group: PermissionGroup;
  label: string;
  roles: Role[];
  /** เส้นทางที่ตรวจสิทธิ์ด้วย RoleGate (:param = ค่าใดก็ได้) */
  routes: string[];
  /** ฟังก์ชันที่เกี่ยวข้อง — guarded: true = เรียก authorize() ก่อนเปลี่ยนข้อมูล */
  /** owner: ตรวจความเป็นเจ้าของเพิ่ม (ผู้ประกอบการ) — shop = ร้านของบัญชีตนเอง (requireOwnShop) · account = บัญชีตนเอง (requireOwnAccount) */
  actions?: { name: string; guarded: boolean; owner?: 'shop' | 'account' }[];
  note?: string;
}

const ALL: Role[] = ['consumer', 'merchant', 'officer', 'admin'];
const C: Role[] = ['consumer'];
const M: Role[] = ['merchant'];
const O: Role[] = ['officer', 'admin'];
const A: Role[] = ['admin'];
const g = (name: string) => ({ name, guarded: true });
const u = (name: string) => ({ name, guarded: false });
/** guarded + ตรวจ Ownership ของผู้ประกอบการ */
const gs = (name: string) => ({ name, guarded: true, owner: 'shop' as const });
const ga = (name: string) => ({ name, guarded: true, owner: 'account' as const });

export const PERMISSIONS = {
  // ---------------------------------------------------------------- สาธารณะ
  'shop.public.view': { group: 'public', label: 'ค้นหาและดูข้อมูลร้านค้าสาธารณะ', roles: ALL, routes: ['/check', '/directory', '/shop/:id'] },
  'band.view': {
    group: 'public',
    label: 'ดู Band / Assessment Badge และสถานะสาธารณะของร้าน',
    roles: ALL,
    routes: ['/shop/:id'],
    actions: [u('publicAssessmentView')],
    note: 'ส่งเฉพาะ Band, สถานะ Badge, Coverage, Confidence และสรุปสาธารณะ — ไม่มีคะแนนตัวเลขและรายละเอียด Risk Signal',
  },
  'badge.verify': { group: 'public', label: 'ตรวจสอบ Badge / ใบรับรองผ่าน QR หรือรหัส', roles: ALL, routes: ['/verify', '/verify/:certId'] },

  // ---------------------------------------------------------------- ผู้บริโภค
  'complaint.submit': { group: 'consumer', label: 'แจ้งปัญหา / ส่งข้อร้องเรียน', roles: C, routes: ['/report'], actions: [g('submitComplaint')] },
  'complaint.own.view': { group: 'consumer', label: 'ดูเรื่องร้องเรียนและการแจ้งเตือนของตนเอง', roles: C, routes: ['/consumer/cases', '/consumer/cases/:id', '/consumer/notifications'] },
  'complaint.consumer.act': {
    group: 'consumer',
    label: 'ตอบข้อเสนอของร้าน · ยืนยันว่าแก้ไขแล้ว · ส่งต่อเจ้าหน้าที่',
    roles: C,
    routes: ['/consumer/cases/:id'],
    actions: [g('consumerMessage'), g('consumerReplyOffer'), g('consumerConfirmResolved'), g("escalateComplaint(by: 'consumer')")],
  },

  // ---------------------------------------------------------------- ผู้ประกอบการ
  'merchant.home': { group: 'merchant', label: 'หน้าหลัก ข้อมูลร้าน Passport และการแจ้งเตือนของร้านตนเอง', roles: M, routes: ['/m', '/m/shop', '/m/passport', '/m/notifications'], actions: [gs('addChannel'), gs('resubmitApplication')] },
  'merchant.kyc': {
    group: 'merchant',
    label: 'ยืนยันตัวตน (e-KYC จำลอง)',
    roles: M,
    routes: ['/m/kyc'],
    actions: [{ name: 'setKycResult', guarded: false, owner: 'account' }],
    note: 'ไม่ตรวจบทบาท (ใช้ระหว่างสมัครก่อนเข้าสู่ระบบ) แต่ผู้ประกอบการที่เข้าสู่ระบบแล้วยืนยันได้เฉพาะบัญชีตนเอง — ผล KYC จริงต้องมาจากฝั่งเซิร์ฟเวอร์',
  },
  'shop.register': { group: 'merchant', label: 'สมัคร / ลงทะเบียนร้านค้า', roles: M, routes: ['/m/register-shop', '/m/register-shop/marketplace'], actions: [ga('submitShopRegistration'), ga('submitMarketplaceRegistration')] },
  'marketplace.connect': {
    group: 'merchant',
    label: 'เชื่อมต่อและนำเข้าข้อมูล Marketplace (จำลอง)',
    roles: M,
    routes: ['/m/marketplace', '/m/marketplace-app', '/m/marketplace/data/:id', '/m/marketplace/analysis', '/m/marketplace/profile/:id'],
    actions: [gs('connectMarketplace'), gs('grantConsent'), gs('resyncMarketplace'), gs('disconnectMarketplace'), u('completeSync'), u('simulateDataAge')],
    note: 'completeSync จำลองการตอบกลับของแพลตฟอร์ม และ simulateDataAge เป็นเครื่องมือสาธิตอายุข้อมูล — ไม่ใช่การกระทำของผู้ใช้ จึงไม่ตรวจบทบาท',
  },
  'profile_change.submit': { group: 'merchant', label: 'ส่งคำขอเปลี่ยนชื่อร้าน / หมวดธุรกิจ', roles: M, routes: ['/m/profile-changes', '/m/profile-changes/:id'], actions: [gs('confirmProfileUpdate'), gs('resubmitProfileChange')] },
  'assessment.own.view': {
    group: 'merchant',
    label: 'ดู Band ประเมิน และส่งผลประเมินของร้านตนเอง · ตอบคำขอข้อมูลของเจ้าหน้าที่',
    roles: M,
    routes: ['/m/trust'],
    actions: [gs("runAssessment(origin: 'merchant')"), gs('submitAssessment'), gs('respondToTask')],
    note: 'เห็น Band ทิศทางของปัจจัย และสิ่งที่ควรปรับปรุง — ไม่เห็นคะแนนตัวเลข 0–100',
  },
  'certification.own': { group: 'merchant', label: 'ดูและขอรับรอง Certification Level ของร้านตนเอง', roles: M, routes: ['/m/certification'], actions: [gs('applyCertification')] },
  'complaint.merchant': { group: 'merchant', label: 'ดูและตอบกลับข้อร้องเรียนของร้านตนเอง', roles: M, routes: ['/m/complaints', '/m/complaints/:id'], actions: [gs('merchantRespond')] },
  'warning.merchant': { group: 'merchant', label: 'รับทราบคำเตือนและส่งผลการแก้ไข', roles: M, routes: ['/m/warnings', '/m/warnings/:id'], actions: [gs('acknowledgeWarning'), gs('toggleWarningItem'), gs('submitCorrection')] },
  'risk.merchant': { group: 'merchant', label: 'ชี้แจงและอุทธรณ์เรื่องพิจารณาความเสี่ยง', roles: M, routes: ['/m/review'], actions: [gs('merchantStatement'), gs('submitAppeal')] },
  'merchant.tools': {
    group: 'merchant',
    label: 'ศูนย์อบรม เครื่องมือส่งเสริมร้านค้า และ AI ผู้ช่วย SME',
    roles: M,
    routes: ['/m/training', '/m/training/:courseId', '/m/toolkit', '/m/ai', '/m/ai/ad-checker', '/m/ai/complaint', '/m/ai/history'],
    actions: [ga('startCourse'), ga('completeLesson'), ga('submitQuiz'), u('recordAiAnalysis'), u('clearAiHistory')],
  },

  // ---------------------------------------------------------------- เจ้าหน้าที่ (ผู้ดูแลระบบมีสิทธิ์เดียวกัน)
  'officer.dashboard': { group: 'officer', label: 'Dashboard และการแจ้งเตือนของเจ้าหน้าที่', roles: O, routes: ['/o', '/o/notifications'] },
  'application.review': {
    group: 'officer',
    label: 'ตรวจคำขอลงทะเบียน / ขอรับรอง — อนุมัติ · ขอข้อมูลเพิ่ม · ไม่อนุมัติ',
    roles: O,
    routes: ['/o/applications', '/o/applications/:id'],
    actions: [g('startReview'), g('setCheck'), g('requestInfo'), g('approveApplication'), g('rejectApplication')],
  },
  'channel.verify': { group: 'officer', label: 'ตรวจสอบช่องทางขาย', roles: O, routes: ['/o/verification'], actions: [g('setChannelStatus')] },
  'certification.manage': {
    group: 'officer',
    label: 'จัดการใบรับรอง — ระงับ · เพิกถอน · คืนสถานะ · ต่ออายุ',
    roles: O,
    routes: ['/o/certification'],
    actions: [g('setCertStatus'), g('renewCertificate'), g('expireCertificate')],
  },
  'complaint.manage': {
    group: 'officer',
    label: 'จัดการข้อร้องเรียน — จัดประเภท · ส่งกลับร้าน · รับเรื่อง · ปิดเรื่อง',
    roles: O,
    routes: ['/o/complaints', '/o/complaints/:id'],
    actions: [g('officerClassify'), g('officerRemand'), g('officerClose'), g("escalateComplaint(by: 'officer')")],
  },
  'warning.issue': { group: 'officer', label: 'ออกคำเตือนและตรวจผลการแก้ไข', roles: O, routes: ['/o/warnings', '/o/warnings/new', '/o/warnings/:id', '/o/corrective'], actions: [g('issueWarning'), g('reviewCorrection')] },
  'risk.manage': { group: 'officer', label: 'เปิดเรื่องพิจารณาความเสี่ยง · ตัดสิน · พิจารณาอุทธรณ์', roles: O, routes: ['/o/risk', '/o/risk/:id'], actions: [g('openRiskCase'), g('riskAction'), g('reviewAppeal')] },
  'assessment.score.view': {
    group: 'officer',
    label: 'ดูคะแนนตัวเลข 0–100 และรายละเอียด Risk Signal',
    roles: O,
    routes: ['/o/assessments', '/o/assessments/:id'],
    note: 'ผู้บริโภคและร้านค้าเห็นเฉพาะ Band — คะแนนตัวเลขใช้ประกอบการพิจารณาของเจ้าหน้าที่',
  },
  'assessment.decide': { group: 'officer', label: 'พิจารณาผลประเมินที่ร้านส่ง (อนุมัติ · ขอข้อมูล · ไม่อนุมัติ · ส่งพิจารณาความเสี่ยง)', roles: O, routes: ['/o/assessments/:id'], actions: [g('decideAssessment')] },
  'profile_change.review': {
    group: 'officer',
    label: 'อนุมัติ / ไม่อนุมัติ / ขอข้อมูลคำขอเปลี่ยนข้อมูลร้าน',
    roles: O,
    routes: ['/o/profile-changes', '/o/profile-changes/:id'],
    actions: [g('approveProfileChange'), g('rejectProfileChange'), g('requestProfileChangeInfo')],
  },
  'exception.resolve': { group: 'officer', label: 'ตัดสินกรณียกเว้น (Exception Queue)', roles: O, routes: ['/o/exceptions', '/o/exceptions/:id'], actions: [g('resolveTask')] },
  'automation.policy': { group: 'officer', label: 'ดูกฎอัตโนมัติ / KPI และรัน Simulation', roles: O, routes: ['/o/automation'], actions: [u("processAll('simulation')")] },
  'officer.reports': { group: 'officer', label: 'รายงานและบันทึกการอบรม', roles: O, routes: ['/o/reports', '/o/training'] },

  // ---------------------------------------------------------------- ผู้ดูแลระบบ
  'admin.dashboard': { group: 'admin', label: 'Admin Dashboard', roles: A, routes: ['/admin'] },
  'accounts.view': { group: 'admin', label: 'ดูรายชื่อบัญชีและร้านค้า (อ่านอย่างเดียว)', roles: A, routes: ['/admin/accounts'] },
  'audit.view': { group: 'admin', label: 'ดู Audit Log ทั้งระบบ', roles: A, routes: ['/admin/audit'] },
  'demo_data.manage': {
    group: 'admin',
    label: 'ส่งออก / รีเซ็ตข้อมูลสาธิต',
    roles: A,
    routes: ['/admin/data'],
    actions: [u('resetAllDemoData')],
    note: 'ปุ่ม Reset ใน Demo Mode เปิดให้ทุกบทบาทใช้เพื่อการสาธิต — ไม่ใช่สิทธิ์ของระบบจริง',
  },
  'assessment_model.configure': { group: 'admin', label: 'ปรับน้ำหนักโมเดลการประเมิน', roles: A, routes: ['/admin/assessment-model'], actions: [g('setWeights')] },
  'permissions.view': { group: 'admin', label: 'ดูตาราง Role & Permission (อ่านอย่างเดียว)', roles: A, routes: ['/admin/permissions'] },
} satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;

export const permissionList = () => Object.entries(PERMISSIONS) as [Permission, PermissionDef][];

export const can = (role: Role, permission: Permission): boolean => (PERMISSIONS[permission] as PermissionDef).roles.includes(role);

/** สิ่งที่ผู้ดูแลระบบในระบบจริงมักมี แต่ระบบต้นแบบนี้ยังไม่มี — แสดงในหน้า Matrix เพื่อไม่ให้เข้าใจผิด */
export const NOT_IN_SYSTEM: string[] = [
  'สร้าง / แก้ไข / ปิดบัญชีผู้ใช้ (หน้าบัญชีเป็นแบบอ่านอย่างเดียว)',
  'กำหนดบทบาทให้ผู้ใช้ และแก้ไขสิทธิ์แบบ Dynamic',
  'จัดการ Master Data และการตั้งค่าระบบทั่วไป (นอกจากน้ำหนักโมเดลการประเมิน)',
  'บทบาทอื่น เช่น Supervisor / Approver / Auditor',
];

/**
 * ฟังก์ชันใน Store ที่ "ไม่ตรวจบทบาทโดยเจตนา" พร้อมเหตุผล — Regression Test บังคับว่าทุกฟังก์ชันที่ export จาก Store
 * ต้องอยู่ใน Matrix (actions) หรืออยู่ในรายการนี้ เพิ่มฟังก์ชันใหม่โดยไม่จัดประเภทจะทำให้ Test ล้มเหลว
 */
export const UNGUARDED_BY_DESIGN: Record<string, string> = {
  // อ่านข้อมูล / คำนวณ — ไม่เปลี่ยนสถานะ
  currentActor: 'อ่านข้อมูลผู้ใช้ปัจจุบัน',
  approvalBlocker: 'ตรวจเงื่อนไข (อ่านอย่างเดียว)',
  openRiskCaseOf: 'อ่านข้อมูล',
  certStatusBlocker: 'ตรวจเงื่อนไข (อ่านอย่างเดียว)',
  negotiationStatus: 'คำนวณสถานะ (อ่านอย่างเดียว)',
  canConfirmResolved: 'ตรวจเงื่อนไข (อ่านอย่างเดียว)',
  mockShopProfile: 'สร้างข้อมูลจำลองเพื่อแสดงผล (ไม่บันทึก)',
  shopClaim: 'อ่านข้อมูล',
  registeredValues: 'อ่านข้อมูล',
  sourceOfConnection: 'อ่านข้อมูล',
  dataBundle: 'อ่านข้อมูล',
  currentInputs: 'อ่านข้อมูล',
  v1CriteriaFor: 'ตรวจเงื่อนไข (อ่านอย่างเดียว)',
  // ภายใน Workflow — ถูกเรียกจากฟังก์ชันที่ตรวจสิทธิ์แล้วเท่านั้น
  notify: 'ภายใน Workflow: ส่งการแจ้งเตือนหลังการกระทำที่ตรวจสิทธิ์แล้ว',
  audit: 'ภายใน Workflow: บันทึก Audit Log',
  fileCertificationApplication: 'ภายใน Workflow: เรียกจาก applyCertification / submitAssessment / decideAssessment ที่ตรวจสิทธิ์แล้ว',
  attachImportedMarketplaces: 'ภายใน Workflow: เรียกจาก submitMarketplaceRegistration และ Fixture ของ Demo',
  // ระบบอัตโนมัติ (actor = system)
  processMerchant: 'ระบบอัตโนมัติ: ประเมินใหม่และจัดเส้นทางเมื่อข้อมูลเปลี่ยน',
  // ก่อนเข้าสู่ระบบ (Self-service) — ยังไม่มีบทบาทที่ยืนยันแล้ว
  registerOperator: 'สมัครบัญชีผู้ประกอบการก่อนเข้าสู่ระบบ',
  resetPin: 'ลืม PIN ก่อนเข้าสู่ระบบ (จำลอง OTP)',
  // ข้อมูลของผู้ใช้เอง / Demo
  markNotificationsRead: 'อ่านการแจ้งเตือนของตนเอง',
  resetAllDemoData: 'Demo Mode — รีเซ็ตข้อมูลสาธิต (ไม่ใช่สิทธิ์ของระบบจริง)',
};
