import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FilePen, Send } from 'lucide-react';
import { useMerchantStore, useProfileChangeStore, useSessionStore, toast } from '@/stores';
import { changeRequestDraftKey, resubmitProfileChange } from '@/stores/workflowsV2';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { BUSINESS_CATEGORIES } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, CardHeader, EmptyState, LinkButton, ListLink, PageHeader, StatusBadge } from '@/components/common/ui';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { ChangeHistory, ChangeTable } from '../ProfileChangeParts';
import { PROFILE_CHANGE_FIELD_LABEL, PROFILE_CHANGE_STATUS, type ProfileChangeField, type ProfileChangeRequest } from '../types';

/** มุมร้านค้า: คำขอเปลี่ยนชื่อร้าน/หมวด — ติดตามสถานะ และแก้ไขส่งใหม่เมื่อเจ้าหน้าที่ขอข้อมูลเพิ่ม */
export default function MerchantProfileChanges() {
  const { id } = useParams();
  const op = useCurrentOperator();
  const all = useProfileChangeStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const mine = all.filter((r) => r.operatorId === op?.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  const shop = (mid: string) => merchants.find((m) => m.id === mid)?.shopName ?? mid;

  if (id) {
    const req = mine.find((r) => r.id === id);
    if (!req) return <EmptyState title="ไม่พบคำขอเปลี่ยนข้อมูลของบัญชีนี้" action={<LinkButton to="/m/profile-changes">ดูคำขอทั้งหมด</LinkButton>} />;
    return <Detail req={req} shopName={shop(req.merchantId)} />;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="คำขอเปลี่ยนข้อมูลร้าน" subtitle="ชื่อร้านและหมวดธุรกิจที่ผูกกับใบรับรอง ต้องให้เจ้าหน้าที่อนุมัติก่อนเปลี่ยน" icon={FilePen} />
      {mine.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id}>
                <ListLink
                  to={`/m/profile-changes/${r.id}`}
                  title={`${r.id} · ${shop(r.merchantId)}`}
                  subtitle={`${r.changes.map((c) => `${PROFILE_CHANGE_FIELD_LABEL[c.field]}: ${c.to}`).join(' · ')} · ${fmtDate(r.updatedAt, true)}`}
                  right={<StatusBadge map={PROFILE_CHANGE_STATUS} value={r.status} />}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="ยังไม่มีคำขอเปลี่ยนข้อมูลร้าน" desc="คำขอถูกสร้างเมื่อร้านที่ได้รับการรับรองแก้ชื่อร้านหรือหมวดธุรกิจในหน้าเติมข้อมูลโปรไฟล์จาก Marketplace" action={<LinkButton to="/m/marketplace">ไปที่ Marketplace</LinkButton>} />
      )}
    </div>
  );
}

type DraftData = { values: Partial<Record<ProfileChangeField, string>>; note: string; revision: number };

function Detail({ req, shopName }: { req: ProfileChangeRequest; shopName: string }) {
  const key = changeRequestDraftKey(req.id);
  const draft = useSessionStore((s) => s.shopDrafts[key]?.data as DraftData | undefined);
  const saveDraft = useSessionStore((s) => s.saveDraft);
  const editable = req.status === 'info_requested';
  const usable = draft && draft.revision === req.revision ? draft : undefined;
  const [values, setValues] = useState<Partial<Record<ProfileChangeField, string>>>(() => usable?.values ?? Object.fromEntries(req.changes.map((c) => [c.field, c.to])));
  const [note, setNote] = useState(usable?.note ?? '');
  const [revision] = useState(req.revision);

  // ฉบับร่างของการแก้ไขส่งใหม่ (Refresh แล้วข้อมูลยังอยู่)
  useEffect(() => {
    if (!editable) return;
    saveDraft(key, { step: 0, data: { values, note, revision }, savedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, note, editable]);

  const submit = () => {
    const r = resubmitProfileChange(req.id, values, note, revision);
    if (!r.ok) return toast.error('ส่งไม่ได้', r.error);
    toast.success(r.duplicate ? 'ส่งข้อมูลนี้แล้ว' : 'ส่งข้อมูลเพิ่มเติมแล้ว', 'รอเจ้าหน้าที่พิจารณาอีกครั้ง');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={`${req.id} — ${shopName}`} subtitle={`คำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง · ยื่นเมื่อ ${fmtDate(req.createdAt, true)}`} back={{ to: '/m/profile-changes', label: 'คำขอเปลี่ยนข้อมูลร้าน' }} action={<StatusBadge map={PROFILE_CHANGE_STATUS} value={req.status} />} />
      {req.status === 'pending' && <Alert tone="warning" title="รอเจ้าหน้าที่พิจารณา">โปรไฟล์และใบรับรองยังใช้ข้อมูลเดิมจนกว่าเจ้าหน้าที่อนุมัติ</Alert>}
      {req.status === 'approved' && <Alert tone="success" title="อนุมัติแล้ว">โปรไฟล์ร้านใช้ข้อมูลใหม่แล้ว · ระดับใบรับรองไม่เปลี่ยน</Alert>}
      {req.status === 'rejected' && <Alert tone="error" title="ไม่อนุมัติ — ข้อมูลร้านยังเป็นข้อมูลเดิม">{req.officerNote}</Alert>}
      {editable && <Alert tone="info" title="เจ้าหน้าที่ขอข้อมูลเพิ่มเติม">{req.officerNote}</Alert>}

      <Card>
        <CardHeader title="ข้อมูลเดิม · ข้อมูลใหม่ · ต้นฉบับ Marketplace" />
        <div className="p-4 sm:p-5">
          <ChangeTable changes={req.changes} req={req} />
        </div>
      </Card>

      {editable && (
        <Card className="space-y-4 p-5" aria-label="แก้ไขและส่งข้อมูลเพิ่มเติม">
          <p className="font-semibold text-ink">แก้ไขและส่งข้อมูลเพิ่มเติม</p>
          {req.changes.map((c) => (
            <Field key={c.field} label={`${PROFILE_CHANGE_FIELD_LABEL[c.field]}ใหม่`} required hint={`ข้อมูลเดิม: ${c.from}`}>
              {c.field === 'category' ? (
                <Select value={values.category ?? ''} onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}>
                  {BUSINESS_CATEGORIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              ) : (
                <Input value={values.shopName ?? ''} onChange={(e) => setValues((v) => ({ ...v, shopName: e.target.value }))} />
              )}
            </Field>
          ))}
          <Field label="ข้อมูลเพิ่มเติมสำหรับเจ้าหน้าที่" required hint="เช่น เหตุผลที่เปลี่ยนชื่อร้าน หรือเอกสารที่แนบ (จำลอง)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button icon={Send} onClick={submit}>
            ส่งข้อมูลเพิ่มเติม
          </Button>
          <p className="text-xs text-ink-soft">ฉบับร่างบันทึกในเบราว์เซอร์นี้ · ระบบไม่ส่งให้อัตโนมัติ</p>
        </Card>
      )}
      <ChangeHistory req={req} />
    </div>
  );
}
