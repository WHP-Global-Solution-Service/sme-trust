import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Save, ShieldAlert, Undo2 } from 'lucide-react';
import type { ComplaintCategory, Priority } from '@/types';
import { useComplaintStore, useMerchantStore, confirmDialog, toast } from '@/stores';
import { escalateComplaint, officerClassify, officerClose, officerRemand } from '@/stores/workflows';
import { consumers } from '@/mock/data';
import { COMPLAINT_CATEGORY, COMPLAINT_STATUS, PRIORITY } from '@/constants/labels';
import { Button, Card, CardHeader, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { Field, Input, Select } from '@/components/forms/Field';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { CaseInfo, CaseProgress, CaseThread, OfferList } from '@/features/resolution/CaseParts';
import { ScreeningPanel } from './ScreeningPanel';

export default function OfficerComplaintDetail() {
  const { id } = useParams();
  const c = useComplaintStore((s) => s.items.find((x) => x.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === c?.merchantId));
  const [cat, setCat] = useState<ComplaintCategory | undefined>(c?.officerCategory ?? c?.screening.suggestedCategory);
  const [pri, setPri] = useState<Priority | undefined>(c?.officerPriority ?? c?.screening.priority);
  const [note, setNote] = useState('');
  if (!c || !m) return <NotFoundPage />;
  const consumer = consumers.find((x) => x.id === c.consumerId);
  const open = !['resolved', 'closed'].includes(c.status);

  const withReason = async (title: string, fn: (r: string) => void, danger = false) => {
    const r = await confirmDialog({ title, reasonLabel: 'บันทึก/เหตุผล', tone: danger ? 'danger' : 'primary', confirmText: title });
    if (!r.ok) return;
    fn(r.reason!);
    toast.success(title);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={c.title} subtitle={`${c.id} · ${m.shopName}`} back={{ to: '/o/complaints', label: 'Complaint Cases' }} action={<StatusBadge map={COMPLAINT_STATUS} value={c.status} />} />
      <Card className="mb-4 p-4">
        <CaseProgress status={c.status} />
      </Card>
      {open && (
        <Card className="mb-4 flex flex-wrap gap-2 p-4">
          {c.status !== 'escalated' && <Button variant="outline" icon={ArrowUpRight} onClick={() => withReason('รับเรื่องเข้าพิจารณา (ส่งต่อ)', (r) => escalateComplaint(c.id, r, 'officer'))}>รับเรื่องเข้าพิจารณา</Button>}
          <Button variant="outline" icon={Undo2} onClick={() => withReason('ส่งกลับให้ร้านค้าแก้ไขเบื้องต้น', (r) => officerRemand(c.id, r))}>ส่งกลับให้ร้านค้า</Button>
          <Button variant="success" icon={CheckCircle2} onClick={() => withReason('ปิดเรื่อง', (r) => officerClose(c.id, r))}>ปิดเรื่อง</Button>
          <LinkButton to={`/o/warnings/new?merchant=${m.id}`} variant="outline" icon={AlertTriangle}>ออกคำแนะนำ/คำเตือน</LinkButton>
          <LinkButton to="/o/risk" variant="ghost" icon={ShieldAlert}>เปิดเรื่องพิจารณาความเสี่ยง</LinkButton>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <ScreeningPanel s={c.screening} linkBase="/o/complaints" />
          <Card>
            <CardHeader title="ปรับผลการจัดประเภท (Officer Override)" />
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <Field label="ประเภท">
                <Select value={cat} onChange={(e) => setCat(e.target.value as ComplaintCategory)}>
                  {Object.entries(COMPLAINT_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="ความสำคัญ">
                <Select value={pri} onChange={(e) => setPri(e.target.value as Priority)}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="หมายเหตุ" className="sm:col-span-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.officerNote ?? 'เหตุผลในการปรับ'} />
              </Field>
              <div className="sm:col-span-2">
                <Button
                  icon={Save}
                  onClick={() => {
                    if (!cat || !pri) return;
                    officerClassify(c.id, cat, pri, note || 'ปรับตามดุลพินิจเจ้าหน้าที่');
                    setNote('');
                    toast.success('บันทึกผลการจัดประเภทแล้ว');
                  }}
                >
                  บันทึกการปรับ
                </Button>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="รายละเอียดเรื่อง" />
            <div className="px-4 sm:px-5">
              <CaseInfo c={c} merchantName={m.shopName} consumerName={consumer ? `${consumer.name} (${consumer.id})` : undefined} />
            </div>
          </Card>
          <Card>
            <CardHeader title="การเจรจาระหว่างผู้บริโภคและร้านค้า" />
            <div className="p-4 sm:p-5"><CaseThread c={c} viewer="officer" /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="ข้อเสนอของร้านค้า" />
            <div className="p-4 sm:p-5"><OfferList c={c} /></div>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <div className="p-4 sm:p-5"><Timeline events={c.timeline} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
