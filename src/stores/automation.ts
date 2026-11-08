/**
 * Automation First, Human by Exception — Workflow ของระบบอัตโนมัติ (Mock State เท่านั้น)
 *
 * processMerchant: ตรวจความครบถ้วน → ประเมินด้วย Engine v2.1 (เมื่อข้อมูลเปลี่ยน) → Decision Router
 *                  → สร้าง/อัปเดต Assessment Badge → งานของเจ้าหน้าที่เฉพาะกรณียกเว้น (หนึ่งงานต่อประเด็น) → แจ้งเตือน → บันทึก
 * - ไม่ออกหรือเปลี่ยนใบรับรอง (Certification Level 1–4 ใช้กฎเดิม) และไม่ระงับ/เพิกถอนอัตโนมัติ
 * - ประมวลผลเมื่อมีเหตุการณ์ขณะผู้ใช้เปิดระบบ หรือกด Run Simulation เท่านั้น (ไม่ใช่การติดตามแบบ Real-time)
 */
import type { AutomationRun, AutomationTrigger, OfficerTask, RoutingIssue, TaskAction, TaskCategory, TaskEvent } from '@/features/automation/types';
import type { TrustAssessment } from '@/features/trust-assessment/types';
import { evaluate, evidenceSnapshot, latestPerMerchant, nextBadge } from '@/features/automation/derive';
import { BADGE_STATUS, ROUTE_LABEL, TASK_CATEGORY_LABEL } from '@/features/automation/labels';
import { BAND_LABEL } from '@/features/trust-assessment/labels';
import { nextRef, nowISO, uid } from '@/utils/id';
import { useAssessmentBadgeStore, useAssessmentStore, useAutomationRunStore, useComplaintStore, useMarketplaceStore, useMerchantStore, useOfficerTaskStore, useOperatorStore } from '.';
import { audit, currentActor, notify, notifyMerchant, openRiskCase, type WorkflowResult } from './workflows';
import { currentInputs, dataBundle, latestAssessment, runAssessment } from './workflowsV2';
import { onMerchantChanged, withoutEvents } from './events';

const tasks = () => useOfficerTaskStore.getState();
const merchantOf = (id: string) => useMerchantStore.getState().items.find((m) => m.id === id);
const RUN_LIMIT = 300;
const OPEN = (t: OfficerTask) => t.status === 'open' || t.status === 'info_requested';
const TASK_CATEGORIES: TaskCategory[] = ['identity_mismatch', 'evidence_conflict', 'risk_signal'];

export const badgeOf = (merchantId: string) => useAssessmentBadgeStore.getState().items.find((b) => b.merchantId === merchantId);
export const tasksOf = (merchantId: string) => tasks().items.filter((t) => t.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
export const openTasksOf = (merchantId: string) => tasksOf(merchantId).filter(OPEN);
export const runsOf = (merchantId: string) => useAutomationRunStore.getState().items.filter((r) => r.merchantId === merchantId).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));

const event = (action: TaskEvent['action'], note?: string, actor?: TaskEvent['actor']): TaskEvent => {
  const a = currentActor();
  const who = actor ?? (a.role === 'merchant' ? 'merchant' : a.role === 'officer' || a.role === 'admin' ? 'officer' : 'system');
  return { id: uid('tev'), at: nowISO(), actor: who, actorName: who === 'system' ? 'ระบบ' : a.name, action, note };
};

export interface ProcessResult {
  assessment: TrustAssessment;
  route: AutomationRun['route'];
  badgeChanged: boolean;
  createdTasks: OfficerTask[];
  run: AutomationRun;
}

/**
 * ประมวลผลร้านหนึ่งร้าน — เรียกซ้ำด้วยข้อมูลเดิมได้ผลเดิม (ไม่สร้างผลประเมิน งาน หรือประวัติ Badge ซ้ำ)
 * reassess=false ใช้ผลประเมินล่าสุด (เช่น เมื่อสถานะมาตรการเปลี่ยน) — สถานะการรับรองอ่านจากข้อมูลปัจจุบันเสมอ
 */
export function processMerchant(merchantId: string, trigger: AutomationTrigger, opts: { reassess?: boolean } = {}): ProcessResult | undefined {
  const m = merchantOf(merchantId);
  if (!m) return undefined;
  const reassess = opts.reassess ?? true;
  let assessment: TrustAssessment | undefined = latestAssessment(merchantId);
  let reassessed = false;
  if (reassess) {
    const cur = currentInputs(merchantId);
    if (cur && (!assessment || assessment.inputsKey !== cur.key)) {
      assessment = runAssessment(merchantId, 'automation');
      reassessed = true;
    }
  }
  if (!assessment) return undefined;
  const at = nowISO();
  const ev = evaluate(dataBundle(), merchantId, assessment, tasks().items, new Date());
  if (!ev) return undefined;

  // ---- งานของเจ้าหน้าที่: เฉพาะประเด็นที่ต้องใช้เจ้าหน้าที่ ยังไม่มีเรื่องเดิมดูแล และยังไม่เคยตรวจแล้ว
  const manual = ev.decision.issues.filter((i): i is RoutingIssue & { category: TaskCategory } => i.kind === 'manual' && !i.handledBy && !i.clearedByTask && TASK_CATEGORIES.includes(i.category as TaskCategory));
  const op = useOperatorStore.getState().items.find((o) => o.id === m.operatorId);
  const createdTasks: OfficerTask[] = [];
  const touched: string[] = [];
  for (const i of manual) {
    const open = tasks().items.find((t) => t.merchantId === merchantId && t.category === i.category && OPEN(t));
    const connectionId = i.category === 'identity_mismatch' ? i.fingerprint.split(':')[1] : undefined;
    const snapshot = evidenceSnapshot(ev, assessment, op?.name, i.evidence, at);
    if (open) {
      touched.push(open.id);
      // ประเด็นเดิม (Fingerprint เดิม) — ไม่สร้างงานใหม่และไม่บันทึกประวัติซ้ำเมื่อ Refresh/ประเมินซ้ำ
      if (open.fingerprint !== i.fingerprint) {
        tasks().update(open.id, (t) => ({ fingerprint: i.fingerprint, summary: i.detail, reasons: [i.title, ...i.evidence], evidence: snapshot, priority: i.priority, connectionId, updatedAt: at, history: [event('updated', 'ข้อมูลของประเด็นเปลี่ยน — อัปเดตหลักฐานล่าสุด (ไม่สร้างงานใหม่)', 'system'), ...t.history] }));
      }
      continue;
    }
    const task: OfficerTask = {
      id: nextRef('TSK', tasks().items.map((t) => t.id)),
      merchantId,
      category: i.category,
      status: 'open',
      priority: i.priority,
      fingerprint: i.fingerprint,
      title: i.title,
      summary: i.detail,
      reasons: [i.title, ...i.evidence],
      connectionId,
      evidence: snapshot,
      createdAt: at,
      updatedAt: at,
      history: [event('created', `ระบบส่งตรวจ: ${i.title}`, 'system')],
    };
    tasks().add(task);
    createdTasks.push(task);
    touched.push(task.id);
    audit('ระบบส่งกรณียกเว้นให้เจ้าหน้าที่ตรวจสอบ', task.id, `${merchantId} · ${TASK_CATEGORY_LABEL[i.category]}`, true);
    notify('officer', undefined, `กรณียกเว้นรอตรวจสอบ: ${TASK_CATEGORY_LABEL[i.category]}`, `${m.shopName} (${merchantId}) · ${task.id}`, `/o/exceptions/${task.id}`, i.priority === 'high' ? 'error' : 'warning');
  }
  // งานที่ประเด็นหายไปแล้ว (ข้อมูลเปลี่ยน หรือรวมเข้ากับเรื่องพิจารณาความเสี่ยงเดิม) → ปิดอัตโนมัติพร้อมเหตุผล
  const measure = ev.decision.issues.find((i) => i.category === 'measure');
  tasks()
    .items.filter((t) => t.merchantId === merchantId && OPEN(t) && !touched.includes(t.id))
    .forEach((t) => {
      const note = measure ? `รวมเข้ากับเรื่องที่เจ้าหน้าที่ดูแลอยู่ (${measure.handledBy?.id ?? measure.title})` : 'ไม่พบประเด็นนี้แล้วหลังข้อมูลเปลี่ยน — ปิดอัตโนมัติ';
      tasks().update(t.id, (x) => ({ status: 'auto_closed', updatedAt: at, resolution: { action: 'approve', note, by: 'ระบบ', at }, history: [event('auto_closed', note, 'system'), ...x.history] }));
      audit('ระบบปิดกรณียกเว้นอัตโนมัติ', t.id, note, true);
    });

  // ---- Assessment Badge
  const prev = badgeOf(merchantId);
  const { badge, changed } = nextBadge(prev, merchantId, assessment, ev, trigger, at);
  if (prev) useAssessmentBadgeStore.getState().update(prev.id, badge);
  else useAssessmentBadgeStore.getState().add(badge);
  if (changed) {
    audit('อัปเดต Trust Assessment Badge อัตโนมัติ', badge.id, `${merchantId} · ${BADGE_STATUS[badge.status].label} · ${BAND_LABEL[badge.band].label} · ${ROUTE_LABEL[ev.decision.route].label} · โมเดล ${badge.modelVersion}`, true);
    // มาตรการ (ระงับ/เพิกถอน/พิจารณาความเสี่ยง) แจ้งร้านโดย Workflow เดิมแล้ว — แจ้งเฉพาะผลของระบบอัตโนมัติ
    const msg = MERCHANT_MESSAGE[badge.status];
    if (msg && (prev?.status !== badge.status || badge.status === 'active')) notifyMerchant(merchantId, msg.title(badge.band), msg.body(ev.decision.reasons), '/m/trust', msg.tone);
  }

  const run: AutomationRun = {
    id: uid('RUN'),
    merchantId,
    at,
    trigger,
    route: ev.decision.route,
    badgeStatus: badge.status,
    band: assessment.result.band,
    assessmentId: assessment.id,
    modelVersion: assessment.result.modelVersion,
    reassessed,
    taskIds: touched,
    reasons: ev.decision.reasons,
  };
  const runs = useAutomationRunStore.getState();
  runs.add(run);
  if (runs.items.length > RUN_LIMIT) useAutomationRunStore.setState({ items: useAutomationRunStore.getState().items.slice(0, RUN_LIMIT) });
  return { assessment, route: ev.decision.route, badgeChanged: changed, createdTasks, run };
}

const MERCHANT_MESSAGE: Partial<Record<string, { title: (band: string) => string; body: (reasons: string[]) => string; tone: 'success' | 'warning' | 'info' }>> = {
  active: { title: (b) => `ได้รับ Trust Assessment Badge อัตโนมัติ (Band ${b})`, body: () => 'ระบบประเมินจากข้อมูลที่เชื่อมต่อและแสดง Badge ต่อผู้บริโภคแล้ว — Badge นี้เป็นผลประเมิน ไม่ใช่ใบรับรอง', tone: 'success' },
  insufficient: { title: () => 'ข้อมูลยังไม่เพียงพอสำหรับ Assessment Badge', body: (r) => `${r.join(' · ')} — ดูสิ่งที่ต้องเพิ่มได้ที่หน้าผลประเมิน`, tone: 'info' },
  needs_update: { title: () => 'ต้องอัปเดตข้อมูลก่อนแสดง Assessment Badge', body: (r) => `${r.join(' · ')} — ร้านดำเนินการเองได้ ไม่ต้องรอเจ้าหน้าที่`, tone: 'warning' },
  under_review: { title: () => 'ข้อมูลบางส่วนส่งให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม', body: (r) => `${r.join(' · ')} — เป็นการตรวจสอบตามเกณฑ์ ไม่ได้หมายความว่าร้านกระทำผิด`, tone: 'info' },
};

/** ประมวลผลทุกร้านที่มีข้อมูล (ปุ่ม Run Simulation) */
export function processAll(trigger: AutomationTrigger = 'simulation') {
  const ids = new Set([...useMarketplaceStore.getState().items.map((c) => c.merchantId), ...latestPerMerchant(useAssessmentStore.getState().items).keys()]);
  return [...ids]
    .sort()
    .map((id) => processMerchant(id, trigger))
    .filter((r): r is ProcessResult => !!r);
}

// ================================================================ การตัดสินของเจ้าหน้าที่ (Approve / Reject / Request Info)

const ACTION_AUDIT: Record<TaskAction, string> = {
  approve: 'เจ้าหน้าที่อนุมัติกรณียกเว้น',
  reject: 'เจ้าหน้าที่ไม่อนุมัติกรณียกเว้น',
  request_info: 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติมจากร้านค้า',
};

export function resolveTask(taskId: string, action: TaskAction, note: string): WorkflowResult {
  const t = tasks().items.find((x) => x.id === taskId);
  if (!t) return { ok: false, error: 'ไม่พบงาน' };
  if (!OPEN(t)) return { ok: false, error: 'งานนี้ดำเนินการเสร็จแล้ว' };
  if (note.trim().length < 5) return { ok: false, error: 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร' };
  const at = nowISO();
  const actor = currentActor();
  const m = merchantOf(t.merchantId);
  const text = note.trim();

  if (action === 'request_info') {
    tasks().update(t.id, (x) => ({ status: 'info_requested', updatedAt: at, infoRequest: { message: text, at }, history: [event('request_info', text), ...x.history] }));
    audit(ACTION_AUDIT[action], t.id, `${t.merchantId} · ${text}`);
    notifyMerchant(t.merchantId, 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม', `${TASK_CATEGORY_LABEL[t.category]}: ${text}`, '/m/trust', 'warning');
    return { ok: true };
  }

  let riskCaseId: string | undefined;
  withoutEvents(() => {
    if (t.category === 'identity_mismatch' && t.connectionId) {
      useMarketplaceStore.getState().update(t.connectionId, { identityReview: { status: action === 'approve' ? 'verified' : 'rejected', by: actor.name, at, taskId: t.id } });
    } else if (action === 'reject') {
      // พบประเด็นที่ต้องพิจารณาต่อ → เปิดเรื่องพิจารณาความเสี่ยงตามกระบวนการเดิม (ร้านชี้แจงและอุทธรณ์ได้) — ไม่ระงับการรับรองอัตโนมัติ
      const open = useComplaintStore.getState().items.filter((c) => c.merchantId === t.merchantId && !['resolved', 'closed'].includes(c.status)).map((c) => c.id);
      riskCaseId = openRiskCase(t.merchantId, `จากกรณียกเว้น ${t.id} (${TASK_CATEGORY_LABEL[t.category]}): ${text}`, open).id;
    }
  });
  tasks().update(t.id, (x) => ({ status: action === 'approve' ? 'approved' : 'rejected', updatedAt: at, resolution: { action, note: text, by: actor.name, at, riskCaseId }, history: [event(action, text), ...x.history] }));
  audit(ACTION_AUDIT[action], t.id, `${t.merchantId} · ${text}${riskCaseId ? ` · เปิด ${riskCaseId}` : ''}`);
  const consequence =
    t.category === 'identity_mismatch'
      ? action === 'approve'
        ? 'เจ้าหน้าที่ยืนยันว่าเป็นร้านของคุณ — ระบบประเมินและอัปเดต Badge ใหม่แล้ว'
        : 'ข้อมูลจากร้านนี้ไม่ถูกนำมาประเมิน — เชื่อมต่อร้านที่เป็นของคุณเพื่อประเมินใหม่ (ใบรับรองไม่เปลี่ยน)'
      : action === 'approve'
        ? 'เจ้าหน้าที่ตรวจแล้วไม่ต้องดำเนินการเพิ่ม — ระบบอัปเดต Badge แล้ว'
        : `เปิดเรื่องพิจารณาความเสี่ยง ${riskCaseId} — ร้านชี้แจงได้ (ใบรับรองไม่เปลี่ยนจนกว่าเจ้าหน้าที่จะตัดสิน)`;
  notifyMerchant(t.merchantId, action === 'approve' ? 'ผลการตรวจสอบ: อนุมัติ' : 'ผลการตรวจสอบ: ไม่อนุมัติ', `${TASK_CATEGORY_LABEL[t.category]} · ${consequence} · เหตุผล: ${text}`, '/m/trust', action === 'approve' ? 'success' : 'warning');
  if (m) processMerchant(t.merchantId, 'officer_decision');
  return { ok: true };
}

/** ร้านค้าตอบคำขอข้อมูลเพิ่มเติม → งานกลับเข้าคิวเจ้าหน้าที่ (งานเดิม ไม่สร้างใหม่) */
export function respondToTask(taskId: string, response: string): WorkflowResult {
  const t = tasks().items.find((x) => x.id === taskId);
  if (!t) return { ok: false, error: 'ไม่พบงาน' };
  if (t.status !== 'info_requested') return { ok: false, error: 'งานนี้ไม่ได้รอข้อมูลจากร้านค้า' };
  if (response.trim().length < 5) return { ok: false, error: 'กรุณาระบุคำชี้แจงอย่างน้อย 5 ตัวอักษร' };
  const at = nowISO();
  tasks().update(t.id, (x) => ({ status: 'open', updatedAt: at, infoRequest: { ...x.infoRequest!, response: response.trim(), respondedAt: at }, history: [event('merchant_response', response.trim()), ...x.history] }));
  audit('ร้านค้าส่งข้อมูลเพิ่มเติมสำหรับกรณียกเว้น', t.id, `${t.merchantId} · ${response.trim()}`);
  notify('officer', undefined, 'ร้านค้าส่งข้อมูลเพิ่มเติม (กรณียกเว้น)', `${merchantOf(t.merchantId)?.shopName} (${t.merchantId}) · ${t.id}`, `/o/exceptions/${t.id}`, 'warning');
  return { ok: true };
}

// Workflow เดิม (มาตรการ/ยืนยันตัวตน) แจ้งเหตุการณ์ → อัปเดตสถานะ Badge ทันทีด้วยผลประเมินล่าสุด
onMerchantChanged((merchantId, trigger) => {
  // มาตรการเปลี่ยน: ใช้ผลประเมินล่าสุด (สถานะการรับรองอ่านจากข้อมูลปัจจุบัน) · ยืนยันตัวตนเปลี่ยน: ประเมินใหม่
  if (badgeOf(merchantId) || latestAssessment(merchantId)) processMerchant(merchantId, trigger, { reassess: trigger !== 'measure_change' });
});
