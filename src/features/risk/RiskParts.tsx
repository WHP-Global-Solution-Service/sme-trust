import type { RiskCaseStatus } from '@/types';
import { RISK_STATUS } from '@/constants/labels';
import { cn } from '@/utils/cn';

const LADDER: RiskCaseStatus[] = ['allegation', 'under_investigation', 'warning', 'suspended', 'revoked'];

/** แสดงลำดับขั้นของการพิจารณา — แยกข้อกล่าวหาออกจากมาตรการอย่างชัดเจน */
export function RiskLadder({ status }: { status: RiskCaseStatus }) {
  const idx = LADDER.indexOf(status);
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1">
        {LADDER.map((s, i) => (
          <li key={s} className="min-w-0">
            <div className={cn('h-1.5 rounded-full', i <= idx ? (i >= 3 ? 'bg-error' : 'bg-warning') : 'bg-line')} />
            <p className={cn('mt-1 truncate text-[11px] sm:text-xs', s === status ? 'font-semibold text-ink' : 'text-ink-soft')}>{RISK_STATUS[s].label}</p>
          </li>
        ))}
      </ol>
      {['appeal_submitted', 'appeal_reviewed', 'dismissed'].includes(status) && (
        <p className="mt-2 text-sm font-medium text-ink">สถานะปัจจุบัน: {RISK_STATUS[status].label}</p>
      )}
      <p className="mt-2 text-xs text-ink-soft">{RISK_STATUS[status].desc}</p>
    </div>
  );
}
