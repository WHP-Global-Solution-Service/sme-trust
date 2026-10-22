import { ClipboardList, Plus } from 'lucide-react';
import { useComplaintStore, useMerchantStore } from '@/stores';
import { useCurrentConsumer } from '@/hooks/useCurrent';
import { COMPLAINT_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Card, EmptyState, LinkButton, ListLink, PageHeader, StatusBadge } from '@/components/common/ui';

export default function ConsumerCases() {
  const consumer = useCurrentConsumer();
  const complaints = useComplaintStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const mine = complaints.filter((c) => c.consumerId === consumer.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const needAction = mine.filter((c) => c.status === 'waiting_consumer' || c.offers.some((o) => o.status === 'pending'));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="เรื่องของฉัน" subtitle={`${consumer.name} · ติดตามสถานะการแจ้งปัญหา`} icon={ClipboardList} action={<LinkButton to="/report" icon={Plus}>แจ้งปัญหาใหม่</LinkButton>} />
      {needAction.length > 0 && <p className="mb-3 rounded-xl bg-primary-50 px-4 py-2.5 text-sm text-primary">มี {needAction.length} เรื่องที่รอคุณตอบข้อเสนอหรือยืนยันผล</p>}
      <Card>
        {mine.length ? (
          <div className="divide-y divide-line">
            {mine.map((c) => (
              <ListLink
                key={c.id}
                to={`/consumer/cases/${c.id}`}
                title={c.title}
                subtitle={`${c.id} · ${merchants.find((m) => m.id === c.merchantId)?.shopName} · อัปเดต ${fmtDate(c.updatedAt)}`}
                right={<StatusBadge map={COMPLAINT_STATUS} value={c.status} />}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="ยังไม่มีเรื่องที่แจ้ง" desc="หากพบปัญหาการซื้อขาย สามารถแจ้งได้ที่ปุ่มด้านบน" action={<LinkButton to="/report">แจ้งปัญหา</LinkButton>} />
        )}
      </Card>
    </div>
  );
}
