/**
 * Automation First — Demo
 * Scenario 14: เส้นทางปกติ (ไม่ต้องใช้เจ้าหน้าที่) — Marketplace App → SME Trust → Auto-Fill → ประเมินอัตโนมัติ → Assessment Badge → ผู้บริโภคตรวจสอบ
 * Scenario 15: กรณียกเว้น — เชื่อม Marketplace → ข้อมูลตัวตนขัดแย้ง → Manual Review Queue → เจ้าหน้าที่ตัดสิน → สถานะที่อัปเดต
 */
import type { DemoCtx } from '@/stores/demo';
import type { GateInput, ScenarioDef, ScenarioOutcome } from '@/demo/types';
import { useAssessmentBadgeStore, useCertificationStore, useMarketplaceStore, useMerchantStore, useOfficerTaskStore } from '@/stores';
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
const tasksSince = (merchantId: string | undefined, since: string) => useOfficerTaskStore.getState().items.filter((t) => t.merchantId === merchantId && t.createdAt >= since);

function badgeLine(c: DemoCtx) {
  const b = badgeOf(c.merchantId);
  return b ? `Assessment Badge: ${BADGE_STATUS[b.status].label} · ${BAND_LABEL[b.band].label} · ${ROUTE_LABEL[b.route].short}` : 'ยังไม่มี Assessment Badge';
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

  // ------------------------------------------------------------ 15
  {
    id: 's15',
    no: 15,
    track: 'v2',
    branch: true,
    title: 'กรณีข้อมูลร้านค้าไม่ตรงกัน — เจ้าหน้าที่ตรวจสอบ',
    objective: 'ร้านเชื่อมบัญชี Marketplace ที่ชื่อเจ้าของไม่ตรงกับผู้ยืนยันตัวตน ระบบตัดสินเองไม่ได้จึงส่งเข้า Manual Review Queue พร้อม Evidence Snapshot และเหตุผล เจ้าหน้าที่ตัดสิน แล้วระบบอัปเดตผลประเมินและ Badge ต่อเอง',
    keyMessage: 'เจ้าหน้าที่รับเฉพาะงานที่ต้องใช้วิจารณญาณหรืออำนาจ — หนึ่งงานต่อประเด็น ไม่มีงานซ้ำ และการคัดกรองไม่ใช่การตัดสินว่าร้านทุจริต',
    audience: ['merchant', 'officer', 'consumer'],
    duration: '≈ 5 นาที',
    caseNote: 'ใช้ร้านตัวอย่างร้านกาแฟดอยสูง (M-005) — ร้านตัวอย่าง "บัญชีร้านเป็นชื่อบุคคลอื่น" มีข้อมูลการขายดี แต่ชื่อเจ้าของบัญชี (จำลอง) ไม่ตรงกับผู้ยืนยันตัวตน',
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
        'เปรียบเทียบ: Demo หลักไม่มีงานเจ้าหน้าที่ · กรณีนี้มีงานเจ้าหน้าที่ 1 งานเฉพาะประเด็นที่ผิดปกติ',
      ];
    },
    outcome: exceptionOutcome,
  },
];

export const merchantName = (c: DemoCtx) => merchant(c.merchantId)?.shopName ?? 'ร้านค้า';
