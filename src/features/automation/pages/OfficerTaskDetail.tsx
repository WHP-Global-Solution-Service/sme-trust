import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileQuestion, XCircle } from 'lucide-react';
import { useAuditStore, useCertificationStore, useMerchantStore, useOfficerTaskStore, confirmDialog, toast } from '@/stores';
import { resolveTask } from '@/stores/automation';
import { BAND_LABEL, CONFIDENCE_LABEL, STANDING_LABEL } from '@/features/trust-assessment/labels';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { CERT_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, CardHeader, InfoRow, PageHeader, StatusBadge } from '@/components/common/ui';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { PRIORITY_LABEL, TASK_CATEGORY_LABEL, TASK_STATUS } from '../labels';
import type { TaskAction } from '../types';

const OUTCOME: Record<string, { approve: string; reject: string }> = {
  identity_mismatch: {
    approve: 'ยืนยันว่าเป็นร้านของผู้ประกอบการ (มีหลักฐาน) → ระบบใช้ข้อมูลจากร้านนี้ประเมินและอัปเดต Badge',
    reject: 'ไม่ใช่ร้านของผู้ประกอบการ → ข้อมูลจากการเชื่อมต่อนี้ไม่ถูกใช้ประเมิน (ใบรับรองไม่เปลี่ยน)',
  },
  evidence_conflict: {
    approve: 'ตรวจแล้วไม่ต้องดำเนินการเพิ่ม → ประเด็นนี้ไม่ถูกส่งซ้ำจนกว่าจะมีข้อมูลใหม่',
    reject: 'พบประเด็นที่ต้องพิจารณาต่อ → เปิดเรื่องพิจารณาความเสี่ยงตามกระบวนการเดิม (ร้านชี้แจง/อุทธรณ์ได้)',
  },
  risk_signal: {
    approve: 'ตรวจแล้วไม่ต้องดำเนินการเพิ่ม → ประเด็นนี้ไม่ถูกส่งซ้ำจนกว่าจะมีข้อมูลใหม่',
    reject: 'พบประเด็นที่ต้องพิจารณาต่อ → เปิดเรื่องพิจารณาความเสี่ยงตามกระบวนการเดิม (ร้านชี้แจง/อุทธรณ์ได้)',
  },
};

/** เจ้าหน้าที่พิจารณากรณียกเว้น: Evidence Snapshot + เหตุผลที่ส่งตรวจ + Approve / Reject / Request More Information */
export default function OfficerTaskDetail() {
  const { id } = useParams();
  const t = useOfficerTaskStore((s) => s.items.find((x) => x.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === t?.merchantId));
  const cert = useCertificationStore((s) => (m ? currentCert(s.items, m.id) : undefined));
  const audit = useAuditStore((s) => s.items.filter((a) => a.target === id));
  if (!t || !m) return <NotFoundPage />;
  const open = t.status === 'open' || t.status === 'info_requested';
  const ev = t.evidence;
  const out = OUTCOME[t.category];

  const act = async (action: TaskAction) => {
    const cfg = {
      approve: { title: 'อนุมัติ', body: out.approve, confirmText: 'อนุมัติ', reasonLabel: 'เหตุผล / หลักฐานที่ใช้ตัดสิน' },
      reject: { title: 'ไม่อนุมัติ', body: out.reject, confirmText: 'ไม่อนุมัติ', reasonLabel: 'เหตุผลการไม่อนุมัติ', tone: 'danger' as const },
      request_info: { title: 'ขอข้อมูลเพิ่มเติม', body: 'ร้านค้าจะได้รับการแจ้งเตือนและส่งคำชี้แจงกลับมาที่งานเดิม', confirmText: 'ส่งคำขอ', reasonLabel: 'ข้อมูลที่ต้องการจากร้านค้า' },
    }[action];
    const r = await confirmDialog(cfg);
    if (!r.ok) return;
    const res = resolveTask(t.id, action, r.reason ?? '');
    if (!res.ok) return toast.error('บันทึกไม่ได้', res.error);
    toast.success('บันทึกผลแล้ว', action === 'request_info' ? 'แจ้งร้านค้าแล้ว' : 'ระบบประมวลผลร้านใหม่และแจ้งร้านค้าแล้ว');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={`${t.id} — ${m.shopName}`}
        subtitle={`${TASK_CATEGORY_LABEL[t.category]} · ระบบส่งตรวจเมื่อ ${fmtDate(t.createdAt, true)}`}
        back={{ to: '/o/exceptions', label: 'Exception Queue' }}
        action={<StatusBadge map={TASK_STATUS} value={t.status} />}
      />
      <Alert tone="info" title="เหตุผลที่ระบบส่งมาให้ตรวจ">
        {t.summary}
        <span className="mt-1 block text-xs">การคัดกรองนี้ไม่ใช่การตัดสินว่าร้านค้ากระทำผิด — ระบบส่งมาเพราะตัดสินเองอย่างปลอดภัยไม่ได้</span>
      </Alert>
      {t.infoRequest && (
        <Alert tone={t.infoRequest.response ? 'success' : 'warning'} title={t.infoRequest.response ? 'ร้านค้าส่งข้อมูลเพิ่มเติมแล้ว' : 'รอร้านค้าส่งข้อมูลเพิ่มเติม'}>
          คำขอ: {t.infoRequest.message}
          {t.infoRequest.response && <span className="mt-1 block">คำชี้แจงของร้าน: {t.infoRequest.response}</span>}
        </Alert>
      )}
      {t.resolution && (
        <Alert tone={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'error' : 'info'} title={`${TASK_STATUS[t.status].label} — ${t.resolution.by} · ${fmtDate(t.resolution.at, true)}`}>
          {t.resolution.note}
          {t.resolution.riskCaseId && (
            <Link to={`/o/risk/${t.resolution.riskCaseId}`} className="ml-1 font-medium text-primary hover:underline">
              เปิดเรื่อง {t.resolution.riskCaseId}
            </Link>
          )}
        </Alert>
      )}

      {open && (
        <Card>
          <CardHeader title="การตัดสินของเจ้าหน้าที่" subtitle="ทุกการตัดสินต้องมีเหตุผล · บันทึก Audit Log · แจ้งร้านค้า" />
          <div className="space-y-2 p-4 text-sm sm:p-5">
            <p className="text-ink-soft">
              <b className="text-ink">อนุมัติ:</b> {out.approve}
            </p>
            <p className="text-ink-soft">
              <b className="text-ink">ไม่อนุมัติ:</b> {out.reject}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button icon={CheckCircle2} onClick={() => act('approve')}>
                อนุมัติ
              </Button>
              <Button variant="outline" icon={FileQuestion} onClick={() => act('request_info')}>
                ขอข้อมูลเพิ่มเติม
              </Button>
              <Button variant="danger" icon={XCircle} onClick={() => act('reject')}>
                ไม่อนุมัติ
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evidence Snapshot" subtitle={`บันทึก ณ ${fmtDate(ev.capturedAt, true)} — ไม่เปลี่ยนตามข้อมูลภายหลัง`} />
          <div className="space-y-1 p-4 text-sm sm:p-5" data-testid="evidence">
            <InfoRow label="ผลประเมิน">{ev.assessmentId} · โมเดล {ev.modelVersion}</InfoRow>
            <InfoRow label="Band">{BAND_LABEL[ev.band].label} (คะแนนภายใน {ev.score} — เฉพาะเจ้าหน้าที่)</InfoRow>
            <InfoRow label="Confidence / Coverage">{CONFIDENCE_LABEL[ev.confidence.level].label} ({ev.confidence.score}) · {ev.coverage}%</InfoRow>
            <InfoRow label="สถานะการรับรอง (ตอนส่งตรวจ)">{STANDING_LABEL[ev.standing].label}</InfoRow>
            <InfoRow label="ผู้ยืนยันตัวตน (e-KYC จำลอง)">{ev.kycName ?? '-'}</InfoRow>
            {ev.connections.map((c) => (
              <InfoRow key={c.id} label={`${PLATFORMS[c.platform].label} · ${c.id}`}>
                {c.mockShopName} · Shop ID จำลอง {c.mockShopId} · เจ้าของบัญชี: {c.ownerName}
              </InfoRow>
            ))}
            {ev.riskSignals.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-ink-soft">สัญญาณจากข้อมูล (ข้อสังเกต ไม่ใช่ข้อสรุป)</p>
                <ul className="text-xs text-ink">
                  {ev.riskSignals.map((s) => (
                    <li key={s.id}>
                      • {s.label}: {s.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ev.items.length > 0 && <ul className="pt-2 text-xs text-ink-soft">{ev.items.map((x) => <li key={x}>• {x}</li>)}</ul>}
          </div>
        </Card>
        <Card>
          <CardHeader title="ร้านค้าและใบรับรอง" subtitle="การตัดสินกรณียกเว้นไม่เปลี่ยนระดับใบรับรองโดยอัตโนมัติ" />
          <div className="space-y-1 p-4 text-sm sm:p-5">
            <InfoRow label="ร้านค้า">
              <Link to={`/shop/${m.id}`} className="text-primary hover:underline">
                {m.shopName} ({m.id})
              </Link>
            </InfoRow>
            <InfoRow label="ใบรับรอง">{cert ? `${cert.id} · Level ${cert.level} ${TRUST_LEVELS[cert.level].name} · ${CERT_STATUS[cert.status].label}` : 'ยังไม่มี'}</InfoRow>
            <InfoRow label="ลำดับความสำคัญ">
              <StatusBadge map={PRIORITY_LABEL} value={t.priority} />
            </InfoRow>
          </div>
          <div className="border-t border-line p-4 sm:p-5">
            <p className="text-xs font-semibold text-ink-soft">ประวัติงาน</p>
            <ul className="mt-1 space-y-1 text-xs text-ink" data-testid="task-history">
              {t.history.map((h) => (
                <li key={h.id}>
                  {fmtDate(h.at, true)} · {h.actorName} · {h.note ?? h.action}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold text-ink-soft">Audit Log</p>
            <ul className="mt-1 space-y-1 text-xs text-ink-soft">
              {audit.map((a) => (
                <li key={a.id}>
                  {fmtDate(a.at, true)} · {a.actorName} · {a.action}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
