import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileQuestion, XCircle } from 'lucide-react';
import { useAuditStore, useCertificationStore, useMerchantStore, useOperatorStore, useProfileChangeStore, confirmDialog, toast } from '@/stores';
import { approveProfileChange, rejectProfileChange, requestProfileChangeInfo } from '@/stores/workflowsV2';
import { CERT_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { Alert, Badge, Button, Card, CardHeader, InfoRow, PageHeader, StatusBadge } from '@/components/common/ui';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { ChangeHistory, ChangeTable } from '../ProfileChangeParts';
import { PROFILE_CHANGE_FIELD_LABEL, PROFILE_CHANGE_STATUS } from '../types';

/** เจ้าหน้าที่พิจารณาคำขอเปลี่ยนชื่อร้าน/หมวด: อนุมัติ / ไม่อนุมัติ / ขอข้อมูลเพิ่ม */
export default function OfficerProfileChangeDetail() {
  const { id } = useParams();
  const req = useProfileChangeStore((s) => s.items.find((r) => r.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === req?.merchantId));
  const op = useOperatorStore((s) => s.items.find((o) => o.id === m?.operatorId));
  const cert = useCertificationStore((s) => (m ? currentCert(s.items, m.id) : undefined));
  const audit = useAuditStore((s) => s.items.filter((a) => a.target === id));
  if (!req || !m) return <NotFoundPage />;
  const pending = req.status === 'pending';
  const summary = req.changes.map((c) => `${PROFILE_CHANGE_FIELD_LABEL[c.field]}: "${c.from}" → "${c.to}"`).join(' · ');

  const approve = async () => {
    const r = await confirmDialog({ title: 'อนุมัติการเปลี่ยนข้อมูลร้าน', body: `${summary} — ระบบจะอัปเดตโปรไฟล์ร้านและแจ้งร้านค้า โดยไม่เปลี่ยนระดับหรือสถานะใบรับรอง`, confirmText: 'อนุมัติ' });
    if (!r.ok) return;
    const res = approveProfileChange(req.id);
    if (!res.ok) return toast.error('อนุมัติไม่ได้', res.error);
    toast.success('อนุมัติแล้ว', 'โปรไฟล์ร้านอัปเดตและแจ้งร้านค้าแล้ว');
  };
  const reject = async () => {
    const r = await confirmDialog({ title: 'ไม่อนุมัติการเปลี่ยนข้อมูล', body: 'ข้อมูลร้านยังเป็นข้อมูลเดิม และร้านค้าจะเห็นเหตุผล', reasonLabel: 'เหตุผลการไม่อนุมัติ', tone: 'danger', confirmText: 'ไม่อนุมัติ' });
    if (!r.ok) return;
    const res = rejectProfileChange(req.id, r.reason ?? '');
    if (!res.ok) return toast.error('บันทึกไม่ได้', res.error);
    toast.success('บันทึกผลไม่อนุมัติแล้ว');
  };
  const askInfo = async () => {
    const r = await confirmDialog({ title: 'ขอข้อมูลเพิ่มเติม', body: 'ร้านค้าจะแก้ไขคำขอและส่งกลับมาให้พิจารณาอีกครั้ง', reasonLabel: 'ข้อมูลที่ต้องการเพิ่มเติม', confirmText: 'ส่งคำขอ' });
    if (!r.ok) return;
    const res = requestProfileChangeInfo(req.id, r.reason ?? '');
    if (!res.ok) return toast.error('ส่งไม่ได้', res.error);
    toast.success('ส่งคำขอข้อมูลเพิ่มเติมแล้ว');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={`${req.id} — ${m.shopName}`}
        subtitle={`คำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง · ยื่นเมื่อ ${fmtDate(req.createdAt, true)} · ฉบับที่ ${req.revision}`}
        back={{ to: '/o/profile-changes', label: 'คำขอเปลี่ยนข้อมูลร้าน' }}
        action={<StatusBadge map={PROFILE_CHANGE_STATUS} value={req.status} />}
      />
      {req.status === 'info_requested' && <Alert tone="info" title="รอร้านค้าส่งข้อมูลเพิ่มเติม">{req.officerNote}</Alert>}
      {req.status === 'rejected' && <Alert tone="error" title="ไม่อนุมัติ — ข้อมูลร้านยังเป็นข้อมูลเดิม">{req.officerNote}</Alert>}
      {req.status === 'approved' && <Alert tone="success" title="อนุมัติแล้ว">โปรไฟล์ร้านใช้ข้อมูลใหม่แล้ว · ระดับและสถานะใบรับรองไม่เปลี่ยน · ข้อมูลต้นฉบับจาก Marketplace ไม่เปลี่ยน</Alert>}

      {pending && (
        <Card className="flex flex-wrap items-center gap-2 p-4" aria-label="การพิจารณา">
          <p className="mr-auto text-sm text-ink-soft">ข้อมูลเดิมยังใช้อยู่จนกว่าจะอนุมัติ — ระบบไม่อนุมัติอัตโนมัติ</p>
          <Button variant="outline" icon={FileQuestion} onClick={askInfo}>ขอข้อมูลเพิ่มเติม</Button>
          <Button variant="danger" icon={XCircle} onClick={reject}>ไม่อนุมัติ</Button>
          <Button variant="success" icon={CheckCircle2} onClick={approve}>อนุมัติการเปลี่ยนข้อมูล</Button>
        </Card>
      )}

      <Card>
        <CardHeader title="ข้อมูลเดิม · ข้อมูลใหม่ · ต้นฉบับ Marketplace" subtitle="ข้อมูลต้นฉบับเป็นสำเนา ณ เวลายื่นคำขอ (จำลอง) แก้ไขไม่ได้" />
        <div className="p-4 sm:p-5">
          <ChangeTable changes={req.changes} req={req} />
          {req.merchantNote && <p className="mt-3 text-sm text-ink">คำอธิบายจากร้าน: “{req.merchantNote}”</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="ร้านค้าและใบรับรอง" />
          <dl className="divide-y divide-line px-4 sm:px-5">
            <InfoRow label="ร้านค้า">
              {m.shopName} · <span className="font-mono text-xs">{m.id}</span>
            </InfoRow>
            <InfoRow label="ผู้ประกอบการ">
              {op?.name} <Badge tone={op?.kycStatus === 'verified' ? 'success' : 'warning'}>{op?.kycStatus === 'verified' ? 'e-KYC ผ่าน' : 'ยังไม่ยืนยันตัวตน'}</Badge>
            </InfoRow>
            <InfoRow label="ใบรับรองปัจจุบัน">
              {cert ? (
                <>
                  Level {cert.level} — {TRUST_LEVELS[cert.level].name} <StatusBadge map={CERT_STATUS} value={cert.status} />
                  <span className="block text-xs text-ink-soft">การอนุมัติคำขอนี้ไม่เปลี่ยนระดับหรือสถานะใบรับรอง</span>
                </>
              ) : (
                'ยังไม่มีใบรับรอง'
              )}
            </InfoRow>
            {req.source && (
              <InfoRow label="แหล่งข้อมูล">
                {PLATFORMS[req.source.platform].label} · Shop ID จำลอง <span className="font-mono text-xs">{req.source.mockShopId}</span>
                {req.connectionId && (
                  <span className="block text-xs text-ink-soft">
                    การเชื่อมต่อ {req.connectionId}
                    {req.importId ? ` · บันทึกการนำเข้า ${req.importId}` : ''}
                  </span>
                )}
              </InfoRow>
            )}
            {req.decidedAt && (
              <InfoRow label="ผู้พิจารณา">
                {req.decidedBy} · {fmtDate(req.decidedAt, true)}
              </InfoRow>
            )}
          </dl>
          <p className="px-4 pb-4 text-xs text-ink-soft sm:px-5">
            <Link to={`/o/applications`} className="text-primary hover:underline">Merchant Applications</Link> ·{' '}
            <Link to={`/o/assessments`} className="text-primary hover:underline">Trust Assessment Review</Link>
          </p>
        </Card>
        <div className="space-y-4">
          <ChangeHistory req={req} />
          <Card>
            <CardHeader title="Mock Audit Log" />
            <ul className="divide-y divide-line text-sm" aria-label="Audit Log ของคำขอ">
              {audit.length ? (
                audit.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-ink">{a.action}</p>
                    <p className="text-xs text-ink-soft">
                      {fmtDate(a.at, true)} · {a.actorName}
                      {a.detail ? ` · ${a.detail}` : ''}
                    </p>
                  </li>
                ))
              ) : (
                <li className="px-5 py-3 text-ink-soft">ยังไม่มีรายการ</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
