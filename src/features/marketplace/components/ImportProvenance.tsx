import { AlertTriangle, CheckCircle2, Clock, Lock, PencilLine, PenLine, ShieldCheck, Store } from 'lucide-react';
import type { MarketplaceConnection } from '../types';
import type { FieldRow, FieldStatus, ImportSource, ImportSummary, MarketplaceImportRecord } from '../autofill';
import { FIELD_LABEL, FIELD_STATUS_LABEL } from '../autofill';
import { PLATFORMS } from '../data/platforms';
import { CONNECTION_STATUS } from './MarketplaceParts';
import { Badge, Card } from '@/components/common/ui';
import type { Tone } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const n = (x: number) => x.toLocaleString('th-TH');

const STATUS_TONE: Record<FieldStatus, Tone> = { imported: 'info', user_edited: 'primary', manual: 'neutral', missing: 'error', verification_required: 'warning' };
const STATUS_ICON = { imported: CheckCircle2, user_edited: PencilLine, manual: PenLine, missing: AlertTriangle, verification_required: Clock } as const;

/** ป้ายที่มาของข้อมูล — "นำเข้าจาก Shopee (จำลอง)" / "ผู้สมัครแก้ไข" / "ต้องกรอกเพิ่ม" / "รอการตรวจสอบ" */
export function FieldStatusBadge({ status, source, registeredLabel }: { status: FieldStatus; source?: ImportSource; registeredLabel?: boolean }) {
  const Icon = STATUS_ICON[status];
  const label = status === 'imported' && source ? `นำเข้าจาก ${PLATFORMS[source.platform].label}` : status === 'manual' && registeredLabel ? 'ข้อมูลเดิมในระบบ' : FIELD_STATUS_LABEL[status];
  return (
    <Badge tone={STATUS_TONE[status]} className="gap-1" >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** สรุปการนำเข้า: นำเข้าสำเร็จ / ต้องกรอกเพิ่ม / แก้ไข */
export function ImportSummaryBar({ summary }: { summary: ImportSummary }) {
  const items: [string, number, string][] = [
    ['นำเข้าสำเร็จ', summary.imported, 'text-info'],
    ['ต้องกรอกเพิ่ม', summary.missing, summary.missing ? 'text-error' : 'text-ink'],
    ['ข้อมูลที่แก้ไข', summary.edited, 'text-primary'],
    ['รอการตรวจสอบ', summary.verification, summary.verification ? 'text-warning' : 'text-ink'],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="สรุปการนำเข้าข้อมูล" data-testid="import-summary">
      {items.map(([label, value, cls]) => (
        <div key={label} className="rounded-lg bg-bg p-2.5 text-center">
          <dt className="text-xs text-ink-soft">{label}</dt>
          <dd className={cn('text-lg font-bold', cls)}>{value} รายการ</dd>
        </div>
      ))}
    </dl>
  );
}

/** ข้อมูลต้นฉบับจาก Marketplace — อ่านอย่างเดียว (แก้ในแบบฟอร์มไม่เปลี่ยนส่วนนี้) */
export function SourceDataCard({ source, connection, compact }: { source: ImportSource; connection?: MarketplaceConnection; compact?: boolean }) {
  const rows: [string, string][] = [
    ['Marketplace Shop ID', source.mockShopId],
    ['ชื่อร้านต้นฉบับ', source.shopName],
    ['ลิงก์ร้านต้นฉบับ (จำลอง)', source.shopUrl],
    ['หมวดสินค้าบนแพลตฟอร์ม', source.categories.length ? source.categories.join(', ') : source.category],
    ['คะแนนร้าน', source.reviewCount ? `${source.rating.toFixed(2)} ดาว` : 'ยังไม่มีรีวิว'],
    ['จำนวนรีวิว', `${n(source.reviewCount)} รีวิว`],
    ['ยอดขาย (คำสั่งซื้อ 12 เดือน)', `${n(source.salesVolume)} คำสั่งซื้อ`],
    ['ซิงก์ล่าสุด', fmtDate(source.lastSyncAt, true)],
  ];
  return (
    <section className="rounded-xl border border-line bg-white" aria-label="ข้อมูลต้นฉบับจาก Marketplace (อ่านอย่างเดียว)" data-testid="source-data">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: `hsl(${source.avatar.hue} 45% 45%)` }} aria-hidden>
          {source.avatar.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{source.shopName}</p>
          <p className="text-xs text-ink-soft">{PLATFORMS[source.platform].label} · รูปร้านจำลอง</p>
        </div>
        <Badge tone="neutral" className="gap-1">
          <Lock className="h-3 w-3" aria-hidden />
          อ่านอย่างเดียว
        </Badge>
        {connection && <Badge tone={CONNECTION_STATUS[connection.status].tone}>{CONNECTION_STATUS[connection.status].label}</Badge>}
      </header>
      <dl className="grid gap-x-4 px-3 py-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line/60 py-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {!compact && (
        <div className="border-t border-line px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-ink-soft">สินค้าและราคาต้นฉบับ ({source.products.length} รายการ)</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {source.products.map((p) => (
              <li key={p.name} className="flex justify-between gap-2 rounded bg-bg px-2 py-1">
                <span className="truncate text-ink">{p.name}</span>
                <span className="shrink-0 font-medium text-ink">{n(p.price)} บาท</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="border-t border-line px-3 py-2 text-[11px] text-ink-soft">ข้อมูลสมมติที่สร้างในเบราว์เซอร์ — ไม่มีการเชื่อมต่อ API จริง · การแก้ข้อมูลในแบบฟอร์มไม่เปลี่ยนข้อมูลส่วนนี้ และการประเมินใช้ข้อมูลส่วนนี้</p>
    </section>
  );
}

/** ตารางเทียบ: ค่าต้นฉบับ / ข้อมูลเดิม / ค่าปัจจุบัน พร้อมสถานะ */
export function FieldDiffTable({ rows, source, showRegistered }: { rows: FieldRow[]; source?: ImportSource; showRegistered?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm" data-testid="field-diff">
        <thead className="text-xs text-ink-soft">
          <tr className="border-b border-line">
            <th className="py-2 pr-2 font-medium">ช่องข้อมูล</th>
            {showRegistered && <th className="py-2 pr-2 font-medium">ข้อมูลเดิมในระบบ</th>}
            <th className="py-2 pr-2 font-medium">ข้อมูลจาก Marketplace</th>
            <th className="py-2 pr-2 font-medium">{showRegistered ? 'ข้อมูลที่ส่ง' : 'ข้อมูลในคำขอ'}</th>
            <th className="py-2 font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const changed = r.status === 'user_edited' || r.status === 'verification_required';
            return (
              <tr key={r.key} className={cn('border-b border-line/60 align-top', changed && 'bg-primary-50/40')} data-field={r.key} data-status={r.status}>
                <td className="py-2 pr-2 font-medium text-ink">{FIELD_LABEL[r.key]}</td>
                {showRegistered && <td className="max-w-[14rem] py-2 pr-2 text-ink-soft">{r.registered || '—'}</td>}
                <td className="max-w-[14rem] py-2 pr-2 text-ink-soft">{r.imported ?? <span className="italic">ไม่มีในแหล่งข้อมูล</span>}</td>
                <td className={cn('max-w-[14rem] py-2 pr-2', changed ? 'font-medium text-ink' : 'text-ink')}>{r.current || '—'}</td>
                <td className="py-2">
                  <FieldStatusBadge status={r.status} source={source} registeredLabel={showRegistered} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * มุมเจ้าหน้าที่: ข้อมูลที่นำเข้า เทียบกับข้อมูลในคำขอ/โปรไฟล์ — ช่องที่แก้ ช่องที่ขาด แหล่งข้อมูล สถานะการเชื่อมต่อ
 * ผลประเมิน และสถานะยืนยันตัวตน
 */
export function ImportReviewPanel({
  record,
  connection,
  assessmentLabel,
  identityVerified,
}: {
  record: MarketplaceImportRecord;
  connection?: MarketplaceConnection;
  assessmentLabel?: string;
  identityVerified: boolean;
}) {
  const modified = record.rows.filter((r) => r.status === 'user_edited' || r.status === 'verification_required');
  const missing = record.rows.filter((r) => r.status === 'missing');
  const update = record.mode === 'profile_update';
  return (
    <Card className="p-4" >
      <section aria-label="ข้อมูลที่นำเข้าจาก Marketplace" data-testid="import-review">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Store className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-semibold text-ink">{update ? 'ร้านอัปเดตโปรไฟล์จากข้อมูลที่นำเข้า' : 'คำขอนี้เติมข้อมูลจาก Marketplace'}</h2>
          <Badge tone="info">{PLATFORMS[record.source.platform].label}</Badge>
          <span className="text-xs text-ink-soft">
            {record.id} · {fmtDate(record.createdAt, true)}
          </span>
        </div>
        <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-bg p-2.5">
            <dt className="text-xs text-ink-soft">แหล่งข้อมูล</dt>
            <dd className="font-medium text-ink">
              {PLATFORMS[record.source.platform].label} · {record.source.mockShopId}
            </dd>
          </div>
          <div className="rounded-lg bg-bg p-2.5">
            <dt className="text-xs text-ink-soft">สถานะการเชื่อมต่อ</dt>
            <dd className="font-medium text-ink">{connection ? CONNECTION_STATUS[connection.status].label : 'ไม่พบการเชื่อมต่อ'}</dd>
          </div>
          <div className="rounded-lg bg-bg p-2.5">
            <dt className="text-xs text-ink-soft">ผลประเมิน</dt>
            <dd className="font-medium text-ink">{assessmentLabel ?? 'ยังไม่ได้ประเมิน'}</dd>
          </div>
          <div className="rounded-lg bg-bg p-2.5">
            <dt className="text-xs text-ink-soft">การยืนยันตัวตน</dt>
            <dd className={cn('flex items-center gap-1 font-medium', identityVerified ? 'text-success' : 'text-warning')}>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {identityVerified ? 'ยืนยันแล้ว (Mock e-KYC)' : 'ยังไม่ยืนยันตัวตน'}
            </dd>
          </div>
        </dl>
        <ImportSummaryBar summary={record.summary} />
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-lg border border-line p-2.5" data-testid="modified-fields">
            <b className="text-ink">ช่องที่ผู้สมัครแก้ไข:</b> {modified.length ? modified.map((r) => r.label).join(', ') : 'ไม่มี'}
          </p>
          <p className="rounded-lg border border-line p-2.5" data-testid="missing-fields">
            <b className="text-ink">ช่องที่ยังขาด:</b> {missing.length ? missing.map((r) => r.label).join(', ') : 'ไม่มี'}
          </p>
        </div>
        {record.pending.length > 0 && (
          <p className="mt-2 rounded-lg bg-warning-50 p-2.5 text-sm text-warning">
            รอการตรวจสอบ (ยังไม่เปลี่ยนในโปรไฟล์ร้าน): {record.pending.map((k) => FIELD_LABEL[k]).join(', ')}
          </p>
        )}
        <div className="mt-3">
          <FieldDiffTable rows={record.rows} source={record.source} showRegistered={update} />
        </div>
        <div className="mt-3">
          <SourceDataCard source={record.source} connection={connection} compact />
        </div>
      </section>
    </Card>
  );
}
