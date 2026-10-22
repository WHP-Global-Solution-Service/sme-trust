import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, PlayCircle, Undo2, XCircle } from 'lucide-react';
import { useMerchantStore, useWarningStore, confirmDialog, toast } from '@/stores';
import { reviewCorrection } from '@/stores/workflows';
import { officers } from '@/mock/data';
import { Button, Card, CardHeader, InfoRow, PageHeader } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { DocList } from '@/components/forms/MockUpload';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { CorrectiveChecklist, LinkedCourses, WarningSummary } from './WarningParts';

export default function OfficerWarningDetail() {
  const { id } = useParams();
  const w = useWarningStore((s) => s.items.find((x) => x.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === w?.merchantId));
  if (!w || !m) return <NotFoundPage />;

  const act = async (action: 'start' | 'approve' | 'return' | 'close') => {
    const cfg = {
      start: { title: 'เริ่มตรวจผลการแก้ไข', reason: undefined },
      approve: { title: 'ตรวจผลผ่าน — ปิดรายการ', reason: 'บันทึกผลการตรวจ' },
      return: { title: 'ส่งกลับให้แก้ไขเพิ่มเติม', reason: 'สิ่งที่ต้องแก้ไขเพิ่ม' },
      close: { title: 'ปิดรายการ', reason: 'บันทึกการปิด' },
    }[action];
    const r = await confirmDialog({ title: cfg.title, reasonLabel: cfg.reason, tone: action === 'return' ? 'danger' : 'primary' });
    if (!r.ok) return;
    reviewCorrection(w.id, action, r.reason);
    toast.success(cfg.title, 'ร้านค้าได้รับการแจ้งเตือนแล้ว');
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={w.title} subtitle={`${w.id} · ${m.shopName}`} back={{ to: '/o/warnings', label: 'Warnings' }} />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <p className="mr-auto text-sm text-ink-soft">การดำเนินการของเจ้าหน้าที่</p>
        {w.status === 'correction_submitted' && <Button icon={PlayCircle} onClick={() => act('start')}>เริ่มตรวจผล</Button>}
        {['correction_submitted', 'under_review'].includes(w.status) && (
          <>
            <Button variant="success" icon={CheckCircle2} onClick={() => act('approve')}>ตรวจผลผ่าน</Button>
            <Button variant="outline" icon={Undo2} onClick={() => act('return')}>ส่งกลับให้แก้ไข</Button>
          </>
        )}
        {['advisory', 'acknowledged', 'warning_issued', 'correction_required'].includes(w.status) && (
          <Button variant="outline" icon={XCircle} onClick={() => act('close')}>ปิดรายการ</Button>
        )}
        {w.status === 'completed' && <span className="text-sm font-medium text-success">รายการนี้เสร็จสิ้นแล้ว</span>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <WarningSummary w={w} />
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <InfoRow label="ร้านค้า">
                <Link to={`/shop/${m.id}`} className="text-primary hover:underline">{m.shopName}</Link> ({m.id})
              </InfoRow>
              <InfoRow label="ผู้ออก">{officers.find((o) => o.id === w.officerId)?.name}</InfoRow>
            </dl>
          </Card>
          <Card>
            <CardHeader title="รายการที่ต้องปรับปรุง" />
            <div className="p-3 sm:p-4">
              <CorrectiveChecklist w={w} />
            </div>
          </Card>
          <Card>
            <CardHeader title="หลักฐานการแก้ไขจากร้านค้า" />
            <div className="space-y-2 p-4 sm:p-5">
              {w.merchantNote && <p className="text-sm">"{w.merchantNote}"</p>}
              <DocList docs={w.evidence} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {w.courseIds.length > 0 && (
            <Card>
              <CardHeader title="หลักสูตรที่แนบ" />
              <div className="p-4 sm:p-5">
                <LinkedCourses ids={w.courseIds} href={(cid) => `/o/training?course=${cid}`} />
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
