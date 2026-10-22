import { useState } from 'react';
import { AlertTriangle, Plus, Wrench } from 'lucide-react';
import type { WarningStatus } from '@/types';
import { useMerchantStore, useWarningStore } from '@/stores';
import { WARNING_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Card, LinkButton, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox } from '@/components/forms/Field';
import { KindBadge, KindExplainer } from './WarningParts';

const CORRECTIVE: WarningStatus[] = ['correction_required', 'correction_submitted', 'under_review'];

export default function OfficerWarnings({ corrective }: { corrective?: boolean }) {
  const warnings = useWarningStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<string>(corrective ? 'correction_submitted' : 'all');
  const base = corrective ? warnings.filter((w) => CORRECTIVE.includes(w.status)) : warnings;
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const rows = base
    .filter((w) => tab === 'all' || (tab === 'open' ? w.status !== 'completed' : w.status === tab))
    .filter((w) => !q || `${w.id} ${w.title} ${shop(w.merchantId)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tabs = corrective
    ? CORRECTIVE.map((s) => ({ value: s, label: WARNING_STATUS[s].label, count: base.filter((w) => w.status === s).length }))
    : [
        { value: 'all', label: 'ทั้งหมด', count: base.length },
        { value: 'open', label: 'ยังไม่เสร็จ', count: base.filter((w) => w.status !== 'completed').length },
        ...(['advisory', 'warning_issued', 'correction_submitted', 'completed'] as WarningStatus[]).map((s) => ({ value: s, label: WARNING_STATUS[s].label, count: base.filter((w) => w.status === s).length })),
      ];

  return (
    <div>
      <PageHeader
        title={corrective ? 'Corrective Actions' : 'Warnings'}
        subtitle={corrective ? 'ติดตามและตรวจผลการแก้ไขของร้านค้า' : 'คำแนะนำและคำเตือนที่ออกให้ร้านค้า'}
        icon={corrective ? Wrench : AlertTriangle}
        action={<LinkButton to="/o/warnings/new" icon={Plus}>ออกคำแนะนำ/คำเตือน</LinkButton>}
      />
      {!corrective && <div className="mb-4"><KindExplainer /></div>}
      <div className="mb-3 flex flex-col gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาเลขที่ หัวข้อ หรือชื่อร้าน" />
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowLink={(w) => `/o/warnings/${w.id}`}
          mobileTitle={(w) => w.title}
          columns={[
            { key: 'id', header: 'เลขที่', render: (w) => <span className="font-mono text-xs">{w.id}</span>, sort: (w) => w.id },
            { key: 'shop', header: 'ร้านค้า', render: (w) => shop(w.merchantId), sort: (w) => shop(w.merchantId) },
            { key: 'title', header: 'หัวข้อ', render: (w) => w.title, hideOnMobile: true },
            { key: 'kind', header: 'ประเภท', render: (w) => <KindBadge kind={w.kind} /> },
            { key: 'status', header: 'สถานะ', render: (w) => <StatusBadge map={WARNING_STATUS} value={w.status} />, sort: (w) => w.status },
            { key: 'due', className: 'whitespace-nowrap', header: 'กำหนด', render: (w) => fmtDate(w.dueDate), sort: (w) => w.dueDate },
          ]}
        />
      </Card>
    </div>
  );
}
