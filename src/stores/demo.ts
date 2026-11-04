import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_PREFIX } from './createEntityStore';

/**
 * Demo Scenario State — แยกจาก Business Data State
 * ใช้ควบคุมขั้นตอน/บริบทของการสาธิตเท่านั้น ไม่เปลี่ยนข้อมูลธุรกิจโดยตรง (ข้อมูลธุรกิจเปลี่ยนผ่าน Workflow เท่านั้น)
 */
export interface DemoCtx {
  operatorId?: string;
  merchantId?: string;
  applicationId?: string;
  certId?: string;
  complaintId?: string;
  warningId?: string;
  riskCaseId?: string;
  consumerId?: string;
  officerId?: string;
  /** v2: การเชื่อมต่อ Marketplace (จำลอง) และผลประเมินที่ใช้ต่อเนื่องใน Scenario 9–13 */
  connectionId?: string;
  assessmentId?: string;
  /** v2: บันทึกการนำเข้าข้อมูลร้านจาก Marketplace (Scenario 9 / 9A) */
  importId?: string;
  /** แจ้งเมื่อใช้ข้อมูลตัวอย่างแทนข้อมูลจาก Scenario ก่อนหน้า (แสดงในตัวควบคุมการสาธิต) */
  notice?: string;
}

export type ScenarioStatus = 'idle' | 'running' | 'paused' | 'completed';

interface DemoState {
  journeyMode: boolean;
  /** Full Journey ชุดใด — v1 (Scenario 1–8) หรือ v2 (Scenario 9–13) */
  journeyTrack: 'v1' | 'v2';
  activeScenario?: string;
  stepIndex: number;
  status: ScenarioStatus;
  completed: string[];
  /** IDs ที่ส่งต่อระหว่าง Scenario (เช่น บัญชีและร้านค้าที่สร้างใน Scenario 1–2) */
  journey: DemoCtx;
  /** IDs ที่ Scenario ปัจจุบันใช้ (currentMerchantId, currentComplaintId, …) */
  current: DemoCtx;
  /** บริบทตอนเริ่ม Scenario ปัจจุบัน — Restart ใช้คู่กับ Snapshot (ไม่เรียก Fixture ซ้ำ) */
  startCtx?: DemoCtx;
  /** บริบทของแต่ละ Scenario ที่จบแล้ว (ใช้แสดงหน้าสรุปย้อนหลัง) */
  results: Record<string, DemoCtx>;
  /** เวลาเริ่ม Scenario ปัจจุบัน — ใช้ตรวจว่ารายการถูกสร้างระหว่างการสาธิต */
  startedAt?: string;
  /** สัญญาณความคืบหน้าจากหน้าจอ (เช่น ขั้นของ Wizard) — ใช้เปิดปุ่ม "ถัดไป" */
  signals: Record<string, string | number | boolean>;
  /** ขั้นที่ทำ Action สำเร็จแล้ว — ย้อนกลับมาจะไม่ต้องทำซ้ำ (ไม่สร้างข้อมูลซ้ำ) */
  passed: string[];
  panelOpen: boolean;
  set: (patch: Partial<DemoState>) => void;
  signal: (key: string, value: string | number | boolean) => void;
  reset: () => void;
}

const initial = {
  journeyMode: false,
  journeyTrack: 'v1' as 'v1' | 'v2',
  activeScenario: undefined,
  stepIndex: 0,
  status: 'idle' as ScenarioStatus,
  completed: [] as string[],
  journey: {} as DemoCtx,
  current: {} as DemoCtx,
  results: {} as Record<string, DemoCtx>,
  startedAt: undefined,
  signals: {} as Record<string, string | number | boolean>,
  passed: [] as string[],
  panelOpen: true,
};

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      signal: (key, value) => set((s) => (s.signals[key] === value ? s : { signals: { ...s.signals, [key]: value } })),
      reset: () => set({ ...initial }),
    }),
    { name: `${STORAGE_PREFIX}demo`, version: 1 },
  ),
);

/** รายงานความคืบหน้าจากหน้าจอ ใช้เฉพาะเมื่อกำลังสาธิต */
export function reportDemo(key: string, value: string | number | boolean) {
  const s = useDemoStore.getState();
  if (s.activeScenario && s.status === 'running') s.signal(key, value);
}
