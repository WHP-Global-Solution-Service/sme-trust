import { Gauge } from 'lucide-react';
import { useAssessmentStore } from '@/stores';
import { latestAssessment } from '@/stores/workflowsV2';
import { Card, CardHeader, StatusBadge } from '@/components/common/ui';
import { CONFIDENCE_LABEL, RECOMMENDATION_LABEL } from '../labels';
import { AssessmentLink, BandBadge, StandingBanner } from './AssessmentParts';

/** ข้อมูลประกอบการพิจารณาคำขอ Level 3–4 ของเจ้าหน้าที่ (D3) — ไม่ใช่เงื่อนไขอนุมัติอัตโนมัติ */
export function AssessmentSupportPanel({ merchantId }: { merchantId: string }) {
  const items = useAssessmentStore((s) => s.items);
  const a = latestAssessment(merchantId, items);
  return (
    <Card>
      <CardHeader title="ข้อมูลประกอบ: Trust Assessment v2" subtitle="จากข้อมูล Marketplace (จำลอง) — ใช้ประกอบการพิจารณาเท่านั้น" icon={Gauge} />
      <div className="space-y-2 p-4 text-sm">
        {!a ? (
          <p className="text-ink-soft">ร้านยังไม่มีผลประเมิน (ยังไม่ได้เชื่อมต่อ Marketplace)</p>
        ) : (
          <>
            <StandingBanner standing={a.result.standing} reason={a.result.standingReason} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <BandBadge band={a.result.band} />
              <span className="text-ink">
                คะแนน <b>{a.result.score.toFixed(1)}</b> · Coverage {a.result.coverage.percent}%
              </span>
            </div>
            <p className="flex flex-wrap gap-2">
              <StatusBadge map={CONFIDENCE_LABEL} value={a.result.confidence.level} />
              <StatusBadge map={RECOMMENDATION_LABEL} value={a.result.recommendation.kind} />
            </p>
            <p className="text-xs text-ink-soft">
              รายละเอียดและวิธีคำนวณ: <AssessmentLink id={a.id} />
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
