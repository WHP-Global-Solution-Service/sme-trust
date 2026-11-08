import { CheckCircle2, CircleAlert, CircleDashed, Info, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { LICENSE_DISCLAIMER, VERIFY_LABEL, type DocCheck, type VerifyItem } from './verification';

/** รายการหลักฐานที่ต้องใช้ตามกฎ (Dynamic) — แสดงเฉพาะรายการที่เกี่ยวข้อง */
export function DocumentChecklist({ items }: { items: DocCheck[] }) {
  return (
    <div className="space-y-2" data-testid="doc-requirements">
      <p className="text-sm font-semibold text-ink">หลักฐานที่ต้องใช้สำหรับร้านนี้</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((r) => (
          <li key={r.id} className="flex gap-2 px-3 py-2.5 text-sm" data-req={r.id} data-met={r.met}>
            {r.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : r.level === 'required' ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">
                {r.label} <Badge tone={r.level === 'required' ? 'error' : 'neutral'}>{r.level === 'required' ? 'จำเป็น' : 'แนะนำ'}</Badge>
              </p>
              <p className="text-xs text-ink-soft">
                {r.satisfiedBy ?? (r.matched.length ? `แนบแล้ว: ${r.matched.map((d) => d.kind).join(', ')}` : r.reason)}
                {!r.satisfiedBy && r.kinds.length > 0 && !r.matched.length && ` · แนบได้: ${r.kinds.join(' / ')}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {items.some((r) => r.id === 'license') && (
        <p className="flex gap-1.5 text-xs text-ink-soft">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {LICENSE_DISCLAIMER}
        </p>
      )}
    </div>
  );
}

const ICON = { verified_simulation: CheckCircle2, pending: CircleDashed, missing: CircleAlert, conflicting: CircleAlert, not_required: MinusCircle };
const TONE = { verified_simulation: 'text-success', pending: 'text-warning', missing: 'text-error', conflicting: 'text-error', not_required: 'text-ink-soft' };

/** สรุปการตรวจสอบตัวตนและธุรกิจ (จำลอง) — ใช้ร่วมกันในมุมร้านค้า เจ้าหน้าที่ และขั้นตรวจสอบก่อนส่งคำขอ */
export function VerificationList({ items }: { items: VerifyItem[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line" data-testid="verification-summary">
      {items.map((x) => {
        const Icon = ICON[x.state];
        return (
          <li key={x.id} className="flex gap-2 px-3 py-2.5 text-sm" data-verify={x.id} data-state={x.state}>
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[x.state])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                {x.label} <Badge tone={VERIFY_LABEL[x.state].tone}>{VERIFY_LABEL[x.state].label}</Badge>
              </p>
              <p className="text-xs text-ink-soft">{x.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
