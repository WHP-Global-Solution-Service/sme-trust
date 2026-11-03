import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Lock, MapPin, MessageSquareWarning, QrCode } from 'lucide-react';
import { useComplaintStore } from '@/stores';
import { useMerchantView } from '@/hooks/useCurrent';
import { CERT_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { isPublicMerchant } from '@/utils/trust';
import { Alert, Card, CardHeader, InfoRow, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { DemoLabel, TrustSeal, VerdictPanel } from '@/components/common/Trust';
import { ChannelButtons, NotFoundExplain } from './shared';
import { PublicAssessmentCard } from '@/features/trust-assessment/components/AssessmentParts';

/** Merchant Detail (Public) — ไม่แสดงข้อมูลผู้ร้องเรียนหรือหลักฐานส่วนตัว */
export default function ShopPublicPage() {
  const { id } = useParams();
  const view = useMerchantView(id);
  const resolved = useComplaintStore((s) => s.items.filter((c) => c.merchantId === id && c.status === 'resolved').length);

  if (!view || !isPublicMerchant(view.merchant))
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="ข้อมูลร้านค้า" back={{ to: '/check', label: 'ค้นหาร้านค้า' }} />
        <NotFoundExplain query={id} />
      </div>
    );

  const { merchant: m, cert, verdict, level } = view;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={m.shopName} subtitle={`${m.category} · ${m.province}`} back={{ to: '/directory', label: 'ทำเนียบร้านค้า' }} />
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <VerdictPanel verdict={verdict} />
          <PublicAssessmentCard merchantId={m.id} />
          <Card>
            <CardHeader title="ข้อมูลร้านค้า" />
            <dl className="divide-y divide-line px-4 sm:px-5">
              <InfoRow label="รูปแบบธุรกิจ">{m.businessType === 'juristic' ? `นิติบุคคล — ${m.juristic?.companyName}` : 'บุคคลธรรมดา'}</InfoRow>
              <InfoRow label="ระดับการตรวจสอบ">
                Level {level} — {TRUST_LEVELS[level].name}
                <span className="block text-xs text-ink-soft">{TRUST_LEVELS[level].meaningNot}</span>
              </InfoRow>
              <InfoRow label="ที่ตั้ง">
                <MapPin className="mr-1 inline h-4 w-4" />
                {m.district}, {m.province}
              </InfoRow>
              <InfoRow label="รายละเอียด">{m.description}</InfoRow>
              {cert && (
                <InfoRow label="ใบรับรอง">
                  <Link to={`/verify/${cert.id}`} className="font-mono text-primary hover:underline">
                    {cert.id}
                  </Link>{' '}
                  <StatusBadge map={CERT_STATUS} value={cert.status} />
                  <span className="block text-xs text-ink-soft">หมดอายุ {fmtDate(cert.expiresAt)}</span>
                </InfoRow>
              )}
              {resolved > 0 && (
                <InfoRow label="การดูแลลูกค้า">
                  <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />
                  แก้ไขปัญหาให้ลูกค้าสำเร็จผ่านระบบ {resolved} เรื่อง
                </InfoRow>
              )}
            </dl>
          </Card>
          <Card>
            <CardHeader title="ช่องทางขายเดิมของร้าน" subtitle="แต่ละช่องทางตรวจสอบแยกกัน" />
            <div className="p-4 sm:p-5">
              <ChannelButtons channels={m.channels} shopName={m.shopName} certId={cert?.id} usable={verdict.usable} level={level} />
            </div>
          </Card>
          <Alert tone="neutral" icon={Lock}>
            หน้าสาธารณะไม่แสดงข้อมูลผู้ร้องเรียน หลักฐานส่วนตัว หรือข้อกล่าวหาที่ยังไม่ได้ข้อสรุป
          </Alert>
        </div>
        <div className="space-y-4">
          <Card className="flex flex-col items-center gap-3 p-5">
            <TrustSeal level={level} shopName={m.shopName} usable={verdict.usable} />
            <DemoLabel />
          </Card>
          {cert && (
            <LinkButton to={`/verify/${cert.id}`} variant="secondary" icon={QrCode} block>
              ตรวจสอบใบรับรอง
            </LinkButton>
          )}
          <LinkButton to={`/report?merchant=${m.id}`} variant="outline" icon={MessageSquareWarning} block>
            แจ้งปัญหา (Report a Problem)
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
