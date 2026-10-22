import { Paperclip } from 'lucide-react';
import type { Complaint, ComplaintStatus } from '@/types';
import { COMPLAINT_CATEGORY, COMPLAINT_STATUS, OFFER_STATUS, OFFER_TYPE } from '@/constants/labels';
import { fmtDate, fmtMoney } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Badge, InfoRow, StatusBadge } from '@/components/common/ui';
import { DocList } from '@/components/forms/MockUpload';

const FLOW: ComplaintStatus[] = ['submitted', 'awaiting_merchant', 'merchant_responded', 'waiting_consumer', 'resolved'];

/** แถบความคืบหน้าของเคส */
export function CaseProgress({ status }: { status: ComplaintStatus }) {
  if (status === 'escalated' || status === 'closed')
    return (
      <div className="flex items-center gap-2 rounded-xl bg-bg p-3 text-sm">
        <StatusBadge map={COMPLAINT_STATUS} value={status} />
        <span className="text-ink-soft">{status === 'escalated' ? 'อยู่ระหว่างเจ้าหน้าที่พิจารณาภายในระบบสาธิต' : 'เรื่องนี้ปิดแล้ว'}</span>
      </div>
    );
  const idx = FLOW.indexOf(status);
  return (
    <div>
      <p className="mb-2 text-sm text-ink sm:hidden">
        ขั้นตอนที่ {idx + 1}/{FLOW.length}: <b className="text-primary">{COMPLAINT_STATUS[status].label}</b>
        {idx < FLOW.length - 1 && <span className="text-ink-soft"> · ถัดไป: {COMPLAINT_STATUS[FLOW[idx + 1]].label}</span>}
      </p>
      <ol className="grid grid-cols-5 gap-1" aria-label="ความคืบหน้าของเรื่อง">
        {FLOW.map((s, i) => (
          <li key={s} className="min-w-0" aria-current={i === idx ? 'step' : undefined}>
            <div className={cn('h-2 rounded-full', i <= idx ? 'bg-primary' : 'bg-line')} />
            <p className={cn('mt-1 hidden text-xs leading-snug sm:block', i === idx ? 'font-semibold text-primary' : 'text-ink-soft')}>{COMPLAINT_STATUS[s].label}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CaseInfo({ c, merchantName, consumerName }: { c: Complaint; merchantName?: string; consumerName?: string }) {
  return (
    <dl className="divide-y divide-line">
      {merchantName && <InfoRow label="ร้านค้า">{merchantName}</InfoRow>}
      {consumerName && <InfoRow label="ผู้ร้องเรียน">{consumerName}</InfoRow>}
      <InfoRow label="ประเภทปัญหา">
        {COMPLAINT_CATEGORY[c.officerCategory ?? c.category]}
        {c.officerCategory && c.officerCategory !== c.category && <span className="block text-xs text-ink-soft">เจ้าหน้าที่ปรับจาก "{COMPLAINT_CATEGORY[c.category]}"</span>}
      </InfoRow>
      <InfoRow label="รายละเอียด">{c.description}</InfoRow>
      <InfoRow label="วันที่เกิดเหตุ">{fmtDate(c.incidentDate)}</InfoRow>
      <InfoRow label="คำสั่งซื้อ / มูลค่า">
        {c.orderRef || '-'} · {fmtMoney(c.orderAmount)}
      </InfoRow>
      <InfoRow label="ยื่นเมื่อ">{fmtDate(c.createdAt, true)}</InfoRow>
      <InfoRow label="หลักฐาน">
        <DocList docs={c.evidence} />
      </InfoRow>
      {c.escalationReason && <InfoRow label="เหตุผลการส่งต่อ">{c.escalationReason}</InfoRow>}
    </dl>
  );
}

export function OfferList({ c }: { c: Complaint }) {
  if (!c.offers.length) return <p className="text-sm text-ink-soft">ยังไม่มีข้อเสนอจากร้านค้า</p>;
  return (
    <ul className="space-y-2">
      {[...c.offers].reverse().map((o) => (
        <li key={o.id} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{OFFER_TYPE[o.type]}</p>
            {o.amount ? <Badge tone="primary">{fmtMoney(o.amount)}</Badge> : null}
            <span className="ml-auto">
              <StatusBadge map={OFFER_STATUS} value={o.status} />
            </span>
          </div>
          <p className="mt-1 text-sm text-ink">{o.note}</p>
          {o.consumerReply && <p className="mt-1 text-sm text-ink-soft">ผู้บริโภคตอบ: {o.consumerReply}</p>}
          <p className="mt-1 text-xs text-ink-soft">{fmtDate(o.createdAt, true)}</p>
        </li>
      ))}
    </ul>
  );
}

export function CaseThread({ c, viewer }: { c: Complaint; viewer: 'consumer' | 'merchant' | 'officer' }) {
  const label = { consumer: 'ผู้บริโภค', merchant: 'ร้านค้า', officer: 'เจ้าหน้าที่', system: 'ระบบ' };
  return (
    <ul className="space-y-3">
      {c.messages.map((m) => {
        const mine = m.from === viewer;
        return (
          <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-bg text-ink')}>
              <p className={cn('mb-0.5 text-[11px] font-medium', mine ? 'text-white/75' : 'text-ink-soft')}>{label[m.from]}</p>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.attachment && (
                <p className={cn('mt-1 flex items-center gap-1 text-xs', mine ? 'text-white/85' : 'text-primary')}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {m.attachment.name}
                </p>
              )}
              <p className={cn('mt-1 text-[10px]', mine ? 'text-white/60' : 'text-ink-soft')}>{fmtDate(m.at, true)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const OPEN_FOR_MERCHANT: ComplaintStatus[] = ['submitted', 'awaiting_merchant', 'merchant_responded'];
