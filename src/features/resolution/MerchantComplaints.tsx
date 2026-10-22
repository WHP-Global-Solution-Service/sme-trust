import { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import type { ComplaintStatus } from '@/types';
import { useComplaintStore } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { COMPLAINT_STATUS, PRIORITY } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Card, EmptyState, ListLink, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';

const GROUPS: { value: string; label: string; statuses: ComplaintStatus[] }[] = [
  { value: 'action', label: 'ต้องดำเนินการ', statuses: ['submitted', 'awaiting_merchant', 'merchant_responded'] },
  { value: 'consumer', label: 'รอผู้บริโภค', statuses: ['waiting_consumer'] },
  { value: 'escalated', label: 'ส่งต่อเจ้าหน้าที่', statuses: ['escalated'] },
  { value: 'done', label: 'ปิดแล้ว', statuses: ['resolved', 'closed'] },
];

export default function MerchantComplaints() {
  const { mine } = useMyMerchants();
  const complaints = useComplaintStore((s) => s.items);
  const [tab, setTab] = useState('action');
  const myIds = mine.map((m) => m.id);
  const all = complaints.filter((c) => myIds.includes(c.merchantId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const group = GROUPS.find((g) => g.value === tab)!;
  const list = all.filter((c) => group.statuses.includes(c.status));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="ข้อร้องเรียน" subtitle="Merchant First Resolution — แก้ไขกับลูกค้าโดยตรงก่อนส่งต่อเจ้าหน้าที่" icon={MessageSquareWarning} />
      <Alert tone="info" className="mb-4">ตอบกลับภายใน 3 วัน และเสนอทางเลือกที่เป็นธรรม ช่วยลดการส่งต่อเรื่องและรักษาสถานะความน่าเชื่อถือของร้าน</Alert>
      <div className="mb-3">
        <Tabs value={tab} onChange={setTab} tabs={GROUPS.map((g) => ({ value: g.value, label: g.label, count: all.filter((c) => g.statuses.includes(c.status)).length }))} />
      </div>
      <Card>
        {list.length ? (
          <div className="divide-y divide-line">
            {list.map((c) => (
              <ListLink
                key={c.id}
                to={`/m/complaints/${c.id}`}
                title={c.title}
                subtitle={`${c.id} · ${mine.find((m) => m.id === c.merchantId)?.shopName} · ${fmtDate(c.createdAt)}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge map={COMPLAINT_STATUS} value={c.status} />
                    {['high', 'urgent'].includes(c.screening.priority) && <StatusBadge map={PRIORITY} value={c.screening.priority} />}
                  </div>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={MessageSquareWarning} title="ไม่มีข้อร้องเรียนในหมวดนี้" desc={tab === 'action' ? 'ยอดเยี่ยม! ไม่มีเรื่องที่รอคุณดำเนินการ' : undefined} />
        )}
      </Card>
    </div>
  );
}
