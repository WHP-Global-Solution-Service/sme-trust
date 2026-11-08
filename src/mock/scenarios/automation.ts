/**
 * Automation First — Demo
 * Scenario 14: เส้นทางปกติ (ไม่ต้องใช้เจ้าหน้าที่) — Marketplace App → SME Trust → Auto-Fill → ประเมินอัตโนมัติ → Assessment Badge → ผู้บริโภคตรวจสอบ
 * Scenario 15: กรณียกเว้น — เชื่อม Marketplace → ข้อมูลตัวตนขัดแย้ง → Manual Review Queue → เจ้าหน้าที่ตัดสิน → สถานะที่อัปเดต
 */
import type { DemoCtx } from '@/stores/demo';
import type { GateInput, ScenarioDef, ScenarioOutcome } from '@/demo/types';
import { useAssessmentBadgeStore, useCertificationStore, useImportRecordStore, useMarketplaceStore, useMerchantStore, useOfficerTaskStore } from '@/stores';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { BADGE_STATUS, ROUTE_LABEL, TASK_STATUS } from '@/features/automation/labels';
import { BAND_LABEL } from '@/features/trust-assessment/labels';
import { CERT_STATUS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { fixtureV2Clean, V2_MERCHANT, V2_OPERATOR } from './v2';

const base = { consumerId: 'CS-001', officerId: 'OF-001' };
const merchant = (id?: string) => useMerchantStore.getState().items.find((m) => m.id === id);
const badgeOf = (id?: string) => useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === id);
const taskOf = (id?: string) => useOfficerTaskStore.getState().items.find((t) => t.id === id);
const certLine = (merchantId?: string) => {
  const c = merchantId ? currentCert(useCertificationStore.getState().items, merchantId) : undefined;
  return c ? `ใบรับรอง ${c.id} Level ${c.level} (${CERT_STATUS[c.status].label}) — ระบบอัตโนมัติไม่เปลี่ยน` : 'ยังไม่มีใบรับรอง';
};
const newConnection = (g: GateInput) =>
  useMarketplaceStore
    .getState()
    .items.filter((c) => c.merchantId === g.ctx.merchantId && c.createdAt >= g.startedAt && c.status !== 'disconnected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
const newImport = (g: GateInput) => useImportRecordStore.getState().items.find((r) => r.merchantId === g.ctx.merchantId && r.createdAt >= g.startedAt);
const processedSince = (g: GateInput) => {
  const b = badgeOf(g.ctx.merchantId);
  return b && b.checkedAt >= g.startedAt ? b : undefined;
};
const tasksSince = (merchantId: string | undefined, since: string) => useOfficerTaskStore.getState().items.filter((t) => t.merchantId === merchantId && t.createdAt >= since);
const sig = (g: GateInput, k: string) => g.signals[k];

function badgeLine(c: DemoCtx) {
  const b = badgeOf(c.merchantId);
  return b ? `Assessment Badge: ${BADGE_STATUS[b.status].label} · ${BAND_LABEL[b.band].label} · ${ROUTE_LABEL[b.route].short}` : 'ยังไม่มี Assessment Badge';
}

function normalOutcome(c: DemoCtx): ScenarioOutcome | undefined {
  const b = badgeOf(c.merchantId);
  if (!b) return undefined;
  const open = useOfficerTaskStore.getState().items.filter((t) => t.merchantId === c.merchantId && (t.status === 'open' || t.status === 'info_requested')).length;
  const facts = [badgeLine(c), `งานที่ส่งเจ้าหน้าที่จากร้านนี้: ${open} งาน`, certLine(c.merchantId)];
  if (b.status === 'active') return { kind: 'approved', tone: 'success', title: 'ระบบออก Assessment Badge อัตโนมัติ — ไม่ต้องใช้เจ้าหน้าที่', facts, consumerView: `ผู้บริโภคเห็น Trust Assessment Badge (Band ${b.band}) พร้อมคำอธิบายว่าเป็นผลประเมิน ไม่ใช่การรับรอง`, next: 'ดู Scenario 15 เพื่อเปรียบเทียบกับกรณีที่ระบบส่งให้เจ้าหน้าที่' };
  if (b.route === 'MANUAL_REVIEW') return { kind: 'pending', tone: 'warning', title: 'ข้อมูลที่เลือกเข้าเกณฑ์ส่งเจ้าหน้าที่', facts, consumerView: BADGE_STATUS[b.status].consumer, next: 'เล่นใหม่และเลือก "ร้านที่ขายมานาน ผลงานดี" เพื่อดูเส้นทางปกติ หรือดู Scenario 15' };
  return { kind: 'insufficient', tone: 'info', title: 'ร้านค้าต้องเพิ่มข้อมูลเอง (AUTO_REQUEST_INFO)', facts, consumerView: BADGE_STATUS[b.status].consumer, next: 'ร้านค้าทำตามรายการที่ระบบแนะนำได้เองโดยไม่ต้องรอเจ้าหน้าที่' };
}

function exceptionOutcome(c: DemoCtx): ScenarioOutcome | undefined {
  const t = taskOf(c.taskId);
  if (!t) return undefined;
  const facts = [`งาน ${t.id}: ${TASK_STATUS[t.status].label}${t.resolution ? ` — ${t.resolution.note}` : ''}`, badgeLine(c), certLine(c.merchantId)];
  const b = badgeOf(c.merchantId);
  const consumerView = b ? BADGE_STATUS[b.status].consumer : '-';
  if (t.status === 'approved') return { kind: 'approved', tone: 'success', title: 'เจ้าหน้าที่ยืนยันข้อมูลตัวตน — ระบบประเมินและออก Badge ต่อเอง', facts, consumerView, next: 'เจ้าหน้าที่ใช้เวลาเฉพาะประเด็นที่ระบบตัดสินเองไม่ได้ หลังจากนั้นระบบทำงานต่ออัตโนมัติ' };
  if (t.status === 'rejected') return { kind: 'rejected', tone: 'error', title: 'ไม่ใช่ร้านของผู้ประกอบการ — ข้อมูลไม่ถูกใช้ประเมิน', facts, consumerView, next: 'ร้านเชื่อมต่อร้านที่เป็นของตนเองแล้วระบบประเมินใหม่อัตโนมัติ · ใบรับรองไม่เปลี่ยนเพราะเป็นอำนาจแยกต่างหาก' };
  if (t.status === 'info_requested') return { kind: 'need_info', tone: 'warning', title: 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม', facts, consumerView, next: 'ร้านส่งคำชี้แจงที่หน้า "ผลประเมินความน่าเชื่อถือ" แล้วงานเดิมกลับเข้าคิว (ไม่สร้างงานใหม่)' };
  return { kind: 'pending', tone: 'info', title: 'รอเจ้าหน้าที่พิจารณา', facts, consumerView, next: 'เปิดงานใน Exception Queue แล้วบันทึกผล' };
}

const prepare = (): DemoCtx => {
  fixtureV2Clean();
  return { ...base, merchantId: V2_MERCHANT, operatorId: V2_OPERATOR };
};

export const automationScenarios: ScenarioDef[] = [
  // ------------------------------------------------------------ 14
  {
    id: 's14',
    no: 14,
    track: 'v2',
    branch: true,
    title: 'Automation First — เส้นทางปกติที่ไม่ต้องใช้เจ้าหน้าที่',
    objective: 'ผู้ขายเริ่มจากแอป Marketplace (จำลอง) เชื่อมข้อมูลกับ SME Trust ใช้ Auto-Fill แล้วระบบประเมินความน่าเชื่อถือ จัดเส้นทาง และออก Trust Assessment Badge ให้อัตโนมัติ จนผู้บริโภคตรวจสอบได้ — โดยไม่มีขั้นตอนของเจ้าหน้าที่',
    keyMessage: 'Automation First, Human by Exception — งานปกติจบได้เองทั้งเส้นทาง เจ้าหน้าที่รับเฉพาะกรณีที่ระบบตัดสินเองอย่างปลอดภัยไม่ได้',
    audience: ['merchant', 'consumer'],
    duration: '≈ 4 นาที',
    caseNote: 'ใช้ร้านกาแฟดอยสูง (M-005) ซึ่งมีใบรับรอง Level 3 อยู่แล้ว — เพื่อแสดงว่า Assessment Badge (อัตโนมัติ) แยกจากใบรับรอง (เจ้าหน้าที่อนุมัติ) และระบบอัตโนมัติไม่เปลี่ยนใบรับรอง',
    benefits: {
      sme: 'ไม่ต้องกรอกซ้ำ ไม่ต้องรอคิวเจ้าหน้าที่ ได้ผลประเมินและ Badge ทันทีหลังนำเข้าข้อมูล',
      consumer: 'เห็น Badge ที่อัปเดตตามข้อมูลล่าสุด พร้อมคำอธิบายว่าไม่ใช่การรับรอง',
      ocpb: 'ลดงานตรวจซ้ำในกรณีปกติ เจ้าหน้าที่มุ่งเน้นกรณีที่จำเป็น',
    },
    nextCta: 'ดำเนินการต่อ: กรณีที่ต้องใช้เจ้าหน้าที่ (Scenario 15)',
    prepare,
    steps: [
      {
        id: 's14-app',
        role: 'merchant',
        route: () => '/m/marketplace-app',
        title: 'Marketplace App Simulation',
        instruction: 'หน้าจอผู้ขายบนแอป Marketplace (จำลอง) — กด "เชื่อมกับ SME Trust"',
        tip: 'หน้าจอจำลองทั้งหมด ไม่ใช่แอปหรือโลโก้ของแพลตฟอร์มจริง',
        gate: { check: (g) => sig(g, 'mktapp.connect') === true, hint: 'กด "เชื่อมกับ SME Trust"' },
      },
      {
        id: 's14-connect',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'SME Trust — อนุญาตและเลือกร้าน',
        instruction: 'กดเชื่อมต่อ Shopee หรือ Lazada (จำลอง) → ติ๊กยินยอม → เลือก "ร้านที่ขายมานาน ผลงานดี" → ดูตัวอย่าง → "ยืนยันนำเข้าข้อมูล"',
        gate: { check: (g) => !!newConnection(g)?.consentAt, hint: 'ยืนยันนำเข้าข้อมูลในหน้าต่างเชื่อมต่อ' },
      },
      {
        id: 's14-auto',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'นำเข้าแล้ว — ระบบประเมินอัตโนมัติ',
        instruction: 'เมื่อซิงก์สำเร็จ ระบบประเมินด้วย Trust Assessment Engine v2.1 ทันที แล้วจัดเส้นทางด้วย Decision Router — ร้านไม่ต้องกดประเมินหรือส่งพิจารณา',
        gate: { check: (g) => !!processedSince(g), hint: 'รอให้ซิงก์สำเร็จ (ถ้าล้มเหลว กด "ลองซิงก์ใหม่")' },
        capture: (g) => ({ connectionId: newConnection(g)?.id }),
      },
      {
        id: 's14-autofill',
        role: 'merchant',
        route: (c) => `/m/marketplace/profile/${c.connectionId}`,
        title: 'Marketplace Auto-Fill',
        instruction: 'ระบบเติมโปรไฟล์ร้านจากข้อมูลที่นำเข้า — ตรวจแล้วติ๊กยืนยันและกด "ยืนยันการอัปเดตข้อมูลร้าน" (ไม่ต้องเปลี่ยนชื่อร้าน/หมวด)',
        tip: 'ข้อมูลทั่วไปบันทึกอัตโนมัติ · ชื่อร้าน/หมวดที่ไม่ตรงกับแหล่งอ้างอิงเท่านั้นที่ส่งเจ้าหน้าที่',
        gate: { check: (g) => !!newImport(g), hint: 'ติ๊กยืนยันแล้วกด "ยืนยันการอัปเดตข้อมูลร้าน"' },
      },
      {
        id: 's14-route',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'Automatic Trust Assessment',
        instruction: (c) => {
          const b = badgeOf(c.merchantId);
          return b ? `ผลการจัดเส้นทาง: ${b.route} — ${ROUTE_LABEL[b.route].desc}` : 'ผลการประมวลผลอัตโนมัติแสดงที่ส่วนบนของหน้า';
        },
      },
      {
        id: 's14-badge',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'Automatic Assessment Badge',
        instruction: (c) => `${badgeLine(c)} — Badge นี้เป็นผลประเมินอัตโนมัติ แยกจากใบรับรอง Level 3 ที่ได้รับจากเจ้าหน้าที่`,
        nextLabel: 'ดูในมุมผู้บริโภค',
      },
      {
        id: 's14-consumer',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        transition: 'ผู้บริโภคตรวจสอบร้านได้ทันที — เส้นทางนี้ไม่มีขั้นตอนของเจ้าหน้าที่',
        title: 'Consumer Verification',
        instruction: 'ผู้บริโภคเห็น Trust Assessment Badge, Band, Coverage และ Confidence — ไม่เห็นคะแนนภายใน และเห็นสถานะใบรับรองแยกกัน',
      },
    ],
    summary: (c) => [badgeLine(c), `เส้นทางนี้ใช้บทบาท: ผู้ประกอบการ → ผู้บริโภค (ไม่มีเจ้าหน้าที่)`, `งานที่ส่งเจ้าหน้าที่จากร้านนี้ (ค้างอยู่): ${useOfficerTaskStore.getState().items.filter((t) => t.merchantId === c.merchantId && (t.status === 'open' || t.status === 'info_requested')).length} งาน`, certLine(c.merchantId)],
    outcome: normalOutcome,
  },

  // ------------------------------------------------------------ 15
  {
    id: 's15',
    no: 15,
    track: 'v2',
    branch: true,
    title: 'Automation First — กรณียกเว้นที่ต้องใช้เจ้าหน้าที่',
    objective: 'ร้านเชื่อมบัญชี Marketplace ที่ชื่อเจ้าของไม่ตรงกับผู้ยืนยันตัวตน ระบบตัดสินเองไม่ได้จึงส่งเข้า Manual Review Queue พร้อม Evidence Snapshot และเหตุผล เจ้าหน้าที่ตัดสิน แล้วระบบอัปเดตผลประเมินและ Badge ต่อเอง',
    keyMessage: 'เจ้าหน้าที่รับเฉพาะงานที่ต้องใช้วิจารณญาณหรืออำนาจ — หนึ่งงานต่อประเด็น ไม่มีงานซ้ำ และการคัดกรองไม่ใช่การตัดสินว่าร้านทุจริต',
    audience: ['merchant', 'officer', 'consumer'],
    duration: '≈ 5 นาที',
    caseNote: 'ใช้ร้านเดียวกับ Scenario 14 (M-005) เพื่อเปรียบเทียบ — ร้านตัวอย่าง "บัญชีร้านเป็นชื่อบุคคลอื่น" มีข้อมูลการขายดี แต่ชื่อเจ้าของบัญชี (จำลอง) ไม่ตรงกับผู้ยืนยันตัวตน',
    benefits: {
      sme: 'รู้ว่าทำไมถูกส่งตรวจ และส่งคำชี้แจงในงานเดิมได้',
      consumer: 'ไม่เห็น Badge จากข้อมูลที่อาจไม่ใช่ของร้านจริง ระหว่างตรวจสอบ',
      ocpb: 'งานมีหลักฐานและเหตุผลครบในที่เดียว ตัดสินได้เร็ว และทุกการตัดสินบันทึก Audit Log',
    },
    nextCta: 'กลับสู่ Demo',
    prepare,
    steps: [
      {
        id: 's15-connect',
        role: 'merchant',
        route: () => '/m/marketplace',
        title: 'Marketplace Connection',
        instruction: 'กดเชื่อมต่อแพลตฟอร์มใดก็ได้ → ยินยอม → เลือกร้านตัวอย่าง "บัญชีร้านเป็นชื่อบุคคลอื่น" → ดูตัวอย่าง → "ยืนยันนำเข้าข้อมูล"',
        gate: { check: (g) => newConnection(g)?.archetype === 'owner_mismatch' && !!newConnection(g)?.consentAt, hint: 'เลือกร้านตัวอย่าง "บัญชีร้านเป็นชื่อบุคคลอื่น" แล้วยืนยันนำเข้า' },
        capture: (g) => ({ connectionId: newConnection(g)?.id }),
      },
      {
        id: 's15-routed',
        role: 'merchant',
        route: () => '/m/trust',
        title: 'Risk / Data Conflict → MANUAL_REVIEW',
        instruction: 'ระบบพบว่าข้อมูลตัวตนสำคัญไม่ตรงกัน จึงไม่แสดง Badge และส่งเจ้าหน้าที่ตรวจ — ร้านเห็นเหตุผล (ไม่ใช่การกล่าวหาว่ากระทำผิด)',
        gate: { check: (g) => tasksSince(g.ctx.merchantId, g.startedAt).length > 0, hint: 'รอให้ซิงก์สำเร็จ — ระบบจะสร้างงานให้เจ้าหน้าที่หนึ่งงาน' },
        capture: (g) => ({ taskId: tasksSince(g.ctx.merchantId, g.startedAt)[0]?.id }),
        nextLabel: 'ไปที่คิวของเจ้าหน้าที่',
      },
      {
        id: 's15-queue',
        role: 'officer',
        route: () => '/o/exceptions?tab=identity',
        transition: 'ระบบตัดสินเองไม่ได้ว่าเป็นร้านเดียวกันหรือไม่ — งานเข้าสู่ Manual Review Queue ของเจ้าหน้าที่',
        title: 'Manual Review Queue',
        instruction: (c) => `คิวแสดงเฉพาะกรณียกเว้นพร้อมเหตุผลที่ส่งตรวจ — งาน ${c.taskId ?? ''} อยู่ในหมวด Identity Mismatch (Refresh หรือประเมินซ้ำไม่สร้างงานใหม่)`,
      },
      {
        id: 's15-decide',
        role: 'officer',
        route: (c) => `/o/exceptions/${c.taskId}`,
        title: 'Officer Decision',
        instruction: 'ดู Evidence Snapshot แล้วเลือก อนุมัติ / ไม่อนุมัติ / ขอข้อมูลเพิ่มเติม พร้อมเหตุผล',
        gate: { check: (g) => ['approved', 'rejected', 'info_requested'].includes(taskOf(g.ctx.taskId)?.status ?? ''), hint: 'บันทึกผลการพิจารณาพร้อมเหตุผล (อย่างน้อย 5 ตัวอักษร)' },
        nextLabel: 'ดูผลในมุมร้านค้า',
      },
      {
        id: 's15-result',
        role: 'merchant',
        route: () => '/m/trust',
        transition: 'เจ้าหน้าที่บันทึกผลแล้ว — ระบบประมวลผลต่อเองและแจ้งร้านค้า',
        title: 'Updated Assessment / Certification Status',
        instruction: (c) => `${badgeLine(c)} · ${certLine(c.merchantId)}`,
      },
      {
        id: 's15-consumer',
        role: 'consumer',
        route: (c) => `/shop/${c.merchantId}`,
        transition: 'สิ่งที่ผู้บริโภคเห็นหลังการตัดสิน',
        title: 'มุมผู้บริโภค',
        instruction: 'ผู้บริโภคเห็นสถานะ Badge ตามผลล่าสุด — ไม่เห็นงานของเจ้าหน้าที่ เหตุผลภายใน หรือคะแนนภายใน',
      },
    ],
    summary: (c) => {
      const t = taskOf(c.taskId);
      const conn = useMarketplaceStore.getState().items.find((x) => x.id === c.connectionId);
      return [
        conn ? `เชื่อมต่อ ${PLATFORMS[conn.platform].label} (${conn.id}) — ร้านตัวอย่างที่ชื่อเจ้าของบัญชีไม่ตรงกับผู้ยืนยันตัวตน` : 'ยังไม่ได้เชื่อมต่อ',
        t ? `ระบบสร้างงาน ${t.id} หนึ่งงาน (${TASK_STATUS[t.status].label})` : 'ยังไม่มีงานให้เจ้าหน้าที่',
        badgeLine(c),
        certLine(c.merchantId),
        'เปรียบเทียบ: Scenario 14 ใช้ 2 บทบาท 0 งานเจ้าหน้าที่ · Scenario 15 ใช้ 3 บทบาท 1 งานเจ้าหน้าที่',
      ];
    },
    outcome: exceptionOutcome,
  },
];

export const merchantName = (c: DemoCtx) => merchant(c.merchantId)?.shopName ?? 'ร้านค้า';
