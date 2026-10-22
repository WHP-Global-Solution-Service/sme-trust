import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Circle, Info, RefreshCw, Send } from 'lucide-react';
import type { TrustLevel } from '@/types';
import { useCertificationStore, useComplaintStore, useRiskStore, useTrainingStore, useVerificationStore, useWarningStore, confirmDialog, toast } from '@/stores';
import { applyCertification } from '@/stores/workflows';
import { useMerchantView, useMyMerchants } from '@/hooks/useCurrent';
import { CERT_STATUS, REGISTRATION_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { levelCriteria } from '@/utils/criteria';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { CertificateCard } from '@/components/common/Trust';
import { Timeline } from '@/components/common/Timeline';
import { ShopSwitcher } from '@/features/merchants/ShopSwitcher';

export default function MerchantCertPage() {
  const { active } = useMyMerchants();
  const view = useMerchantView(active?.id);
  const certs = useCertificationStore((s) => s.items);
  const apps = useVerificationStore((s) => s.items);
  const enrollments = useTrainingStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const risks = useRiskStore((s) => s.items);

  const criteria = useMemo(
    () => (view ? levelCriteria(view.merchant, view.operator, { enrollments, warnings, complaints, risks, cert: view.cert }) : undefined),
    [view, enrollments, warnings, complaints, risks],
  );

  if (!active || !view || !criteria)
    return (
      <div>
        <PageHeader title="ขอรับรองความน่าเชื่อถือ" icon={BadgeCheck} />
        <Card>
          <EmptyState title="ยังไม่มีร้านค้า" desc="ต้องลงทะเบียนร้านค้าและได้รับอนุมัติก่อนจึงจะขอรับรองได้" action={<LinkButton to="/m/register-shop">ลงทะเบียนร้านค้า</LinkButton>} />
        </Card>
      </div>
    );

  const { merchant: m, cert } = view;
  const myCerts = certs.filter((c) => c.merchantId === m.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const certApps = apps.filter((a) => a.merchantId === m.id && a.type === 'certification').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const pending = certApps.find((a) => !['approved', 'rejected'].includes(a.status));
  const lastRejected = certApps[0]?.status === 'rejected' ? certApps[0] : undefined;
  const allMet = (l: 1 | 2 | 3 | 4) => criteria[l].every((c) => c.met);
  const currentLevel = view.level;

  const apply = async (level: TrustLevel, renewal = false) => {
    const r = await confirmDialog({
      title: renewal ? 'ยืนยันการยื่นต่ออายุใบรับรอง' : `ยื่นขอรับรอง ${TRUST_LEVELS[level].name}`,
      body: 'คำขอจะถูกส่งให้เจ้าหน้าที่ตรวจสอบในระบบสาธิต',
      confirmText: 'ยื่นคำขอ',
    });
    if (!r.ok) return;
    const app = applyCertification(m.id, level, renewal);
    toast.success('ยื่นคำขอแล้ว', app.id);
  };

  return (
    <div>
      <PageHeader title="ขอรับรองความน่าเชื่อถือ" subtitle={m.shopName} icon={BadgeCheck} />
      <ShopSwitcher />

      <Alert tone="info" icon={Info} className="mb-4">
        ระดับการตรวจสอบเป็นแนวคิดสำหรับการสาธิตเท่านั้น <b>Identity Verified</b> หมายถึงยืนยันตัวตนเจ้าของร้าน ไม่ใช่การรับรองคุณภาพสินค้า
      </Alert>

      {cert && cert.status === 'suspended' && (
        <Alert tone="error" title="Certificate Suspended" className="mb-4" action={<LinkButton to="/m/review" size="sm" variant="outline">ชี้แจง/อุทธรณ์</LinkButton>}>
          ใบรับรองถูกระงับ ไม่สามารถใช้แสดงต่อผู้บริโภคได้ในขณะนี้ — {cert.statusReason}
        </Alert>
      )}
      {cert && cert.status === 'revoked' && (
        <Alert tone="error" title="Certificate Revoked" className="mb-4">
          ใบรับรองถูกเพิกถอนแล้ว — {cert.statusReason}
        </Alert>
      )}
      {cert && cert.status === 'expired' && !cert.supersededBy && (
        <Alert tone="warning" title="Certificate Expired" className="mb-4" action={!pending && <Button size="sm" icon={RefreshCw} onClick={() => apply(cert.level, true)}>ยื่นต่ออายุ</Button>}>
          ใบรับรองหมดอายุเมื่อ {fmtDate(cert.expiresAt)} กรุณานำ Badge ออกจากช่องทางขายจนกว่าจะต่ออายุสำเร็จ
        </Alert>
      )}
      {pending && (
        <Alert tone="warning" title="มีคำขอรออนุมัติ" className="mb-4">
          {pending.id} — {TRUST_LEVELS[pending.requestedLevel].name} · สถานะ <StatusBadge map={REGISTRATION_STATUS} value={pending.status} />
        </Alert>
      )}
      {lastRejected && !pending && (
        <Alert tone="error" title={`คำขอ ${lastRejected.id} ไม่ได้รับอนุมัติ`} className="mb-4">
          เหตุผล: {lastRejected.rejectReason}
          <br />
          วิธียื่นใหม่: ดำเนินการตามเกณฑ์ที่ยังไม่ผ่านด้านล่างให้ครบ แล้วกดยื่นคำขออีกครั้ง
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {cert ? <CertificateCard cert={cert} merchant={m} /> : <Card><EmptyState icon={BadgeCheck} title="ยังไม่มีใบรับรอง" desc="ใบรับรองระดับ Business Verified จะออกให้อัตโนมัติเมื่อคำขอลงทะเบียนร้านค้าได้รับอนุมัติ" /></Card>}
          {cert && (
            <Card>
              <CardHeader title="ประวัติใบรับรองและการต่ออายุ" />
              <div className="p-4 sm:p-5">
                <Timeline events={myCerts.flatMap((c) => c.history.map((h) => ({ ...h, note: `${c.id}${h.note ? ` · ${h.note}` : ''}` })))} />
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader title="ระดับการตรวจสอบ" subtitle={`ระดับปัจจุบัน: Level ${currentLevel} — ${TRUST_LEVELS[currentLevel].name}`} />
          <ol className="divide-y divide-line">
            {([1, 2, 3, 4] as const).map((lvl) => {
              const info = TRUST_LEVELS[lvl];
              const met = allMet(lvl);
              const reached = currentLevel >= lvl;
              return (
                <li key={lvl} className="p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <span className={cn('grid h-8 w-8 place-items-center rounded-full text-sm font-bold', reached ? 'bg-success text-white' : 'bg-bg text-ink-soft')}>{lvl}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {info.name} {lvl === 4 && <Badge tone="neutral">ระดับที่เสนอ</Badge>}
                      </p>
                      <p className="text-xs text-ink-soft">{info.desc}</p>
                    </div>
                    {reached && <Badge tone="success">ได้รับแล้ว</Badge>}
                  </div>
                  <ul className="mt-2 space-y-1 pl-10">
                    {criteria[lvl].slice(lvl === 1 ? 0 : criteria[(lvl - 1) as 1 | 2 | 3].length).map((c) => (
                      <li key={c.label} className="flex items-start gap-1.5 text-sm">
                        {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-line" />}
                        <span className={c.met ? 'text-ink' : 'text-ink-soft'}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                  {lvl >= 3 && !reached && (
                    <div className="mt-3 pl-10">
                      <Button size="sm" icon={Send} disabled={!met || !!pending} onClick={() => apply(lvl)}>
                        ยื่นขอ {info.name}
                      </Button>
                      {!met && <p className="mt-1 text-xs text-ink-soft">ต้องผ่านเกณฑ์ทุกข้อก่อนยื่นคำขอ {lvl === 3 && <Link className="text-primary underline" to="/m/training">ไปศูนย์อบรม</Link>}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {myCerts.length > 0 && (
            <div className="border-t border-line p-4 text-sm sm:p-5">
              <p className="mb-2 font-medium text-ink">ใบรับรองทั้งหมด</p>
              <ul className="space-y-1.5">
                {myCerts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link to={`/verify/${c.id}`} className="font-mono text-primary hover:underline">
                      {c.id}
                    </Link>
                    <span className="text-xs text-ink-soft">L{c.level}</span>
                    <StatusBadge map={CERT_STATUS} value={c.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
