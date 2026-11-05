import { useState } from 'react';
import { FilePen } from 'lucide-react';
import { useMerchantStore, useProfileChangeStore } from '@/stores';
import { Alert, Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { fmtDate } from '@/utils/format';
import { PROFILE_CHANGE_FIELD_LABEL, PROFILE_CHANGE_STATUS, type ProfileChangeStatus } from '../types';

type Tab = 'pending' | 'info_requested' | 'decided' | 'all';

/** คิวคำขอเปลี่ยนชื่อร้าน/หมวดของร้านที่ได้รับการรับรอง (เจ้าหน้าที่) */
export default function OfficerProfileChanges() {
  const items = useProfileChangeStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState<Tab>('pending');
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const decided = (s: ProfileChangeStatus) => s === 'approved' || s === 'rejected';
  const rows = items
    .filter((r) => (tab === 'all' ? true : tab === 'decided' ? decided(r.status) : r.status === tab))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  const count = (t: Tab) => items.filter((r) => (t === 'all' ? true : t === 'decided' ? decided(r.status) : r.status === t)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="คำขอเปลี่ยนข้อมูลร้าน" subtitle="ชื่อร้านและหมวดธุรกิจที่ผูกกับใบรับรอง — ข้อมูลเดิมยังใช้อยู่จนกว่าเจ้าหน้าที่อนุมัติ" icon={FilePen} />
      <Alert tone="info">ระบบไม่อนุมัติอัตโนมัติ · การอนุมัติเปลี่ยนเฉพาะข้อมูลในคำขอ ไม่เปลี่ยนระดับหรือสถานะใบรับรอง · ข้อมูลต้นฉบับจาก Marketplace (จำลอง) ไม่เปลี่ยน</Alert>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: 'รอพิจารณา', count: count('pending') },
          { value: 'info_requested', label: 'รอร้านส่งข้อมูลเพิ่ม', count: count('info_requested') },
          { value: 'decided', label: 'พิจารณาแล้ว', count: count('decided') },
          { value: 'all', label: 'ทั้งหมด', count: items.length },
        ]}
      />
      <Card>
        <DataTable
          rows={rows}
          rowLink={(r) => `/o/profile-changes/${r.id}`}
          mobileTitle={(r) => shop(r.merchantId)}
          empty="ไม่มีคำขอในหมวดนี้"
          columns={[
            { key: 'id', header: 'เลขที่', render: (r) => <span className="font-mono text-xs">{r.id}</span>, sort: (r) => r.id },
            { key: 'shop', header: 'ร้านค้า', render: (r) => `${shop(r.merchantId)} (${r.merchantId})`, hideOnMobile: true, sort: (r) => shop(r.merchantId) },
            { key: 'fields', header: 'ข้อมูลที่ขอเปลี่ยน', render: (r) => r.changes.map((c) => PROFILE_CHANGE_FIELD_LABEL[c.field]).join(', ') },
            { key: 'st', header: 'สถานะ', render: (r) => <StatusBadge map={PROFILE_CHANGE_STATUS} value={r.status} /> },
            { key: 'at', header: 'อัปเดตล่าสุด', render: (r) => fmtDate(r.updatedAt, true), sort: (r) => r.updatedAt },
          ]}
        />
      </Card>
    </div>
  );
}
