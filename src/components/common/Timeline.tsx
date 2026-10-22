import type { TimelineEvent } from '@/types';
import { ROLE_LABEL } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const dot: Record<TimelineEvent['actor'], string> = {
  merchant: 'bg-primary',
  consumer: 'bg-info',
  officer: 'bg-secondary',
  admin: 'bg-ink',
  system: 'bg-slate-400',
};

export function Timeline({ events, newestFirst = true }: { events: TimelineEvent[]; newestFirst?: boolean }) {
  const list = [...events].sort((a, b) => (newestFirst ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
  if (!list.length) return <p className="text-sm text-ink-soft">ยังไม่มีประวัติ</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {list.map((e) => (
        <li key={e.id} className="relative">
          <span className={cn('absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white', dot[e.actor])} />
          <p className="text-sm font-medium text-ink">{e.title}</p>
          {e.note && <p className="mt-0.5 text-sm text-ink-soft">{e.note}</p>}
          <p className="mt-0.5 text-xs text-ink-soft">
            {fmtDate(e.at, true)} · {e.actorName ?? ROLE_LABEL[e.actor]}
          </p>
        </li>
      ))}
    </ol>
  );
}
