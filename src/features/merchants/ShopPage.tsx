import { useState } from 'react';
import { AlertTriangle, ClipboardEdit, ExternalLink, FileText, Plus, Send, Store } from 'lucide-react';
import type { ChannelType, MockDocument } from '@/types';
import { useVerificationStore, toast } from '@/stores';
import { addChannel, resubmitApplication } from '@/stores/workflows';
import { useMerchantView, useMyMerchants } from '@/hooks/useCurrent';
import { CHANNEL_STATUS, CHANNEL_TYPES, REGISTRATION_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, CardHeader, EmptyState, InfoRow, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { VerdictBadge } from '@/components/common/Trust';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { DocList, MockUpload } from '@/components/forms/MockUpload';
import { ShopSwitcher } from './ShopSwitcher';

export default function ShopPage() {
  const { mine, active } = useMyMerchants();
  const view = useMerchantView(active?.id);
  const apps = useVerificationStore((s) => s.items);
  const [note, setNote] = useState('');
  const [docs, setDocs] = useState<MockDocument[]>([]);
  const [chType, setChType] = useState<ChannelType>('line');
  const [chHandle, setChHandle] = useState('');

  if (!active || !view)
    return (
      <div>
        <PageHeader title="ข้อมูลร้านค้า" icon={Store} />
        <Card>
          <EmptyState icon={Store} title="ยังไม่มีร้านค้า" desc="เริ่มลงทะเบียนร้านค้าแรกของคุณเพื่อรับการตรวจสอบ" action={<LinkButton to="/m/register-shop" icon={ClipboardEdit}>ลงทะเบียนร้านค้า</LinkButton>} />
        </Card>
      </div>
    );

  const m = active;
  const regApp = apps.filter((a) => a.merchantId === m.id && a.type === 'registration').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  const canResubmit = regApp && ['need_info', 'rejected'].includes(regApp.status);

  return (
    <div>
      <PageHeader
        title={m.shopName}
        subtitle={`รหัสร้าน ${m.id} · ${m.businessType === 'juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}`}
        icon={Store}
        action={<LinkButton to="/m/register-shop" variant="outline" icon={Plus}>ลงทะเบียนร้านเพิ่ม</LinkButton>}
      />
      <ShopSwitcher />

      {m.registrationStatus === 'draft' && (
        <Alert tone="info" className="mb-4" action={<LinkButton to="/m/register-shop" size="sm">ทำต่อ</LinkButton>}>
          ร้านค้านี้ยังเป็นฉบับร่าง ยังไม่ได้ส่งคำขอตรวจสอบ
        </Alert>
      )}
      {['submitted', 'pending_review', 'under_verification'].includes(m.registrationStatus) && (
        <Alert tone="warning" title="Pending Approval" className="mb-4">
          คำขออยู่ระหว่างการพิจารณา ระหว่างนี้ร้านค้ายังไม่ได้รับสถานะผ่านเกณฑ์ธุรกิจ
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {canResubmit && (
            <Card className="border-warning/40">
              <CardHeader title={regApp.status === 'rejected' ? 'คำขอไม่ได้รับอนุมัติ' : 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม'} icon={AlertTriangle} />
              <div className="space-y-3 p-4 sm:p-5">
                <Alert tone={regApp.status === 'rejected' ? 'error' : 'warning'} title="เหตุผล / สิ่งที่ต้องดำเนินการ">
                  {regApp.rejectReason ?? regApp.infoRequest}
                </Alert>
                {regApp.status === 'rejected' && (
                  <p className="text-sm text-ink-soft">วิธียื่นใหม่: แก้ไขตามเหตุผลข้างต้น แนบเอกสารที่เกี่ยวข้อง แล้วกด "ยื่นคำขออีกครั้ง" คำขอจะกลับเข้าสู่คิวตรวจสอบ</p>
                )}
                <Field label="คำชี้แจงถึงเจ้าหน้าที่">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="อธิบายสิ่งที่แก้ไขหรือแนบเพิ่ม" />
                </Field>
                <MockUpload value={docs} onChange={setDocs} kinds={['ทะเบียนพาณิชย์', 'เอกสารเพิ่มเติม']} />
                <Button
                  icon={Send}
                  onClick={() => {
                    if (!docs.length && note.trim().length < 5) return toast.error('กรุณาแนบเอกสารหรือเขียนคำชี้แจง');
                    resubmitApplication(regApp.id, note, docs);
                    setNote('');
                    setDocs([]);
                    toast.success('ส่งข้อมูลเพิ่มเติมแล้ว', 'คำขอกลับเข้าสู่คิวตรวจสอบ');
                  }}
                >
                  {regApp.status === 'rejected' ? 'ยื่นคำขออีกครั้ง' : 'ส่งข้อมูลเพิ่มเติม'}
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="ข้อมูลร้านค้า" action={<StatusBadge map={REGISTRATION_STATUS} value={m.registrationStatus} />} />
            <dl className="divide-y divide-line px-4 sm:px-5">
              <InfoRow label="สถานะความน่าเชื่อถือ">
                <VerdictBadge verdict={view.verdict} size="sm" />
              </InfoRow>
              <InfoRow label="ผู้ประกอบการ">{m.ownerName}</InfoRow>
              {m.juristic && (
                <>
                  <InfoRow label="นิติบุคคล">{m.juristic.companyName}</InfoRow>
                  <InfoRow label="เลขทะเบียน (จำลอง)">{m.juristic.registrationNo}</InfoRow>
                  <InfoRow label="ประเภท / ผู้มีอำนาจ">
                    {m.juristic.companyType} · {m.juristic.authorizedPerson}
                  </InfoRow>
                </>
              )}
              <InfoRow label="หมวดสินค้า">{m.category}</InfoRow>
              <InfoRow label="ที่ตั้ง">
                {m.address ? `${m.address}, ` : ''}
                {m.district}, {m.province}
              </InfoRow>
              <InfoRow label="ติดต่อ">
                {m.phone} · {m.email}
              </InfoRow>
              <InfoRow label="รายละเอียด">{m.description}</InfoRow>
              <InfoRow label="วันที่ลงทะเบียน">{fmtDate(m.createdAt)}</InfoRow>
              {m.approvedAt && <InfoRow label="วันที่อนุมัติ">{fmtDate(m.approvedAt)}</InfoRow>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="ช่องทางขาย" subtitle="แต่ละช่องทางมีสถานะการตรวจสอบของตัวเอง" />
            <ul className="divide-y divide-line">
              {m.channels.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <ExternalLink className="h-4 w-4 shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{CHANNEL_TYPES[c.type].label}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {CHANNEL_TYPES[c.type].prefix}
                      {c.handle}
                    </p>
                    {c.note && <p className="text-xs text-error">{c.note}</p>}
                  </div>
                  <StatusBadge map={CHANNEL_STATUS} value={c.status} />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row sm:p-5">
              <Select value={chType} onChange={(e) => setChType(e.target.value as ChannelType)} className="sm:w-44">
                {Object.entries(CHANNEL_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
              <Input value={chHandle} onChange={(e) => setChHandle(e.target.value)} placeholder="ชื่อบัญชี / ลิงก์ (สมมติ)" />
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => {
                  if (chHandle.trim().length < 3) return toast.error('กรุณากรอกชื่อบัญชีอย่างน้อย 3 ตัวอักษร');
                  addChannel(m.id, chType, chHandle.trim());
                  setChHandle('');
                  toast.success('เพิ่มช่องทางขายแล้ว', 'สถานะ: รอตรวจสอบ');
                }}
              >
                เพิ่ม
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {m.identityFlag && (
            <Alert tone="warning" title="ข้อสังเกตจากระบบ">
              {m.identityFlag} — เจ้าหน้าที่จะพิจารณาเป็นพิเศษ ไม่ใช่การปฏิเสธอัตโนมัติ
            </Alert>
          )}
          <Card>
            <CardHeader title="เอกสารประกอบ" icon={FileText} />
            <div className="p-4 sm:p-5">
              <DocList docs={m.documents} />
            </div>
          </Card>
          <Card>
            <CardHeader title="ความคืบหน้าคำขอ" subtitle={regApp ? regApp.id : undefined} />
            <div className="p-4 sm:p-5">{regApp ? <Timeline events={regApp.timeline} /> : <p className="text-sm text-ink-soft">ยังไม่ได้ส่งคำขอ</p>}</div>
          </Card>
          {mine.length > 1 && <p className="text-xs text-ink-soft">คุณมีร้านค้า {mine.length} ร้าน ใช้ตัวเลือกด้านบนเพื่อสลับร้าน</p>}
        </div>
      </div>
    </div>
  );
}
