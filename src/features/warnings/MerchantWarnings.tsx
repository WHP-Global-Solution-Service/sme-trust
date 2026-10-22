import { FileWarning } from 'lucide-react';
import { useWarningStore } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { WARNING_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Card, EmptyState, ListLink, PageHeader, SectionTitle, StatusBadge } from '@/components/common/ui';
import { KindBadge, KindExplainer } from './WarningParts';

export default function MerchantWarnings() {
  const { mine } = useMyMerchants();
  const warnings = useWarningStore((s) => s.items);
  const ids = mine.map((m) => m.id);
  const list = warnings.filter((w) => ids.includes(w.merchantId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const open = list.filter((w) => w.status !== 'completed');
  const done = list.filter((w) => w.status === 'completed');

  const render = (arr: typeof list) => (
    <div className="divide-y divide-line">
      {arr.map((w) => (
        <ListLink
          key={w.id}
          to={`/m/warnings/${w.id}`}
          title={w.title}
          subtitle={`${w.id} · ${mine.find((m) => m.id === w.merchantId)?.shopName} · กำหนด ${fmtDate(w.dueDate)}`}
          right={
            <div className="flex flex-col items-end gap-1">
              <KindBadge kind={w.kind} />
              <StatusBadge map={WARNING_STATUS} value={w.status} />
            </div>
          }
        />
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="คำเตือนและการแก้ไข" subtitle="อ่าน รับทราบ และส่งหลักฐานการแก้ไขตามคำแนะนำ" icon={FileWarning} />
      <KindExplainer />
      <SectionTitle>กำลังดำเนินการ ({open.length})</SectionTitle>
      <Card>{open.length ? render(open) : <EmptyState icon={FileWarning} title="ไม่มีคำเตือนหรือคำแนะนำที่ค้างอยู่" desc="ร้านค้าของคุณไม่มีรายการที่ต้องแก้ไข" />}</Card>
      {done.length > 0 && (
        <>
          <SectionTitle>เสร็จสิ้นแล้ว ({done.length})</SectionTitle>
          <Card>{render(done)}</Card>
        </>
      )}
    </div>
  );
}
