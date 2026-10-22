import { useState } from 'react';
import { CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import type { ChannelStatus } from '@/types';
import { useMerchantStore, confirmDialog, toast } from '@/stores';
import { setChannelStatus } from '@/stores/workflows';
import { CHANNEL_STATUS, CHANNEL_TYPES } from '@/constants/labels';
import { Alert, Button, Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';

/** ตรวจสอบช่องทางขายรายช่องทาง — การยืนยันเจ้าของร้านไม่เท่ากับการยืนยันทุกบัญชี */
export default function ChannelVerification() {
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState<ChannelStatus>('pending');
  const rows = merchants.flatMap((m) => m.channels.map((c) => ({ ...c, id: `${m.id}:${c.id}`, channelId: c.id, merchant: m })));
  const list = rows.filter((r) => r.status === tab);

  const decide = async (r: (typeof rows)[number], status: ChannelStatus) => {
    const res = await confirmDialog({
      title: status === 'verified' ? 'ยืนยันช่องทางขาย' : 'ช่องทางไม่ผ่านการตรวจสอบ',
      body: status === 'verified' ? `ยืนยันว่า ${r.handle} เป็นของ ${r.merchant.shopName} (การตรวจจำลอง เช่น ให้ร้านโพสต์รหัสยืนยัน)` : undefined,
      reasonLabel: status === 'rejected' ? 'เหตุผล' : undefined,
      tone: status === 'rejected' ? 'danger' : 'primary',
    });
    if (!res.ok) return;
    setChannelStatus(r.merchant.id, r.channelId, status, res.reason);
    toast.success('บันทึกผลแล้ว', `${CHANNEL_TYPES[r.type].label}: ${r.handle}`);
  };

  return (
    <div>
      <PageHeader title="Verification — ช่องทางขาย" subtitle="ตรวจสอบความเป็นเจ้าของบัญชีขายแต่ละช่องทางแยกกัน" icon={ListChecks} />
      <Alert tone="info" className="mb-4">การยืนยันตัวตนเจ้าของร้านหนึ่งครั้ง ไม่ถือว่าบัญชี Social Media ทุกบัญชีผ่านการตรวจสอบแล้ว</Alert>
      <div className="mb-3">
        <Tabs value={tab} onChange={setTab} tabs={(Object.keys(CHANNEL_STATUS) as ChannelStatus[]).map((s) => ({ value: s, label: CHANNEL_STATUS[s].label, count: rows.filter((r) => r.status === s).length }))} />
      </div>
      <Card>
        <DataTable
          rows={list}
          mobileTitle={(r) => r.merchant.shopName}
          columns={[
            { key: 'shop', header: 'ร้านค้า', render: (r) => r.merchant.shopName, sort: (r) => r.merchant.shopName, hideOnMobile: true },
            { key: 'type', header: 'ช่องทาง', render: (r) => CHANNEL_TYPES[r.type].label },
            { key: 'handle', header: 'บัญชี', render: (r) => <span className="break-all">{r.handle}</span> },
            { key: 'status', header: 'สถานะ', render: (r) => <StatusBadge map={CHANNEL_STATUS} value={r.status} /> },
            {
              key: 'act',
              header: 'ดำเนินการ',
              render: (r) =>
                r.status === 'verified' ? (
                  <span className="text-xs text-ink-soft">—</span>
                ) : (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => decide(r, 'verified')}>ยืนยัน</Button>
                    {r.status !== 'rejected' && <Button size="sm" variant="outline" icon={XCircle} onClick={() => decide(r, 'rejected')}>ไม่ผ่าน</Button>}
                  </div>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
