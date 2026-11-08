import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, BadgeCheck, ClipboardCheck, Clock, LayoutDashboard, MessageSquareWarning, ShieldAlert, Wrench } from 'lucide-react';
import { useCertificationStore, useComplaintStore, useMerchantStore, useRiskStore, useVerificationStore, useWarningStore } from '@/stores';
import { useCurrentOfficer } from '@/hooks/useCurrent';
import { COMPLAINT_STATUS, PRIORITY, REGISTRATION_STATUS, WARNING_STATUS } from '@/constants/labels';
import { fmtDate, fmtRelative } from '@/utils/format';
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, StatusBadge } from '@/components/common/ui';
import { QueueList, useExceptionQueue, type QueueTab } from '@/features/automation/pages/OfficerExceptionQueue';
import { AutomationKpiRow } from '@/features/automation/pages/AutomationPolicyPage';

const EXCEPTION_TILES: { tab: QueueTab; th: string; label: string; tone: 'primary' | 'error' | 'warning' | 'info' | 'success' | 'neutral' }[] = [
  { tab: 'pending', th: 'รอเจ้าหน้าที่พิจารณา', label: 'Pending Manual Review', tone: 'warning' },
  { tab: 'high', th: 'เร่งด่วน', label: 'High Priority Cases', tone: 'error' },
  { tab: 'identity', th: 'ข้อมูลตัวตนไม่ตรงกัน', label: 'Identity Mismatch', tone: 'error' },
  { tab: 'conflict', th: 'หลักฐานขัดแย้งกัน', label: 'Evidence Conflicts', tone: 'warning' },
  { tab: 'certification', th: 'คำขอที่ต้องใช้อำนาจอนุมัติ', label: 'Certification Requests', tone: 'info' },
  { tab: 'complaints', th: 'ข้อร้องเรียนส่งต่อ', label: 'Escalated Complaints', tone: 'error' },
  { tab: 'completed', th: 'ตรวจเสร็จแล้ว', label: 'Completed Reviews', tone: 'success' },
];

const DAY = 86400_000;

export default function OfficerDashboard() {
  const officer = useCurrentOfficer();
  const apps = useVerificationStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);
  const risks = useRiskStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const exceptions = useExceptionQueue();
  const pendingExceptions = exceptions.filter((q) => q.tabs.includes('pending'));

  const pendingApps = apps.filter((a) => ['submitted', 'pending_review', 'under_verification'].includes(a.status));
  const pendingComplaints = complaints.filter((c) => c.status === 'submitted');
  const awaitingMerchant = complaints.filter((c) => c.status === 'awaiting_merchant');
  const overdueMerchant = awaitingMerchant.filter((c) => Date.now() - new Date(c.createdAt).getTime() > 3 * DAY);
  const escalated = complaints.filter((c) => c.status === 'escalated');
  const warnFollow = warnings.filter((w) => ['correction_submitted', 'under_review'].includes(w.status));
  const expiring = certs.filter((c) => !c.supersededBy && c.status === 'active' && new Date(c.expiresAt).getTime() - Date.now() < 90 * DAY);
  const openRisk = risks.filter((r) => !['dismissed', 'appeal_reviewed', 'revoked'].includes(r.status));

  // Work Queue — รวมงานทุกประเภท เรียงตามความเร่งด่วน
  const queue = [
    ...escalated.map((c) => ({ id: c.id, to: `/o/complaints/${c.id}`, kind: 'ข้อร้องเรียนส่งต่อ', title: `${c.title} — ${shop(c.merchantId)}`, at: c.updatedAt, weight: c.screening.priority === 'urgent' ? 100 : 60, badge: <StatusBadge map={PRIORITY} value={c.officerPriority ?? c.screening.priority} /> })),
    ...risks.filter((r) => r.status === 'appeal_submitted' || r.status === 'allegation').map((r) => ({ id: r.id, to: `/o/risk/${r.id}`, kind: r.status === 'appeal_submitted' ? 'คำอุทธรณ์' : 'ข้อกล่าวหาใหม่', title: shop(r.merchantId), at: r.updatedAt, weight: 70, badge: <ShieldAlert className="h-4 w-4 text-error" /> })),
    ...pendingApps.map((a) => ({ id: a.id, to: `/o/applications/${a.id}`, kind: a.type === 'registration' ? 'คำขอลงทะเบียน' : 'คำขอรับรอง', title: shop(a.merchantId), at: a.submittedAt, weight: 50, badge: <StatusBadge map={REGISTRATION_STATUS} value={a.status} /> })),
    ...warnFollow.map((w) => ({ id: w.id, to: `/o/warnings/${w.id}`, kind: 'ตรวจผลการแก้ไข', title: `${w.title} — ${shop(w.merchantId)}`, at: w.updatedAt, weight: 40, badge: <StatusBadge map={WARNING_STATUS} value={w.status} /> })),
    ...overdueMerchant.map((c) => ({ id: c.id, to: `/o/complaints/${c.id}`, kind: 'ร้านค้ายังไม่ตอบเกิน 3 วัน', title: `${c.title} — ${shop(c.merchantId)}`, at: c.createdAt, weight: 30, badge: <StatusBadge map={COMPLAINT_STATUS} value={c.status} /> })),
  ].sort((a, b) => b.weight - a.weight || a.at.localeCompare(b.at));

  return (
    <div>
      <PageHeader title="Officer Dashboard" subtitle={`${officer.name} · ${officer.position} · ${fmtDate(new Date())}`} icon={LayoutDashboard} />
      <section className="mb-6 space-y-3" aria-label="Exception Queue">
        <AutomationKpiRow />
        <Card>
          <CardHeader
            title="Exception Queue — งานที่ต้องใช้เจ้าหน้าที่"
            subtitle="งานปกติระบบประเมินและออก Assessment Badge เอง · ที่นี่มีเฉพาะกรณียกเว้นและคำขอที่ต้องใช้อำนาจอนุมัติ พร้อมเหตุผลที่ส่งตรวจ"
            action={<LinkButton to="/o/exceptions" variant="outline" size="sm">ดูทั้งหมด</LinkButton>}
          />
          <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4 lg:grid-cols-7 sm:px-5">
            {EXCEPTION_TILES.map((t) => (
              <Stat key={t.tab} th={t.th} label={t.label} value={exceptions.filter((q) => q.tabs.includes(t.tab)).length} tone={t.tone} to={`/o/exceptions?tab=${t.tab}`} />
            ))}
          </div>
          <QueueList items={pendingExceptions} limit={6} />
        </Card>
      </section>
      <h2 className="mb-3 text-sm font-semibold text-ink-soft">ตัวชี้วัดกระบวนการเดิม (คุ้มครองผู้บริโภค · ใบรับรอง)</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat th="คำขอรอตรวจสอบ" label="Pending Applications" value={pendingApps.length} icon={ClipboardCheck} to="/o/applications" />
        <Stat th="ข้อร้องเรียนใหม่รอคัดกรอง" label="Pending Complaints" value={pendingComplaints.length} icon={MessageSquareWarning} tone="info" to="/o/complaints?status=submitted" />
        <Stat th="รอร้านค้าตอบกลับ" label="Cases Awaiting Merchant" value={awaitingMerchant.length} icon={Clock} tone="warning" hint={`เกิน 3 วัน ${overdueMerchant.length} เรื่อง`} to="/o/complaints?status=awaiting_merchant" />
        <Stat th="เรื่องที่ส่งต่อเจ้าหน้าที่" label="Escalated Cases" value={escalated.length} icon={ArrowUpRight} tone="error" to="/o/complaints?status=escalated" />
        <Stat th="ผลการแก้ไขรอตรวจ" label="Warning Follow-up" value={warnFollow.length} icon={Wrench} tone="warning" to="/o/corrective" />
        <Stat th="ใบรับรองใกล้หมดอายุ (90 วัน)" label="Certificate Expiry" value={expiring.length} icon={BadgeCheck} tone="neutral" to="/o/certification" />
        <Stat th="เรื่องพิจารณาความเสี่ยงที่เปิดอยู่" label="Risk Reviews" value={openRisk.length} icon={ShieldAlert} tone="error" to="/o/risk" />
        <Stat
          th="ร้านค้าแก้ไขเองสำเร็จ"
          label="Merchant Resolved"
          value={`${complaints.filter((c) => c.status === 'resolved').length}/${complaints.length}`}
          icon={CheckCircle2}
          tone="success"
          hint="เรื่องที่ไม่ต้องใช้เจ้าหน้าที่"
        />
      </div>

      <Card className="mt-5">
        <CardHeader title="Work Queue" subtitle={`${queue.length} งานที่รอดำเนินการ เรียงตามความเร่งด่วน`} />
        {queue.length ? (
          <ul className="divide-y divide-line">
            {queue.slice(0, 12).map((q) => (
              <li key={q.kind + q.id}>
                <Link to={q.to} className="flex items-center gap-3 px-4 py-3 hover:bg-bg sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink-soft">
                      {q.kind} · <span className="font-mono">{q.id}</span>
                    </p>
                    <p className="truncate text-sm text-ink">{q.title}</p>
                  </div>
                  <span className="hidden text-xs text-ink-soft sm:block">{fmtRelative(q.at)}</span>
                  {q.badge}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="ไม่มีงานค้าง" />
        )}
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="ใบรับรองใกล้หมดอายุ" />
          {expiring.length ? (
            <ul className="divide-y divide-line text-sm">
              {expiring.map((c) => (
                <li key={c.id} className="flex justify-between px-5 py-2.5">
                  <span>{shop(c.merchantId)}</span>
                  <span className="text-warning">{fmtDate(c.expiresAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-ink-soft">ไม่มีใบรับรองที่จะหมดอายุภายใน 90 วัน</p>
          )}
        </Card>
        <Card>
          <CardHeader title="ภาระงานที่ลดลงจาก Merchant First Resolution" />
          <div className="p-5 text-sm text-ink-soft">
            จากข้อร้องเรียนทั้งหมด {complaints.length} เรื่อง มี <b className="text-success">{complaints.filter((c) => c.status === 'resolved').length}</b> เรื่องที่ร้านค้าแก้ไขสำเร็จโดยไม่ต้องใช้เจ้าหน้าที่ และมีเพียง <b className="text-error">{escalated.length}</b> เรื่องที่ถูกส่งต่อ
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-bg">
              <div className="bg-success" style={{ width: `${(complaints.filter((c) => c.status === 'resolved').length / Math.max(1, complaints.length)) * 100}%` }} />
              <div className="ml-0.5 bg-error" style={{ width: `${(escalated.length / Math.max(1, complaints.length)) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs">เขียว = แก้ไขสำเร็จโดยร้านค้า · แดง = ส่งต่อเจ้าหน้าที่</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
