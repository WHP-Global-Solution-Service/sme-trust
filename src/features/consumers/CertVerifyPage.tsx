import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, MessageSquareWarning, Store } from 'lucide-react';
import { useCertificationStore, useMerchantStore, useOperatorStore } from '@/stores';
import { reportDemo } from '@/stores/demo';
import { currentCert, verdictFor, VERDICTS } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { Alert, Card, LinkButton, PageHeader, SkeletonList } from '@/components/common/ui';
import { CertificateCard, VerdictPanel } from '@/components/common/Trust';
import { NotFoundExplain } from './shared';

/** Certificate Verification — ปลายทางของ QR Code */
export default function CertVerifyPage() {
  const { certId = '' } = useParams();
  const certs = useCertificationStore((s) => s.items);
  const cert = certs.find((c) => c.id.toUpperCase() === certId.toUpperCase());
  const merchant = useMerchantStore((s) => s.items.find((m) => m.id === cert?.merchantId));
  const op = useOperatorStore((s) => s.items.find((o) => o.id === merchant?.operatorId));
  const [loading, setLoading] = useState(true);
  const [checkedAt] = useState(new Date().toISOString());

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [certId]);

  // ผู้บริโภคเปิดดูใบรับรองนี้แล้ว (ใช้กับขั้นจำลองการสแกน QR ในการสาธิต)
  useEffect(() => {
    if (!loading && cert) reportDemo('verify.viewed', cert.id);
  }, [loading, cert]);

  if (loading)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="ผลการตรวจสอบใบรับรอง" back={{ to: '/verify', label: 'สแกน QR' }} />
        <Card>
          <SkeletonList rows={4} />
        </Card>
      </div>
    );

  if (!cert || !merchant)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="ผลการตรวจสอบใบรับรอง" subtitle={certId} back={{ to: '/verify', label: 'สแกน QR' }} />
        <NotFoundExplain query={certId} />
      </div>
    );

  const latest = currentCert(certs, merchant.id);
  const isLatest = latest?.id === cert.id;
  const verdict = isLatest ? verdictFor(merchant, op, cert) : { key: 'expired' as const, ...VERDICTS.expired, desc: 'ใบรับรองฉบับนี้ไม่ใช่ฉบับล่าสุดของร้านค้า' };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="ผลการตรวจสอบใบรับรอง" subtitle={cert.id} back={{ to: '/verify', label: 'สแกน QR' }} />
      <VerdictPanel verdict={verdict} />
      {!isLatest && latest && (
        <Alert tone="info" title="ใบรับรองนี้ถูกแทนที่แล้ว">
          ใบรับรองฉบับล่าสุดของร้านคือ{' '}
          <Link to={`/verify/${latest.id}`} className="font-mono font-semibold underline">
            {latest.id}
          </Link>
        </Alert>
      )}
      <CertificateCard cert={cert} merchant={merchant} />
      <p className="flex items-center gap-1 text-xs text-ink-soft">
        <Clock className="h-3.5 w-3.5" />
        ตรวจสอบเมื่อ {fmtDate(checkedAt, true)} — ผลตรวจสอบเป็นข้อมูลสาธิต ณ เวลาที่ตรวจ
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <LinkButton to={`/shop/${merchant.id}`} variant="secondary" icon={Store}>
          ดูหน้าร้านค้าและช่องทางขาย
        </LinkButton>
        <LinkButton to={`/report?merchant=${merchant.id}`} variant="outline" icon={MessageSquareWarning}>
          แจ้งปัญหากับร้านนี้
        </LinkButton>
      </div>
    </div>
  );
}
