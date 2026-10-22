import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Ban, CheckCircle2, Fingerprint, Gavel, Search, ShieldOff, Undo2 } from 'lucide-react';
import type { RiskCaseStatus } from '@/types';
import { useCertificationStore, useMerchantStore, useOperatorStore, useRiskStore, confirmDialog, toast } from '@/stores';
import { reviewAppeal, riskAction } from '@/stores/workflows';
import { CERT_STATUS, RISK_STATUS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, CardHeader, InfoRow, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { RiskLadder } from './RiskParts';

export default function OfficerRiskDetail() {
  const { id } = useParams();
  const r = useRiskStore((s) => s.items.find((x) => x.id === id));
  const merchants = useMerchantStore((s) => s.items);
  const ops = useOperatorStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);
  if (!r) return <NotFoundPage />;
  const m = merchants.find((x) => x.id === r.merchantId)!;
  const op = ops.find((o) => o.id === m.operatorId);
  const cert = currentCert(certs, m.id);
  const sameIdentity = merchants.filter((x) => x.operatorId === m.operatorId && x.id !== m.id);

  const act = async (status: RiskCaseStatus, title: string, danger = false) => {
    const res = await confirmDialog({ title, body: 'ระบุเหตุผลและผลการพิจารณา ร้านค้าจะได้รับแจ้งและสามารถชี้แจงได้', reasonLabel: 'เหตุผล / ผลการพิจารณา', tone: danger ? 'danger' : 'primary', confirmText: title });
    if (!res.ok) return;
    riskAction(r.id, status, res.reason!);
    toast.success(title, 'บันทึกใน Timeline และ Audit Log แล้ว');
  };
  const appeal = async (result: 'upheld' | 'overturned') => {
    const res = await confirmDialog({ title: result === 'overturned' ? 'รับอุทธรณ์ — คืนสถานะการรับรอง' : 'ยกอุทธรณ์ — คงผลเดิม', reasonLabel: 'เหตุผลการพิจารณาอุทธรณ์' });
    if (!res.ok) return;
    reviewAppeal(r.id, result, res.reason!);
    toast.success('บันทึกผลการพิจารณาอุทธรณ์แล้ว');
  };

  const s = r.status;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`${r.id} — ${m.shopName}`} subtitle={`เปิดเมื่อ ${fmtDate(r.createdAt)}`} back={{ to: '/o/risk', label: 'Risk Reviews' }} action={<StatusBadge map={RISK_STATUS} value={s} />} />
      <Card className="mb-4 p-4">
        <RiskLadder status={s} />
      </Card>
      <Card className="mb-4 flex flex-wrap gap-2 p-4">
        {s === 'allegation' && <Button icon={Search} onClick={() => act('under_investigation', 'เปิดการตรวจสอบ')}>เปิดการตรวจสอบและให้ร้านชี้แจง</Button>}
        {['allegation', 'under_investigation'].includes(s) && <Button variant="outline" icon={CheckCircle2} onClick={() => act('dismissed', 'ยุติเรื่อง — ไม่พบมูล')}>ยุติเรื่อง (ไม่พบมูล)</Button>}
        {s === 'under_investigation' && (
          <>
            <Button variant="outline" icon={AlertTriangle} onClick={() => act('warning', 'มีมติออกคำเตือน')}>มีมติเตือน</Button>
            <Button variant="danger" icon={Ban} onClick={() => act('suspended', 'ระงับการรับรองชั่วคราว', true)}>ระงับการรับรอง</Button>
          </>
        )}
        {s === 'warning' && (
          <>
            <LinkButton to={`/o/warnings/new?merchant=${m.id}`} variant="outline" icon={AlertTriangle}>ออกคำเตือนพร้อมรายการแก้ไข</LinkButton>
            <Button variant="danger" icon={Ban} onClick={() => act('suspended', 'ระงับการรับรองชั่วคราว', true)}>ระงับการรับรอง</Button>
            <Button variant="outline" icon={CheckCircle2} onClick={() => act('dismissed', 'ยุติเรื่อง')}>ยุติเรื่อง</Button>
          </>
        )}
        {s === 'suspended' && (
          <>
            <Button variant="danger" icon={ShieldOff} onClick={() => act('revoked', 'เพิกถอนการรับรอง', true)}>เพิกถอนการรับรอง</Button>
            <Button variant="outline" icon={Undo2} onClick={() => act('dismissed', 'ยกเลิกการระงับ — ยุติเรื่อง')}>ยกเลิกการระงับ</Button>
          </>
        )}
        {s === 'appeal_submitted' && (
          <>
            <Button variant="success" icon={Gavel} onClick={() => appeal('overturned')}>รับอุทธรณ์ (คืนสถานะ)</Button>
            <Button variant="outline" icon={Gavel} onClick={() => appeal('upheld')}>ยกอุทธรณ์ (คงผล)</Button>
          </>
        )}
        {['appeal_reviewed', 'dismissed', 'revoked'].includes(s) && <p className="text-sm text-ink-soft">เรื่องนี้ไม่มีการดำเนินการค้าง {s === 'revoked' && '(ร้านค้ายังยื่นอุทธรณ์ได้)'}</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="ข้อมูลการพิจารณา" />
            <dl className="divide-y divide-line px-4 sm:px-5">
              <InfoRow label="ร้านค้า">
                <Link to={`/shop/${m.id}`} className="text-primary hover:underline">{m.shopName}</Link> ({m.id})
              </InfoRow>
              <InfoRow label="เหตุผล">{r.reason}</InfoRow>
              <InfoRow label="หลักฐาน">
                <ul className="list-disc pl-4">{r.evidenceSummary.map((e) => <li key={e}>{e}</li>)}</ul>
              </InfoRow>
              <InfoRow label="ข้อร้องเรียนที่เกี่ยวข้อง">
                {r.relatedComplaintIds.length ? r.relatedComplaintIds.map((c) => <Link key={c} to={`/o/complaints/${c}`} className="mr-2 font-mono text-xs text-primary hover:underline">{c}</Link>) : '-'}
              </InfoRow>
              <InfoRow label="ใบรับรองปัจจุบัน">{cert ? <>{cert.id} <StatusBadge map={CERT_STATUS} value={cert.status} /></> : '-'}</InfoRow>
              <InfoRow label="คำชี้แจงร้านค้า">{r.merchantStatement ?? <span className="text-ink-soft">ยังไม่มี</span>}</InfoRow>
              {r.appeal && (
                <InfoRow label="อุทธรณ์">
                  {r.appeal.text} ({fmtDate(r.appeal.submittedAt)})
                  {r.appeal.result && <span className="block font-medium">ผล: {r.appeal.result === 'overturned' ? 'รับอุทธรณ์' : 'ยกอุทธรณ์'} — {r.appeal.resultNote}</span>}
                </InfoRow>
              )}
            </dl>
          </Card>
          {(m.identityFlag || sameIdentity.length > 0) && (
            <Card>
              <CardHeader title="ความเชื่อมโยงของตัวตน (Mock Identity)" icon={Fingerprint} />
              <div className="space-y-2 p-4 sm:p-5 text-sm">
                <p>Mock Identity ID: <span className="font-mono font-semibold">{op?.mockIdentityId}</span> ({op?.name})</p>
                {m.identityFlag && <Alert tone="warning">{m.identityFlag}</Alert>}
                <p className="font-medium">ร้านอื่นของผู้ประกอบการรายเดียวกัน:</p>
                <ul className="space-y-1">
                  {sameIdentity.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2">
                      <span>{x.shopName} ({x.id})</span>
                      <StatusBadge map={RISK_STATUS} value={x.riskStatus} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-soft">ระบบใช้รหัสตัวตนจำลองภายในเท่านั้น ไม่เก็บหรือแสดงเลขบัตรประชาชนจริง</p>
              </div>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Timeline" />
          <div className="p-4 sm:p-5">
            <Timeline events={r.timeline} />
          </div>
        </Card>
      </div>
    </div>
  );
}
