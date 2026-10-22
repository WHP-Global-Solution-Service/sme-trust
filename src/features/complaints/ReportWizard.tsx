import { useEffect, useMemo, useState } from 'react';
import { reportDemo } from '@/stores/demo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AlertOctagon, CheckCircle2, FlaskConical, MessageSquareWarning, Search } from 'lucide-react';
import type { Complaint, ComplaintCategory, MockDocument } from '@/types';
import { useComplaintStore, toast } from '@/stores';
import { submitComplaint } from '@/stores/workflows';
import { useCurrentConsumer } from '@/hooks/useCurrent';
import { CHANNEL_TYPES, COMPLAINT_CATEGORY } from '@/constants/labels';
import { screenComplaint } from '@/utils/screening';
import { fmtDate, fmtMoney } from '@/utils/format';
import { nowISO, uid } from '@/utils/id';
import { cn } from '@/utils/cn';
import { Alert, Button, Card, InfoRow, LinkButton, PageHeader } from '@/components/common/ui';
import { Stepper } from '@/components/common/Stepper';
import { Field, Input, SearchBox, Select, Textarea } from '@/components/forms/Field';
import { DocList, MockUpload } from '@/components/forms/MockUpload';
import { VerdictBadge } from '@/components/common/Trust';
import { usePublicMerchants } from '@/features/consumers/shared';
import { ScreeningPanel } from './ScreeningPanel';

const STEPS = ['เลือกร้านค้า', 'ประเภทปัญหา', 'รายละเอียด', 'วันและคำสั่งซื้อ', 'หลักฐาน', 'ตรวจสอบข้อมูล', 'ส่งเรื่อง'];

const detailSchema = z.object({
  title: z.string().trim().min(5, 'กรุณาระบุหัวข้ออย่างน้อย 5 ตัวอักษร'),
  description: z.string().trim().min(10, 'กรุณาอธิบายเหตุการณ์อย่างน้อย 10 ตัวอักษร'),
});
const orderSchema = z.object({
  incidentDate: z
    .string()
    .min(1, 'กรุณาระบุวันที่เกิดเหตุ')
    .refine((v) => new Date(v) <= new Date(), 'วันที่ต้องไม่เกินวันนี้'),
  orderAmount: z.number({ invalid_type_error: 'กรุณากรอกตัวเลข' }).min(0, 'มูลค่าต้องไม่ติดลบ').max(1_000_000, 'มูลค่าสูงเกินไปสำหรับระบบสาธิต'),
});

interface FormState {
  merchantId: string;
  category: ComplaintCategory | '';
  title: string;
  description: string;
  incidentDate: string;
  orderRef: string;
  orderAmount: number;
  channel: Complaint['channel'];
  evidence: MockDocument[];
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ReportWizard() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const consumer = useCurrentConsumer();
  const complaints = useComplaintStore((s) => s.items);
  const merchants = usePublicMerchants();
  const pre = params.get('merchant') ?? '';
  const [step, setStep] = useState(pre && merchants.some((m) => m.merchant.id === pre) ? 1 : 0);
  useEffect(() => reportDemo('report.step', step), [step]);
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [escalateNow, setEscalateNow] = useState(false);
  const [created, setCreated] = useState<Complaint>();
  const [f, setF] = useState<FormState>({ merchantId: pre, category: '', title: '', description: '', incidentDate: '', orderRef: '', orderAmount: 0, channel: 'facebook', evidence: [] });
  const set = (patch: Partial<FormState>) => setF((v) => ({ ...v, ...patch }));

  const sel = merchants.find((m) => m.merchant.id === f.merchantId);
  const screening = useMemo(
    () =>
      f.merchantId && f.category
        ? screenComplaint({ merchantId: f.merchantId, consumerId: consumer.id, category: f.category, description: f.description, orderRef: f.orderRef, incidentDate: f.incidentDate, orderAmount: f.orderAmount, evidenceCount: f.evidence.length }, complaints)
        : undefined,
    [f, consumer.id, complaints],
  );

  const validate = (): boolean => {
    let res: z.SafeParseReturnType<unknown, unknown> | undefined;
    if (step === 0 && !f.merchantId) return setErrors({ merchantId: 'กรุณาเลือกร้านค้า' }), false;
    if (step === 1 && !f.category) return setErrors({ category: 'กรุณาเลือกประเภทปัญหา' }), false;
    if (step === 2) res = detailSchema.safeParse(f);
    if (step === 3) res = orderSchema.safeParse(f);
    if (res && !res.success) {
      setErrors(Object.fromEntries(res.error.issues.map((i) => [i.path[0], i.message])));
      toast.error('กรุณาตรวจสอบข้อมูลที่ไม่ถูกต้อง');
      return false;
    }
    setErrors({});
    return true;
  };

  const demoFill = (kind: 'normal' | 'incomplete' | 'duplicate' | 'severe') => {
    const mId = f.merchantId || 'M-001';
    const base = { merchantId: mId, channel: 'facebook' as const, incidentDate: today() };
    if (kind === 'normal')
      setF({ ...base, category: 'not_as_described', title: 'ขนาดเสื้อไม่ตรงตามที่สั่ง', description: 'สั่งเสื้อไซซ์ L ตามตารางไซซ์ในโพสต์ แต่ได้รับไซซ์ M ทักแชตแจ้งร้านแล้วแต่ยังไม่ได้รับคำตอบ ต้องการเปลี่ยนเป็นไซซ์ที่ถูกต้อง', orderRef: `FB-${Date.now().toString().slice(-6)}`, orderAmount: 890, evidence: [{ id: uid('doc'), name: 'ภาพสินค้าที่ได้รับ (จำลอง).jpg', kind: 'หลักฐาน', sizeKb: 420, addedAt: nowISO() }] });
    if (kind === 'incomplete') setF({ ...base, category: 'not_received', title: 'ยังไม่ได้ของ', description: 'ยังไม่ได้รับของ', orderRef: '', orderAmount: 0, incidentDate: '', evidence: [] });
    if (kind === 'duplicate') {
      const prev = complaints.find((c) => c.merchantId === mId) ?? complaints[0];
      setF({ ...base, merchantId: prev.merchantId, category: prev.category, title: `${prev.title} (แจ้งซ้ำ)`, description: `${prev.description} ขอแจ้งอีกครั้งเนื่องจากยังไม่ได้รับการแก้ไข`, orderRef: prev.orderRef || 'FB-DUP-001', orderAmount: prev.orderAmount, evidence: [] });
    }
    if (kind === 'severe') {
      setF({ ...base, category: 'defective', title: 'ปลั๊กพ่วงมีควันและไฟช็อต', description: 'ใช้ปลั๊กพ่วงที่ซื้อมาได้ 2 วัน เกิดควันและไฟช็อตจนสายไหม้ เกือบเกิดไฟไหม้ในบ้าน ลูกได้รับบาดเจ็บเล็กน้อยที่มือ', orderRef: 'TT-SEVERE-01', orderAmount: 690, evidence: [{ id: uid('doc'), name: 'ภาพปลั๊กไหม้ (จำลอง).jpg', kind: 'หลักฐาน', sizeKb: 800, addedAt: nowISO() }] });
      setEscalateNow(true);
    }
    setErrors({});
    setStep(5);
    toast.info('เติมข้อมูลตัวอย่างแล้ว', 'ดูผลการคัดกรองในขั้นตอนตรวจสอบข้อมูล');
  };

  const submit = () => {
    if (!f.category) return;
    const c = submitComplaint({ ...f, category: f.category, consumerId: consumer.id, escalateNow });
    setCreated(c);
    setStep(6);
    toast.success('ยื่นเรื่องสำเร็จ', c.id);
  };

  const filtered = merchants.filter((m) => !q || m.merchant.shopName.includes(q) || m.merchant.category.includes(q));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="แจ้งปัญหาการซื้อขาย" subtitle={`ผู้แจ้ง: ${consumer.name} (บัญชีสาธิต)`} icon={MessageSquareWarning} />
      <Stepper steps={STEPS} current={step} />

      {step < 6 && (
        <details className="mb-4 rounded-xl border border-dashed border-secondary/40 bg-secondary-50/50 p-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-secondary">
            <FlaskConical className="h-4 w-4" />
            เติมข้อมูลตัวอย่างสำหรับสาธิต
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => demoFill('normal')}>กรณีปกติ</Button>
            <Button size="sm" variant="outline" onClick={() => demoFill('incomplete')}>ข้อมูลไม่ครบ</Button>
            <Button size="sm" variant="outline" onClick={() => demoFill('duplicate')}>ยื่นเรื่องซ้ำ</Button>
            <Button size="sm" variant="outline" onClick={() => demoFill('severe')}>กรณีเสี่ยงร้ายแรง</Button>
          </div>
        </details>
      )}

      <Card className="p-5">
        {step === 0 && (
          <div className="space-y-3">
            <SearchBox value={q} onChange={setQ} placeholder="ค้นหาร้านค้าในระบบ" />
            {errors.merchantId && <p className="text-xs text-error">{errors.merchantId}</p>}
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((x) => (
                <li key={x.merchant.id}>
                  <button onClick={() => set({ merchantId: x.merchant.id, channel: x.merchant.channels[0]?.type ?? 'other' })} className={cn('flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left', f.merchantId === x.merchant.id ? 'border-primary bg-primary-50/50' : 'border-line')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{x.merchant.shopName}</p>
                      <p className="text-xs text-ink-soft">{x.merchant.category} · {x.merchant.province}</p>
                    </div>
                    <VerdictBadge verdict={x.verdict} size="sm" />
                  </button>
                </li>
              ))}
              {!filtered.length && <p className="py-4 text-center text-sm text-ink-soft">ไม่พบร้านค้า — ระบบสาธิตรองรับเฉพาะร้านที่ลงทะเบียนแล้ว</p>}
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            {sel && <p className="mb-2 text-sm text-ink-soft">ร้านค้า: <b className="text-ink">{sel.merchant.shopName}</b></p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(COMPLAINT_CATEGORY) as ComplaintCategory[]).map((k) => (
                <button key={k} onClick={() => set({ category: k })} className={cn('rounded-xl border-2 p-3 text-left text-sm font-medium', f.category === k ? 'border-primary bg-primary-50/50 text-primary' : 'border-line text-ink')}>
                  {COMPLAINT_CATEGORY[k]}
                </button>
              ))}
            </div>
            {errors.category && <p className="text-xs text-error">{errors.category}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="หัวข้อปัญหา" required error={errors.title}>
              <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="เช่น โอนเงินแล้วไม่ได้รับสินค้า" invalid={!!errors.title} />
            </Field>
            <Field label="รายละเอียดเหตุการณ์" required error={errors.description} hint={`${f.description.trim().length} ตัวอักษร — แนะนำอย่างน้อย 40 ตัวอักษร โดยระบุสิ่งที่เกิดขึ้นและสิ่งที่ต้องการให้ร้านแก้ไข`}>
              <Textarea rows={5} value={f.description} onChange={(e) => set({ description: e.target.value })} invalid={!!errors.description} />
            </Field>
            <Alert tone="warning">กรุณาอย่าใส่ข้อมูลส่วนบุคคลจริง เช่น เลขบัตรประชาชน เลขบัญชีธนาคาร</Alert>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="วันที่เกิดเหตุ / วันที่สั่งซื้อ" required error={errors.incidentDate}>
              <Input type="date" max={today()} value={f.incidentDate} onChange={(e) => set({ incidentDate: e.target.value })} invalid={!!errors.incidentDate} />
            </Field>
            <Field label="มูลค่าสินค้า (บาท)" required error={errors.orderAmount}>
              <Input type="number" min={0} value={f.orderAmount || ''} onChange={(e) => set({ orderAmount: Number(e.target.value) })} invalid={!!errors.orderAmount} />
            </Field>
            <Field label="เลขที่คำสั่งซื้อ (จำลอง)" hint="ไม่บังคับ แต่ช่วยให้ร้านค้าตรวจสอบได้เร็วขึ้น">
              <Input value={f.orderRef} onChange={(e) => set({ orderRef: e.target.value })} placeholder="เช่น FB-1020-001" />
            </Field>
            <Field label="ช่องทางที่ซื้อ">
              <Select value={f.channel} onChange={(e) => set({ channel: e.target.value as Complaint['channel'] })}>
                {Object.entries(CHANNEL_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
                <option value="other">อื่น ๆ</option>
              </Select>
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">แนบหลักฐานจำลอง เช่น ภาพแชต สลิปโอนเงิน ภาพสินค้า (ไม่บังคับ แต่ช่วยให้แก้ไขได้เร็วขึ้น)</p>
            <MockUpload value={f.evidence} onChange={(v) => set({ evidence: v })} kinds={['ภาพแชต', 'สลิปโอนเงิน', 'ภาพสินค้า']} />
          </div>
        )}

        {step === 5 && screening && (
          <div className="space-y-4">
            <dl className="divide-y divide-line">
              <InfoRow label="ร้านค้า">{sel?.merchant.shopName}</InfoRow>
              <InfoRow label="ประเภทปัญหา">{f.category && COMPLAINT_CATEGORY[f.category]}</InfoRow>
              <InfoRow label="หัวข้อ">{f.title || '-'}</InfoRow>
              <InfoRow label="รายละเอียด">{f.description || '-'}</InfoRow>
              <InfoRow label="วันที่เกิดเหตุ">{f.incidentDate ? fmtDate(f.incidentDate) : '-'}</InfoRow>
              <InfoRow label="คำสั่งซื้อ / มูลค่า">
                {f.orderRef || '-'} · {fmtMoney(f.orderAmount)}
              </InfoRow>
              <InfoRow label="หลักฐาน">
                <DocList docs={f.evidence} />
              </InfoRow>
            </dl>
            <ScreeningPanel s={screening} />
            {screening.missing.length >= 2 && (
              <Alert tone="warning" title="ข้อมูลยังไม่ครบถ้วน">
                คุณยังส่งเรื่องได้ แต่ร้านค้าหรือเจ้าหน้าที่อาจต้องขอข้อมูลเพิ่ม แนะนำให้ย้อนกลับไปเพิ่มข้อมูลที่ขาด
              </Alert>
            )}
            {screening.duplicateOf.length > 0 && (
              <Alert tone="warning" title="อาจเป็นการยื่นเรื่องซ้ำ">
                หากเป็นเหตุการณ์เดียวกัน แนะนำให้เปิดเรื่องเดิมและส่งข้อมูลเพิ่มเติมแทน เพื่อไม่ให้การพิจารณาล่าช้า
              </Alert>
            )}
            <label className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', screening.severe ? 'border-error/40 bg-error-50' : 'border-line')}>
              <input type="checkbox" checked={escalateNow} onChange={(e) => setEscalateNow(e.target.checked)} className="mt-1 h-5 w-5 accent-secondary" />
              <span>
                <b className="flex items-center gap-1">
                  <AlertOctagon className="h-4 w-4 text-error" />
                  ส่งต่อเจ้าหน้าที่ทันทีโดยไม่ต้องรอร้านค้า
                </b>
                ใช้สำหรับกรณีเสี่ยงร้ายแรง เช่น อันตรายต่อสุขภาพหรือความปลอดภัย {screening.severe && '(ระบบแนะนำสำหรับเรื่องนี้)'}
              </span>
            </label>
          </div>
        )}

        {step === 6 && created && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <div>
              <h2 className="text-xl font-bold text-ink">ยื่นเรื่องสำเร็จ</h2>
              <p className="text-sm text-ink-soft">
                Case ID <span className="font-mono font-semibold text-ink">{created.id}</span>
              </p>
            </div>
            <Alert tone={created.status === 'escalated' ? 'warning' : 'info'} className="text-left">
              {created.status === 'escalated'
                ? 'เรื่องถูกส่งต่อเจ้าหน้าที่ภายในระบบสาธิตแล้ว (ไม่ได้ส่งเข้าสู่ระบบของหน่วยงานจริง)'
                : 'ระบบแจ้งร้านค้าแล้ว ร้านค้าควรตอบกลับภายใน 3 วัน หากไม่ตอบหรือตกลงกันไม่ได้ คุณสามารถขอส่งต่อเจ้าหน้าที่ได้'}
            </Alert>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <LinkButton to={`/consumer/cases/${created.id}`}>ติดตามสถานะ</LinkButton>
              <LinkButton to="/check" variant="outline" icon={Search}>
                ตรวจสอบร้านอื่น
              </LinkButton>
            </div>
          </div>
        )}
      </Card>

      {step < 6 && (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? nav(-1) : setStep(step - 1))}>
            {step === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}
          </Button>
          <Button className="ml-auto" onClick={() => (step === 5 ? submit() : validate() && setStep(step + 1))}>
            {step === 5 ? 'ส่งเรื่อง (Submit)' : 'ถัดไป'}
          </Button>
        </div>
      )}
    </div>
  );
}
