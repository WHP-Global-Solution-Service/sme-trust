import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Bot, CircleAlert, History, Info, Send, ShieldQuestion, UserCheck } from 'lucide-react';
import { useAssessmentBadgeStore, useAssessmentStore, useAutomationRunStore, useCertificationStore, useOfficerTaskStore, toast } from '@/stores';
import { respondToTask } from '@/stores/automation';
import { latestAssessment } from '@/stores/workflowsV2';
import { useAssessmentState } from '@/features/trust-assessment/hooks';
import { BAND_LABEL, CONFIDENCE_LABEL } from '@/features/trust-assessment/labels';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { CERT_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Badge, Button, Card, CardHeader, StatusBadge } from '@/components/common/ui';
import type { AssessmentBadge, Route, RoutingIssue } from '../types';
import { AUTOMATION_DISCLAIMER, BADGE_STATUS, ROUTE_LABEL, TASK_CATEGORY_LABEL, TASK_STATUS, TRIGGER_LABEL } from '../labels';
import { publicBadgeView } from '../router';
import { evaluate } from '../derive';
import { dataBundle } from '@/stores/workflowsV2';

export function RouteBadge({ route }: { route: Route }) {
  const r = ROUTE_LABEL[route];
  return (
    <Badge tone={r.tone} className="gap-1 font-mono text-[11px]">
      <Bot className="h-3 w-3" aria-hidden />
      {route}
    </Badge>
  );
}

/** ตรา Trust Assessment Badge — ผลประเมินอัตโนมัติ (คนละอย่างกับ Certification Badge) */
export function AssessmentBadgeEmblem({ badge, size = 'md' }: { badge: AssessmentBadge; size?: 'sm' | 'md' }) {
  const band = badge.band === 'insufficient' ? '–' : badge.band;
  return (
    <div className={cn('inline-flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-primary-50 px-3 py-2', size === 'sm' && 'gap-2 px-2 py-1.5')} data-testid="assessment-badge" data-status={badge.status}>
      <span className={cn('grid shrink-0 place-items-center rounded-xl bg-primary font-bold text-white', size === 'sm' ? 'h-8 w-8 text-base' : 'h-12 w-12 text-2xl')} aria-hidden>
        {band}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-primary">Trust Assessment Badge</span>
        <span className="block text-xs text-ink-soft">
          {BAND_LABEL[badge.band].label} · ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง
        </span>
        {size === 'md' && (
          <span className="block text-[11px] text-ink-soft">
            {badge.id} · ข้อมูล {badge.dataSources.map((p) => PLATFORMS[p].label).join(', ') || 'ในระบบ'} · ประเมิน {fmtDate(badge.updatedAt, true)} · โมเดล {badge.modelVersion}
          </span>
        )}
      </span>
    </div>
  );
}

function IssueRow({ i }: { i: RoutingIssue }) {
  const tone = i.clearedByTask ? 'text-success' : i.kind === 'manual' ? 'text-error' : i.kind === 'merchant_fixable' ? 'text-warning' : 'text-ink-soft';
  return (
    <li className="flex gap-2 px-3 py-2.5 text-sm" data-issue={i.category}>
      <CircleAlert className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {i.title}
          {i.clearedByTask && <span className="ml-1 text-xs font-normal text-success">· เจ้าหน้าที่ตรวจแล้ว ({i.clearedByTask})</span>}
          {i.handledBy && <span className="ml-1 text-xs font-normal text-ink-soft">· อยู่ในเรื่อง {i.handledBy.id}</span>}
        </p>
        <p className="text-xs text-ink-soft">{i.detail}</p>
        {i.action && !i.clearedByTask && (
          <Link to={i.action.to} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {i.action.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}

/** มุมร้านค้า: ผลการประมวลผลอัตโนมัติ + Assessment Badge + สิ่งที่ต้องทำ (ไม่แสดงคะแนนภายใน) */
export function MerchantAutomationPanel({ merchantId }: { merchantId: string }) {
  const badge = useAssessmentBadgeStore((s) => s.items.find((b) => b.merchantId === merchantId));
  const tasks = useOfficerTaskStore((s) => s.items.filter((t) => t.merchantId === merchantId));
  const runs = useAutomationRunStore((s) => s.items.filter((r) => r.merchantId === merchantId));
  const cert = useCertificationStore((s) => currentCert(s.items, merchantId));
  const assessments = useAssessmentStore((s) => s.items);
  useAssessmentState(merchantId); // ให้หน้าจออัปเดตเมื่อข้อมูลที่เกี่ยวข้องเปลี่ยน
  const latest = latestAssessment(merchantId, assessments);
  const ev = latest ? evaluate(dataBundle(), merchantId, latest, tasks, new Date()) : undefined;
  const [showHistory, setShowHistory] = useState(false);
  const waiting = tasks.filter((t) => t.status === 'info_requested');
  const open = tasks.filter((t) => t.status === 'open');
  const lastRun = [...runs].sort((a, b) => b.at.localeCompare(a.at))[0];

  return (
    <Card data-testid="automation-panel">
      <CardHeader title="ผลการประมวลผลอัตโนมัติ (Automation First)" subtitle="ระบบประเมิน จัดเส้นทาง และออก Assessment Badge เอง — ส่งเจ้าหน้าที่เฉพาะกรณียกเว้น" icon={Bot} action={badge && <RouteBadge route={badge.route} />} />
      <div className="space-y-3 p-4 sm:p-5">
        {!badge || !ev ? (
          <p className="text-sm text-ink-soft">ยังไม่มีผลการประมวลผล — เชื่อมต่อ Marketplace (จำลอง) แล้วระบบจะประเมินและจัดเส้นทางให้อัตโนมัติหลังนำเข้าข้อมูล</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {badge.status === 'active' ? <AssessmentBadgeEmblem badge={badge} /> : <StatusBadge map={BADGE_STATUS} value={badge.status} />}
            </div>
            <p className="text-sm text-ink" data-testid="route-desc">
              <b>{ROUTE_LABEL[badge.route].short}</b> — {ev.decision.reasons.join(' · ')}
            </p>
            {ev.decision.issues.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{ev.decision.issues.map((i) => <IssueRow key={i.fingerprint} i={i} />)}</ul>}
            {open.map((t) => (
              <Alert key={t.id} tone="info" icon={ShieldQuestion} title={`ส่งเจ้าหน้าที่ตรวจสอบ: ${TASK_CATEGORY_LABEL[t.category]} (${t.id})`}>
                ระหว่างตรวจสอบยังไม่แสดง Assessment Badge — เป็นการตรวจตามเกณฑ์ ไม่ได้หมายความว่าร้านกระทำผิด
              </Alert>
            ))}
            {waiting.map((t) => (
              <InfoResponse key={t.id} taskId={t.id} message={t.infoRequest?.message ?? ''} title={TASK_CATEGORY_LABEL[t.category]} />
            ))}
          </>
        )}
        <div className="grid gap-2 rounded-xl bg-bg p-3 text-xs text-ink-soft sm:grid-cols-2">
          <p>
            <b className="text-ink">Assessment Badge</b> = ผลประเมินอัตโนมัติจากข้อมูลร้าน (Band, Coverage, Confidence) — อัปเดตเองเมื่อข้อมูลเปลี่ยน
          </p>
          <p>
            <b className="text-ink">Certification</b> = สถานะการรับรอง Level 1–4 ตามกระบวนการเดิม:{' '}
            {cert ? `Level ${cert.level} ${TRUST_LEVELS[cert.level].name} (${CERT_STATUS[cert.status].label})` : 'ยังไม่มีใบรับรอง'} — ระบบอัตโนมัติไม่เปลี่ยนสถานะนี้
          </p>
        </div>
        {badge && (
          <div>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <History className="h-3.5 w-3.5" /> ประวัติ Badge และการประมวลผล ({badge.history.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1 text-xs text-ink-soft" data-testid="badge-history">
                {badge.history.map((h, i) => (
                  <li key={i}>
                    {fmtDate(h.at, true)} · {TRIGGER_LABEL[h.trigger]} · {BADGE_STATUS[h.status].label} · {BAND_LABEL[h.band].label} · {CONFIDENCE_LABEL[h.confidence].label} · {h.route} · {h.assessmentId} · โมเดล {h.modelVersion}
                  </li>
                ))}
                {lastRun && <li>ประมวลผลล่าสุด {fmtDate(lastRun.at, true)} ({TRIGGER_LABEL[lastRun.trigger]}){lastRun.reassessed ? ' — ประเมินใหม่' : ' — ใช้ผลประเมินเดิม (ข้อมูลไม่เปลี่ยน)'}</li>}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-ink-soft">{AUTOMATION_DISCLAIMER}</p>
      </div>
    </Card>
  );
}

function InfoResponse({ taskId, message, title }: { taskId: string; message: string; title: string }) {
  const [text, setText] = useState('');
  const send = () => {
    const r = respondToTask(taskId, text);
    if (!r.ok) return toast.error('ส่งไม่ได้', r.error);
    toast.success('ส่งข้อมูลเพิ่มเติมแล้ว', 'งานกลับเข้าคิวเจ้าหน้าที่ (งานเดิม ไม่สร้างใหม่)');
    setText('');
  };
  return (
    <div className="rounded-xl border border-warning/40 bg-warning-50 p-3 text-sm" data-testid="info-request">
      <p className="font-semibold text-ink">
        เจ้าหน้าที่ขอข้อมูลเพิ่มเติม — {title} ({taskId})
      </p>
      <p className="text-ink">{message}</p>
      <label className="mt-2 block text-xs font-medium text-ink-soft" htmlFor={`resp-${taskId}`}>
        คำชี้แจง / หลักฐานเพิ่มเติม (จำลอง)
      </label>
      <textarea id={`resp-${taskId}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-sm" />
      <Button size="sm" icon={Send} className="mt-2" onClick={send} disabled={text.trim().length < 5}>
        ส่งข้อมูลให้เจ้าหน้าที่
      </Button>
    </div>
  );
}

/** มุมผู้บริโภค: สถานะ Assessment Badge — ไม่แสดงคะแนนภายใน งานของเจ้าหน้าที่ หรือเหตุผลที่ยังไม่มีข้อสรุป */
export function PublicBadgeBlock({ merchantId }: { merchantId: string }) {
  const badge = useAssessmentBadgeStore((s) => s.items.find((b) => b.merchantId === merchantId));
  if (!badge) return null;
  return (
    <div className="space-y-2" data-testid="public-badge" data-status={badge.status}>
      {publicBadgeView(badge.status).showBadge ? (
        <AssessmentBadgeEmblem badge={badge} />
      ) : (
        <p className="flex gap-2 rounded-xl border border-line bg-bg p-3 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {BADGE_STATUS[badge.status].consumer}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        <BadgeCheck className="h-3.5 w-3.5" />
        Assessment Badge ออกอัตโนมัติจากข้อมูลร้าน แยกจากใบรับรอง (Certification) ที่ต้องได้รับอนุมัติจากเจ้าหน้าที่
      </p>
    </div>
  );
}

export const TaskStatusBadge = ({ status }: { status: keyof typeof TASK_STATUS }) => <StatusBadge map={TASK_STATUS} value={status} />;
export const OfficerIcon = UserCheck;

/** มุมเจ้าหน้าที่: สถานะ Assessment Badge ปัจจุบันของร้าน (ตรงกับที่ร้านค้าและผู้บริโภคเห็น) + งานกรณียกเว้นที่เปิดอยู่ */
export function OfficerBadgeStatus({ merchantId }: { merchantId: string }) {
  const badge = useAssessmentBadgeStore((s) => s.items.find((b) => b.merchantId === merchantId));
  const open = useOfficerTaskStore((s) => s.items.filter((t) => t.merchantId === merchantId && (t.status === 'open' || t.status === 'info_requested')));
  return (
    <Card data-testid="officer-badge-status">
      <div className="flex flex-wrap items-center gap-3 p-4 text-sm sm:p-5">
        <Bot className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Trust Assessment Badge (อัตโนมัติ)</p>
          {badge ? (
            <p className="text-xs text-ink-soft">
              {BADGE_STATUS[badge.status].label} · {BAND_LABEL[badge.band].label} · อิงผลประเมิน {badge.assessmentId} · โมเดล {badge.modelVersion} · ตรวจล่าสุด {fmtDate(badge.checkedAt, true)}
            </p>
          ) : (
            <p className="text-xs text-ink-soft">ยังไม่มีผลการประมวลผลอัตโนมัติ</p>
          )}
          {open.map((t) => (
            <Link key={t.id} to={`/o/exceptions/${t.id}`} className="mt-1 block text-xs font-medium text-primary hover:underline">
              งานกรณียกเว้น {t.id}: {TASK_CATEGORY_LABEL[t.category]} ({TASK_STATUS[t.status].label})
            </Link>
          ))}
        </div>
        {badge && <RouteBadge route={badge.route} />}
      </div>
    </Card>
  );
}
