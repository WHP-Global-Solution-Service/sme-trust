import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_PREFIX } from './createEntityStore';
import { MODEL_V2, modelWith, validateWeights, type Model, type Weights } from '@/features/trust-assessment/model';

/** ชุดน้ำหนักแต่ละครั้งที่บันทึก — ผลประเมินเก็บสำเนาน้ำหนักและเลขชุดไว้เอง จึงไม่ถูกแก้ย้อนหลัง */
export interface WeightSet {
  revision: number;
  weights: Weights;
  /** วันที่เริ่มใช้ (ไม่มี = ค่าเริ่มต้นของระบบ) */
  at?: string;
  note: string;
}

/** น้ำหนักของ Trust Assessment ที่ผู้ดูแลระบบปรับได้ (D5) — ค่าเริ่มต้นตามแผน */
interface AssessmentConfigState {
  weights: Weights;
  /** เลขชุดน้ำหนัก (0 = ค่าเริ่มต้นของระบบ) */
  revision: number;
  updatedAt?: string;
  /** ประวัติชุดน้ำหนัก (ล่าสุดก่อน ไม่เกิน 10 ชุด) */
  history: WeightSet[];
  setWeights: (w: Weights) => string | undefined;
  /** คืนค่าน้ำหนักเริ่มต้น — บันทึกเป็นชุดใหม่ (ผลประเมินเดิมยังอ้างชุดเดิม) */
  restoreDefault: () => void;
  /** ล้างทั้งหมดกลับสถานะเริ่มต้นของ Demo (ใช้กับ Reset Demo Data) */
  reset: () => void;
}

const same = (a: Weights, b: Weights) => (Object.keys(a) as (keyof Weights)[]).every((k) => a[k] === b[k]);
const initial = () => ({ weights: { ...MODEL_V2.weights }, revision: 0, updatedAt: undefined, history: [{ revision: 0, weights: { ...MODEL_V2.weights }, note: 'ค่าเริ่มต้นของระบบ' }] as WeightSet[] });

export const useAssessmentConfigStore = create<AssessmentConfigState>()(
  persist(
    (set, get) => {
      const record = (w: Weights, note: string) => {
        const s = get();
        if (same(s.weights, w)) return;
        const revision = s.revision + 1;
        const at = new Date().toISOString();
        set({ weights: { ...w }, revision, updatedAt: at, history: [{ revision, weights: { ...w }, at, note }, ...s.history].slice(0, 10) });
      };
      return {
        ...initial(),
        setWeights: (w) => {
          const err = validateWeights(w);
          if (!err) record(w, 'ผู้ดูแลระบบปรับน้ำหนัก');
          return err;
        },
        restoreDefault: () => record({ ...MODEL_V2.weights }, 'คืนค่าเริ่มต้น'),
        reset: () => set(initial()),
      };
    },
    {
      name: `${STORAGE_PREFIX}assessment-config`,
      version: 2,
      // รุ่น 1 เก็บเฉพาะ weights — ส่งต่อให้ merge แปลงเป็นชุด #1 (ไม่ทิ้งน้ำหนักที่ผู้ใช้บันทึกไว้)
      migrate: (persisted) => persisted as AssessmentConfigState,
      // ค่าที่บันทึกไว้ผิดรูปแบบ → ใช้ค่าเริ่มต้น · ข้อมูลรุ่นก่อน (มีแต่ weights) → ถือเป็นชุดที่ 1
      merge: (persisted, current) => {
        const p = persisted as Partial<AssessmentConfigState> | undefined;
        const w = p?.weights;
        if (!w || validateWeights(w)) return current;
        const revision = Number.isInteger(p?.revision) && p!.revision! >= 0 ? p!.revision! : same(w, MODEL_V2.weights) ? 0 : 1;
        const history = Array.isArray(p?.history) && p!.history!.every((h) => h && !validateWeights(h.weights)) ? p!.history! : [{ revision, weights: w, at: p?.updatedAt, note: revision ? 'ชุดน้ำหนักที่บันทึกไว้' : 'ค่าเริ่มต้นของระบบ' }];
        return { ...current, weights: w, revision, updatedAt: p?.updatedAt, history };
      },
    },
  ),
);

/** โมเดลที่ใช้ประเมินตอนนี้ — พร้อมเลขชุดน้ำหนักเพื่อบันทึกลงผลประเมิน */
export const currentModel = (): Model => {
  const s = useAssessmentConfigStore.getState();
  return { ...modelWith(s.weights), weightSet: { revision: s.revision, at: s.updatedAt } };
};

export const weightSetLabel = (ws?: { revision: number; at?: string }) => (!ws ? 'ไม่ระบุชุดน้ำหนัก' : ws.revision === 0 ? 'ชุดน้ำหนักเริ่มต้น' : `ชุดน้ำหนัก #${ws.revision}`);
