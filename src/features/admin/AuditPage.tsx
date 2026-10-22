import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useAuditStore } from '@/stores';
import { ROLE_LABEL } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Badge, Card, PageHeader } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox, Select } from '@/components/forms/Field';

export default function AuditPage() {
  const log = useAuditStore((s) => s.items);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const rows = log
    .filter((a) => !role || a.actorRole === role)
    .filter((a) => !q || `${a.action} ${a.target} ${a.actorName} ${a.detail ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="บันทึกการดำเนินการทั้งหมดในระบบสาธิต" icon={ScrollText} />
      <Alert tone="info" className="mb-4">Mock Audit Log — บันทึกเก็บในเบราว์เซอร์เท่านั้น ไม่ใช่ระบบ Audit ที่ป้องกันการแก้ไขได้จริง</Alert>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาการกระทำ เป้าหมาย หรือผู้ดำเนินการ" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-48" aria-label="บทบาท">
          <option value="">ทุกบทบาท</option>
          {['merchant', 'consumer', 'officer', 'admin', 'system'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
      </div>
      <Card>
        <DataTable
          rows={rows}
          pageSize={15}
          mobileTitle={(a) => a.action}
          columns={[
            { key: 'at', className: 'whitespace-nowrap', header: 'เวลา', render: (a) => fmtDate(a.at, true), sort: (a) => a.at },
            { key: 'who', header: 'ผู้ดำเนินการ', render: (a) => <span>{a.actorName} <Badge>{ROLE_LABEL[a.actorRole]}</Badge></span> },
            { key: 'act', header: 'การกระทำ', render: (a) => a.action, hideOnMobile: true },
            { key: 't', header: 'เป้าหมาย', render: (a) => <span className="font-mono text-xs">{a.target}</span> },
            { key: 'd', header: 'รายละเอียด', render: (a) => a.detail ?? '-' },
          ]}
        />
      </Card>
    </div>
  );
}
