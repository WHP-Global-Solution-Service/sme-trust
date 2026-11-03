import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileQuestion, Fingerprint, PlayCircle, XCircle } from 'lucide-react';
import { useAuditStore, useComplaintStore, useOperatorStore, useRiskStore, useTrainingStore, useVerificationStore, useWarningStore, useMerchantStore, confirmDialog, toast } from '@/stores';
import { approvalBlocker, approveApplication, rejectApplication, requestInfo, setCheck, startReview } from '@/stores/workflows';
import { CHANNEL_STATUS, CHANNEL_TYPES, REGISTRATION_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { levelCriteria } from '@/utils/criteria';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Badge, Button, Card, CardHeader, InfoRow, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { DocList } from '@/components/forms/MockUpload';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { AssessmentSupportPanel } from '@/features/trust-assessment/components/AssessmentSupportPanel';

export default function ApplicationDetail() {
  const { id } = useParams();
  const app = useVerificationStore((s) => s.items.find((a) => a.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === app?.merchantId));
  const op = useOperatorStore((s) => s.items.find((o) => o.id === m?.operatorId));
  const audit = useAuditStore((s) => s.items.filter((a) => a.target === id));
  const enrollments = useTrainingStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const risks = useRiskStore((s) => s.items);
  if (!app || !m) return <NotFoundPage />;

  const open = ['submitted', 'pending_review', 'under_verification'].includes(app.status);
  const failed = app.checks.some((c) => c.result === 'fail');
  // เงื่อนไขเดียวกับ Workflow (เช่น ยังไม่ผ่าน e-KYC) — แสดงเหตุผลแทนการกดแล้วไม่เกิดผล
  const blocker = open ? approvalBlocker(app.id) : undefined;
  const criteria = app.type === 'certification' && app.requestedLevel >= 3 ? levelCriteria(m, op, { enrollments, warnings, complaints, risks })[app.requestedLevel as 3 | 4] : undefined;

  const approve = async () => {
    const pending = app.checks.filter((c) => c.result === 'pending').length;
    const r = await confirmDialog({
      title: 'อนุมัติคำขอ',
      body: `${pending ? `ยังมีรายการตรวจที่ไม่ได้ระบุผล ${pending} รายการ (จะถือว่าผ่าน) · ` : ''}ระบบจะออกใบรับรอง ${TRUST_LEVELS[app.type === 'registration' ? 2 : app.requestedLevel].name} และแจ้งร้านค้าทันที`,
      confirmText: 'อนุมัติ',
    });
    if (!r.ok) return;
    const res = approveApplication(app.id);
    if (!res.ok) return toast.error('อนุมัติไม่ได้', res.error);
    toast.success('อนุมัติแล้ว', `${m.shopName} — สถานะอัปเดตในมุมมองร้านค้าและผู้บริโภคแล้ว`);
  };
  const reject = async () => {
    const r = await confirmDialog({ title: 'ไม่อนุมัติคำขอ', body: 'ร้านค้าจะเห็นเหตุผลและวิธียื่นใหม่', reasonLabel: 'เหตุผลการไม่อนุมัติ', tone: 'danger', confirmText: 'ไม่อนุมัติ' });
    if (!r.ok) return;
    rejectApplication(app.id, r.reason!);
    toast.success('บันทึกผลไม่อนุมัติแล้ว');
  };
  const askInfo = async () => {
    const r = await confirmDialog({ title: 'ขอเอกสาร/ข้อมูลเพิ่มเติม', reasonLabel: 'รายการที่ต้องการเพิ่มเติม', confirmText: 'ส่งคำขอ' });
    if (!r.ok) return;
    requestInfo(app.id, r.reason!);
    toast.success('ส่งคำขอข้อมูลเพิ่มเติมแล้ว');
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${app.id} — ${m.shopName}`}
        subtitle={`${app.type === 'registration' ? 'คำขอลงทะเบียนร้านค้า' : `คำขอรับรอง ${TRUST_LEVELS[app.requestedLevel].name}`} · ยื่นเมื่อ ${fmtDate(app.submittedAt, true)}`}
        back={{ to: '/o/applications', label: 'Merchant Applications' }}
        action={<StatusBadge map={REGISTRATION_STATUS} value={app.status} />}
      />

      {m.identityFlag && (
        <Alert tone="error" icon={Fingerprint} title="ข้อสังเกต: ตัวตนซ้ำกับร้านที่ถูกระงับ/เพิกถอน" className="mb-4">
          {m.identityFlag} — พิจารณาประกอบกับข้อเท็จจริง ไม่ใช่เหตุปฏิเสธอัตโนมัติ{' '}
          <Link to="/o/risk" className="underline">ดู Risk Reviews</Link>
        </Alert>
      )}
      {app.status === 'need_info' && <Alert tone="warning" title="รอร้านค้าส่งข้อมูลเพิ่มเติม" className="mb-4">{app.infoRequest}</Alert>}
      {app.status === 'rejected' && <Alert tone="error" title="ไม่อนุมัติ" className="mb-4">{app.rejectReason}</Alert>}
      {app.status === 'approved' && <Alert tone="success" title="อนุมัติแล้ว" className="mb-4">ร้านค้าเห็นสถานะใหม่และใบรับรองแล้ว</Alert>}

      {open && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
          <p className="mr-auto text-sm text-ink-soft">การดำเนินการ</p>
          {app.status !== 'under_verification' && <Button icon={PlayCircle} onClick={() => { startReview(app.id); toast.info('เริ่มตรวจสอบ'); }}>เริ่มตรวจสอบ</Button>}
          <Button variant="outline" icon={FileQuestion} onClick={askInfo}>ขอเอกสารเพิ่มเติม</Button>
          <Button variant="danger" icon={XCircle} onClick={reject}>ไม่อนุมัติ</Button>
          <Button variant="success" icon={CheckCircle2} onClick={approve} disabled={!!blocker} title={blocker}>อนุมัติ</Button>
          {blocker && <p className="w-full text-sm text-warning">ยังอนุมัติไม่ได้: {blocker}</p>}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="รายการตรวจสอบ (ข้อมูลจำลอง)" subtitle={open ? 'กดเลือกผลแต่ละรายการ' : undefined} />
            <ul className="divide-y divide-line">
              {app.checks.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <span className="flex-1 text-sm text-ink">{c.label}</span>
                  <div className="flex gap-1">
                    {(['pass', 'fail', 'pending'] as const).map((r) => (
                      <button
                        key={r}
                        disabled={!open}
                        onClick={() => setCheck(app.id, c.id, r)}
                        className={cn(
                          'h-9 min-w-[64px] rounded-lg border px-3 text-sm font-medium disabled:cursor-default',
                          c.result === r ? (r === 'pass' ? 'border-success bg-success text-white' : r === 'fail' ? 'border-error bg-error text-white' : 'border-slate-300 bg-slate-100 text-slate-700') : 'border-line bg-white text-ink-soft hover:bg-bg',
                        )}
                      >
                        {r === 'pass' ? 'ผ่าน' : r === 'fail' ? 'ไม่ผ่าน' : 'รอตรวจ'}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {failed && open && <p className="px-5 pb-3 text-xs text-error">มีรายการไม่ผ่าน — ควรขอเอกสารเพิ่มหรือไม่อนุมัติพร้อมเหตุผล</p>}
          </Card>
          {criteria && (
            <Card>
              <CardHeader title="เกณฑ์ระดับที่ขอ (คำนวณจากข้อมูลจริงในระบบ)" />
              <ul className="space-y-1.5 p-4 sm:p-5">
                {criteria.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-error" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {app.type === 'certification' && app.requestedLevel >= 3 && <AssessmentSupportPanel merchantId={app.merchantId} />}
          <Card>
            <CardHeader title="ข้อมูลผู้ประกอบการและร้านค้า" />
            <dl className="divide-y divide-line px-4 sm:px-5">
              <InfoRow label="ผู้ประกอบการ">
                {op?.name} · <span className="font-mono text-xs">{op?.mockIdentityId}</span>{' '}
                <Badge tone={op?.kycStatus === 'verified' ? 'success' : 'warning'}>{op?.kycStatus === 'verified' ? 'e-KYC ผ่าน' : 'ยังไม่ยืนยันตัวตน'}</Badge>
              </InfoRow>
              <InfoRow label="รูปแบบ">{m.businessType === 'juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}</InfoRow>
              {m.juristic && (
                <InfoRow label="นิติบุคคล">
                  {m.juristic.companyName} · {m.juristic.registrationNo} · {m.juristic.companyType}
                  <span className="block text-xs text-ink-soft">ผู้มีอำนาจ {m.juristic.authorizedPerson} · ผู้แทน {m.juristic.applicantName}</span>
                </InfoRow>
              )}
              <InfoRow label="หมวด / ที่ตั้ง">{m.category} · {m.district}, {m.province}</InfoRow>
              <InfoRow label="ติดต่อ">{m.phone} · {m.email}</InfoRow>
              <InfoRow label="รายละเอียด">{m.description}</InfoRow>
              <InfoRow label="ช่องทางขาย">
                <ul className="space-y-1">
                  {m.channels.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      {CHANNEL_TYPES[c.type].label}: {c.handle} <StatusBadge map={CHANNEL_STATUS} value={c.status} />
                    </li>
                  ))}
                </ul>
                <Link to="/o/verification" className="text-xs text-primary hover:underline">ตรวจช่องทางขายแยกรายการ</Link>
              </InfoRow>
            </dl>
          </Card>
          <Card>
            <CardHeader title="เอกสารประกอบจำลอง" />
            <div className="p-4 sm:p-5"><DocList docs={m.documents} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Timeline" />
            <div className="p-4 sm:p-5"><Timeline events={app.timeline} /></div>
          </Card>
          <Card>
            <CardHeader title="Mock Audit Log" />
            <ul className="divide-y divide-line text-sm">
              {audit.length ? audit.map((a) => (
                <li key={a.id} className="px-4 py-2.5 sm:px-5">
                  <p className="text-ink">{a.action}</p>
                  <p className="text-xs text-ink-soft">{fmtDate(a.at, true)} · {a.actorName}{a.detail ? ` · ${a.detail}` : ''}</p>
                </li>
              )) : <li className="px-5 py-3 text-ink-soft">ยังไม่มีรายการ</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
