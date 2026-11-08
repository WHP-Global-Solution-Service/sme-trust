import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bot, Inbox } from 'lucide-react';
import { useAssessmentStore, useComplaintStore, useMerchantStore, useOfficerTaskStore, useProfileChangeStore, useRiskStore, useVerificationStore } from '@/stores';
import { fmtRelative } from '@/utils/format';
import { Badge, Card, EmptyState, PageHeader, StatusBadge, Tabs, LinkButton } from '@/components/common/ui';
import { PRIORITY_LABEL, TASK_CATEGORY_LABEL, TASK_STATUS } from '../labels';
import { AutomationKpiRow } from './AutomationPolicyPage';
import type { Priority } from '../types';

export type QueueTab = 'pending' | 'high' | 'identity' | 'conflict' | 'risk' | 'certification' | 'complaints' | 'completed';

export interface QueueItem {
  key: string;
  to: string;
  kind: string;
  title: string;
  /** เหตุผลที่ระบบส่งมาให้ตรวจ */
  reason: string;
  priority: Priority;
  at: string;
  status?: { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' };
  tabs: QueueTab[];
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** รวม Exception Queue จากงานของระบบอัตโนมัติ และงานที่ต้องใช้อำนาจในกระบวนการเดิม (ไม่สร้างงานซ้ำ — ลิงก์ไปที่เรื่องเดิม) */
export function useExceptionQueue() {
  const tasks = useOfficerTaskStore((s) => s.items);
  const apps = useVerificationStore((s) => s.items);
  const assessments = useAssessmentStore((s) => s.items);
  const changes = useProfileChangeStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const risks = useRiskStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  return useMemo(() => {
    const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
    const items: QueueItem[] = [];
    for (const t of tasks) {
      const open = t.status === 'open' || t.status === 'info_requested';
      const cat: QueueTab = t.category === 'identity_mismatch' ? 'identity' : t.category === 'evidence_conflict' ? 'conflict' : 'risk';
      items.push({
        key: t.id,
        to: `/o/exceptions/${t.id}`,
        kind: `${TASK_CATEGORY_LABEL[t.category]} · ${t.id}`,
        title: shop(t.merchantId),
        reason: t.summary,
        priority: t.priority,
        at: t.updatedAt,
        status: TASK_STATUS[t.status],
        tabs: open ? ['pending', cat, ...(t.priority === 'high' ? (['high'] as QueueTab[]) : [])] : ['completed', cat],
      });
    }
    // คำขอที่ต้องใช้อำนาจอนุมัติ (Certification Policy: Level 2–4 = เจ้าหน้าที่) — อยู่ในกระบวนการเดิม
    apps
      .filter((a) => ['submitted', 'pending_review', 'under_verification', 'need_info'].includes(a.status))
      .forEach((a) =>
        items.push({ key: a.id, to: `/o/applications/${a.id}`, kind: `${a.type === 'registration' ? 'คำขอลงทะเบียน (Level 2)' : `คำขอรับรอง Level ${a.requestedLevel ?? ''}`} · ${a.id}`, title: shop(a.merchantId), reason: 'การรับรองต้องใช้อำนาจอนุมัติของเจ้าหน้าที่ตามนโยบาย (ยังไม่ได้กำหนดสิทธิ์อนุมัติอัตโนมัติ)', priority: 'medium', at: a.submittedAt, tabs: a.status === 'need_info' ? ['certification'] : ['pending', 'certification'] }),
      );
    assessments
      .filter((a) => a.status === 'pending_review' && !a.applicationId)
      .forEach((a) => items.push({ key: a.id, to: `/o/assessments/${a.id}`, kind: `ผลประเมินรอพิจารณา · ${a.id}`, title: shop(a.merchantId), reason: 'ร้านส่งผลประเมินประกอบการพิจารณายกระดับการรับรอง', priority: 'medium', at: a.submittedAt ?? a.createdAt, tabs: ['pending', 'certification'] }));
    changes
      .filter((c) => c.status === 'pending')
      .forEach((c) => items.push({ key: c.id, to: `/o/profile-changes/${c.id}`, kind: `คำขอเปลี่ยนข้อมูลร้าน · ${c.id}`, title: shop(c.merchantId), reason: 'ชื่อร้าน/หมวดที่ผูกกับใบรับรองเปลี่ยนเป็นค่าที่ตรวจสอบอัตโนมัติไม่ได้ (ไม่ตรงกับแหล่งอ้างอิง)', priority: 'medium', at: c.updatedAt, tabs: ['pending', 'certification'] }));
    complaints
      .filter((c) => c.status === 'escalated')
      .forEach((c) => items.push({ key: c.id, to: `/o/complaints/${c.id}`, kind: `ข้อร้องเรียนส่งต่อ · ${c.id}`, title: `${c.title} — ${shop(c.merchantId)}`, reason: 'ร้านค้าและผู้บริโภคตกลงกันเองไม่ได้ จึงส่งต่อเจ้าหน้าที่', priority: c.screening.priority === 'urgent' || c.screening.priority === 'high' ? 'high' : 'medium', at: c.updatedAt, tabs: ['pending', 'complaints', ...(c.screening.priority === 'urgent' || c.screening.priority === 'high' ? (['high'] as QueueTab[]) : [])] }));
    risks
      .filter((r) => r.status === 'appeal_submitted' || r.status === 'allegation')
      .forEach((r) => items.push({ key: r.id, to: `/o/risk/${r.id}`, kind: `${r.status === 'appeal_submitted' ? 'คำอุทธรณ์' : 'ข้อกล่าวหาใหม่'} · ${r.id}`, title: shop(r.merchantId), reason: r.reason, priority: 'high', at: r.updatedAt, tabs: ['pending', 'high', 'risk'] }));
    return items.sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.at.localeCompare(b.at));
  }, [tasks, apps, assessments, changes, complaints, risks, merchants]);
}

const TABS: { value: QueueTab; label: string }[] = [
  { value: 'pending', label: 'Pending Manual Review' },
  { value: 'high', label: 'High Priority' },
  { value: 'identity', label: 'Identity Mismatch' },
  { value: 'conflict', label: 'Evidence Conflicts' },
  { value: 'risk', label: 'Risk Signals' },
  { value: 'certification', label: 'Certification Requests' },
  { value: 'complaints', label: 'Escalated Complaints' },
  { value: 'completed', label: 'Completed Reviews' },
];

export function QueueList({ items, limit }: { items: QueueItem[]; limit?: number }) {
  if (!items.length) return <EmptyState icon={Inbox} title="ไม่มีงานในหมวดนี้" desc="งานปกติระบบดำเนินการเองโดยไม่ต้องใช้เจ้าหน้าที่" />;
  return (
    <ul className="divide-y divide-line" data-testid="exception-list">
      {items.slice(0, limit).map((q) => (
        <li key={q.key}>
          <Link to={q.to} className="flex items-start gap-3 px-4 py-3 hover:bg-bg sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink-soft">{q.kind}</p>
              <p className="truncate text-sm font-medium text-ink">{q.title}</p>
              <p className="line-clamp-2 text-xs text-ink-soft">
                <span className="font-medium text-ink">เหตุผลที่ส่งตรวจ:</span> {q.reason}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge map={PRIORITY_LABEL} value={q.priority} />
              {q.status && <Badge tone={q.status.tone}>{q.status.label}</Badge>}
              <span className="hidden text-xs text-ink-soft sm:block">{fmtRelative(q.at)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Exception Queue — งานที่ระบบตัดสินเองอย่างปลอดภัยไม่ได้ หรือต้องใช้อำนาจอนุมัติ */
export default function OfficerExceptionQueue() {
  const items = useExceptionQueue();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'pending') as QueueTab;
  const shown = items.filter((i) => i.tabs.includes(tab));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Exception Queue — กรณีที่ต้องใช้เจ้าหน้าที่"
        subtitle="งานปกติระบบประเมินและออก Assessment Badge เอง · คิวนี้มีเฉพาะกรณียกเว้นและคำขอที่ต้องใช้อำนาจอนุมัติ พร้อมเหตุผลที่ส่งตรวจ"
        icon={Bot}
        action={<LinkButton to="/o/automation" variant="outline">กฎอัตโนมัติและ KPI</LinkButton>}
      />
      <AutomationKpiRow />
      <Card>
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <Tabs tabs={TABS.map((t) => ({ ...t, count: items.filter((i) => i.tabs.includes(t.value)).length }))} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
        </div>
        <QueueList items={shown} />
      </Card>
    </div>
  );
}
