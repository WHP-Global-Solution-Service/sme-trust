import type { TrustAssessment } from '@/features/trust-assessment/types';
import { assessTrust } from '@/features/trust-assessment/engine';
import { MODEL_V2 } from '@/features/trust-assessment/model';
import { buildAssessmentInput, inputsKey, type DataBundle } from '@/features/trust-assessment/inputs';
import { d } from './helpers';

/** ผลประเมินตัวอย่าง — คำนวณจาก Seed ด้วย Engine จริง ณ วันที่คงที่ (ผลเหมือนเดิมทุกครั้ง) */
const AS_OF = d('2026-10-21');
const PENDING = new Set(['M-006']);

export function buildAssessments(data: DataBundle): TrustAssessment[] {
  const ids = [...new Set(data.connections.map((c) => c.merchantId))].sort();
  return ids.flatMap((merchantId, i) => {
    const input = buildAssessmentInput(merchantId, data, new Date(AS_OF));
    if (!input) return [];
    const pending = PENDING.has(merchantId);
    return [
      {
        id: `TAS-2569-${String(i + 1).padStart(4, '0')}`,
        merchantId,
        createdAt: AS_OF,
        status: pending ? 'pending_review' : 'draft',
        submittedAt: pending ? AS_OF : undefined,
        inputsKey: inputsKey(input, MODEL_V2.weights),
        result: assessTrust(input, MODEL_V2),
      } satisfies TrustAssessment,
    ];
  });
}
