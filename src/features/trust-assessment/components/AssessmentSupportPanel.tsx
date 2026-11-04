import { Gauge } from 'lucide-react';
import { useAssessmentStore, useMarketplaceStore } from '@/stores';
import { latestAssessment } from '@/stores/workflowsV2';
import { Card, CardHeader, StatusBadge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import { ARCHETYPE_LABEL, PLATFORMS } from '@/features/marketplace/data/platforms';
import { CONNECTION_STATUS } from '@/features/marketplace/components/MarketplaceParts';
import { ASSESSMENT_STATUS, CONFIDENCE_LABEL, RECOMMENDATION_LABEL } from '../labels';
import { AssessmentLink, BandBadge, StandingBanner } from './AssessmentParts';

/** หลักฐานจาก Marketplace (จำลอง) ของร้าน — แพลตฟอร์ม Shop ID จำลอง สถานะ และวันที่ซิงก์ */
export function MarketplaceEvidence({ merchantId }: { merchantId: string }) {
  const conns = useMarketplaceStore((s) => s.items.filter((c) => c.merchantId === merchantId && c.status !== 'disconnected'));
  if (!conns.length) return <p className="text-sm text-ink-soft">ไม่มีการเชื่อมต่อ Marketplace — ร้านไม่ถูกหักคะแนนจากการไม่มีบัญชี (ประเมินจากข้อมูลในระบบ)</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line text-sm" aria-label="หลักฐานจาก Marketplace">
      {conns.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="font-medium text-ink">{PLATFORMS[c.platform].label}</span>
          <span className="font-mono text-xs text-ink-soft">{c.mockShopId}</span>
          <StatusBadge map={CONNECTION_STATUS} value={c.status} />
          <span className="w-full text-xs text-ink-soft">
            {c.id} · ซิงก์ล่าสุด {c.lastSyncAt ? fmtDate(c.lastSyncAt, true) : '—'} · ข้อมูลจำลองแบบ "{ARCHETYPE_LABEL[c.archetype].label}"
          </span>
        </li>
      ))}
    </ul>
  );
}

/** ข้อมูลประกอบการพิจารณาคำขอของเจ้าหน้าที่ (D3) — ไม่ใช่เงื่อนไขอนุมัติอัตโนมัติ */
export function AssessmentSupportPanel({ merchantId }: { merchantId: string }) {
  const items = useAssessmentStore((s) => s.items);
  const a = latestAssessment(merchantId, items);
  return (
    <Card>
      <CardHeader title="ข้อมูลประกอบ: Trust Assessment v2" subtitle="หลักฐานจาก Marketplace (จำลอง) และผลประเมิน — ใช้ประกอบการพิจารณาเท่านั้น" icon={Gauge} />
      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-soft">Marketplace Evidence</p>
          <MarketplaceEvidence merchantId={merchantId} />
        </div>
        {!a ? (
          <p className="text-ink-soft">ร้านยังไม่มีผลประเมิน</p>
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
              <StatusBadge map={ASSESSMENT_STATUS} value={a.status} />
            </p>
            <p className="text-xs text-ink-soft">
              รายละเอียด วิธีคำนวณ และการตัดสิน: <AssessmentLink id={a.id} />
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
