import { useState } from 'react';
import { ClipboardCheck, Fingerprint } from 'lucide-react';
import type { RegistrationStatus } from '@/types';
import { useMerchantStore, useVerificationStore } from '@/stores';
import { REGISTRATION_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Badge, Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox, Select } from '@/components/forms/Field';

const STATUS_TABS: (RegistrationStatus | 'all' | 'queue')[] = ['queue', 'all', 'submitted', 'pending_review', 'under_verification', 'need_info', 'approved', 'rejected'];

export default function OfficerApplications() {
  const apps = useVerificationStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<string>('queue');
  const [type, setType] = useState('');
  const shop = (id: string) => merchants.find((m) => m.id === id);
  const inQueue = (s: RegistrationStatus) => ['submitted', 'pending_review', 'under_verification'].includes(s);

  const rows = apps
    .filter((a) => (tab === 'all' ? true : tab === 'queue' ? inQueue(a.status) : a.status === tab))
    .filter((a) => !type || a.type === type)
    .filter((a) => !q || `${a.id} ${shop(a.merchantId)?.shopName} ${shop(a.merchantId)?.province}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div>
      <PageHeader title="Merchant Applications" subtitle="คำขอลงทะเบียนร้านค้าและคำขอรับรอง" icon={ClipboardCheck} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาเลขคำขอ ชื่อร้าน หรือจังหวัด" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-52" aria-label="ประเภทคำขอ">
          <option value="">ทุกประเภทคำขอ</option>
          <option value="registration">ลงทะเบียนร้านค้า</option>
          <option value="certification">ขอรับรอง/ต่ออายุ</option>
        </Select>
      </div>
      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={STATUS_TABS.map((s) => ({
            value: s,
            label: s === 'all' ? 'ทั้งหมด' : s === 'queue' ? 'คิวงาน' : REGISTRATION_STATUS[s].label,
            count: s === 'all' ? apps.length : s === 'queue' ? apps.filter((a) => inQueue(a.status)).length : apps.filter((a) => a.status === s).length,
          }))}
        />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowLink={(a) => `/o/applications/${a.id}`}
          mobileTitle={(a) => shop(a.merchantId)?.shopName}
          columns={[
            { key: 'id', header: 'เลขคำขอ', render: (a) => <span className="font-mono text-xs">{a.id}</span>, sort: (a) => a.id },
            {
              key: 'shop',
              header: 'ร้านค้า',
              hideOnMobile: true,
              render: (a) => (
                <span>
                  {shop(a.merchantId)?.shopName}
                  {shop(a.merchantId)?.identityFlag && <Fingerprint className="ml-1 inline h-4 w-4 text-error" aria-label="พบตัวตนซ้ำ" />}
                </span>
              ),
              sort: (a) => shop(a.merchantId)?.shopName ?? '',
            },
            { key: 'type', header: 'ประเภท', render: (a) => <Badge tone={a.type === 'registration' ? 'primary' : 'info'}>{a.type === 'registration' ? 'ลงทะเบียน' : `รับรอง ${TRUST_LEVELS[a.requestedLevel].name}`}</Badge> },
            { key: 'prov', header: 'จังหวัด', render: (a) => shop(a.merchantId)?.province, hideOnMobile: true },
            { key: 'status', header: 'สถานะ', render: (a) => <StatusBadge map={REGISTRATION_STATUS} value={a.status} />, sort: (a) => a.status },
            { key: 'date', className: 'whitespace-nowrap', header: 'ยื่นเมื่อ', render: (a) => fmtDate(a.submittedAt), sort: (a) => a.submittedAt },
          ]}
        />
      </Card>
    </div>
  );
}
