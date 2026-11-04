import { useEffect, useMemo, useState } from 'react';
import { reportDemo } from '@/stores/demo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CheckCircle2, ClipboardEdit, Download, FlaskConical, Pencil, Phone, Plus, RefreshCw, Save, Store, Trash2, User, XCircle } from 'lucide-react';
import type { ChannelType, MockDocument } from '@/types';
import { useSessionStore, toast, confirmDialog } from '@/stores';
import { submitShopRegistration } from '@/stores/workflows';
import { submitMarketplaceRegistration } from '@/stores/workflowsV2';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { clearImported, fieldRows, newRegistrationRules, summarize, type FieldKey, type FieldValues, type ImportSource } from '@/features/marketplace/autofill';
import { FieldDiffTable, FieldStatusBadge, ImportSummaryBar, SourceDataCard } from '@/features/marketplace/components/ImportProvenance';
import { uid } from '@/utils/id';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { BUSINESS_CATEGORIES, CHANNEL_TYPES, COMPANY_TYPES, PROVINCES } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Button, Card, InfoRow, LinkButton, PageHeader } from '@/components/common/ui';
import { Stepper } from '@/components/common/Stepper';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { DocList, MockUpload } from '@/components/forms/MockUpload';

const STEPS = ['ประเภทธุรกิจ', 'ข้อมูลผู้ประกอบการ', 'ข้อมูลร้านค้า', 'ช่องทางขาย', 'เอกสารประกอบ', 'ตรวจสอบข้อมูล', 'ส่งคำขอ'];
const req = (m: string) => z.string().trim().min(1, m);

const schema = z
  .object({
    businessType: z.enum(['individual', 'juristic']),
    ownerName: z.string().trim(),
    companyName: z.string().trim(),
    registrationNo: z.string().trim(),
    companyType: z.string(),
    authorizedPerson: z.string().trim(),
    applicantName: z.string().trim(),
    shopName: req('กรุณากรอกชื่อร้านค้า').max(60, 'ชื่อร้านยาวเกิน 60 ตัวอักษร'),
    category: req('กรุณาเลือกประเภทธุรกิจ'),
    province: req('กรุณาเลือกจังหวัด'),
    district: req('กรุณากรอกอำเภอ/เขต'),
    address: z.string().trim(),
    phone: z.string().regex(/^0\d{8,9}$/, 'เบอร์โทรศัพท์ไม่ถูกต้อง'),
    email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
    description: z.string().trim().min(20, 'กรุณาอธิบายสินค้าและบริการอย่างน้อย 20 ตัวอักษร'),
    channels: z.array(z.object({ type: z.enum(['facebook', 'tiktok', 'line', 'website', 'marketplace']), handle: z.string().trim().min(3, 'กรุณากรอกชื่อบัญชี/ลิงก์') })).min(1, 'ต้องมีช่องทางขายอย่างน้อย 1 ช่องทาง'),
    agree: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.businessType === 'individual' && v.ownerName.length < 4) ctx.addIssue({ code: 'custom', path: ['ownerName'], message: 'กรุณากรอกชื่อและนามสกุล' });
    if (v.businessType === 'juristic') {
      if (!v.companyName) ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'กรุณากรอกชื่อนิติบุคคล' });
      if (!/^DEMO-\d{13}$/.test(v.registrationNo)) ctx.addIssue({ code: 'custom', path: ['registrationNo'], message: 'รูปแบบ: DEMO- ตามด้วยตัวเลข 13 หลัก (เลขจำลอง)' });
      if (!v.companyType) ctx.addIssue({ code: 'custom', path: ['companyType'], message: 'กรุณาเลือกประเภทนิติบุคคล' });
      if (!v.authorizedPerson) ctx.addIssue({ code: 'custom', path: ['authorizedPerson'], message: 'กรุณากรอกชื่อผู้มีอำนาจ' });
      if (!v.applicantName) ctx.addIssue({ code: 'custom', path: ['applicantName'], message: 'กรุณากรอกชื่อผู้แทนที่สมัคร' });
      if (!v.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'นิติบุคคลต้องระบุที่อยู่สถานประกอบการ' });
    }
  });
type Form = z.infer<typeof schema>;

const stepFields: (keyof Form)[][] = [
  ['businessType'],
  ['ownerName', 'companyName', 'registrationNo', 'companyType', 'authorizedPerson', 'applicantName'],
  ['shopName', 'category', 'province', 'district', 'address', 'phone', 'email', 'description'],
  ['channels'],
  [],
  ['agree'],
];

const fieldValues = (v: Partial<Form>): FieldValues => ({
  shopName: v.shopName ?? '',
  description: v.description ?? '',
  category: v.category ?? '',
  phone: v.phone ?? '',
  email: v.email ?? '',
  province: v.province ?? '',
  district: v.district ?? '',
  address: v.address ?? '',
});

type DraftData = Form & { docs?: MockDocument[]; importSource?: ImportSource; draftId?: string };

export default function RegisterShopWizard() {
  const nav = useNavigate();
  const op = useCurrentOperator()!;
  const draft = useSessionStore((s) => s.shopDrafts[op.id]);
  const saveDraft = useSessionStore((s) => s.saveDraft);
  const [params] = useSearchParams();
  const fromImport = params.get('from') === 'import';
  // มาจากการยืนยันนำเข้า → เปิดฉบับร่างทันทีตั้งแต่ Render แรก (ไม่ต้องถาม และไม่กระพริบเป็นขั้นแรก)
  const initial = fromImport && draft ? (draft.data as DraftData) : undefined;
  const [step, setStep] = useState(initial ? draft!.step : 0);
  useEffect(() => reportDemo('shop.step', step), [step]);
  const [docs, setDocs] = useState<MockDocument[]>(initial?.docs ?? []);
  const [docErr, setDocErr] = useState('');
  // v2: ข้อมูลต้นฉบับที่นำเข้าจาก Marketplace (จำลอง) — อ่านอย่างเดียว · รหัสฉบับร่างกันการส่งคำขอซ้ำ
  const [importSource, setImportSource] = useState<ImportSource | undefined>(initial?.importSource);
  const [draftId, setDraftId] = useState(() => initial?.draftId ?? uid('DRF'));
  // มาจากการยืนยันนำเข้า → เปิดฉบับร่างทันที (ไม่ต้องถาม)
  const [showDraftPrompt, setShowDraftPrompt] = useState(!!draft && !fromImport);
  const [result, setResult] = useState<{ appId: string; merchantId: string; flagged: boolean }>();

  const defaults: Form = useMemo(
    () => ({
      businessType: 'individual',
      ownerName: op.name,
      companyName: '',
      registrationNo: '',
      companyType: '',
      authorizedPerson: '',
      applicantName: op.name,
      shopName: '',
      category: '',
      province: op.province,
      district: '',
      address: '',
      phone: op.phone,
      email: op.email,
      description: '',
      channels: [{ type: 'facebook', handle: '' }],
      agree: false,
    }),
    [op],
  );

  const { register, handleSubmit, trigger, watch, setValue, getValues, reset, control, formState: { errors, isDirty } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: initial ? (() => { const { docs: _d, importSource: _s, draftId: _i, ...rest } = initial; return { ...defaults, ...rest }; })() : defaults });
  const channels = useFieldArray({ control, name: 'channels' });
  const bt = watch('businessType');
  const values = watch();

  /** โหลดฉบับร่าง (Resume) — รวมข้อมูลต้นฉบับที่นำเข้าและรหัสฉบับร่าง */
  const loadDraft = (d: NonNullable<typeof draft>) => {
    const { docs: dd, importSource: src, draftId: id, ...rest } = d.data as DraftData;
    reset({ ...defaults, ...rest });
    setDocs(dd ?? []);
    setImportSource(src);
    if (id) setDraftId(id);
    setStep(d.step);
  };

  // บันทึกฉบับร่างอัตโนมัติใน localStorage ของ v2 (Refresh / Back / Next ไม่ทำให้ข้อมูลหาย) — ไม่มีรหัสผ่าน Token หรือเลขบัตรประชาชน
  const snapshot = JSON.stringify(values);
  useEffect(() => {
    if (showDraftPrompt || step >= 6) return;
    if (!importSource && !isDirty && step === 0 && !docs.length) return;
    saveDraft(op.id, { step, data: { ...getValues(), docs, importSource, draftId }, savedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, docs, step, importSource, draftId, showDraftPrompt]);

  // สถานะที่มาของแต่ละช่อง (เมื่อเติมจากข้อมูลที่นำเข้า)
  const rows = importSource ? fieldRows(fieldValues(values), newRegistrationRules(importSource, bt === 'juristic')) : [];
  const summary = summarize(rows);
  const rowOf = (k: FieldKey) => rows.find((r) => r.key === k);
  const tag = (k: FieldKey) => {
    const r = rowOf(k);
    return r ? <FieldStatusBadge status={r.status} source={importSource} /> : undefined;
  };
  const originalHint = (k: FieldKey, fallback?: string) => {
    const r = rowOf(k);
    return r && (r.status === 'user_edited' || r.status === 'verification_required') ? `ต้นฉบับจาก Marketplace: ${r.imported}` : r?.status === 'missing' ? 'ไม่มีในข้อมูลที่นำเข้า — กรุณากรอกเพิ่ม' : fallback;
  };
  useEffect(() => reportDemo('reg.edited', summary.edited), [summary.edited]);

  const next = async () => {
    if (step === 4) {
      const needed = bt === 'juristic' ? 'หนังสือรับรองนิติบุคคล' : null;
      if (!docs.length) return setDocErr('เอกสารไม่ครบ: ต้องแนบเอกสารประกอบอย่างน้อย 1 รายการ');
      if (needed && !docs.some((d) => d.kind === needed)) return setDocErr(`เอกสารไม่ครบ: นิติบุคคลต้องแนบ "${needed}"`);
      setDocErr('');
      return setStep(5);
    }
    if (step === 5) {
      if (!getValues('agree')) return toast.error('กรุณายืนยันความถูกต้องของข้อมูล');
      return handleSubmit(onSubmit)();
    }
    const ok = await trigger(stepFields[step]);
    if (ok) setStep(step + 1);
    else toast.error('กรุณาตรวจสอบข้อมูลที่ไม่ถูกต้อง');
  };

  const onSubmit = (v: Form) => {
    const form = {
      businessType: v.businessType,
      ownerName: v.businessType === 'individual' ? v.ownerName : v.applicantName,
      juristic: v.businessType === 'juristic' ? { companyName: v.companyName, registrationNo: v.registrationNo, companyType: v.companyType, authorizedPerson: v.authorizedPerson, applicantName: v.applicantName } : undefined,
      shopName: v.shopName,
      category: v.category,
      province: v.province,
      district: v.district,
      address: v.address,
      phone: v.phone,
      email: v.email,
      description: v.description,
      channels: v.channels as { type: ChannelType; handle: string }[],
      documents: docs,
    };
    // ผู้สมัครกดส่งเองเท่านั้น — ส่งซ้ำจากฉบับร่างเดิมได้คำขอเดิม (ไม่สร้างร้าน/คำขอ/การเชื่อมต่อซ้ำ)
    const { merchant, app } = importSource
      ? submitMarketplaceRegistration(op.id, form, { draftId, source: importSource, juristic: v.businessType === 'juristic' })
      : submitShopRegistration(op.id, form, { draftId });
    saveDraft(op.id, undefined);
    setResult({ appId: app.id, merchantId: merchant.id, flagged: !!merchant.identityFlag });
    setStep(6);
    toast.success('ส่งคำขอลงทะเบียนแล้ว', app.id);
  };

  /** ยกเลิกการนำเข้า: ช่องที่ยังเป็นค่าจากแหล่งข้อมูลถูกล้าง ช่องที่ผู้สมัครแก้/กรอกเองยังอยู่ และจะไม่ผูกการเชื่อมต่อเมื่อส่งคำขอ */
  const cancelImport = async () => {
    if (!importSource) return;
    const r = await confirmDialog({
      title: 'ยกเลิกการนำเข้าข้อมูล?',
      body: `ช่องที่ยังเป็นค่าจาก ${PLATFORMS[importSource.platform].label} จะถูกล้าง ช่องที่คุณแก้ไขหรือกรอกเองยังอยู่ และร้านจะไม่ถูกเชื่อมต่อกับ Marketplace เมื่อส่งคำขอ`,
      confirmText: 'ยกเลิกการนำเข้า',
      tone: 'danger',
    });
    if (!r.ok) return;
    const cleared = clearImported(fieldValues(getValues()), importSource);
    (['shopName', 'description', 'category'] as const).forEach((k) => setValue(k, cleared[k], { shouldDirty: true }));
    const rest = getValues('channels').filter((c) => c.handle !== importSource.shopUrl);
    setValue('channels', rest.length ? rest : [{ type: 'facebook', handle: '' }], { shouldDirty: true });
    setImportSource(undefined);
    reportDemo('reg.imported', 0);
    toast.info('ยกเลิกการนำเข้าแล้ว', 'กรอกข้อมูลร้านด้วยตนเองต่อได้');
  };

  /** ช่องติดต่อไม่มีในข้อมูลที่นำเข้า — เติมจากบัญชีที่ยืนยันตัวตนแล้ว (สถานะ "กรอกเอง") */
  const fillAccountContact = () => {
    setValue('phone', op.phone, { shouldValidate: true, shouldDirty: true });
    setValue('email', op.email, { shouldValidate: true, shouldDirty: true });
    if (PROVINCES.includes(op.province)) setValue('province', op.province, { shouldValidate: true, shouldDirty: true });
  };

  // สำหรับการนำเสนอ: เติมข้อมูลตัวอย่างครบทุกขั้น แล้วไปขั้นตรวจสอบข้อมูล (ยังต้องติ๊กยืนยันและกดส่งเอง)
  const demoFill = () => {
    reset({
      ...defaults,
      businessType: 'individual',
      ownerName: op.name,
      shopName: 'ขนมไทยบ้านสวน',
      category: 'อาหารและเครื่องดื่ม',
      province: PROVINCES.includes(op.province) ? op.province : 'สงขลา',
      district: 'หาดใหญ่',
      description: 'ขนมไทยโบราณทำสดทุกวัน ระบุวันผลิตและวันหมดอายุทุกกล่อง เปลี่ยนสินค้าได้ภายใน 3 วันหากเสียหายจากการขนส่ง',
      channels: [
        { type: 'facebook', handle: 'khanomthai-bansuan.demo' },
        { type: 'line', handle: 'khanomthai.demo' },
      ],
      agree: false,
    });
    setDocs([
      { id: `doc-demo-${Date.now()}-1`, name: 'ทะเบียนพาณิชย์ (ตัวอย่างจำลอง).pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 240, addedAt: new Date().toISOString() },
      { id: `doc-demo-${Date.now()}-2`, name: 'ภาพสินค้า (ตัวอย่างจำลอง).jpg', kind: 'ภาพสินค้า', sizeKb: 860, addedAt: new Date().toISOString() },
    ]);
    setDocErr('');
    setStep(5);
    toast.info('เติมข้อมูลตัวอย่างแล้ว', 'ตรวจสอบข้อมูล ติ๊กยืนยัน แล้วกดส่งคำขอ');
  };

  const doSaveDraft = () => {
    saveDraft(op.id, { step, data: { ...getValues(), docs, importSource, draftId }, savedAt: new Date().toISOString() });
    toast.success('บันทึกฉบับร่างแล้ว', 'กลับมาทำต่อได้ภายหลังจากเมนูลงทะเบียนร้านค้า');
  };

  if (showDraftPrompt && draft)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="ลงทะเบียนร้านค้า" back={{ to: '/m', label: 'หน้าหลัก' }} />
        <Card className="p-5">
          <p className="font-semibold text-ink">พบฉบับร่างที่บันทึกไว้</p>
          <p className="mt-1 text-sm text-ink-soft">
            บันทึกเมื่อ {fmtDate(draft.savedAt, true)} · ค้างอยู่ที่ขั้นตอน "{STEPS[draft.step]}"
            {(draft.data as DraftData).importSource && ` · ข้อมูลนำเข้าจาก ${PLATFORMS[(draft.data as DraftData).importSource!.platform].label}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                loadDraft(draft);
                setShowDraftPrompt(false);
              }}
            >
              ทำต่อจากฉบับร่าง (Resume Draft)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                saveDraft(op.id, undefined);
                setShowDraftPrompt(false);
              }}
            >
              เริ่มใหม่
            </Button>
          </div>
        </Card>
      </div>
    );

  const err = (k: keyof Form) => (errors[k] as { message?: string } | undefined)?.message;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="ลงทะเบียนร้านค้า" subtitle="ข้อมูลจะใช้เพื่อการตรวจสอบในระบบสาธิตเท่านั้น" back={{ to: '/m', label: 'หน้าหลัก' }} />
      <Stepper steps={STEPS} current={step} />
      {step < 5 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-secondary/40 bg-secondary-50/50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm text-secondary">
            <FlaskConical className="h-4 w-4" />
            สำหรับการสาธิต
          </p>
          <Button size="sm" variant="outline" onClick={demoFill}>
            เติมข้อมูลตัวอย่าง
          </Button>
        </div>
      )}

      <Card className="p-5">
        {step === 0 && (
          <div className="space-y-3">
            {importSource ? (
              <Alert tone="info" title={`เติมข้อมูลร้านจาก ${PLATFORMS[importSource.platform].label} แล้ว`}>
                ร้าน "{importSource.shopName}" · ตรวจสอบและแก้ไขได้ในขั้น "ข้อมูลร้านค้า" ก่อนส่งคำขอ
              </Alert>
            ) : (
              <section aria-label="วิธีลงทะเบียน" className="space-y-2 border-b border-line pb-4">
                <p className="font-semibold text-ink">เลือกวิธีลงทะเบียน</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => nav('/m/register-shop/marketplace')} className="flex items-start gap-3 rounded-xl border-2 border-line p-4 text-left hover:border-primary/30">
                    <Store className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                    <span>
                      <span className="block font-semibold text-ink">A. เชื่อมต่อร้านค้าจาก Marketplace</span>
                      <span className="block text-sm text-ink-soft">Shopee (จำลอง) / Lazada (จำลอง) — เติมข้อมูลร้านอัตโนมัติ แล้วตรวจแก้ก่อนส่ง</span>
                    </span>
                  </button>
                  <div className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary-50/50 p-4" aria-current="step">
                    <ClipboardEdit className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                    <span>
                      <span className="block font-semibold text-ink">B. ลงทะเบียนด้วยตนเอง</span>
                      <span className="block text-sm text-ink-soft">สำหรับร้านที่ไม่ได้ใช้แพลตฟอร์มที่รองรับ — กรอกแบบฟอร์มด้านล่าง</span>
                    </span>
                    <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-primary" aria-hidden />
                  </div>
                </div>
              </section>
            )}
            <p className="font-semibold text-ink">เลือกรูปแบบธุรกิจ</p>
            {(
              [
                { v: 'individual', icon: User, t: 'บุคคลธรรมดา', d: 'ผู้ขายรายบุคคล ร้านค้าออนไลน์ หรือผู้มีทะเบียนพาณิชย์' },
                { v: 'juristic', icon: Building2, t: 'นิติบุคคล', d: 'บริษัท ห้างหุ้นส่วน ที่จดทะเบียนนิติบุคคล' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setValue('businessType', o.v)}
                className={cn('flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left', bt === o.v ? 'border-primary bg-primary-50/50' : 'border-line hover:border-primary/30')}
              >
                <o.icon className="h-6 w-6 shrink-0 text-primary" />
                <span>
                  <span className="block font-semibold text-ink">{o.t}</span>
                  <span className="block text-sm text-ink-soft">{o.d}</span>
                </span>
                {bt === o.v && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        )}

        {step === 1 &&
          (bt === 'individual' ? (
            <div className="space-y-4">
              <Field label="ชื่อและนามสกุลผู้ประกอบการ" required error={err('ownerName')} hint="ดึงจากข้อมูลบัญชี สามารถแก้ไขได้">
                <Input invalid={!!errors.ownerName} {...register('ownerName')} />
              </Field>
              <Alert tone="info">ระบบสาธิตไม่ขอเลขบัตรประชาชน ใช้ Mock Identity ID: {op.mockIdentityId}</Alert>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อนิติบุคคล" required error={err('companyName')} className="sm:col-span-2">
                <Input placeholder="บริษัท ตัวอย่าง จำกัด" invalid={!!errors.companyName} {...register('companyName')} />
              </Field>
              <Field label="เลขทะเบียนนิติบุคคล (จำลอง)" required error={err('registrationNo')} hint="ตัวอย่าง DEMO-0105569000123">
                <Input placeholder="DEMO-0000000000000" invalid={!!errors.registrationNo} {...register('registrationNo')} />
              </Field>
              <Field label="ประเภทนิติบุคคล" required error={err('companyType')}>
                <Select invalid={!!errors.companyType} {...register('companyType')}>
                  <option value="">เลือก</option>
                  {COMPANY_TYPES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="ชื่อผู้มีอำนาจลงนาม" required error={err('authorizedPerson')}>
                <Input invalid={!!errors.authorizedPerson} {...register('authorizedPerson')} />
              </Field>
              <Field label="ชื่อผู้แทนที่สมัคร" required error={err('applicantName')}>
                <Input invalid={!!errors.applicantName} {...register('applicantName')} />
              </Field>
            </div>
          ))}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {importSource ? (
              <section aria-label="ทบทวนข้อมูลที่นำเข้า" className="space-y-3 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">ทบทวนข้อมูลที่นำเข้า (Review Imported Information)</p>
                  <FieldStatusBadge status="imported" source={importSource} />
                </div>
                <ImportSummaryBar summary={summary} />
                <SourceDataCard source={importSource} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => nav('/m/register-shop/marketplace')}>
                    เปลี่ยน Marketplace / ร้าน
                  </Button>
                  <Button size="sm" variant="outline" icon={Phone} onClick={fillAccountContact}>
                    ใช้ข้อมูลติดต่อจากบัญชี
                  </Button>
                  <Button size="sm" variant="ghost" icon={XCircle} onClick={cancelImport}>
                    ยกเลิกการนำเข้า
                  </Button>
                </div>
                <p className="text-xs text-ink-soft">แก้ไขช่องด้านล่างได้ — ข้อมูลต้นฉบับด้านบนไม่เปลี่ยน และเจ้าหน้าที่จะเห็นความแตกต่างระหว่างต้นฉบับกับข้อมูลที่ส่ง</p>
              </section>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-50/50 p-3 sm:col-span-2">
                <p className="text-sm text-ink">มีร้านบน Shopee หรือ Lazada (จำลอง)? นำเข้าข้อมูลร้านอัตโนมัติแทนการกรอกเอง</p>
                <Button size="sm" variant="outline" icon={Download} onClick={() => nav('/m/register-shop/marketplace')}>
                  นำเข้าจาก Marketplace
                </Button>
              </div>
            )}
            <Field label="ชื่อร้านค้า" required error={err('shopName')} className="sm:col-span-2" extra={tag('shopName')} hint={originalHint('shopName')}>
              <Input placeholder="ชื่อที่ใช้บนช่องทางขาย" invalid={!!errors.shopName} {...register('shopName')} />
            </Field>
            <Field label="ประเภทธุรกิจ/หมวดสินค้า" required error={err('category')} extra={tag('category')} hint={originalHint('category')}>
              <Select invalid={!!errors.category} {...register('category')}>
                <option value="">เลือก</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="จังหวัด" required error={err('province')} extra={tag('province')} hint={originalHint('province')}>
              <Select invalid={!!errors.province} {...register('province')}>
                <option value="">เลือก</option>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="อำเภอ/เขต" required error={err('district')} extra={tag('district')} hint={originalHint('district')}>
              <Input invalid={!!errors.district} {...register('district')} />
            </Field>
            <Field label={bt === 'juristic' ? 'ที่อยู่สถานประกอบการ' : 'ที่อยู่ (ไม่บังคับ)'} required={bt === 'juristic'} error={err('address')} extra={tag('address')} hint={originalHint('address')}>
              <Input placeholder="ที่อยู่สมมติ" invalid={!!errors.address} {...register('address')} />
            </Field>
            <Field label="เบอร์โทรศัพท์ร้าน" required error={err('phone')} extra={tag('phone')} hint={originalHint('phone')}>
              <Input inputMode="numeric" invalid={!!errors.phone} {...register('phone')} />
            </Field>
            <Field label="อีเมลร้าน" required error={err('email')} extra={tag('email')} hint={originalHint('email')}>
              <Input type="email" invalid={!!errors.email} {...register('email')} />
            </Field>
            <Field label="รายละเอียดสินค้าและบริการ" required error={err('description')} className="sm:col-span-2" extra={tag('description')} hint={originalHint('description')}>
              <Textarea placeholder="สินค้าหลัก นโยบายการคืนสินค้า ระยะเวลาจัดส่ง" invalid={!!errors.description} {...register('description')} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">ระบุช่องทางขายทั้งหมด แต่ละช่องทางจะได้รับการตรวจสอบแยกกัน — การยืนยันตัวตนเจ้าของร้านไม่ได้หมายความว่าทุกบัญชีผ่านการตรวจสอบ</p>
            {channels.fields.map((f, i) => (
              <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row">
                <Select className="sm:w-48" {...register(`channels.${i}.type`)}>
                  {Object.entries(CHANNEL_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
                <div className="flex-1">
                  <Input placeholder={`${CHANNEL_TYPES[values.channels?.[i]?.type ?? 'facebook'].prefix}ชื่อบัญชี`} invalid={!!errors.channels?.[i]?.handle} {...register(`channels.${i}.handle`)} />
                  {errors.channels?.[i]?.handle && <p className="mt-1 text-xs text-error">{errors.channels[i]?.handle?.message}</p>}
                </div>
                <Button variant="ghost" icon={Trash2} onClick={() => channels.remove(i)} disabled={channels.fields.length === 1} aria-label="ลบช่องทาง" />
              </div>
            ))}
            {errors.channels?.message && <p className="text-xs text-error">{errors.channels.message}</p>}
            <Button variant="secondary" icon={Plus} onClick={() => channels.append({ type: 'line', handle: '' })} disabled={channels.fields.length >= 5}>
              เพิ่มช่องทางขาย
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">แนบเอกสารจำลอง (กดปุ่มเพื่อสร้างไฟล์ตัวอย่าง หรือเลือกไฟล์ใดก็ได้ ระบบเก็บเฉพาะชื่อไฟล์)</p>
            <MockUpload
              value={docs}
              onChange={(d) => {
                setDocs(d);
                setDocErr('');
              }}
              kinds={bt === 'juristic' ? ['หนังสือรับรองนิติบุคคล', 'ใบอนุญาตที่เกี่ยวข้อง', 'ภาพสถานประกอบการ'] : ['ทะเบียนพาณิชย์', 'ภาพสินค้า', 'ภาพสถานที่']}
            />
            {docErr && <Alert tone="error" title="Incomplete Documents">{docErr}</Alert>}
          </div>
        )}

        {step === 5 && (
          <div>
            {importSource && (
              <section aria-label="ตรวจสอบข้อมูลที่นำเข้าและแก้ไข" className="mb-4 space-y-3 border-b border-line pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">ข้อมูลที่นำเข้าและแก้ไข</p>
                  <FieldStatusBadge status="imported" source={importSource} />
                </div>
                <ImportSummaryBar summary={summary} />
                <FieldDiffTable rows={rows} source={importSource} />
                <p className="text-xs text-ink-soft">
                  ระบบไม่ส่งคำขออัตโนมัติ — ตรวจสอบแล้วติ๊กยืนยันและกด "ส่งคำขอ" ด้วยตนเอง · การประเมินใช้ข้อมูลต้นฉบับจาก {PLATFORMS[importSource.platform].label} (Shop ID {importSource.mockShopId}) ไม่ใช่ข้อมูลที่แก้ในแบบฟอร์ม
                </p>
              </section>
            )}
            {[
              { title: 'ประเภทธุรกิจ', s: 0, rows: [['รูปแบบ', bt === 'juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา']] },
              {
                title: 'ข้อมูลผู้ประกอบการ',
                s: 1,
                rows:
                  bt === 'juristic'
                    ? [['ชื่อนิติบุคคล', values.companyName], ['เลขทะเบียน (จำลอง)', values.registrationNo], ['ประเภท', values.companyType], ['ผู้มีอำนาจ', values.authorizedPerson], ['ผู้แทนที่สมัคร', values.applicantName]]
                    : [['ชื่อ-นามสกุล', values.ownerName]],
              },
              { title: 'ข้อมูลร้านค้า', s: 2, rows: [['ชื่อร้าน', values.shopName], ['หมวด', values.category], ['ที่ตั้ง', `${values.district}, ${values.province}`], ['ติดต่อ', `${values.phone} · ${values.email}`], ['รายละเอียด', values.description]] },
              { title: 'ช่องทางขาย', s: 3, rows: values.channels.map((c) => [CHANNEL_TYPES[c.type].label, c.handle]) },
            ].map((sec) => (
              <div key={sec.title} className="border-b border-line py-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{sec.title}</p>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setStep(sec.s)}>
                    แก้ไข
                  </Button>
                </div>
                <dl>
                  {sec.rows.map(([k, v], i) => (
                    <InfoRow key={i} label={k}>
                      {v || '-'}
                    </InfoRow>
                  ))}
                </dl>
              </div>
            ))}
            <div className="py-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">เอกสารประกอบ ({docs.length})</p>
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setStep(4)}>
                  แก้ไข
                </Button>
              </div>
              <DocList docs={docs} />
            </div>
            {op.kycStatus !== 'verified' && <Alert tone="warning" className="mb-3">คุณยังไม่ได้ยืนยันตัวตน เจ้าหน้าที่จะตรวจสอบคำขอได้ครบถ้วนหลังยืนยันตัวตนแล้ว</Alert>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" {...register('agree')} />
              ข้าพเจ้ายืนยันว่าข้อมูลข้างต้นถูกต้อง (ข้อมูลสมมติเพื่อการสาธิต) และยินยอมให้เจ้าหน้าที่ตรวจสอบภายในระบบสาธิต
            </label>
          </div>
        )}

        {step === 6 && result && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <div>
              <h2 className="text-xl font-bold text-ink">ส่งคำขอเรียบร้อย</h2>
              <p className="text-sm text-ink-soft">
                เลขที่คำขอ <span className="font-mono font-semibold text-ink">{result.appId}</span> · รหัสร้าน {result.merchantId}
              </p>
            </div>
            {result.flagged && <Alert tone="warning">ระบบพบข้อสังเกตเกี่ยวกับประวัติของบัญชีนี้ คำขอจะได้รับการพิจารณาเป็นพิเศษโดยเจ้าหน้าที่ (ไม่ใช่การปฏิเสธอัตโนมัติ)</Alert>}
            <ol className="mx-auto max-w-sm space-y-2 text-left text-sm">
              {['ส่งคำขอแล้ว (Submitted)', 'รอเจ้าหน้าที่ตรวจสอบ (Pending Review)', 'ตรวจสอบข้อมูล (Under Verification)', 'ผลการพิจารณา (Approved / Need More Info / Rejected)'].map((t, i) => (
                <li key={t} className="flex items-center gap-2">
                  <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs font-semibold', i === 0 ? 'bg-success text-white' : 'bg-bg text-ink-soft')}>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <LinkButton to="/m/shop">ดูสถานะคำขอ</LinkButton>
              <LinkButton to="/m" variant="outline">
                กลับหน้าหลัก
              </LinkButton>
            </div>
          </div>
        )}
      </Card>

      {step < 6 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => (step === 0 ? nav('/m') : setStep(step - 1))}>
            {step === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}
          </Button>
          <Button variant="ghost" icon={Save} onClick={doSaveDraft}>
            บันทึกฉบับร่าง
          </Button>
          <Button className="ml-auto" onClick={next}>
            {step === 5 ? 'ส่งคำขอ' : 'ถัดไป'}
          </Button>
        </div>
      )}
    </div>
  );
}
