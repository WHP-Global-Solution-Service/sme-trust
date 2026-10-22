import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Lock, Send } from 'lucide-react';
import type { MockDocument } from '@/types';
import { useWarningStore, confirmDialog, toast } from '@/stores';
import { acknowledgeWarning, submitCorrection, toggleWarningItem } from '@/stores/workflows';
import { useMyMerchants } from '@/hooks/useCurrent';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { Field, Textarea } from '@/components/forms/Field';
import { DocList, MockUpload } from '@/components/forms/MockUpload';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { CorrectiveChecklist, LinkedCourses, WarningSummary } from './WarningParts';

export default function MerchantWarningDetail() {
  const { id } = useParams();
  const { mine } = useMyMerchants();
  const w = useWarningStore((s) => s.items.find((x) => x.id === id));
  const [note, setNote] = useState('');
  const [docs, setDocs] = useState<MockDocument[]>([]);

  if (!w) return <NotFoundPage />;
  const shop = mine.find((m) => m.id === w.merchantId);
  if (!shop)
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์ดูรายการนี้" desc="คำเตือนนี้ไม่ใช่ของร้านค้าในบัญชีปัจจุบัน (การจำกัดสิทธิ์ระดับ UI จำลอง)" />
      </Card>
    );

  const needAck = ['advisory', 'warning_issued'].includes(w.status);
  const canSubmit = w.status === 'correction_required';
  const allDone = w.items.every((i) => i.done);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={w.title} subtitle={`${w.id} · ${shop.shopName}`} back={{ to: '/m/warnings', label: 'คำเตือนและการแก้ไข' }} />
      {needAck && (
        <Alert
          tone={w.kind === 'advisory' ? 'info' : 'warning'}
          title={w.kind === 'advisory' ? 'คุณได้รับคำแนะนำ' : 'คุณได้รับคำเตือน'}
          className="mb-4"
          action={
            <Button
              icon={CheckCircle2}
              onClick={async () => {
                const r = await confirmDialog({ title: 'ยืนยันการรับทราบ', body: w.items.length ? 'หลังรับทราบ ระบบจะเปิดให้ส่งหลักฐานการแก้ไข' : 'ยืนยันว่าได้อ่านและรับทราบคำแนะนำแล้ว' });
                if (r.ok) {
                  acknowledgeWarning(w.id);
                  toast.success('รับทราบแล้ว');
                }
              }}
            >
              กดรับทราบ
            </Button>
          }
        >
          {w.kind === 'advisory' ? 'คำแนะนำนี้ไม่ใช่มาตรการลงโทษ และไม่กระทบสถานะการรับรอง' : 'กรุณาอ่านประเด็นและแนวทางแก้ไข แล้วกดรับทราบเพื่อเริ่มดำเนินการ'}
        </Alert>
      )}
      {['correction_submitted', 'under_review'].includes(w.status) && <Alert tone="info" className="mb-4" title="ส่งผลการแก้ไขแล้ว">รอเจ้าหน้าที่ตรวจผลการแก้ไข</Alert>}
      {w.status === 'completed' && <Alert tone="success" className="mb-4" title="เสร็จสิ้น">รายการนี้ถูกบันทึกใน SME Trust Passport เป็นประวัติการปรับปรุง</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <WarningSummary w={w} />
          </Card>
          <Card>
            <CardHeader title="รายการที่ต้องปรับปรุง" subtitle={canSubmit ? 'ติ๊กเมื่อแก้ไขแล้ว' : undefined} />
            <div className="p-3 sm:p-4">
              <CorrectiveChecklist w={w} onToggle={canSubmit ? (itemId) => toggleWarningItem(w.id, itemId) : undefined} />
            </div>
          </Card>
          {canSubmit && (
            <Card className="border-primary/30">
              <CardHeader title="ส่งหลักฐานการแก้ไข" />
              <div className="space-y-3 p-4 sm:p-5">
                {!allDone && <Alert tone="warning">ยังมีรายการที่ไม่ได้ติ๊กว่าแก้ไขแล้ว</Alert>}
                <Field label="คำอธิบายการแก้ไข" required>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลบโพสต์ที่มีข้อความการันตีผลแล้ว และแก้ไขคำบรรยายสินค้าทุกช่องทาง" />
                </Field>
                <MockUpload value={docs} onChange={setDocs} kinds={['ภาพหลังแก้ไข', 'ลิงก์โพสต์ใหม่']} />
                <Button
                  icon={Send}
                  onClick={() => {
                    if (note.trim().length < 10) return toast.error('กรุณาอธิบายการแก้ไขอย่างน้อย 10 ตัวอักษร');
                    if (!docs.length) return toast.error('กรุณาแนบหลักฐานจำลองอย่างน้อย 1 ไฟล์');
                    submitCorrection(w.id, note.trim(), docs);
                    setNote('');
                    setDocs([]);
                    toast.success('ส่งหลักฐานการแก้ไขแล้ว', 'รอเจ้าหน้าที่ตรวจผล');
                  }}
                >
                  ส่งกลับให้ตรวจ
                </Button>
              </div>
            </Card>
          )}
          {w.evidence.length > 0 && (
            <Card>
              <CardHeader title="หลักฐานที่ส่งแล้ว" />
              <div className="space-y-2 p-4 sm:p-5">
                {w.merchantNote && <p className="text-sm text-ink">"{w.merchantNote}"</p>}
                <DocList docs={w.evidence} />
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {w.courseIds.length > 0 && (
            <Card>
              <CardHeader title="หลักสูตรอบรมที่แนะนำ" />
              <div className="p-4 sm:p-5">
                <LinkedCourses ids={w.courseIds} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Timeline การแก้ไข" />
            <div className="p-4 sm:p-5">
              <Timeline events={w.timeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
