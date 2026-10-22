import { History, MessageSquareHeart, ScanText, Trash2 } from 'lucide-react';
import type { AiHistoryEntry } from '../types/ai.types';
import { useAiHistoryStore, confirmDialog, toast } from '@/stores';
import { clearAiHistory } from '@/stores/workflows';
import { fmtDate } from '@/utils/format';
import { Badge, Button, EmptyState } from '@/components/common/ui';
import { AiDisclaimer, AiHeader, SectionCard } from '../components/AiCommon';

const TONE: Record<string, 'error' | 'warning' | 'success' | 'neutral'> = { High: 'error', 'Urgent Review': 'error', Medium: 'warning', Attention: 'warning', Low: 'success', Normal: 'neutral' };

export function HistoryList({ items }: { items: AiHistoryEntry[] }) {
  if (!items.length) return <EmptyState icon={History} title="ยังไม่มีประวัติการวิเคราะห์" desc="ผลการวิเคราะห์จะถูกบันทึกที่นี่ (ล่าสุด 20 รายการ)" />;
  return (
    <ul className="divide-y divide-line">
      {items.map((h) => {
        const Icon = h.type === 'advertising' ? ScanText : MessageSquareHeart;
        return (
          <li key={h.id} className="flex items-start gap-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{h.type === 'advertising' ? 'ตรวจข้อความโฆษณา' : 'วิเคราะห์ข้อร้องเรียน'} · {h.resultCategory}</p>
              <p className="truncate text-xs text-ink-soft">
                {h.source} · {fmtDate(h.createdAt, true)} · <span className="font-mono">{h.id}</span>
              </p>
            </div>
            <Badge tone={TONE[h.level] ?? 'neutral'}>{h.level}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

/** AI Activity History — เก็บในเบราว์เซอร์ ล่าสุด 20 รายการ */
export default function AIHistory() {
  const items = useAiHistoryStore((s) => s.items);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AiHeader icon={History} title="ประวัติการใช้งาน AI" desc="AI Activity History — บันทึกล่าสุด 20 รายการในเบราว์เซอร์นี้" back={{ to: '/m/ai', label: 'AI ผู้ช่วย SME' }} />
      <AiDisclaimer compact />
      <SectionCard
        title={`ประวัติ (${items.length}/20)`}
        icon={History}
        action={
          <Button
            size="sm"
            variant="outline"
            icon={Trash2}
            disabled={!items.length}
            onClick={async () => {
              const r = await confirmDialog({ title: 'ล้างประวัติทั้งหมด?', body: 'ประวัติการวิเคราะห์ในเบราว์เซอร์นี้จะถูกลบ (Reset Demo Data จะคืนประวัติตัวอย่าง)', confirmText: 'ล้างประวัติ', tone: 'danger' });
              if (!r.ok) return;
              clearAiHistory();
              toast.success('ล้างประวัติแล้ว');
            }}
          >
            Clear History
          </Button>
        }
      >
        <HistoryList items={items} />
        <p className="mt-3 text-xs text-ink-soft">เพื่อความเป็นส่วนตัว ระบบบันทึกเฉพาะชื่อตัวอย่างหรือเลขเคส ไม่บันทึกข้อความที่ผู้ใช้พิมพ์เอง</p>
      </SectionCard>
    </div>
  );
}
