import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquareWarning } from 'lucide-react';
import type { ComplaintStatus } from '@/types';
import { useComplaintStore, useMerchantStore } from '@/stores';
import { COMPLAINT_CATEGORY, COMPLAINT_STATUS, PRIORITY } from '@/constants/labels';
import { fmtDate, fmtMoney } from '@/utils/format';
import { Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox, Select } from '@/components/forms/Field';

const PRI_ORDER = { urgent: 4, high: 3, medium: 2, low: 1 };

export default function OfficerComplaints() {
  const [params] = useSearchParams();
  const complaints = useComplaintStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState<string>(params.get('status') ?? 'escalated');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pri, setPri] = useState('');
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const rows = complaints
    .filter((c) => tab === 'all' || c.status === tab)
    .filter((c) => !cat || (c.officerCategory ?? c.category) === cat)
    .filter((c) => !pri || (c.officerPriority ?? c.screening.priority) === pri)
    .filter((c) => !q || `${c.id} ${c.title} ${shop(c.merchantId)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => PRI_ORDER[b.officerPriority ?? b.screening.priority] - PRI_ORDER[a.officerPriority ?? a.screening.priority] || b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader title="Complaint Cases" subtitle="เรื่องที่ส่งต่อจะเรียงตามลำดับความสำคัญจาก Screening Assistant" icon={MessageSquareWarning} />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา Case ID หัวข้อ หรือร้านค้า" />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="ประเภท">
            <option value="">ทุกประเภท</option>
            {Object.entries(COMPLAINT_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={pri} onChange={(e) => setPri(e.target.value)} aria-label="ความสำคัญ">
            <option value="">ทุกระดับความสำคัญ</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
      </div>
      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[{ value: 'all', label: 'ทั้งหมด', count: complaints.length }, ...(Object.keys(COMPLAINT_STATUS) as ComplaintStatus[]).map((s) => ({ value: s, label: COMPLAINT_STATUS[s].label, count: complaints.filter((c) => c.status === s).length }))]}
        />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowLink={(c) => `/o/complaints/${c.id}`}
          mobileTitle={(c) => c.title}
          columns={[
            { key: 'id', header: 'Case ID', render: (c) => <span className="font-mono text-xs">{c.id}</span>, sort: (c) => c.id },
            { key: 'shop', header: 'ร้านค้า', render: (c) => shop(c.merchantId), sort: (c) => shop(c.merchantId), hideOnMobile: true },
            { key: 'cat', header: 'ประเภท', render: (c) => COMPLAINT_CATEGORY[c.officerCategory ?? c.category] },
            { key: 'pri', header: 'ความสำคัญ', render: (c) => <StatusBadge map={PRIORITY} value={c.officerPriority ?? c.screening.priority} />, sort: (c) => PRI_ORDER[c.officerPriority ?? c.screening.priority] },
            { key: 'amt', header: 'มูลค่า', render: (c) => fmtMoney(c.orderAmount), sort: (c) => c.orderAmount, hideOnMobile: true },
            { key: 'st', header: 'สถานะ', render: (c) => <StatusBadge map={COMPLAINT_STATUS} value={c.status} /> },
            { key: 'date', className: 'whitespace-nowrap', header: 'ยื่นเมื่อ', render: (c) => fmtDate(c.createdAt), sort: (c) => c.createdAt },
          ]}
        />
      </Card>
    </div>
  );
}
