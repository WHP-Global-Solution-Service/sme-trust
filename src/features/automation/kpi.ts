import type { AssessmentBadge, AutomationRun, OfficerTask, Route } from './types';

/**
 * KPI ของระบบอัตโนมัติ — คำนวณจาก State ของ Prototype (ข้อมูลจำลอง)
 * ไม่ใช่ผลการลดภาระงานที่วัดจากการใช้งานจริง
 */
export function automationKpis(runs: AutomationRun[], tasks: OfficerTask[], badges: AssessmentBadge[]) {
  const latest = new Map<string, AutomationRun>();
  [...runs].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).forEach((r) => !latest.has(r.merchantId) && latest.set(r.merchantId, r));
  const by = (route: Route) => [...latest.values()].filter((r) => r.route === route).length;
  const processed = latest.size;
  const manual = by('MANUAL_REVIEW');
  const closed = tasks.filter((t) => ['approved', 'rejected', 'auto_closed'].includes(t.status)).length;
  return {
    processed,
    autoPass: by('AUTO_PASS'),
    requestInfo: by('AUTO_REQUEST_INFO'),
    manual,
    manualRatio: processed ? Math.round((manual / processed) * 100) : 0,
    tasksCreated: tasks.length,
    tasksOpen: tasks.filter((t) => t.status === 'open' || t.status === 'info_requested').length,
    tasksClosed: closed,
    badgesActive: badges.filter((b) => b.status === 'active').length,
    runs: runs.length,
  };
}
