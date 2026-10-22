import { Link } from 'react-router-dom';
import { BookOpen, CheckSquare, Info, Square } from 'lucide-react';
import type { WarningRecord } from '@/types';
import { courses } from '@/mock/data';
import { WARNING_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Badge, StatusBadge } from '@/components/common/ui';

export function KindBadge({ kind }: { kind: WarningRecord['kind'] }) {
  return kind === 'advisory' ? <Badge tone="info">คำแนะนำ (ไม่ใช่การลงโทษ)</Badge> : <Badge tone="warning">คำเตือน</Badge>;
}

/** อธิบายความต่างระหว่างคำแนะนำ / คำเตือน / มาตรการ */
export function KindExplainer() {
  return (
    <Alert tone="neutral" icon={Info}>
      <b>คำแนะนำ (Advisory)</b> = ข้อแนะนำเพื่อปรับปรุง ไม่มีผลต่อสถานะการรับรอง · <b>คำเตือน (Warning)</b> = ต้องแก้ไขภายในกำหนด ·{' '}
      <b>มาตรการ (ระงับ/เพิกถอน)</b> = พิจารณาแยกต่างหากในเมนูความเสี่ยง โดยต้องมีเหตุผลและเปิดให้ชี้แจงเสมอ
    </Alert>
  );
}

export function WarningSummary({ w }: { w: WarningRecord }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={w.kind} />
        <StatusBadge map={WARNING_STATUS} value={w.status} />
        <span className="text-xs text-ink-soft">กำหนดแก้ไข {fmtDate(w.dueDate)}</span>
      </div>
      <div>
        <p className="text-xs font-medium text-ink-soft">ประเด็นที่พบ</p>
        <p className="text-sm text-ink">{w.issue}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-ink-soft">แนวทางแก้ไข</p>
        <p className="text-sm text-ink">{w.guidance}</p>
      </div>
      {w.relatedComplaintIds.length > 0 && <p className="text-xs text-ink-soft">อ้างอิงข้อร้องเรียน: {w.relatedComplaintIds.join(', ')}</p>}
    </div>
  );
}

export function CorrectiveChecklist({ w, onToggle }: { w: WarningRecord; onToggle?: (itemId: string) => void }) {
  if (!w.items.length) return <p className="text-sm text-ink-soft">ไม่มีรายการที่ต้องแก้ไข</p>;
  return (
    <ul className="space-y-2">
      {w.items.map((i) => {
        const Icon = i.done ? CheckSquare : Square;
        return (
          <li key={i.id}>
            <button disabled={!onToggle} onClick={() => onToggle?.(i.id)} className={cn('flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm', onToggle && 'hover:bg-bg')}>
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', i.done ? 'text-success' : 'text-ink-soft')} />
              <span className={i.done ? 'text-ink-soft line-through' : 'text-ink'}>{i.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LinkedCourses({ ids, href = (id) => `/m/training/${id}` }: { ids: string[]; href?: (id: string) => string }) {
  if (!ids.length) return null;
  return (
    <ul className="space-y-2">
      {ids.map((id) => {
        const c = courses.find((x) => x.id === id);
        if (!c) return null;
        return (
          <li key={id}>
            <Link to={href(id)} className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary hover:underline">
              <BookOpen className="h-4 w-4 shrink-0" />
              {c.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
