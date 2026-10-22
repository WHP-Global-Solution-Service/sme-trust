import { useState } from 'react';
import { Users } from 'lucide-react';
import { useMerchantStore, useOperatorStore } from '@/stores';
import { consumers, officers } from '@/mock/data';
import { REGISTRATION_STATUS, RISK_STATUS, ROLE_LABEL } from '@/constants/labels';
import { fmtDate, maskPhone } from '@/utils/format';
import { Badge, Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox } from '@/components/forms/Field';

export default function AccountsPage() {
  const ops = useOperatorStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState('merchants');
  const [q, setQ] = useState('');
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());

  return (
    <div>
      <PageHeader title="บัญชีและร้านค้า" subtitle="บัญชีสาธิตทั้งหมด (ข้อมูลสมมติ)" icon={Users} />
      <div className="mb-3 flex flex-col gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหา" />
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'merchants', label: 'ร้านค้า', count: merchants.length },
            { value: 'operators', label: 'ผู้ประกอบการ', count: ops.length },
            { value: 'consumers', label: 'ผู้บริโภค', count: consumers.length },
            { value: 'staff', label: 'เจ้าหน้าที่/Admin', count: officers.length },
          ]}
        />
      </div>
      <Card>
        {tab === 'merchants' && (
          <DataTable
            rows={merchants.filter((m) => match(`${m.id} ${m.shopName} ${m.province}`))}
            rowLink={(m) => `/shop/${m.id}`}
            mobileTitle={(m) => m.shopName}
            columns={[
              { key: 'id', header: 'รหัส', render: (m) => <span className="font-mono text-xs">{m.id}</span>, sort: (m) => m.id },
              { key: 'n', header: 'ชื่อร้าน', render: (m) => m.shopName, hideOnMobile: true, sort: (m) => m.shopName },
              { key: 'o', header: 'เจ้าของ', render: (m) => ops.find((o) => o.id === m.operatorId)?.name },
              { key: 'p', header: 'จังหวัด', render: (m) => m.province, sort: (m) => m.province },
              { key: 'r', header: 'ลงทะเบียน', render: (m) => <StatusBadge map={REGISTRATION_STATUS} value={m.registrationStatus} /> },
              { key: 'k', header: 'ความเสี่ยง', render: (m) => <StatusBadge map={RISK_STATUS} value={m.riskStatus} /> },
            ]}
          />
        )}
        {tab === 'operators' && (
          <DataTable
            rows={ops.filter((o) => match(`${o.id} ${o.name} ${o.mockIdentityId}`))}
            mobileTitle={(o) => o.name}
            columns={[
              { key: 'id', header: 'รหัส', render: (o) => <span className="font-mono text-xs">{o.id}</span>, sort: (o) => o.id },
              { key: 'n', header: 'ชื่อ', render: (o) => o.name, hideOnMobile: true },
              { key: 'm', header: 'Mock Identity ID', render: (o) => <span className="font-mono text-xs">{o.mockIdentityId}</span> },
              { key: 'ph', header: 'โทรศัพท์', render: (o) => maskPhone(o.phone) },
              { key: 'k', header: 'e-KYC', render: (o) => <Badge tone={o.kycStatus === 'verified' ? 'success' : o.kycStatus === 'failed' ? 'error' : 'neutral'}>{o.kycStatus === 'verified' ? 'ยืนยันแล้ว' : o.kycStatus === 'failed' ? 'ไม่สำเร็จ' : 'ยังไม่ยืนยัน'}</Badge> },
              { key: 's', header: 'ร้านค้า', render: (o) => merchants.filter((m) => m.operatorId === o.id).length },
              { key: 'c', header: 'สมัครเมื่อ', render: (o) => fmtDate(o.createdAt), sort: (o) => o.createdAt },
            ]}
          />
        )}
        {tab === 'consumers' && (
          <DataTable
            rows={consumers.filter((c) => match(`${c.id} ${c.name}`))}
            mobileTitle={(c) => c.name}
            columns={[
              { key: 'id', header: 'รหัส', render: (c) => <span className="font-mono text-xs">{c.id}</span> },
              { key: 'n', header: 'ชื่อ', render: (c) => c.name, hideOnMobile: true },
              { key: 'p', header: 'จังหวัด', render: (c) => c.province },
              { key: 'ph', header: 'โทรศัพท์', render: (c) => maskPhone(c.phone) },
            ]}
          />
        )}
        {tab === 'staff' && (
          <DataTable
            rows={officers.filter((o) => match(`${o.id} ${o.name}`))}
            mobileTitle={(o) => o.name}
            columns={[
              { key: 'id', header: 'รหัส', render: (o) => <span className="font-mono text-xs">{o.id}</span> },
              { key: 'n', header: 'ชื่อ', render: (o) => o.name, hideOnMobile: true },
              { key: 'p', header: 'ตำแหน่ง', render: (o) => o.position },
              { key: 'r', header: 'บทบาท', render: (o) => <Badge tone={o.role === 'admin' ? 'primary' : 'neutral'}>{ROLE_LABEL[o.role]}</Badge> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
