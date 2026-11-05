import { Link } from 'react-router-dom';
import { useProfileChangeStore } from '@/stores';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { fmtDate } from '@/utils/format';
import { Alert, Card, CardHeader, StatusBadge } from '@/components/common/ui';
import { PROFILE_CHANGE_ACTION_LABEL, PROFILE_CHANGE_FIELD_LABEL, PROFILE_CHANGE_STATUS, isOpenChange, type ProfileChange, type ProfileChangeRequest } from './types';

/** ตารางเทียบ: ข้อมูลเดิม (โปรไฟล์/ใบรับรอง) · ข้อมูลใหม่ที่ขอ · ข้อมูลต้นฉบับจาก Marketplace (จำลอง) */
export function ChangeTable({ changes, req }: { changes: ProfileChange[]; req: Pick<ProfileChangeRequest, 'source'> }) {
  const platform = req.source ? PLATFORMS[req.source.platform].label : 'Marketplace';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm" data-testid="change-table">
        <thead className="bg-bg text-xs text-ink-soft">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">ข้อมูล</th>
            <th scope="col" className="px-3 py-2 font-medium">ข้อมูลเดิม (โปรไฟล์/ใบรับรอง)</th>
            <th scope="col" className="px-3 py-2 font-medium">ข้อมูลใหม่ที่ขอ</th>
            <th scope="col" className="px-3 py-2 font-medium">ต้นฉบับจาก {platform} (อ่านอย่างเดียว)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {changes.map((x) => (
            <tr key={x.field} data-field={x.field}>
              <th scope="row" className="px-3 py-2.5 font-medium text-ink">{PROFILE_CHANGE_FIELD_LABEL[x.field]}</th>
              <td className="px-3 py-2.5 text-ink" data-col="from">{x.from}</td>
              <td className="px-3 py-2.5 font-semibold text-primary" data-col="to">{x.to}</td>
              <td className="px-3 py-2.5 text-ink-soft" data-col="source">{x.source ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ประวัติการพิจารณา (ใหม่สุดอยู่ล่าง) */
export function ChangeHistory({ req }: { req: ProfileChangeRequest }) {
  return (
    <Card>
      <CardHeader title="ประวัติการพิจารณา" />
      <ol className="divide-y divide-line text-sm" aria-label="ประวัติการพิจารณา">
        {req.history.map((h, i) => (
          <li key={i} className="px-4 py-2.5 sm:px-5" data-action={h.action}>
            <p className="font-medium text-ink">{PROFILE_CHANGE_ACTION_LABEL[h.action]}</p>
            <p className="text-xs text-ink-soft">
              {fmtDate(h.at, true)} · {h.actorName}
            </p>
            {h.note && <p className="mt-1 text-ink">“{h.note}”</p>}
            {h.changes && <p className="mt-1 text-xs text-ink-soft">{h.changes.map((c) => `${PROFILE_CHANGE_FIELD_LABEL[c.field]}: ${c.to}`).join(' · ')}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** สถานะคำขอที่ยังเปิดอยู่หรือล่าสุดของร้าน — ใช้ในหน้าอัปเดตโปรไฟล์และหน้าตรวจของเจ้าหน้าที่ */
export function ChangeRequestNotice({ merchantId, role, className }: { merchantId: string; role: 'merchant' | 'officer'; className?: string }) {
  const req = useProfileChangeStore((s) => s.items.filter((r) => r.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]);
  if (!req) return null;
  const to = role === 'officer' ? `/o/profile-changes/${req.id}` : `/m/profile-changes/${req.id}`;
  const open = isOpenChange(req);
  return (
    <Alert tone={req.status === 'info_requested' ? 'info' : open ? 'warning' : req.status === 'approved' ? 'success' : 'error'} className={className} title={`คำขอเปลี่ยนข้อมูลร้าน ${req.id}`}>
      <span className="mr-2 inline-block align-middle">
        <StatusBadge map={PROFILE_CHANGE_STATUS} value={req.status} />
      </span>
      {req.changes.map((c) => `${PROFILE_CHANGE_FIELD_LABEL[c.field]}: "${c.from}" → "${c.to}"`).join(' · ')}
      {open && ' — ข้อมูลเดิมยังใช้อยู่จนกว่าเจ้าหน้าที่อนุมัติ'}{' '}
      <Link to={to} className="font-medium text-primary underline">
        {role === 'officer' ? (req.status === 'pending' ? 'พิจารณาคำขอ' : 'ดูคำขอ') : req.status === 'info_requested' ? 'ส่งข้อมูลเพิ่มเติม' : 'ดูสถานะคำขอ'}
      </Link>
    </Alert>
  );
}
