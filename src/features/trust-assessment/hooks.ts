import { useMemo } from 'react';
import {
  useAssessmentStore,
  useCertificationStore,
  useComplaintStore,
  useMarketplaceStore,
  useMerchantStore,
  useOperatorStore,
  useRiskStore,
  useTrainingStore,
  useWarningStore,
} from '@/stores';
import { useAssessmentConfigStore } from '@/stores/assessmentConfig';
import { currentInputs, latestAssessment } from '@/stores/workflowsV2';

/** ผลประเมินล่าสุดของร้าน + ข้อมูลเปลี่ยนหลังประเมินหรือไม่ (อัปเดตทันทีเมื่อ Store ที่เกี่ยวข้องเปลี่ยน) */
export function useAssessmentState(merchantId?: string) {
  const items = useAssessmentStore((s) => s.items);
  const deps = [
    useMarketplaceStore((s) => s.items),
    useMerchantStore((s) => s.items),
    useOperatorStore((s) => s.items),
    useCertificationStore((s) => s.items),
    useComplaintStore((s) => s.items),
    useWarningStore((s) => s.items),
    useRiskStore((s) => s.items),
    useTrainingStore((s) => s.items),
    useAssessmentConfigStore((s) => s.weights),
  ];
  return useMemo(() => {
    if (!merchantId) return { latest: undefined, history: [], stale: false };
    const latest = latestAssessment(merchantId, items);
    const cur = currentInputs(merchantId);
    const history = items.filter((a) => a.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return { latest, history, stale: !!latest && !!cur && latest.inputsKey !== cur.key };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, items, ...deps]);
}
