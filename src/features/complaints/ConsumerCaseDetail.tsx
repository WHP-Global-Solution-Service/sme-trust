import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Lock, Send, ThumbsDown, ThumbsUp, Handshake } from 'lucide-react';
import type { OfferStatus } from '@/types';
import { useComplaintStore, useMerchantStore, confirmDialog, toast } from '@/stores';
import { canConfirmResolved, consumerConfirmResolved, consumerMessage, consumerReplyOffer, escalateComplaint } from '@/stores/workflows';
import { useCurrentConsumer } from '@/hooks/useCurrent';
import { COMPLAINT_STATUS } from '@/constants/labels';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { Textarea } from '@/components/forms/Field';
import { CaseInfo, CaseProgress, CaseThread, OfferList } from '@/features/resolution/CaseParts';
import NotFoundPage from '@/features/onboarding/NotFoundPage';

export default function ConsumerCaseDetail() {
  const { id } = useParams();
  const consumer = useCurrentConsumer();
  const c = useComplaintStore((s) => s.items.find((x) => x.id === id));
  const merchant = useMerchantStore((s) => s.items.find((m) => m.id === c?.merchantId));
  const [msg, setMsg] = useState('');

  if (!c) return <NotFoundPage />;
  if (c.consumerId !== consumer.id)
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์ดูเรื่องนี้" desc="เรื่องนี้เป็นของผู้บริโภคบัญชีอื่น (การจำกัดสิทธิ์ระดับ UI จำลอง) — สลับบัญชีได้ที่ Demo Mode" />
      </Card>
    );

  const pending = c.offers.find((o) => o.status === 'pending');
  const accepted = c.offers.find((o) => o.status === 'accepted');
  const closed = ['resolved', 'closed', 'escalated'].includes(c.status);

  const reply = async (r: Exclude<OfferStatus, 'pending'>) => {
    const titles = { accepted: 'ยอมรับข้อเสนอ', rejected: 'ปฏิเสธข้อเสนอ', negotiate: 'ขอเจรจาเพิ่มเติม' };
    const res = await confirmDialog({
      title: titles[r],
      body: r === 'accepted' ? 'หลังร้านค้าดำเนินการตามข้อเสนอแล้ว กรุณากลับมายืนยันผลการแก้ไข' : 'ร้านค้าจะได้รับแจ้งและสามารถเสนอทางเลือกใหม่ได้',
      reasonLabel: r === 'accepted' ? undefined : 'ข้อความถึงร้านค้า',
      confirmText: titles[r],
    });
    if (!res.ok || !pending) return;
    consumerReplyOffer(c.id, pending.id, r, res.reason ?? '');
    toast.success(titles[r]);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={c.title} subtitle={`${c.id} · ${merchant?.shopName}`} back={{ to: '/consumer/cases', label: 'เรื่องของฉัน' }} action={<StatusBadge map={COMPLAINT_STATUS} value={c.status} />} />
      <Card className="mb-4 p-4">
        <CaseProgress status={c.status} />
      </Card>

      {pending && (
        <Card className="mb-4 border-primary/40">
          <CardHeader title="ร้านค้าเสนอแนวทางแก้ไข" subtitle="กรุณาพิจารณาข้อเสนอ" icon={Handshake} />
          <div className="space-y-3 p-4 sm:p-5">
            <OfferList c={{ ...c, offers: [pending] }} />
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button variant="success" size="lg" icon={ThumbsUp} onClick={() => reply('accepted')}>ยอมรับข้อเสนอ</Button>
              <Button variant="outline" icon={Handshake} onClick={() => reply('negotiate')}>ขอเจรจาเพิ่มเติม</Button>
              <Button variant="outline" icon={ThumbsDown} onClick={() => reply('rejected')}>ปฏิเสธ</Button>
            </div>
          </div>
        </Card>
      )}

      {canConfirmResolved(c) && accepted && (
        <Alert
          tone="success"
          title="คุณยอมรับข้อเสนอแล้ว"
          className="mb-4"
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="success"
                icon={CheckCircle2}
                onClick={async () => {
                  const r = await confirmDialog({ title: 'ยืนยันว่าได้รับการแก้ไขแล้ว', body: 'เรื่องจะถูกปิดด้วยสถานะ "แก้ไขสำเร็จ"', confirmText: 'ยืนยัน' });
                  if (r.ok) {
                    consumerConfirmResolved(c.id);
                    toast.success('ปิดเรื่องเรียบร้อย', 'ขอบคุณที่ใช้ระบบแก้ไขปัญหาร่วมกับร้านค้า');
                  }
                }}
              >
                ได้รับการแก้ไขแล้ว (Consumer Confirm)
              </Button>
            </div>
          }
        >
          เมื่อร้านค้าดำเนินการตามข้อเสนอ ({accepted.note}) แล้ว กรุณายืนยันผล
        </Alert>
      )}

      {c.status === 'escalated' && (
        <Alert tone="warning" title="ส่งต่อเจ้าหน้าที่แล้ว (ภายในระบบสาธิต)" className="mb-4">
          ขั้นตอนถัดไปในระบบสาธิต: 1) เจ้าหน้าที่ตรวจสอบข้อมูลและผลคัดกรอง 2) อาจขอข้อมูลเพิ่มจากคุณหรือร้านค้า 3) ส่งกลับให้ร้านค้าแก้ไข หรือพิจารณามาตรการ 4) แจ้งผลและปิดเรื่อง
          <br />
          <span className="text-xs">ระบบนี้ไม่ได้ส่งเรื่องเข้าสู่ระบบของหน่วยงานจริง</span>
        </Alert>
      )}
      {c.status === 'resolved' && <Alert tone="success" title="แก้ไขสำเร็จ" className="mb-4">เรื่องนี้ได้รับการแก้ไขโดยร้านค้าและคุณยืนยันผลแล้ว</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="การสนทนากับร้านค้า" />
            <div className="p-4 sm:p-5">
              <CaseThread c={c} viewer="consumer" />
              {!closed && (
                <div className="mt-4 flex gap-2">
                  <Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="ส่งข้อมูลเพิ่มเติมถึงร้านค้า" className="min-h-[44px]" />
                  <Button
                    icon={Send}
                    aria-label="ส่งข้อความ"
                    onClick={() => {
                      if (msg.trim().length < 2) return;
                      consumerMessage(c.id, msg.trim());
                      setMsg('');
                      toast.success('ส่งข้อความแล้ว');
                    }}
                  />
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="ข้อเสนอทั้งหมด" />
            <div className="p-4 sm:p-5">
              <OfferList c={c} />
            </div>
          </Card>
          <Card>
            <CardHeader title="รายละเอียดเรื่อง" />
            <div className="px-4 sm:px-5">
              <CaseInfo c={c} merchantName={merchant?.shopName} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {!closed && (
            <Card className="p-4">
              <p className="font-medium text-ink">ตกลงกับร้านค้าไม่ได้?</p>
              <p className="mt-1 text-sm text-ink-soft">คุณสามารถขอให้ส่งต่อเจ้าหน้าที่ได้ทุกเมื่อ โดยเฉพาะกรณีเสี่ยงร้ายแรงไม่ต้องรอร้านค้า</p>
              <Button
                variant="outline"
                icon={ArrowUpRight}
                className="mt-3"
                block
                onClick={async () => {
                  const r = await confirmDialog({ title: 'ขอส่งต่อเจ้าหน้าที่', body: 'เจ้าหน้าที่ในระบบสาธิตจะได้รับเรื่องพร้อมประวัติการเจรจาทั้งหมด', reasonLabel: 'เหตุผลที่ขอส่งต่อ', confirmText: 'ส่งต่อ', tone: 'danger' });
                  if (r.ok) {
                    escalateComplaint(c.id, r.reason!, 'consumer');
                    toast.success('ส่งต่อเจ้าหน้าที่แล้ว', 'ภายในระบบสาธิต');
                  }
                }}
              >
                ขอส่งต่อเจ้าหน้าที่
              </Button>
            </Card>
          )}
          <Card>
            <CardHeader title="Timeline" />
            <div className="p-4 sm:p-5">
              <Timeline events={c.timeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
