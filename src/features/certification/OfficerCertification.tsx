import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Ban, Clock, RefreshCw, RotateCcw, ShieldOff } from 'lucide-react';
import type { CertStatus } from '@/types';
import { useCertificationStore, useMerchantStore, confirmDialog, toast } from '@/stores';
import { certStatusBlocker, expireCertificate, openRiskCaseOf, renewCertificate, setCertStatus } from '@/stores/workflows';
import { CERT_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, PageHeader, StatusBadge, Tabs } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox } from '@/components/forms/Field';

const DAY = 86400_000;

export default function OfficerCertification() {
  const certs = useCertificationStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const [tab, setTab] = useState<CertStatus | 'all' | 'expiring'>('all');
  const [q, setQ] = useState('');
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const expiring = (exp: string) => new Date(exp).getTime() - Date.now() < 90 * DAY;
  const rows = certs
    .filter((c) => !c.supersededBy)
    .filter((c) => (tab === 'all' ? true : tab === 'expiring' ? c.status === 'active' && expiring(c.expiresAt) : c.status === tab))
    .filter((c) => !q || `${c.id} ${shop(c.merchantId)}`.includes(q))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  const act = async (id: string, action: 'suspend' | 'revoke' | 'reinstate' | 'renew' | 'expire') => {
    const cfg = {
      suspend: { t: 'ระงับใบรับรอง', reason: 'เหตุผลการระงับ', danger: true },
      revoke: { t: 'เพิกถอนใบรับรอง', reason: 'เหตุผลการเพิกถอน', danger: true },
      reinstate: { t: 'คืนสถานะใบรับรอง', reason: 'เหตุผล', danger: false },
      renew: { t: 'ต่ออายุใบรับรอง 1 ปี', reason: undefined, danger: false },
      expire: { t: 'จำลองใบรับรองหมดอายุ', reason: undefined, danger: true },
    }[action];
    const r = await confirmDialog({ title: cfg.t, reasonLabel: cfg.reason, tone: cfg.danger ? 'danger' : 'primary', body: action === 'suspend' || action === 'revoke' ? 'แนะนำให้ดำเนินการผ่าน Risk Reviews เพื่อเปิดโอกาสให้ร้านค้าชี้แจง' : undefined });
    if (!r.ok) return;
    if (action === 'renew') renewCertificate(id);
    else if (action === 'expire') expireCertificate(id);
    else {
      const res = setCertStatus(id, action === 'suspend' ? 'suspended' : action === 'revoke' ? 'revoked' : 'active', r.reason!);
      if (!res.ok) return toast.error('ดำเนินการไม่ได้', res.error);
    }
    toast.success(cfg.t, id);
  };

  return (
    <div>
      <PageHeader title="Certification" subtitle="ทะเบียนใบรับรอง (ฉบับปัจจุบันของแต่ละร้าน)" icon={BadgeCheck} />
      <Alert tone="info" className="mb-4">ใบรับรองที่ถูกระงับหรือเพิกถอนจะแสดงว่าใช้งานไม่ได้ทันทีในหน้าตรวจสอบสาธารณะและ QR</Alert>
      <div className="mb-3 flex flex-col gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาเลขใบรับรองหรือชื่อร้าน" />
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'expiring', label: 'ใกล้หมดอายุ (90 วัน)' },
            ...(Object.keys(CERT_STATUS) as CertStatus[]).map((s) => ({ value: s, label: CERT_STATUS[s].label })),
          ]}
        />
      </div>
      <Card>
        <DataTable
          rows={rows}
          mobileTitle={(c) => shop(c.merchantId)}
          columns={[
            { key: 'id', header: 'เลขใบรับรอง', render: (c) => <Link to={`/verify/${c.id}`} className="font-mono text-xs text-primary hover:underline">{c.id}</Link>, sort: (c) => c.id },
            { key: 'shop', header: 'ร้านค้า', render: (c) => shop(c.merchantId), hideOnMobile: true },
            { key: 'lvl', header: 'ระดับ', render: (c) => `L${c.level} ${TRUST_LEVELS[c.level].name}`, sort: (c) => c.level },
            { key: 'st', header: 'สถานะ', render: (c) => <StatusBadge map={CERT_STATUS} value={c.status} /> },
            { key: 'exp', className: 'whitespace-nowrap', header: 'หมดอายุ', render: (c) => <span className={c.status === 'active' && expiring(c.expiresAt) ? 'font-medium text-warning' : ''}>{fmtDate(c.expiresAt)}</span>, sort: (c) => c.expiresAt },
            {
              key: 'act',
              header: 'ดำเนินการ',
              render: (c) => (
                <div className="flex flex-wrap gap-1">
                  {c.status === 'active' && (
                    <>
                      <Button size="sm" variant="outline" icon={Ban} onClick={() => act(c.id, 'suspend')}>ระงับ</Button>
                      <Button size="sm" variant="ghost" icon={Clock} onClick={() => act(c.id, 'expire')}>จำลองหมดอายุ</Button>
                    </>
                  )}
                  {c.status === 'suspended' && certStatusBlocker(c.id, 'active') && (
                    <Link to={`/o/risk/${openRiskCaseOf(c.merchantId)?.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-primary hover:underline">
                      จัดการผ่าน Risk Review ({openRiskCaseOf(c.merchantId)?.id})
                    </Link>
                  )}
                  {c.status === 'suspended' && !certStatusBlocker(c.id, 'active') && (
                    <>
                      <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => act(c.id, 'reinstate')}>คืนสถานะ</Button>
                      <Button size="sm" variant="danger" icon={ShieldOff} onClick={() => act(c.id, 'revoke')}>เพิกถอน</Button>
                    </>
                  )}
                  {c.status === 'expired' && <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => act(c.id, 'renew')}>ต่ออายุ</Button>}
                  {c.status === 'revoked' && <span className="text-xs text-ink-soft">—</span>}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
