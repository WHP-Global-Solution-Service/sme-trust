import { COMPLAINT_STATUS, REGISTRATION_STATUS, RISK_STATUS, TRUST_LEVELS, WARNING_STATUS } from '@/constants/labels';
import { courses } from '@/mock/data';
import {
  useCertificationStore,
  useComplaintStore,
  useMerchantStore,
  useOperatorStore,
  useRiskStore,
  useSessionStore,
  useTrainingStore,
  useVerificationStore,
  useWarningStore,
} from '@/stores';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import type { DemoCtx } from '@/stores/demo';
import { currentCert, verdictFor } from '@/utils/trust';
import { validateAdInput, AD_LEVEL_LABEL } from '@/features/ai-assistant/services/advertisingAnalyzer';
import type { ContinuityIssue, GateInput, ScenarioDef, Track } from '@/demo/types';
import { v2Scenarios } from './v2';
import { fixtureAdChecker, fixtureBeforeSuspension, fixtureComplaintCase, fixtureWarningCaseStudy, operatorExists } from './fixtures';

// ---------- ตัวช่วยอ่านข้อมูลธุรกิจ (อ่านอย่างเดียว) ----------
const merchant = (id?: string) => useMerchantStore.getState().items.find((m) => m.id === id);
const operator = (id?: string) => useOperatorStore.getState().items.find((o) => o.id === id);
const app = (id?: string) => useVerificationStore.getState().items.find((a) => a.id === id);
const complaint = (id?: string) => useComplaintStore.getState().items.find((c) => c.id === id);
const warning = (id?: string) => useWarningStore.getState().items.find((w) => w.id === id);
const risk = (id?: string) => useRiskStore.getState().items.find((r) => r.id === id);
const certOf = (merchantId?: string) => (merchantId ? currentCert(useCertificationStore.getState().items, merchantId) : undefined);
const sig = (g: GateInput, k: string) => g.signals[k];
const num = (g: GateInput, k: string) => (typeof g.signals[k] === 'number' ? (g.signals[k] as number) : -1);
const shopName = (ctx: DemoCtx) => merchant(ctx.merchantId)?.shopName ?? 'ร้านค้า';
const verdictText = (merchantId?: string) => {
  const m = merchant(merchantId);
  return m ? verdictFor(m, operator(m.operatorId), certOf(m.id)).label : '-';
};
const courseOfWarning = (ctx: DemoCtx) => warning(ctx.warningId)?.courseIds[0] ?? 'CRS-02';

/** ร้านที่อนุมัติแล้วและใบรับรองใช้งานได้ (ใช้ต่อจาก Scenario ก่อนหน้า) */
const certifiedShop = (id?: string) => {
  const m = merchant(id);
  return m && m.registrationStatus === 'approved' && certOf(m.id)?.status === 'active' ? m : undefined;
};

// ---------- ความต่อเนื่องของ Full Journey ----------
const hasShop = (operatorId?: string) => useMerchantStore.getState().items.some((m) => m.operatorId === operatorId);

/** Scenario 2 ต้องใช้บัญชีจาก Scenario 1 ที่ยืนยันตัวตนแล้วและยังไม่มีร้าน */
const accountIssue = (j: DemoCtx): ContinuityIssue | undefined => {
  const op = operator(j.operatorId);
  if (op && op.kycStatus === 'verified' && !hasShop(op.id)) return undefined;
  return {
    message: !op ? 'ยังไม่มีบัญชีผู้ประกอบการจาก Scenario 1' : op.kycStatus !== 'verified' ? `บัญชี "${op.name}" จาก Scenario 1 ยังไม่ผ่านการยืนยันตัวตน` : `บัญชี "${op.name}" มีร้านค้าแล้ว จึงสาธิตการสมัครร้านแรกไม่ได้`,
    fixScenario: 's1',
    fallbackLabel: `บัญชีตัวอย่าง "${operator('OP-012')?.name}" (OP-012) ที่ยืนยันตัวตนแล้วและยังไม่มีร้าน`,
  };
};

/** Scenario 3–4 ต้องใช้ร้านจาก Scenario 2 ที่ได้รับการรับรองแล้ว */
const shopIssue = (j: DemoCtx): ContinuityIssue | undefined => {
  if (certifiedShop(j.merchantId)) return undefined;
  const m = merchant(j.merchantId);
  return {
    message: m ? `ร้าน "${m.shopName}" จาก Scenario 2 ยังไม่ได้รับการรับรอง (สถานะ: ${REGISTRATION_STATUS[m.registrationStatus].label})` : 'ยังไม่มีร้านค้าที่ได้รับการรับรองจาก Scenario 2',
    fixScenario: 's2',
    fallbackLabel: `ร้านค้าตัวอย่าง "${merchant('M-001')?.shopName}" (M-001) ที่ได้รับการรับรองแล้ว`,
  };
};

/** Scenario 7 ใช้บัญชีจาก Scenario 1 */
const operatorIssue = (j: DemoCtx): ContinuityIssue | undefined =>
  operatorExists(j.operatorId)
    ? undefined
    : { message: 'ยังไม่มีบัญชีผู้ประกอบการจาก Scenario 1', fixScenario: 's1', fallbackLabel: `บัญชีตัวอย่าง "${operator('OP-001')?.name}" (OP-001)` };

export const scenarios: ScenarioDef[] = [
  // ------------------------------------------------------------ 1
  {
    id: 's1',
    no: 1,
    title: 'ผู้ประกอบการสมัครสมาชิกและยืนยันตัวตน',
    objective: 'เริ่มใช้งานได้ง่ายด้วยมือถือ: OTP, e-KYC จำลอง และ PIN จนได้สถานะ "ยืนยันตัวตนแล้ว (Level 1)"',
    keyMessage: 'ผู้ประกอบการเริ่มต้นได้ภายในไม่กี่นาที และทุกร้านผูกกับตัวตนที่ยืนยันแล้ว',
    audience: ['merchant'],
    duration: '≈ 4 นาที',
    benefits: {
      sme: 'เริ่มต้นได้ภายในไม่กี่นาทีผ่านมือถือ ไม่ต้องเดินทางหรือส่งเอกสารกระดาษ',
      consumer: 'มั่นใจได้ว่าร้านค้ามีเจ้าของที่ยืนยันตัวตนแล้ว',
      ocpb: 'ติดตามผู้ประกอบการได้ด้วยตัวตนเดียว แม้เปิดหลายร้านหรือหลายช่องทาง',
    },
    nextCta: 'ดำเนินการต่อ: ลงทะเบียนร้านค้า',
    prepare: () => ({ operatorId: '', consumerId: 'CS-001', officerId: 'OF-001' }),
    exports: (c) => ({ operatorId: c.operatorId }),
    steps: [
      { id: 's1-welcome', role: 'merchant', route: () => '/', title: 'หน้าเริ่มต้น', instruction: 'แนะนำระบบ แล้วกด "ถัดไป" (หรือปุ่ม "เริ่มลงทะเบียน")', tip: 'ผู้บริโภคตรวจสอบร้านได้จากหน้านี้โดยไม่ต้องสมัครสมาชิก', nextLabel: 'เริ่มลงทะเบียน' },
      { id: 's1-phone', role: 'merchant', route: () => '/register', title: 'กรอกเบอร์โทรศัพท์', instruction: 'กรอกเบอร์ เช่น 0891234567 ติ๊กยอมรับเงื่อนไข แล้วกด "ขอรหัส OTP"', gate: { check: (g) => num(g, 'register.step') >= 1, hint: 'กรอกเบอร์โทรและกด "ขอรหัส OTP"' } },
      { id: 's1-otp', role: 'merchant', route: () => '/register', title: 'ยืนยันรหัส OTP', instruction: 'กรอก OTP ที่แสดงในกล่องสีเหลือง แล้วกด "ยืนยัน" (ลองกรอกผิดเพื่อแสดงข้อความเตือน)', tip: 'ระบบจริงส่งทาง SMS — ระบบสาธิตแสดงรหัสบนจอ', gate: { check: (g) => num(g, 'register.step') >= 2, hint: 'กรอก OTP ให้ถูกต้องแล้วกด "ยืนยัน"' } },
      { id: 's1-profile', role: 'merchant', route: () => '/register', title: 'ข้อมูลเริ่มต้น', instruction: 'กรอกชื่อ นามสกุล อีเมล และจังหวัด (ข้อมูลสมมติ) แล้วกด "ถัดไป"', gate: { check: (g) => num(g, 'register.step') >= 3, hint: 'กรอกข้อมูลให้ครบแล้วกด "ถัดไป"' } },
      {
        id: 's1-id',
        role: 'merchant',
        route: () => '/register',
        title: 'ยืนยันบัตรประจำตัว (จำลอง)',
        instruction: 'กด "เริ่มยืนยันตัวตน" → "จำลองการถ่ายบัตร" (ติ๊ก "จำลองผลล้มเหลว" ก่อนเริ่ม เพื่อแสดงการ Retry ได้)',
        tip: 'ไม่เปิดกล้อง ไม่เก็บภาพ และไม่เก็บเลขบัตรประชาชน',
        gate: { check: (g) => ['face', 'face_scan', 'success'].includes(String(sig(g, 'ekyc.phase'))), hint: 'ถ่ายบัตรจำลองให้ผ่านขั้นตอน (หากล้มเหลว กด Retry)' },
      },
      { id: 's1-face', role: 'merchant', route: () => '/register', title: 'สแกนใบหน้า (จำลอง)', instruction: 'กด "จำลองการสแกนใบหน้า" จนได้ Identity Verified แล้วกด "ดำเนินการต่อ"', gate: { check: (g) => sig(g, 'register.kyc') === 'ok', hint: 'ต้องยืนยันตัวตนสำเร็จ (Identity Verified) — กด Retry ได้หากล้มเหลว' } },
      { id: 's1-pin', role: 'merchant', route: () => '/register', title: 'ตั้ง PIN 6 หลัก', instruction: 'ตั้ง PIN และยืนยันให้ตรงกัน (ลอง 111111 ระบบจะปฏิเสธ)', gate: { check: (g) => num(g, 'register.step') >= 5, hint: 'ตั้ง PIN และยืนยันให้ตรงกัน' } },
      {
        id: 's1-success',
        role: 'merchant',
        route: () => '/register',
        title: 'ลงทะเบียนสำเร็จ',
        instruction: 'กด "เข้าสู่หน้าหลัก" บนหน้าจอ',
        gate: {
          check: (g) => {
            const op = operator(g.session.operatorId);
            return !!op && op.createdAt >= g.startedAt && op.kycStatus === 'verified' && g.session.merchantLoggedIn;
          },
          hint: 'กด "เข้าสู่หน้าหลัก" เพื่อเข้าสู่ระบบด้วยบัญชีที่เพิ่งสร้าง',
        },
        capture: (g) => ({ operatorId: g.session.operatorId }),
      },
      { id: 's1-home', role: 'merchant', route: () => '/m', title: 'หน้าหลักผู้ประกอบการ', instruction: 'ชี้สถานะ "ยืนยันตัวตนแล้ว (Level 1)" และข้อความว่ายังไม่มีร้านค้า', tip: 'Level 1 คือยืนยันตัวตนเจ้าของบัญชีเท่านั้น ไม่ใช่การรับรองคุณภาพสินค้า', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const op = operator(c.operatorId);
      return op
        ? [`สร้างบัญชีผู้ประกอบการ "${op.name}" (${op.id})`, `ผูกกับ Mock Identity ID ${op.mockIdentityId} — ไม่เก็บเลขบัตรประชาชน`, 'สถานะ e-KYC: ยืนยันตัวตนแล้ว (Level 1)', 'ตั้ง PIN สำหรับเข้าสู่ระบบสาธิต']
        : ['ยังไม่มีบัญชีที่สร้างใน Scenario นี้'];
    },
  },

  // ------------------------------------------------------------ 2
  {
    id: 's2',
    no: 2,
    title: 'สมัครร้านค้าและได้รับการรับรองหลังการตรวจสอบ',
    objective: 'ผู้ประกอบการยื่นข้อมูลร้าน เจ้าหน้าที่ตรวจตาม Checklist และอนุมัติ ใบรับรองตัวอย่างและ Badge อัปเดตทันที',
    keyMessage: 'การตรวจสอบเป็นมาตรฐานเดียวกัน มีหลักฐานทุกขั้น และร้านค้านำผลไปใช้บนช่องทางขายเดิมได้',
    audience: ['merchant', 'officer'],
    duration: '≈ 7 นาที',
    benefits: {
      sme: 'ได้สถานะที่ตรวจสอบได้ไปแสดงบน Facebook / LINE / TikTok เดิม เพิ่มความมั่นใจให้ลูกค้า',
      consumer: 'มีข้อมูลร้านที่ผ่านการตรวจสอบให้ใช้ประกอบการตัดสินใจ',
      ocpb: 'ตรวจสอบด้วย Checklist มาตรฐาน และมี Audit Log ทุกการตัดสินใจ',
    },
    nextCta: 'ดำเนินการต่อ: ตรวจสอบร้านค้าในมุมผู้บริโภค',
    continuity: accountIssue,
    prepare: (j, carry) => {
      const fromS1 = carry && !accountIssue(j);
      const operatorId = fromS1 ? j.operatorId! : 'OP-012';
      // แบบฟอร์มบันทึกฉบับร่างอัตโนมัติ — เริ่ม/เล่นซ้ำ Scenario 2 จากหน้าแรกของแบบฟอร์มเสมอ
      useSessionStore.getState().saveDraft(operatorId, undefined);
      return { operatorId, officerId: 'OF-001', consumerId: 'CS-001' };
    },
    exports: (c) => ({ operatorId: c.operatorId, merchantId: c.merchantId, applicationId: c.applicationId, certId: c.certId }),
    steps: [
      { id: 's2-home', role: 'merchant', route: () => '/m', title: 'หน้าหลักผู้ประกอบการ', instruction: (c) => `บัญชี "${operator(c.operatorId)?.name}" ยืนยันตัวตนแล้วแต่ยังไม่มีร้าน — กด "ถัดไป" เพื่อลงทะเบียนร้านค้า`, nextLabel: 'ลงทะเบียนร้านค้า' },
      { id: 's2-type', role: 'merchant', route: () => '/m/register-shop', title: 'ประเภทธุรกิจ', instruction: 'เลือก "บุคคลธรรมดา" หรือ "นิติบุคคล" แล้วกด "ถัดไป" (หรือกด "เติมข้อมูลตัวอย่าง" เพื่อข้ามไปขั้นตรวจสอบ)', gate: { check: (g) => num(g, 'shop.step') >= 1, hint: 'เลือกประเภทธุรกิจแล้วกด "ถัดไป" ในแบบฟอร์ม' } },
      { id: 's2-info', role: 'merchant', route: () => '/m/register-shop', title: 'ข้อมูลผู้ประกอบการและร้านค้า', instruction: 'กรอกข้อมูลผู้ประกอบการและข้อมูลร้าน (ระบบตรวจรูปแบบข้อมูลให้)', gate: { check: (g) => num(g, 'shop.step') >= 3, hint: 'กรอกข้อมูลให้ครบจนถึงขั้น "ช่องทางขาย"' } },
      { id: 's2-channels', role: 'merchant', route: () => '/m/register-shop', title: 'ช่องทางขาย', instruction: 'ระบุช่องทางขายเดิม เช่น Facebook / LINE', tip: 'แต่ละช่องทางถูกตรวจแยกกัน ป้องกันเพจปลอม', gate: { check: (g) => num(g, 'shop.step') >= 4, hint: 'ระบุช่องทางขายอย่างน้อย 1 ช่องทางแล้วกด "ถัดไป"' } },
      { id: 's2-docs', role: 'merchant', route: () => '/m/register-shop', title: 'เอกสารประกอบ (จำลอง)', instruction: 'เพิ่มเอกสารตัวอย่าง (ระบบเก็บเฉพาะชื่อไฟล์ ไม่อัปโหลดไปที่ใด)', gate: { check: (g) => num(g, 'shop.step') >= 5, hint: 'แนบเอกสารจำลองอย่างน้อย 1 รายการแล้วกด "ถัดไป"' } },
      {
        id: 's2-submit',
        role: 'merchant',
        route: () => '/m/register-shop',
        title: 'ตรวจสอบข้อมูลและส่งคำขอ',
        instruction: 'ตรวจทานข้อมูล ติ๊กยืนยัน แล้วกด "ส่งคำขอ" — ระบบแสดงหน้ายืนยันพร้อมเลขคำขอ',
        gate: { check: (g) => !!latestApp(g), hint: 'ติ๊กยืนยันความถูกต้องแล้วกด "ส่งคำขอ"' },
        capture: (g) => {
          const a = latestApp(g)!;
          return { applicationId: a.id, merchantId: a.merchantId };
        },
      },
      { id: 's2-pending', role: 'merchant', route: () => '/m/shop', title: 'รอการตรวจสอบ', instruction: (c) => `ร้าน "${shopName(c)}" สถานะ Pending Approval — คำขอ ${c.applicationId} ถูกส่งถึงเจ้าหน้าที่แล้ว`, nextLabel: 'ดูการตรวจสอบในมุมเจ้าหน้าที่' },
      {
        id: 's2-review',
        role: 'officer',
        route: (c) => `/o/applications/${c.applicationId}`,
        transition: 'คำขอของผู้ประกอบการถูกส่งแล้ว ขั้นตอนต่อไปคือเจ้าหน้าที่ตรวจสอบข้อมูลร้านค้าในคำขอเดียวกัน',
        title: 'เจ้าหน้าที่เปิดคำขอ',
        instruction: (c) => `คำขอ ${c.applicationId} — ตรวจข้อมูลและเอกสาร แล้วกด "เริ่มตรวจสอบ"`,
        gate: { check: (g) => ['under_verification', 'approved'].includes(app(g.ctx.applicationId)?.status ?? ''), hint: 'กด "เริ่มตรวจสอบ" บนหน้าคำขอ' },
      },
      {
        id: 's2-approve',
        role: 'officer',
        route: (c) => `/o/applications/${c.applicationId}`,
        title: 'ตรวจ Checklist และอนุมัติ',
        instruction: 'กด "ผ่าน" ในรายการตรวจ แล้วกด "อนุมัติ" (ระบบไม่อนุมัติให้อัตโนมัติ)',
        tip: 'ระบบไม่ให้อนุมัติหากยังไม่ผ่าน e-KYC หรือมีรายการตรวจไม่ผ่าน',
        nextLabel: 'ดูผลในมุมผู้ประกอบการ',
        gate: { check: (g) => app(g.ctx.applicationId)?.status === 'approved', hint: 'กด "อนุมัติ" และยืนยัน' },
        capture: (g) => ({ certId: certOf(g.ctx.merchantId)?.id }),
      },
      { id: 's2-notify', role: 'merchant', route: () => '/m/notifications', transition: 'เจ้าหน้าที่อนุมัติคำขอแล้ว กลับไปดูผลในมุมผู้ประกอบการ (ร้านเดิม)', title: 'การแจ้งเตือนผลอนุมัติ', instruction: 'ร้านค้าได้รับแจ้ง "คำขอลงทะเบียนได้รับอนุมัติ" พร้อมเลขใบรับรอง' },
      { id: 's2-badge', role: 'merchant', route: () => '/m/toolkit', title: 'Trust Badge', instruction: 'Badge ระดับ Business Verified พร้อม QR และลิงก์ตรวจสอบ — คัดลอกไปใช้บนช่องทางขายเดิมได้', tip: 'ไม่สร้าง Marketplace ใหม่ ร้านค้าขายบนช่องทางเดิมต่อได้' },
      { id: 's2-passport', role: 'merchant', route: () => '/m/passport', title: 'SME Trust Passport', instruction: 'Passport แสดงร้านใหม่ ระดับการตรวจสอบ ใบรับรอง และช่องทางขาย', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const m = merchant(c.merchantId);
      const a = app(c.applicationId);
      const cert = certOf(c.merchantId);
      return [
        m ? `สร้างร้าน "${m.shopName}" (${m.id}) ของ ${operator(m.operatorId)?.name}` : 'ยังไม่ได้สร้างร้านค้า',
        a ? `คำขอ ${a.id} สถานะ: ${REGISTRATION_STATUS[a.status].label}` : '',
        cert ? `ออกใบรับรองตัวอย่าง ${cert.id} ระดับ ${TRUST_LEVELS[cert.level].name}` : '',
        'บันทึก Timeline, Audit Log และแจ้งเตือนร้านค้า',
      ].filter(Boolean);
    },
  },

  // ------------------------------------------------------------ 3
  {
    id: 's3',
    no: 3,
    title: 'ผู้บริโภคตรวจสอบร้านค้าก่อนซื้อ',
    objective: 'ผู้บริโภคตรวจสอบร้านเดียวกับที่เพิ่งได้รับการรับรอง ผ่านการค้นหาและ QR จำลอง แล้วเห็นข้อมูลตรงกับ Badge ของร้าน',
    keyMessage: 'ผู้บริโภคตรวจสอบได้เองก่อนโอนเงิน ข้อมูลตรงกันทุกช่องทาง',
    audience: ['merchant', 'consumer'],
    duration: '≈ 4 นาที',
    benefits: {
      sme: 'ร้านที่โปร่งใสโดดเด่นกว่า และได้รับความไว้วางใจจากลูกค้าใหม่',
      consumer: 'รู้สถานะร้านก่อนโอนเงิน ลดความเสี่ยงจากร้านไม่น่าเชื่อถือ',
      ocpb: 'ป้องกันปัญหาก่อนเกิดเหตุ ลดเรื่องร้องเรียนปลายทาง',
    },
    nextCta: 'ดำเนินการต่อ: ทดลองแจ้งปัญหาจากการซื้อสินค้า',
    continuity: shopIssue,
    prepare: (j, carry) => {
      const m = (carry && certifiedShop(j.merchantId)) || merchant('M-001')!;
      return { merchantId: m.id, operatorId: m.operatorId, certId: certOf(m.id)?.id, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    steps: [
      { id: 's3-badge', role: 'merchant', route: () => '/m/toolkit', title: 'Trust Badge ของร้าน', instruction: (c) => `ร้าน "${shopName(c)}" แสดง Badge และ QR บนช่องทางขาย — ต่อไปดูว่าผู้บริโภคตรวจสอบได้อย่างไร`, nextLabel: 'ดำเนินการต่อในมุมผู้บริโภค' },
      { id: 's3-search', role: 'consumer', route: (c) => `/check?q=${encodeURIComponent(shopName(c))}`, transition: 'ร้านค้านำ Badge ไปแสดงแล้ว เปลี่ยนเป็นมุมผู้บริโภคที่กำลังจะซื้อสินค้าจากร้านเดียวกัน', title: 'ค้นหาร้านค้า', instruction: 'ผลค้นหาแสดงสถานะเดียวกับ Badge — ไม่ต้องเข้าสู่ระบบ' },
      {
        id: 's3-qr',
        role: 'consumer',
        route: () => '/verify',
        title: 'สแกน QR (จำลอง)',
        instruction: (c) => `เลือก QR ของร้าน "${shopName(c)}" — ระบบจำลองการสแกนโดยไม่เปิดกล้อง`,
        gate: { check: (g) => sig(g, 'verify.viewed') === g.ctx.certId, hint: 'เลือก QR ของร้านนี้เพื่อจำลองการสแกน' },
      },
      { id: 's3-cert', role: 'consumer', route: (c) => `/verify/${c.certId}`, title: 'รายละเอียดใบรับรอง', instruction: 'เลขอ้างอิง ระดับ วันหมดอายุ และสถานะปัจจุบัน — ตรงกับที่ร้านค้าเห็น', tip: 'ใบรับรองตัวอย่างในระบบสาธิต ไม่มีผลรับรองจริง' },
      { id: 's3-profile', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'โปรไฟล์ร้านและช่องทางขายที่ตรวจแล้ว', instruction: 'ช่องทางขายแต่ละช่องทางมีสถานะการตรวจสอบของตัวเอง' },
      {
        id: 's3-external',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        title: 'ตัวอย่างหน้าร้านบนแพลตฟอร์มเดิม',
        instruction: 'กด "เปิด" ที่ช่องทางขาย เพื่อดูตัวอย่าง (Mockup ภายในแอป ไม่เปิดเว็บจริง)',
        gate: { check: (g) => sig(g, 'channel.preview') === true, hint: 'กด "เปิด" ที่ช่องทางขายใดก็ได้' },
        nextLabel: 'จบ Scenario และดูสรุป',
      },
    ],
    summary: (c) => [`ผู้บริโภคตรวจสอบร้าน "${shopName(c)}" — ผล: ${verdictText(c.merchantId)}`, `ใบรับรองที่ตรวจ: ${c.certId}`, 'ไม่มีการเปลี่ยนข้อมูลธุรกิจ (เป็นการอ่านข้อมูลเท่านั้น)'],
  },

  // ------------------------------------------------------------ 4
  {
    id: 's4',
    no: 4,
    title: 'ผู้บริโภคร้องเรียนและร้านค้าช่วยแก้ไขก่อนส่งต่อ',
    objective: 'ผู้บริโภคแจ้งปัญหากับร้านเดียวกัน ร้านค้าเสนอทางแก้ไขเอง ผู้บริโภคยอมรับและยืนยันผล (หรือขอส่งต่อเจ้าหน้าที่)',
    keyMessage: 'เรื่องที่แก้ได้ระหว่างผู้บริโภคกับร้านค้า ไม่ต้องใช้เจ้าหน้าที่ — ลดภาระงานร้องเรียน',
    audience: ['consumer', 'merchant'],
    duration: '≈ 6 นาที',
    benefits: {
      sme: 'แก้ปัญหากับลูกค้าได้โดยตรงและรวดเร็ว รักษาชื่อเสียงร้าน',
      consumer: 'ได้รับการแก้ไขเร็วขึ้น ติดตามสถานะได้ และยังขอส่งต่อเจ้าหน้าที่ได้',
      ocpb: 'เรื่องที่ร้านแก้ไขเองได้ไม่ต้องเข้าสู่กระบวนการของเจ้าหน้าที่ ลดภาระงาน',
    },
    nextCta: 'ดำเนินการต่อ: ระบบตักเตือนและอบรม',
    continuity: shopIssue,
    prepare: (j, carry) => {
      const m = (carry && certifiedShop(j.merchantId)) || merchant('M-001')!;
      return { merchantId: m.id, operatorId: m.operatorId, consumerId: 'CS-003', officerId: 'OF-002' };
    },
    exports: (c) => ({ complaintId: c.complaintId }),
    steps: [
      { id: 's4-shop', role: 'consumer', route: (c) => `/shop/${c.merchantId}`, title: 'หน้าร้านค้า', instruction: (c) => `ผู้บริโภคซื้อสินค้าจาก "${shopName(c)}" แล้วพบปัญหา — กด "ถัดไป" เพื่อแจ้งปัญหา`, nextLabel: 'แจ้งปัญหา' },
      { id: 's4-wizard', role: 'consumer', route: (c) => `/report?merchant=${c.merchantId}`, title: 'แบบฟอร์มแจ้งปัญหา', instruction: 'กรอกประเภทปัญหา รายละเอียด วันที่ มูลค่า และหลักฐานจำลอง (หรือเปิด "เติมข้อมูลตัวอย่าง" → "กรณีปกติ")', tip: 'Screening Assistant คัดกรองด้วยกฎ ไม่ใช้ AI ภายนอก', gate: { check: (g) => num(g, 'report.step') >= 5, hint: 'กรอกจนถึงขั้น "ตรวจสอบข้อมูล"' } },
      {
        id: 's4-submit',
        role: 'consumer',
        route: (c) => `/report?merchant=${c.merchantId}`,
        title: 'ตรวจสอบและส่งเรื่อง',
        instruction: 'ตรวจผลคัดกรอง แล้วกด "ส่งเรื่อง (Submit)" — ได้ Case ID',
        gate: { check: (g) => !!latestComplaint(g), hint: 'กด "ส่งเรื่อง (Submit)"' },
        capture: (g) => ({ complaintId: latestComplaint(g)!.id }),
      },
      { id: 's4-track', role: 'consumer', route: (c) => `/consumer/cases/${c.complaintId}`, title: 'ติดตามสถานะ', instruction: (c) => `เรื่อง ${c.complaintId} สถานะ "รอร้านค้าตอบกลับ" — ระบบแจ้งร้านค้าแล้ว`, nextLabel: 'ดูการรับเรื่องของร้านค้า' },
      {
        id: 's4-respond',
        role: 'merchant',
        route: (c) => `/m/complaints/${c.complaintId}`,
        transition: 'ผู้บริโภคส่งเรื่องแล้ว ระบบแจ้งร้านค้าให้แก้ไขเบื้องต้นก่อนส่งต่อเจ้าหน้าที่ — เปิดเรื่องเดียวกันในมุมร้านค้า',
        title: 'ร้านค้าตอบกลับ',
        instruction: 'เลือก "เสนอคืนเงิน" หรือแนวทางอื่น แล้วกด "ส่งการตอบกลับ" ด้วยตนเอง',
        tip: 'Merchant First Resolution — ร้านแก้ไขกับลูกค้าโดยตรงก่อน',
        nextLabel: 'ดูในมุมผู้บริโภค',
        gate: { check: (g) => (complaint(g.ctx.complaintId)?.firstMerchantResponseAt ?? '') >= g.startedAt, hint: 'กด "ส่งการตอบกลับ"' },
      },
      {
        id: 's4-review',
        role: 'consumer',
        route: (c) => `/consumer/cases/${c.complaintId}`,
        transition: 'ร้านค้าส่งข้อเสนอแล้ว กลับไปมุมผู้บริโภคเพื่อพิจารณาข้อเสนอในเรื่องเดียวกัน',
        title: 'พิจารณาข้อเสนอ',
        instruction: 'กด "ยอมรับข้อเสนอ" — เส้นทางทางเลือก: "ขอส่งต่อเจ้าหน้าที่" หากไม่ยอมรับ',
        gate: { check: (g) => !!complaint(g.ctx.complaintId) && (complaint(g.ctx.complaintId)!.offers.some((o) => o.status === 'accepted') || complaint(g.ctx.complaintId)!.status === 'escalated'), hint: 'กด "ยอมรับข้อเสนอ" หรือ "ขอส่งต่อเจ้าหน้าที่"' },
      },
      {
        id: 's4-confirm',
        role: 'consumer',
        route: (c) => `/consumer/cases/${c.complaintId}`,
        title: 'ยืนยันผลการแก้ไข',
        instruction: 'กด "ได้รับการแก้ไขแล้ว (Consumer Confirm)" — (ถ้าเลือกส่งต่อ ขั้นนี้ผ่านอัตโนมัติ)',
        gate: { check: (g) => ['resolved', 'escalated'].includes(complaint(g.ctx.complaintId)?.status ?? ''), hint: 'กด "ได้รับการแก้ไขแล้ว"' },
      },
      { id: 's4-timeline', role: 'consumer', route: (c) => `/consumer/cases/${c.complaintId}`, title: 'Timeline ของเรื่อง', instruction: 'Timeline บันทึกทุกขั้นตอน ตั้งแต่ยื่นเรื่องจนปิดเรื่อง', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const x = complaint(c.complaintId);
      if (!x) return ['ยังไม่ได้สร้างเรื่องร้องเรียน'];
      return [
        `สร้างเรื่อง ${x.id} กับร้าน "${shopName(c)}"`,
        x.offers.length ? `ร้านค้าเสนอ ${x.offers.length} แนวทาง` : '',
        `สถานะล่าสุด: ${COMPLAINT_STATUS[x.status].label}${x.status === 'escalated' ? ' (เส้นทางทางเลือก — ส่งต่อเจ้าหน้าที่)' : ''}`,
        `Timeline ${x.timeline.length} เหตุการณ์ · KPI "ร้านค้าแก้ไขสำเร็จ" บน Dashboard อัปเดตตามสถานะจริง`,
      ].filter(Boolean);
    },
  },

  // ------------------------------------------------------------ 5
  {
    id: 's5',
    no: 5,
    title: 'ผู้ประกอบการได้รับคำเตือนและเข้ารับการอบรม',
    objective: 'เจ้าหน้าที่ออกคำเตือนเรื่องโฆษณาที่อาจทำให้เข้าใจผิด ร้านค้ารับทราบ อบรม ส่งหลักฐานแก้ไข และเจ้าหน้าที่ตรวจผลก่อนปิดรายการ',
    keyMessage: 'เน้นการแนะนำและพัฒนาก่อนมาตรการลงโทษ — มีหลักฐานและ Timeline ทุกขั้น',
    audience: ['officer', 'merchant'],
    duration: '≈ 7 นาที',
    caseNote: 'กรณีศึกษาแยก: ร้าน "สวยใสคอสเมติก" ซึ่งมีข้อร้องเรียนเรื่องโฆษณาเกินจริง (คนละเหตุการณ์กับร้านใน Scenario 1–4)',
    benefits: {
      sme: 'ได้รับคำแนะนำและโอกาสปรับปรุงก่อนถูกพิจารณามาตรการ พร้อมความรู้ที่ใช้ได้จริง',
      consumer: 'โฆษณาที่อาจทำให้เข้าใจผิดถูกแก้ไขอย่างรวดเร็ว',
      ocpb: 'ติดตามการแก้ไขเป็นระบบ มีหลักฐานและ Timeline ตรวจสอบย้อนหลังได้',
    },
    nextCta: 'ดำเนินการต่อ: การพิจารณาระงับและอุทธรณ์',
    prepare: (j) => {
      fixtureWarningCaseStudy();
      return { merchantId: 'M-003', operatorId: 'OP-003', officerId: 'OF-001', consumerId: j.consumerId ?? 'CS-001' };
    },
    steps: [
      { id: 's5-dash', role: 'officer', route: () => '/o', title: 'Officer Dashboard', instruction: 'ภาพรวมงานของเจ้าหน้าที่ — ต่อไปทบทวนข้อมูลร้าน "สวยใสคอสเมติก"' },
      { id: 's5-review', role: 'officer', route: () => '/o/complaints/CMP-2569-0004', title: 'ทบทวนข้อมูลร้านค้า', instruction: 'ข้อร้องเรียนเรื่องโฆษณา "รักษาฝ้าหายขาด" พร้อมผลคัดกรอง — ใช้ประกอบการออกคำเตือน', tip: 'คำแนะนำ (Advisory) ไม่ใช่การลงโทษ / คำเตือน (Warning) ต้องแก้ไขภายในกำหนด' },
      {
        id: 's5-issue',
        role: 'officer',
        route: () => '/o/warnings/new?merchant=M-003',
        title: 'ออกคำเตือน',
        instruction: 'กด "เติมตัวอย่าง" (หัวข้อ รายการแก้ไข และหลักสูตรอบรม) ตรวจข้อมูล แล้วกด "ออกคำเตือน"',
        gate: { check: (g) => !!latestWarning(g), hint: 'กด "ออกคำเตือน" เพื่อสร้างคำเตือนให้ร้านนี้' },
        capture: (g) => ({ warningId: latestWarning(g)!.id }),
        nextLabel: 'ดำเนินการต่อในมุมร้านค้า',
      },
      {
        id: 's5-ack',
        role: 'merchant',
        route: (c) => `/m/warnings/${c.warningId}`,
        transition: 'เจ้าหน้าที่ออกคำเตือนแล้ว ร้านค้าได้รับแจ้งและต้องรับทราบก่อนดำเนินการแก้ไข',
        title: 'รับทราบคำเตือน',
        instruction: (c) => `อ่านคำเตือน ${c.warningId} แล้วกด "กดรับทราบ"`,
        gate: { check: (g) => !!warning(g.ctx.warningId) && !['warning_issued', 'advisory'].includes(warning(g.ctx.warningId)!.status), hint: 'กด "กดรับทราบ" และยืนยัน' },
      },
      { id: 's5-recommend', role: 'merchant', route: (c) => `/m/warnings/${c.warningId}`, title: 'หลักสูตรที่แนะนำ', instruction: 'ดูรายการที่ต้องปรับปรุง และหลักสูตรอบรมที่เจ้าหน้าที่แนบไว้', nextLabel: 'ไปที่หลักสูตร' },
      {
        id: 's5-lessons',
        role: 'merchant',
        route: (c) => `/m/training/${courseOfWarning(c)}`,
        title: 'เรียนบทเรียน',
        instruction: 'กด "เริ่มเรียน/เรียนต่อ" และ "เรียนจบบทนี้" จนครบทุกบท',
        gate: {
          check: (g) => {
            const cid = courseOfWarning(g.ctx);
            const e = useTrainingStore.getState().items.find((x) => x.operatorId === g.ctx.operatorId && x.courseId === cid);
            return !!e && e.completedLessonIds.length >= (courses.find((c) => c.id === cid)?.lessons.length ?? 99);
          },
          hint: 'เรียนให้ครบทุกบท',
        },
      },
      {
        id: 's5-quiz',
        role: 'merchant',
        route: (c) => `/m/training/${courseOfWarning(c)}`,
        title: 'แบบทดสอบ',
        instruction: (c) => (courseOfWarning(c) === 'CRS-02' ? 'ตอบแบบทดสอบ (คำตอบที่ถูก: ข้อ 3, 2, 2, 2) — ระบบตรวจคะแนนตามเกณฑ์ 75%' : 'ตอบแบบทดสอบให้ผ่านเกณฑ์ 75%'),
        gate: { check: (g) => !!useTrainingStore.getState().items.find((x) => x.operatorId === g.ctx.operatorId && x.courseId === courseOfWarning(g.ctx) && x.passed), hint: 'ทำแบบทดสอบให้ผ่าน (ทำใหม่ได้หากไม่ผ่าน)' },
        nextLabel: 'ส่งหลักฐานการแก้ไข',
      },
      {
        id: 's5-correction',
        role: 'merchant',
        route: (c) => `/m/warnings/${c.warningId}`,
        title: 'ส่งหลักฐานการแก้ไข',
        instruction: 'รายการ "เข้าอบรม" ถูกติ๊กอัตโนมัติ → ติ๊กรายการที่เหลือ กรอกคำอธิบาย แนบหลักฐานจำลอง แล้วกด "ส่งกลับให้ตรวจ"',
        gate: {
          check: (g) => {
            const w = warning(g.ctx.warningId);
            return !!w && (['correction_submitted', 'under_review', 'completed'].includes(w.status) || (w.items.length === 0 && w.status === 'acknowledged'));
          },
          hint: 'กด "ส่งกลับให้ตรวจ"',
        },
        nextLabel: 'ดำเนินการต่อในมุมเจ้าหน้าที่',
      },
      {
        id: 's5-close',
        role: 'officer',
        route: (c) => `/o/warnings/${c.warningId}`,
        transition: 'ร้านค้าส่งผลการแก้ไขแล้ว เจ้าหน้าที่ตรวจผลก่อนปิดรายการเดียวกัน',
        title: 'ตรวจผลและปิดรายการ',
        instruction: 'กด "เริ่มตรวจผล" แล้ว "ตรวจผลผ่าน" (หรือ "ส่งกลับให้แก้ไข" พร้อมเหตุผล)',
        gate: { check: (g) => warning(g.ctx.warningId)?.status === 'completed', hint: 'ตรวจผลให้ผ่านเพื่อปิดรายการ' },
        nextLabel: 'จบ Scenario และดูสรุป',
      },
    ],
    summary: (c) => {
      const w = warning(c.warningId);
      const cid = courseOfWarning(c);
      const e = useTrainingStore.getState().items.find((x) => x.operatorId === c.operatorId && x.courseId === cid);
      return [
        w ? `เจ้าหน้าที่ออกคำเตือน ${w.id} "${w.title}" — สถานะ: ${WARNING_STATUS[w.status].label}` : 'ยังไม่ได้ออกคำเตือน',
        e?.passed ? `บันทึกการอบรม "${courses.find((x) => x.id === cid)?.title}" ผ่าน (${e.certificateNo}) ใน Training Record และ Passport` : '',
        `สถานะความเสี่ยงของร้าน: ${RISK_STATUS[merchant('M-003')!.riskStatus].label}`,
      ].filter(Boolean);
    },
  },

  // ------------------------------------------------------------ 6
  {
    id: 's6',
    no: 6,
    title: 'เจ้าหน้าที่พิจารณาระงับการรับรอง พร้อมกระบวนการชี้แจงและอุทธรณ์',
    objective: 'ข้อกล่าวหายังไม่ใช่ความผิด: เจ้าหน้าที่พิจารณาหลักฐาน ระงับพร้อมเหตุผล ร้านค้าชี้แจง/อุทธรณ์ และเจ้าหน้าที่พิจารณาอีกครั้ง',
    keyMessage: 'กระบวนการเป็นธรรม โปร่งใส ตรวจสอบย้อนหลังได้ และสถานะต่อสาธารณะอัปเดตทันที',
    audience: ['officer', 'merchant', 'consumer'],
    duration: '≈ 7 นาที',
    caseNote: 'กรณีศึกษาแยก: ร้าน "ไอทีแกดเจ็ตช็อป" มีข้อร้องเรียนไม่ได้รับสินค้าหลายเรื่อง — ไม่เกี่ยวกับคำเตือนหรือการอบรมใน Scenario 5',
    benefits: {
      sme: 'ได้รับสิทธิชี้แจงและอุทธรณ์อย่างเป็นธรรม ทุกการตัดสินใจมีเหตุผล',
      consumer: 'สถานะใบรับรองต่อสาธารณะอัปเดตทันทีเมื่อมีปัญหา',
      ocpb: 'กระบวนการโปร่งใส ตรวจสอบย้อนหลังได้ ลดข้อโต้แย้งภายหลัง',
    },
    nextCta: 'ดำเนินการต่อ: AI ตรวจสอบโฆษณาก่อนเผยแพร่',
    prepare: () => {
      fixtureBeforeSuspension();
      return { merchantId: 'M-004', operatorId: 'OP-004', riskCaseId: 'RSK-2569-0001', certId: certOf('M-004')?.id, officerId: 'OF-003', consumerId: 'CS-001' };
    },
    steps: [
      { id: 's6-risk', role: 'officer', route: (c) => `/o/risk/${c.riskCaseId}`, title: 'Risk Review', instruction: 'ลำดับขั้น: ข้อกล่าวหา → ตรวจสอบ → เตือน → ระงับ → เพิกถอน — เรื่องนี้อยู่ระหว่างตรวจสอบ', tip: 'ไม่ระงับหรือ Blacklist อัตโนมัติจากข้อร้องเรียนเพียงเรื่องเดียว' },
      { id: 's6-evidence', role: 'officer', route: (c) => `/o/risk/${c.riskCaseId}`, title: 'ตรวจหลักฐาน', instruction: 'หลักฐานสมมติ: ข้อร้องเรียน 4 เรื่อง คำเตือนที่ยังไม่แก้ไข และระยะเวลาตอบกลับ' },
      {
        id: 's6-suspend',
        role: 'officer',
        route: (c) => `/o/risk/${c.riskCaseId}`,
        title: 'บันทึกผลพิจารณาและระงับการรับรอง',
        instruction: 'กด "ระงับการรับรอง" และระบุเหตุผล (บังคับกรอก) — เจ้าหน้าที่ต้องยืนยันเอง',
        gate: { check: (g) => risk(g.ctx.riskCaseId)?.status === 'suspended', hint: 'กด "ระงับการรับรอง" และยืนยันพร้อมเหตุผล' },
        nextLabel: 'ดำเนินการต่อในมุมร้านค้า',
      },
      { id: 's6-notice', role: 'merchant', route: () => '/m/review', transition: 'เจ้าหน้าที่ระงับการรับรองแล้ว ร้านค้าได้รับแจ้งพร้อมเหตุผลและสิทธิ์ชี้แจง/อุทธรณ์', title: 'ประกาศการระงับ', instruction: 'ร้านค้าเห็นเหตุผลและหลักฐานโดยสรุป (ไม่เปิดเผยข้อมูลผู้ร้องเรียน)' },
      {
        id: 's6-appeal',
        role: 'merchant',
        route: () => '/m/review',
        title: 'ชี้แจงและยื่นอุทธรณ์',
        instruction: 'กรอกคำชี้แจง → "ส่งคำชี้แจง" แล้วกรอกเหตุผล → "ยื่นอุทธรณ์"',
        gate: { check: (g) => risk(g.ctx.riskCaseId)?.status === 'appeal_submitted', hint: 'กด "ยื่นอุทธรณ์"' },
        nextLabel: 'ดำเนินการต่อในมุมเจ้าหน้าที่',
      },
      {
        id: 's6-decide',
        role: 'officer',
        route: (c) => `/o/risk/${c.riskCaseId}`,
        transition: 'ร้านค้ายื่นอุทธรณ์แล้ว เจ้าหน้าที่พิจารณาเรื่องเดิมอีกครั้ง',
        title: 'พิจารณาอุทธรณ์',
        instruction: 'เลือก "รับอุทธรณ์ (คืนสถานะ)" หรือ "ยกอุทธรณ์ (คงผล)" พร้อมเหตุผล — รองรับทั้งสองผล',
        gate: { check: (g) => risk(g.ctx.riskCaseId)?.status === 'appeal_reviewed', hint: 'บันทึกผลการพิจารณาอุทธรณ์' },
        nextLabel: 'ดูสถานะในมุมผู้บริโภค',
      },
      { id: 's6-public', role: 'consumer', route: (c) => `/verify/${c.certId}`, transition: 'ผลพิจารณาถูกบันทึกแล้ว ดูสถานะใบรับรองที่ผู้บริโภคเห็นในขณะนี้', title: 'สถานะต่อสาธารณะ', instruction: 'รับอุทธรณ์ → "ผ่านเกณฑ์ธุรกิจ" · ยกอุทธรณ์ → "ถูกระงับการรับรอง"', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const r = risk(c.riskCaseId);
      return [
        `เรื่องพิจารณา ${c.riskCaseId}: ${r ? RISK_STATUS[r.status].label : '-'}`,
        r?.appeal?.result ? `ผลอุทธรณ์: ${r.appeal.result === 'overturned' ? 'รับอุทธรณ์ — คืนสถานะการรับรอง' : 'ยกอุทธรณ์ — คงผลเดิม'}` : 'ยังไม่มีผลอุทธรณ์',
        `สถานะที่ผู้บริโภคเห็น (${c.certId}): ${verdictText(c.merchantId)}`,
        'ไม่กระทบข้อมูลของร้านอื่น',
      ];
    },
  },

  // ------------------------------------------------------------ 7
  {
    id: 's7',
    no: 7,
    title: 'AI ตรวจสอบโฆษณาก่อนเผยแพร่',
    objective: 'ผู้ประกอบการตรวจข้อความโฆษณาด้วย AI Simulation เห็นจุดเสี่ยง ปรับตามข้อเสนอ และเปรียบเทียบผลก่อน–หลัง',
    keyMessage: 'ช่วยผู้ประกอบการตรวจสอบและปรับปรุงข้อความก่อนเผยแพร่ เพื่อลดโอกาสเกิดปัญหาโฆษณาที่อาจทำให้ผู้บริโภคเข้าใจผิด',
    audience: ['merchant'],
    duration: '≈ 4 นาที',
    benefits: {
      sme: 'รู้จุดเสี่ยงก่อนโพสต์ ปรับข้อความได้เองทันที',
      consumer: 'ได้รับข้อมูลโฆษณาที่ระมัดระวังและครบถ้วนขึ้น',
      ocpb: 'ป้องกันปัญหาโฆษณาเกินจริงตั้งแต่ต้นทาง ลดเรื่องร้องเรียนปลายทาง',
    },
    nextCta: 'ดำเนินการต่อ: AI ช่วยร้านค้าแก้ไขข้อร้องเรียน',
    continuity: operatorIssue,
    prepare: (j, carry) => {
      fixtureAdChecker();
      const op = carry && !operatorIssue(j) ? j.operatorId! : 'OP-001';
      const shop = useMerchantStore.getState().items.find((m) => m.operatorId === op);
      return { operatorId: op, merchantId: shop?.id, consumerId: 'CS-001', officerId: 'OF-001' };
    },
    steps: [
      { id: 's7-home', role: 'merchant', route: () => '/m', title: 'Merchant Home', instruction: 'ส่วน "AI ผู้ช่วย SME" อยู่ใต้เมนูบริการ — กด "ถัดไป" เพื่อเปิด' },
      { id: 's7-ai', role: 'merchant', route: () => '/m/ai', title: 'AI ผู้ช่วย SME', instruction: 'มี 2 บริการ: ตรวจสอบข้อความโฆษณา และช่วยจัดการข้อร้องเรียน — ทุกหน้าระบุว่าเป็น AI Simulation', nextLabel: 'เปิดตรวจสอบโฆษณา' },
      { id: 's7-input', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'เลือกตัวอย่างหรือพิมพ์ข้อความ', instruction: 'เลือกตัวอย่าง เช่น "อาหารเสริมอ้างรักษาโรค" หรือพิมพ์ข้อความเอง', gate: { check: () => validateAdInput(useAiWorkspaceStore.getState().ad.text) === null, hint: 'เลือกตัวอย่างหรือพิมพ์ข้อความอย่างน้อย 10 ตัวอักษร' } },
      { id: 's7-analyze', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'วิเคราะห์ข้อความ', instruction: 'กด "วิเคราะห์ข้อความโฆษณา"', tip: 'ประมวลผลด้วยกฎในเบราว์เซอร์ ไม่ส่งข้อความออกนอกเครื่อง', gate: { check: () => !!useAiWorkspaceStore.getState().ad.before, hint: 'กด "วิเคราะห์ข้อความโฆษณา"' } },
      { id: 's7-highlight', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'Highlight และระดับความเสี่ยงเบื้องต้น', instruction: 'ชี้ระดับ Low/Medium/High และคำที่ถูก Highlight ในข้อความ', tip: 'ระดับความเสี่ยงเป็นผลจากกฎจำลอง ไม่ใช่การรับรองความถูกต้องตามกฎหมาย' },
      { id: 's7-findings', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'ประเด็นและคำแนะนำ', instruction: 'แต่ละประเด็นมีข้อความที่พบ คำอธิบาย เหตุผล และคำแนะนำ' },
      { id: 's7-edit', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'แก้ข้อความตามข้อเสนอ', instruction: 'แก้ไขในช่อง "ข้อความฉบับเสนอแก้ไข" — ข้อความใน [ ] คือข้อมูลที่ร้านต้องกรอกเองตามจริง', gate: { check: () => !!useAiWorkspaceStore.getState().ad.revisionDraft?.trim(), hint: 'แก้ไขหรือเขียนข้อความฉบับปรับปรุงในช่องด้านล่าง' } },
      { id: 's7-reanalyze', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'วิเคราะห์ใหม่', instruction: 'กด "วิเคราะห์ใหม่เพื่อเปรียบเทียบ"', gate: { check: () => !!useAiWorkspaceStore.getState().ad.after, hint: 'กด "วิเคราะห์ใหม่เพื่อเปรียบเทียบ"' } },
      { id: 's7-compare', role: 'merchant', route: () => '/m/ai/ad-checker', title: 'เปรียบเทียบก่อน–หลัง', instruction: 'ประเด็นที่ไม่พบแล้ว และประเด็นที่ยังควรตรวจสอบ', tip: 'AI Simulation ไม่ได้อนุมัติโฆษณา ผู้ประกอบการต้องตรวจสอบข้อเท็จจริงก่อนเผยแพร่', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: () => {
      const { before, after } = useAiWorkspaceStore.getState().ad;
      const lvl = (l?: string) => (l ? AD_LEVEL_LABEL[l as 'low'].label.split(' — ')[0] : '-');
      return [
        before ? `วิเคราะห์ข้อความต้นฉบับ: ${lvl(before.level)} (${before.findings.length} ประเด็น)` : 'ยังไม่ได้วิเคราะห์',
        after ? `วิเคราะห์ฉบับปรับปรุง: ${lvl(after.level)} (${after.findings.length} ประเด็น)` : '',
        'บันทึกในประวัติ AI (เฉพาะชื่อตัวอย่าง ไม่บันทึกข้อความที่พิมพ์เอง)',
        'ไม่มีการส่งข้อมูลออกนอกเบราว์เซอร์ และไม่มีการอนุมัติโฆษณา',
      ].filter(Boolean);
    },
  },

  // ------------------------------------------------------------ 8
  {
    id: 's8',
    no: 8,
    title: 'AI ช่วยร้านค้าแก้ไขข้อร้องเรียน',
    objective: 'ร้านค้าใช้ AI Simulation วิเคราะห์เคสจริงใน Mock Store สร้างร่างคำตอบ แล้วตรวจสอบและส่งเองผ่าน Workflow เดิม',
    keyMessage: 'ช่วยให้ผู้ประกอบการเข้าใจปัญหาและเตรียมคำตอบได้รวดเร็วขึ้น เพิ่มโอกาสแก้ไขข้อพิพาทเบื้องต้นก่อนต้องส่งต่อเจ้าหน้าที่',
    audience: ['merchant', 'consumer'],
    duration: '≈ 6 นาที',
    caseNote: 'ใช้เคสที่มีอยู่ในระบบ CMP-2569-0005 ของร้าน "สวยใสคอสเมติก" (ลูกค้าได้รับลิปคนละเฉดสี)',
    benefits: {
      sme: 'เข้าใจปัญหาเร็ว รู้ข้อมูลที่ต้องขอเพิ่ม และมีร่างคำตอบที่สุภาพพร้อมแก้ไข',
      consumer: 'ได้รับคำตอบเร็วขึ้น และเรื่องได้รับการแก้ไขก่อนต้องร้องเรียนต่อ',
      ocpb: 'เพิ่มสัดส่วนเรื่องที่จบที่ร้านค้า ลดเรื่องที่ต้องส่งต่อเจ้าหน้าที่',
    },
    prepare: () => {
      fixtureComplaintCase('CMP-2569-0005');
      return { merchantId: 'M-003', operatorId: 'OP-003', complaintId: 'CMP-2569-0005', consumerId: 'CS-007', officerId: 'OF-002' };
    },
    steps: [
      { id: 's8-center', role: 'merchant', route: () => '/m/complaints', title: 'Complaint Center', instruction: 'แท็บ "ต้องดำเนินการ" มีเคสที่รอร้านค้าตอบ' },
      { id: 's8-case', role: 'merchant', route: (c) => `/m/complaints/${c.complaintId}`, title: 'เลือกเคส', instruction: (c) => `เคส ${c.complaintId} — กด "ให้ AI ช่วยวิเคราะห์" (หรือ "ถัดไป")`, nextLabel: 'ให้ AI ช่วยวิเคราะห์' },
      {
        id: 's8-analyze',
        role: 'merchant',
        route: (c) => `/m/ai/complaint?case=${c.complaintId}`,
        title: 'วิเคราะห์ข้อร้องเรียน',
        instruction: 'ระบบเติมรายละเอียดจากเคสและวิเคราะห์ให้ทันที (รอประมาณ 1 วินาที)',
        gate: { check: (g) => { const w = useAiWorkspaceStore.getState().complaint; return w.caseId === g.ctx.complaintId && !!w.analysis; }, hint: 'รอผลวิเคราะห์ หรือเลือกเคสในรายการ' },
      },
      { id: 's8-issues', role: 'merchant', route: (c) => `/m/ai/complaint?case=${c.complaintId}`, title: 'สรุปประเด็นและข้อมูลที่ควรตรวจสอบ', instruction: 'ประเภท ระดับการติดตามเบื้องต้น ประเด็นสำคัญ และข้อมูลที่ควรขอเพิ่ม — สรุปจากข้อมูลในเคสเท่านั้น' },
      { id: 's8-resolution', role: 'merchant', route: (c) => `/m/ai/complaint?case=${c.complaintId}`, title: 'แนวทางแก้ไขเบื้องต้น', instruction: 'คำแนะนำตามประเภทเคส ไม่ตัดสินว่าฝ่ายใดผิดก่อนตรวจสอบข้อเท็จจริง' },
      { id: 's8-tone', role: 'merchant', route: (c) => `/m/ai/complaint?case=${c.complaintId}`, title: 'ร่างคำตอบและเลือก Tone', instruction: 'ลองเปลี่ยน Tone: สุภาพ / เป็นมิตร / กระชับ และกด "สร้างสำนวนใหม่"', gate: { check: () => !!useAiWorkspaceStore.getState().complaint.draft, hint: 'รอให้ระบบสร้างร่างคำตอบ' } },
      { id: 's8-edit', role: 'merchant', route: (c) => `/m/ai/complaint?case=${c.complaintId}`, title: 'แก้ไขร่าง', instruction: 'แก้ข้อความได้อิสระ — ร่างไม่ยืนยันว่าร้านคืนเงินหรือส่งสินค้าแล้ว' },
      {
        id: 's8-insert',
        role: 'merchant',
        // ถ้ากดนำร่างไปใส่ตั้งแต่ขั้นก่อนแล้ว ให้อยู่ที่หน้าเคส ไม่พากลับไปหน้า AI
        route: (c) => (useAiWorkspaceStore.getState().replyDrafts[c.complaintId!] ? `/m/complaints/${c.complaintId}` : `/m/ai/complaint?case=${c.complaintId}`),
        title: 'นำร่างไปใส่ช่องตอบกลับ',
        instruction: 'กด "นำร่างไปใส่ช่องตอบกลับเคส" — ระบบเปิดหน้าเคสพร้อมร่าง แต่ยังไม่ส่ง',
        gate: { check: (g) => !!useAiWorkspaceStore.getState().replyDrafts[g.ctx.complaintId!] || (complaint(g.ctx.complaintId)?.firstMerchantResponseAt ?? '') >= g.startedAt, hint: 'กด "นำร่างไปใส่ช่องตอบกลับเคส"' },
      },
      {
        id: 's8-submit',
        role: 'merchant',
        route: (c) => `/m/complaints/${c.complaintId}`,
        title: 'ร้านค้าตรวจสอบและกดส่งเอง',
        instruction: 'ตรวจข้อความ เลือกรูปแบบการตอบกลับ แล้วกด "ส่งการตอบกลับ" — AI ไม่ส่งแทน',
        gate: { check: (g) => complaint(g.ctx.complaintId)?.messages.some((m) => m.from === 'merchant' && m.at >= g.startedAt) ?? false, hint: 'กด "ส่งการตอบกลับ"' },
        nextLabel: 'ดูในมุมผู้บริโภค',
      },
      { id: 's8-consumer', role: 'consumer', route: (c) => `/consumer/cases/${c.complaintId}`, transition: 'ร้านค้าส่งคำตอบแล้ว ดูเรื่องเดียวกันในมุมผู้บริโภค', title: 'ผู้บริโภคเห็นคำตอบ', instruction: 'คำตอบที่ร้านส่งปรากฏในการสนทนาและ Timeline' },
      { id: 's8-follow', role: 'consumer', route: (c) => `/consumer/cases/${c.complaintId}`, title: 'ติดตามเคส', instruction: 'ผู้บริโภคตอบกลับ ยอมรับข้อเสนอ หรือขอส่งต่อเจ้าหน้าที่ได้ตาม Workflow เดิม', nextLabel: 'จบ Scenario และดูสรุป' },
    ],
    summary: (c) => {
      const x = complaint(c.complaintId);
      const sent = x?.messages.filter((m) => m.from === 'merchant').length ?? 0;
      return [
        `วิเคราะห์เคส ${c.complaintId} ด้วย AI Simulation (Rule-based)`,
        sent ? `ร้านค้าส่งคำตอบผ่าน Workflow เดิม — สถานะ: ${x ? COMPLAINT_STATUS[x.status].label : '-'}` : 'ยังไม่ได้ส่งคำตอบ',
        'AI ไม่ส่งข้อความแทนร้านค้า และไม่สร้างข้อเท็จจริงเพิ่ม',
      ];
    },
  },
];

// ---------- ตัวค้นหารายการที่ถูกสร้างระหว่างสาธิต ----------
function latestApp(g: GateInput) {
  const shops = useMerchantStore.getState().items.filter((m) => m.operatorId === g.ctx.operatorId).map((m) => m.id);
  return useVerificationStore
    .getState()
    .items.filter((a) => shops.includes(a.merchantId) && a.type === 'registration' && a.submittedAt >= g.startedAt)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
}
function latestComplaint(g: GateInput) {
  return useComplaintStore
    .getState()
    .items.filter((c) => c.merchantId === g.ctx.merchantId && c.consumerId === g.ctx.consumerId && c.createdAt >= g.startedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
function latestWarning(g: GateInput) {
  return useWarningStore
    .getState()
    .items.filter((w) => w.merchantId === g.ctx.merchantId && w.createdAt >= g.startedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export { v2Scenarios };
/** ทุก Scenario — v1 (1–8) ตามด้วย v2 (9–13 และเส้นทางทางเลือก) */
export const allScenarios: ScenarioDef[] = [...scenarios, ...v2Scenarios];
export const findScenario = (id?: string) => allScenarios.find((s) => s.id === id);
export const trackOf = (sc?: ScenarioDef): Track => sc?.track ?? 'v1';
/** Scenario ทั้งหมดของชุด (รวมเส้นทางทางเลือก) */
export const trackScenarios = (t: Track) => allScenarios.filter((s) => trackOf(s) === t);
/** ลำดับของ Full Journey (ไม่รวมเส้นทางทางเลือก) */
export const journeyScenarios = (t: Track) => trackScenarios(t).filter((s) => !s.branch);
/** รหัสที่แสดง เช่น "3", "9B" */
export const scenarioCode = (sc: ScenarioDef) => sc.code ?? String(sc.no);
export const TRACK_INFO: Record<Track, { name: string; tagline: string; desc: string }> = {
  v1: { name: 'SME Trust v1 — Consumer Protection', tagline: 'Scenario 1–8', desc: 'ยืนยันตัวตน รับรองร้านค้า ร้องเรียน คำเตือน การระงับ/อุทธรณ์ และ AI Simulation ช่วยผู้ประกอบการ' },
  v2: { name: 'SME Trust v2 — Marketplace Intelligence', tagline: 'Scenario 9–13', desc: 'เน้นการเชื่อมข้อมูลจากแพลตฟอร์มขายเดิม (จำลอง) และประเมินความน่าเชื่อถือจากหลายปัจจัยอย่างอธิบายได้ — เจ้าหน้าที่ยังเป็นผู้ตัดสินการรับรอง' },
};
export const stepInstruction = (ins: string | ((c: DemoCtx) => string), ctx: DemoCtx) => (typeof ins === 'function' ? ins(ctx) : ins);

/** บัญชีสาธิตสำหรับ Role Switcher */
export const demoMerchantAccounts = [
  { operatorId: 'OP-001', label: 'Merchant A — Approved (Trusted SME)' },
  { operatorId: 'OP-002', label: 'Merchant B — Pending' },
  { operatorId: 'OP-003', label: 'Merchant C — Warning' },
  { operatorId: 'OP-004', label: 'Merchant D — Suspended' },
  { operatorId: 'OP-012', label: 'ผู้ประกอบการใหม่ — ยืนยันตัวตนแล้ว ยังไม่มีร้าน' },
  { operatorId: 'OP-013', label: 'ผู้ประกอบการใหม่ — มีร้านบน Marketplace (จำลอง) ยังไม่มีร้านใน SME Trust' },
  { operatorId: 'OP-005', label: 'ร้านกาแฟดอยสูง — Trusted SME' },
  { operatorId: 'OP-007', label: 'ของเล่นไม้ลูกรัก — ใบรับรองหมดอายุ' },
  { operatorId: 'OP-008', label: 'เฮลท์ตี้ซัพพลีเมนต์ — ถูกเพิกถอน และเปิดร้านใหม่' },
  { operatorId: 'OP-009', label: 'ผ้าไหมบุรีรัมย์ — อยู่ระหว่างตรวจสอบ' },
  { operatorId: 'OP-010', label: 'สมุนไพรบ้านนา — ขอข้อมูลเพิ่ม' },
  { operatorId: 'OP-011', label: 'เครื่องหนังภูเก็ต — ยังไม่ยืนยันตัวตน' },
];
