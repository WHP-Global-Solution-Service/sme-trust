import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { useAssessmentStore, useMerchantStore } from '@/stores';
import { Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { fmtDate } from '@/utils/format';
import { MarketplaceDisclaimer } from '@/features/marketplace/components/MarketplaceParts';
import { ASSESSMENT_STATUS, BAND_LABEL, CONFIDENCE_LABEL, RECOMMENDATION_LABEL, STANDING_LABEL } from '../labels';
import type { AssessmentStatus, BandOrInsufficient } from '../types';

type Tab = 'pending_review' | 'all' | 'decided';

/** คิวผลประเมินสำหรับเจ้าหน้าที่ — เห็นคะแนนตัวเลขได้ (D2) */
export default function OfficerAssessmentList() {
  const items = useAssessmentStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState<Tab>('pending_review');
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const rows = items.filter((a) => (tab === 'all' ? true : a.status === (tab as AssessmentStatus))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = (s: AssessmentStatus) => items.filter((a) => a.status === s).length;
  const bands: BandOrInsufficient[] = ['A', 'B', 'C', 'D', 'insufficient'];

  return (
    <div className="space-y-4">
      <PageHeader title="Trust Assessment Review" subtitle="ผลประเมินความน่าเชื่อถือจากข้อมูล Marketplace (จำลอง) — ข้อมูลประกอบการพิจารณา Level 3–4" icon={Gauge} />
      <MarketplaceDisclaimer />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {bands.map((b) => (
          <Card key={b} className="p-3">
            <p className="text-xs text-ink-soft">{BAND_LABEL[b].label.split(' — ')[0]}</p>
            <p className="text-xl font-bold text-ink">{items.filter((a) => a.result.band === b).length}</p>
          </Card>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending_review', label: 'รอพิจารณา', count: count('pending_review') },
          { value: 'decided', label: 'พิจารณาแล้ว', count: count('decided') },
          { value: 'all', label: 'ทั้งหมด', count: items.length },
        ]}
      />
      <Card>
        <DataTable
          rows={rows}
          rowLink={(a) => `/o/assessments/${a.id}`}
          mobileTitle={(a) => shop(a.merchantId)}
          empty="ไม่มีผลประเมินในหมวดนี้"
          columns={[
            { key: 'id', header: 'เลขที่', render: (a) => <span className="font-mono text-xs">{a.id}</span>, sort: (a) => a.id },
            { key: 'shop', header: 'ร้านค้า', render: (a) => shop(a.merchantId), hideOnMobile: true, sort: (a) => shop(a.merchantId) },
            { key: 'band', header: 'Band', render: (a) => <StatusBadge map={BAND_LABEL} value={a.result.band} />, sort: (a) => a.result.band },
            { key: 'score', header: 'คะแนน', render: (a) => a.result.score.toFixed(1), sort: (a) => a.result.score },
            { key: 'cov', header: 'Coverage', render: (a) => `${a.result.coverage.percent}%`, sort: (a) => a.result.coverage.percent },
            { key: 'conf', header: 'Confidence', render: (a) => <StatusBadge map={CONFIDENCE_LABEL} value={a.result.confidence.level} /> },
            { key: 'standing', header: 'Standing', render: (a) => <StatusBadge map={STANDING_LABEL} value={a.result.standing} /> },
            { key: 'rec', header: 'ข้อเสนอของระบบ', render: (a) => <StatusBadge map={RECOMMENDATION_LABEL} value={a.result.recommendation.kind} /> },
            { key: 'st', header: 'สถานะ', render: (a) => <StatusBadge map={ASSESSMENT_STATUS} value={a.status} /> },
            { key: 'at', header: 'ประเมินเมื่อ', render: (a) => fmtDate(a.createdAt), sort: (a) => a.createdAt },
          ]}
        />
      </Card>
    </div>
  );
}
