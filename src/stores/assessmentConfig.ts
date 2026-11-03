import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_PREFIX } from './createEntityStore';
import { MODEL_V2, modelWith, validateWeights, type Model, type Weights } from '@/features/trust-assessment/model';

/** น้ำหนักของ Trust Assessment ที่ผู้ดูแลระบบปรับได้ (D5) — ค่าเริ่มต้นตามแผน */
interface AssessmentConfigState {
  weights: Weights;
  setWeights: (w: Weights) => string | undefined;
  reset: () => void;
}

export const useAssessmentConfigStore = create<AssessmentConfigState>()(
  persist(
    (set) => ({
      weights: { ...MODEL_V2.weights },
      setWeights: (w) => {
        const err = validateWeights(w);
        if (!err) set({ weights: { ...w } });
        return err;
      },
      reset: () => set({ weights: { ...MODEL_V2.weights } }),
    }),
    {
      name: `${STORAGE_PREFIX}assessment-config`,
      version: 1,
      // ค่าที่บันทึกไว้ผิดรูปแบบ → ใช้ค่าเริ่มต้น
      merge: (persisted, current) => {
        const w = (persisted as { weights?: Weights } | undefined)?.weights;
        return w && !validateWeights(w) ? { ...current, weights: w } : current;
      },
    },
  ),
);

export const currentModel = (): Model => modelWith(useAssessmentConfigStore.getState().weights);
