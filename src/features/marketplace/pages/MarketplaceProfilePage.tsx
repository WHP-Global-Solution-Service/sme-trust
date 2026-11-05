import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, RotateCcw, Save } from 'lucide-react';
import { useCertificationStore, useImportRecordStore, useMarketplaceStore, useMerchantStore, useSessionStore, toast } from '@/stores';
import { confirmProfileUpdate, importRecordsOf, profileDraftKey, registeredValues, sourceOfConnection } from '@/stores/workflowsV2';
import { reportDemo } from '@/stores/demo';
import { fieldRows, profileUpdateRules, summarize, FIELD_LABEL, type FieldKey, type FieldValues } from '../autofill';
import { PLATFORMS } from '../data/platforms';
import { FieldDiffTable, FieldStatusBadge, ImportSummaryBar, SourceDataCard } from '../components/ImportProvenance';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { ChangeRequestNotice } from '@/features/profile-change/ProfileChangeParts';
import { currentCert } from '@/utils/trust';
import { uid } from '@/utils/id';
import { BUSINESS_CATEGORIES, PROVINCES } from '@/constants/labels';
import { Alert, Button, Card, EmptyState, LinkButton, PageHeader } from '@/components/common/ui';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';

const PHONE = /^0\d{8,9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ร้านเดิมเชื่อม Marketplace แล้วเติมข้อมูลโปรไฟล์อัตโนมัติ (Scenario 9)
 * Connect → อนุญาต (จำลอง) → นำเข้า → Auto-Fill โปรไฟล์ร้านเดิม → ตรวจ/แก้ไข → ยืนยันอัปเดต
 * ไม่ใช่การสมัครร้านใหม่ ไม่สร้างคำขอลงทะเบียน และไม่เปลี่ยนใบรับรองเดิม
 */
export default function MarketplaceProfilePage() {
  const { id = '' } = useParams();
  const op = useCurrentOperator();
  const c = useMarketplaceStore((s) => s.items.find((x) => x.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === c?.merchantId));
  const cert = useCertificationStore((s) => (m ? currentCert(s.items, m.id) : undefined));
  const records = useImportRecordStore((s) => s.items);
  const key = profileDraftKey(id);
  const draft = useSessionStore((s) => s.shopDrafts[key]);
  const saveDraft = useSessionStore((s) => s.saveDraft);
  const owned = !!c && !!m && m.operatorId === op?.id;
  const ready = owned && c!.status === 'connected' && !!c!.lastSyncAt;

  const source = useMemo(() => (ready ? sourceOfConnection(c!, m!) : undefined), [ready, c, m]);
  const registered = useMemo(() => (m ? registeredValues(m) : undefined), [m]);
  /**
   * Auto-Fill: คำอธิบายร้านจากข้อมูลที่นำเข้า · ชื่อร้าน/หมวดใช้ข้อมูลที่อนุมัติแล้วในระบบ (ผูกกับใบรับรอง — เปลี่ยนได้ผ่านคำขอให้เจ้าหน้าที่อนุมัติ)
   * ช่องติดต่อ/ที่อยู่ไม่มีในแหล่งข้อมูล → ใช้ข้อมูลเดิมในระบบ
   */
  const autofill = useMemo<FieldValues | undefined>(() => (source && registered ? { ...registered, description: source.description } : undefined), [source, registered]);

  const saved = draft?.data as { values?: FieldValues; draftId?: string } | undefined;
  const [values, setValues] = useState<FieldValues | undefined>(saved?.values);
  const [draftId] = useState(() => saved?.draftId ?? uid('DRF'));
  const [checked, setChecked] = useState(false);
  const [editAgain, setEditAgain] = useState(false);
  useEffect(() => {
    if (!values && autofill) setValues(saved?.values ?? autofill);
  }, [autofill, values, saved?.values]);

  const last = useMemo(() => (m ? importRecordsOf(m.id).find((r) => r.connectionId === id) : undefined), [m, id, records]);
  const done = !!last && !draft && !editAgain;

  // บันทึกฉบับร่างอัตโนมัติ (Refresh แล้วข้อมูลยังอยู่)
  useEffect(() => {
    if (!values || !ready || done) return;
    saveDraft(key, { step: 1, data: { values, draftId }, savedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, ready, done]);

  const rows = values && source && registered ? fieldRows(values, profileUpdateRules(source, registered)) : [];
  const summary = summarize(rows);
  useEffect(() => reportDemo('profile.edited', summary.edited), [summary.edited]);
  useEffect(() => reportDemo('profile.loaded', ready && !!values ? 1 : 0), [ready, values]);

  if (!owned) return <EmptyState title="ไม่พบการเชื่อมต่อ Marketplace ของร้านนี้" action={<LinkButton to="/m/marketplace">กลับไปหน้า Marketplace</LinkButton>} />;
  if (!ready)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="เติมข้อมูลโปรไฟล์ร้านจาก Marketplace" back={{ to: '/m/marketplace', label: 'Marketplace' }} />
        <Alert tone="warning" title="การเชื่อมต่อยังไม่พร้อม">
          ต้องซิงก์ข้อมูลจาก {PLATFORMS[c!.platform].label} สำเร็จก่อน (สถานะปัจจุบัน: {c!.status}) — ฉบับร่างที่ค้างจากการเชื่อมต่อนี้ถูกล้างเมื่อยกเลิกการเชื่อมต่อ
        </Alert>
      </div>
    );

  const set = (k: FieldKey, v: string) => setValues((x) => (x ? { ...x, [k]: v } : x));
  const rowOf = (k: FieldKey) => rows.find((r) => r.key === k);
  const hint = (k: FieldKey) => {
    const r = rowOf(k);
    if (!r) return undefined;
    if (r.status === 'verification_required') return `ข้อมูลเดิม: ${r.registered} — ถ้าเปลี่ยน ต้องให้เจ้าหน้าที่ตรวจก่อน (ยังไม่เปลี่ยนในใบรับรอง)`;
    if (r.imported !== undefined && r.registered !== undefined && r.current !== r.registered) return `ข้อมูลเดิมในระบบ: ${r.registered || '—'}`;
    if (r.status === 'user_edited' && r.imported !== undefined) return `ต้นฉบับจาก Marketplace: ${r.imported}`;
    if (r.imported === undefined) return 'ไม่มีในข้อมูลจาก Marketplace — ใช้ข้อมูลเดิมในระบบ แก้ไขได้';
    return undefined;
  };
  const tag = (k: FieldKey) => {
    const r = rowOf(k);
    return r ? <FieldStatusBadge status={r.status} source={source} registeredLabel /> : undefined;
  };
  const invalid = values ? [!PHONE.test(values.phone) && 'เบอร์โทรศัพท์', !EMAIL.test(values.email) && 'อีเมล'].filter(Boolean) : [];

  const confirm = () => {
    if (!values) return;
    if (invalid.length) return toast.error('ข้อมูลไม่ถูกต้อง', invalid.join(', '));
    const r = confirmProfileUpdate(id, values, draftId);
    if (!r.ok) return toast.error('ยังอัปเดตไม่ได้', r.error);
    saveDraft(key, undefined);
    setEditAgain(false);
    reportDemo('profile.confirmed', 1);
    toast.success('อัปเดตข้อมูลร้านแล้ว', r.record?.pending.length ? `รอเจ้าหน้าที่ตรวจ: ${r.record.pending.map((k) => FIELD_LABEL[k]).join(', ')}` : 'ไม่เปลี่ยนใบรับรองและข้อมูลต้นฉบับจาก Marketplace');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={`เติมข้อมูลโปรไฟล์ร้านจาก ${PLATFORMS[c!.platform].label}`} subtitle={`ร้าน ${m!.shopName} (${m!.id}) · อัปเดตข้อมูลร้านเดิม — ไม่ใช่การสมัครร้านใหม่`} back={{ to: '/m/marketplace', label: 'Marketplace' }} />
      <Alert tone="info">
        {cert ? `ร้านได้รับการรับรอง Level ${cert.level} อยู่แล้ว — ` : ''}การอัปเดตนี้ไม่สร้างคำขอลงทะเบียนใหม่และไม่เปลี่ยนใบรับรอง · คำอธิบาย ช่องทางติดต่อ และที่อยู่ บันทึกทันที · ชื่อร้านและหมวดที่ผูกกับใบรับรอง ถ้าเปลี่ยนจะเป็นคำขอให้เจ้าหน้าที่อนุมัติ (ข้อมูลเดิมยังใช้อยู่จนกว่าอนุมัติ)
      </Alert>
      {!done && <ChangeRequestNotice merchantId={m!.id} role="merchant" />}

      {done && last ? (
        <Card className="space-y-3 p-5" >
          <div role="status" className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            อัปเดตข้อมูลร้านแล้ว ({last.id})
          </div>
          <ImportSummaryBar summary={last.summary} />
          <p className="text-sm text-ink">บันทึกลงโปรไฟล์: {last.applied.length ? last.applied.map((k) => FIELD_LABEL[k]).join(', ') : 'ไม่มีช่องที่เปลี่ยน'}</p>
          {last.pending.length > 0 && <p className="text-sm text-warning">รอเจ้าหน้าที่ตรวจ (ยังไม่เปลี่ยน): {last.pending.map((k) => FIELD_LABEL[k]).join(', ')}</p>}
          {last.changeRequestId && <ChangeRequestNotice merchantId={m!.id} role="merchant" />}
          <FieldDiffTable rows={last.rows} source={last.source} showRegistered />
          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/m/marketplace/data/${id}`} icon={ChevronRight}>
              ดูภาพรวมข้อมูล Marketplace
            </LinkButton>
            <Button
              variant="outline"
              onClick={() => {
                setValues(autofill);
                setEditAgain(true);
              }}
            >
              อัปเดตอีกครั้ง
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <ImportSummaryBar summary={summary} />
          {source && <SourceDataCard source={source} connection={c} />}
          <Card className="p-5">
            <section aria-label="ข้อมูลโปรไฟล์ร้าน (แก้ไขได้)" className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อร้านที่ใช้แสดง" required className="sm:col-span-2" extra={tag('shopName')} hint={hint('shopName')}>
                <Input value={values?.shopName ?? ''} onChange={(e) => set('shopName', e.target.value)} />
              </Field>
              <Field label="หมวดหมู่ธุรกิจ" required extra={tag('category')} hint={hint('category')}>
                <Select value={values?.category ?? ''} onChange={(e) => set('category', e.target.value)}>
                  {BUSINESS_CATEGORIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label="จังหวัด" required extra={tag('province')} hint={hint('province')}>
                <Select value={values?.province ?? ''} onChange={(e) => set('province', e.target.value)}>
                  {PROVINCES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label="อำเภอ/เขต" required extra={tag('district')} hint={hint('district')}>
                <Input value={values?.district ?? ''} onChange={(e) => set('district', e.target.value)} />
              </Field>
              <Field label="ที่อยู่ธุรกิจ" extra={tag('address')} hint={hint('address')}>
                <Input value={values?.address ?? ''} onChange={(e) => set('address', e.target.value)} />
              </Field>
              <Field label="เบอร์โทรศัพท์ร้าน" required extra={tag('phone')} hint={hint('phone')} error={values && !PHONE.test(values.phone) ? 'เบอร์โทรศัพท์ไม่ถูกต้อง' : undefined}>
                <Input inputMode="numeric" value={values?.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="อีเมลร้าน" required extra={tag('email')} hint={hint('email')} error={values && !EMAIL.test(values.email) ? 'รูปแบบอีเมลไม่ถูกต้อง' : undefined}>
                <Input type="email" value={values?.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="คำอธิบายธุรกิจ" required className="sm:col-span-2" extra={tag('description')} hint={hint('description')}>
                <Textarea value={values?.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </section>
          </Card>
          <Card className="space-y-3 p-5">
            <p className="font-semibold text-ink">ตรวจสอบก่อนยืนยัน</p>
            <FieldDiffTable rows={rows} source={source} showRegistered />
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
              ข้าพเจ้าตรวจสอบข้อมูลแล้ว และยืนยันอัปเดตโปรไฟล์ร้าน (ข้อมูลสมมติเพื่อการสาธิต)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button icon={Save} disabled={!checked || summary.missing > 0} onClick={confirm}>
                ยืนยันการอัปเดตข้อมูลร้าน
              </Button>
              <Button variant="outline" icon={RotateCcw} onClick={() => setValues(autofill)}>
                คืนค่าตามข้อมูลที่นำเข้า
              </Button>
            </div>
            <p className="text-xs text-ink-soft">ระบบไม่บันทึกอัตโนมัติจนกว่าจะกดยืนยัน (ฉบับร่างเก็บในเบราว์เซอร์นี้) · คะแนน รีวิว ยอดขาย และผลประเมินใช้ข้อมูลต้นฉบับจาก Marketplace เสมอ</p>
          </Card>
        </>
      )}
    </div>
  );
}
