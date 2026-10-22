import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Send } from 'lucide-react';
import { useComplaintStore, useMerchantStore, toast } from '@/stores';
import { issueWarning } from '@/stores/workflows';
import { courses } from '@/mock/data';
import { COMPLAINT_CATEGORY } from '@/constants/labels';
import { cn } from '@/utils/cn';
import { Button, Card, PageHeader } from '@/components/common/ui';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { KindExplainer } from './WarningParts';

const schema = z.object({
  merchantId: z.string().min(1, 'กรุณาเลือกร้านค้า'),
  kind: z.enum(['advisory', 'warning']),
  title: z.string().trim().min(5, 'กรุณาระบุหัวข้อ'),
  issue: z.string().trim().min(15, 'กรุณาบันทึกประเด็นที่พบอย่างน้อย 15 ตัวอักษร'),
  guidance: z.string().trim().min(10, 'กรุณาระบุแนวทางแก้ไข'),
  items: z.string(),
  courseIds: z.array(z.string()),
  dueDate: z.string().min(1, 'กรุณากำหนดวันครบกำหนด'),
  relatedComplaintIds: z.array(z.string()),
});
type Form = z.infer<typeof schema>;

const in14 = () => new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

export default function NewWarningPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const merchants = useMerchantStore((s) => s.items.filter((m) => m.registrationStatus === 'approved'));
  const complaints = useComplaintStore((s) => s.items);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { merchantId: params.get('merchant') ?? '', kind: 'warning', title: '', issue: '', guidance: '', items: '', courseIds: [], dueDate: in14(), relatedComplaintIds: [] },
  });
  const merchantId = watch('merchantId');
  const kind = watch('kind');
  const related = complaints.filter((c) => c.merchantId === merchantId);

  const example = () => {
    setValue('title', 'ข้อความโฆษณาที่อาจทำให้เข้าใจผิด');
    setValue('issue', 'พบโพสต์ขายสินค้าที่ใช้ข้อความ "เห็นผลทันที 100%" โดยไม่มีข้อมูลรองรับ ซึ่งอาจทำให้ผู้บริโภคเข้าใจผิดเกี่ยวกับคุณสมบัติสินค้า');
    setValue('guidance', 'แก้ไขข้อความโฆษณาให้ตรงกับข้อมูลผลิตภัณฑ์ และระบุว่าผลลัพธ์ขึ้นกับแต่ละบุคคล');
    setValue('items', 'แก้ไขหรือลบโพสต์ที่มีข้อความเกินจริง\nตรวจสอบคำบรรยายสินค้าในทุกช่องทาง\nเข้าอบรมหลักสูตรการโฆษณาสินค้าออนไลน์อย่างเหมาะสม');
    setValue('courseIds', ['CRS-02']);
  };

  const onSubmit = (v: Form) => {
    const w = issueWarning({ ...v, items: v.items.split('\n').map((s) => s.trim()).filter(Boolean) });
    toast.success(v.kind === 'advisory' ? 'ออกคำแนะนำแล้ว' : 'ออกคำเตือนแล้ว', `${w.id} — ร้านค้าได้รับการแจ้งเตือน`);
    nav(`/o/warnings/${w.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ออกคำแนะนำ / คำเตือน" icon={AlertTriangle} back={{ to: '/o/warnings', label: 'Warnings' }} action={<Button variant="outline" size="sm" onClick={example}>เติมตัวอย่าง</Button>} />
      <KindExplainer />
      <Card className="mt-4 p-5">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ร้านค้า" required error={errors.merchantId?.message}>
              <Select invalid={!!errors.merchantId} {...register('merchantId')}>
                <option value="">เลือกร้านค้า</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.shopName} ({m.id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="กำหนดแก้ไขภายใน" required error={errors.dueDate?.message}>
              <Input type="date" {...register('dueDate')} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['advisory', 'warning'] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setValue('kind', k)}
                className={cn('rounded-xl border-2 p-3 text-left text-sm', kind === k ? (k === 'advisory' ? 'border-info bg-info-50' : 'border-warning bg-warning-50') : 'border-line')}
              >
                <b>{k === 'advisory' ? 'คำแนะนำ (Advisory)' : 'คำเตือน (Warning)'}</b>
                <span className="block text-ink-soft">{k === 'advisory' ? 'ไม่ใช่มาตรการลงโทษ ไม่กระทบการรับรอง' : 'ต้องแก้ไขภายในกำหนด สถานะร้านแสดง "มีคำเตือน"'}</span>
              </button>
            ))}
          </div>
          <Field label="หัวข้อ" required error={errors.title?.message}>
            <Input invalid={!!errors.title} {...register('title')} />
          </Field>
          <Field label="บันทึกประเด็นที่พบ" required error={errors.issue?.message}>
            <Textarea invalid={!!errors.issue} {...register('issue')} />
          </Field>
          <Field label="คำแนะนำ / แนวทางแก้ไข" required error={errors.guidance?.message}>
            <Textarea invalid={!!errors.guidance} {...register('guidance')} />
          </Field>
          <Field label="รายการที่ต้องปรับปรุง (บรรทัดละ 1 รายการ)" hint="ถ้าเว้นว่าง ร้านค้าเพียงกดรับทราบ">
            <Textarea rows={4} {...register('items')} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">แนบหลักสูตรอบรม</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" value={c.id} className="h-5 w-5 accent-primary" {...register('courseIds')} />
                  {c.title}
                </label>
              ))}
            </div>
          </div>
          {related.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">ข้อร้องเรียนที่เกี่ยวข้อง</p>
              <div className="space-y-1.5">
                {related.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <input type="checkbox" value={c.id} className="h-5 w-5 accent-primary" {...register('relatedComplaintIds')} />
                    <span className="font-mono text-xs">{c.id}</span> {c.title} · {COMPLAINT_CATEGORY[c.category]}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav('/o/warnings')}>
              ยกเลิก
            </Button>
            <Button type="submit" icon={Send}>
              {kind === 'advisory' ? 'ออกคำแนะนำ' : 'ออกคำเตือน'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
