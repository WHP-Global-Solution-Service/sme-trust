import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, CheckCircle2, ListChecks } from 'lucide-react';
import type { ScreeningResult } from '@/types';
import { COMPLAINT_CATEGORY, PRIORITY } from '@/constants/labels';
import { Badge, StatusBadge } from '@/components/common/ui';

/** แสดงผล Complaint Screening Assistant (Rule-based จำลอง) */
export function ScreeningPanel({ s, linkBase = '/consumer/cases' }: { s: ScreeningResult; linkBase?: string }) {
  return (
    <div className="rounded-xl border border-info/25 bg-info-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-5 w-5 text-info" />
        <p className="font-semibold text-ink">Complaint Screening Assistant</p>
        <Badge tone="info">Rule-based จำลอง</Badge>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-ink-soft">Suggested Category</p>
          <p className="font-medium text-ink">{COMPLAINT_CATEGORY[s.suggestedCategory]}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Priority Label</p>
          <StatusBadge map={PRIORITY} value={s.priority} />
        </div>
        <div>
          <p className="text-xs text-ink-soft">ความครบถ้วนของข้อมูล</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <div className={s.completeness >= 80 ? 'h-full bg-success' : s.completeness >= 60 ? 'h-full bg-warning' : 'h-full bg-error'} style={{ width: `${s.completeness}%` }} />
            </div>
            <span className="text-xs font-medium">{s.completeness}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Suggested Next Step</p>
          <p className="text-ink">{s.nextStep}</p>
        </div>
      </div>
      {s.missing.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1 text-xs font-medium text-warning">
            <ListChecks className="h-4 w-4" />
            Missing Information
          </p>
          <ul className="mt-1 list-disc pl-6 text-sm text-ink">
            {s.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {s.duplicateOf.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          อาจเป็นเรื่องซ้ำกับ:
          {s.duplicateOf.map((d) => (
            <Link key={d} to={`${linkBase}/${d}`} className="font-mono underline">
              {d}
            </Link>
          ))}
        </p>
      )}
      {s.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
          {s.reasons.map((r) => (
            <li key={r} className="flex gap-1">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-info/20 pt-2 text-xs text-ink-soft">ผลการประเมินเป็นคำแนะนำจำลองจากกฎอย่างง่าย ไม่ใช่คำตัดสินทางกฎหมาย เจ้าหน้าที่สามารถเปลี่ยนผลการจัดประเภทได้</p>
    </div>
  );
}
