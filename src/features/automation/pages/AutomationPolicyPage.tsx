import { Bot, Play, Settings2 } from 'lucide-react';
import { useAssessmentBadgeStore, useAutomationRunStore, useMerchantStore, useOfficerTaskStore, toast, confirmDialog } from '@/stores';
import { processAll } from '@/stores/automation';
import { TRUST_LEVELS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Badge, Button, Card, CardHeader, PageHeader, Stat } from '@/components/common/ui';
import { automationKpis } from '../kpi';
import { CERTIFICATION_POLICY, PROFILE_CHANGE_POLICY, ROUTING_POLICY } from '../policy';
import { AUTOMATION_DISCLAIMER, BADGE_STATUS, ROUTE_LABEL, TRIGGER_LABEL } from '../labels';
import { RouteBadge } from '../components/AutomationParts';

export function useAutomationKpis() {
  const runs = useAutomationRunStore((s) => s.items);
  const tasks = useOfficerTaskStore((s) => s.items);
  const badges = useAssessmentBadgeStore((s) => s.items);
  return automationKpis(runs, tasks, badges);
}

/** KPI จาก Mock State — ไม่ใช่ผลการลดภาระงานจากการใช้งานจริง */
export function AutomationKpiRow() {
  const k = useAutomationKpis();
  return (
    <div data-testid="automation-kpis">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat th="ร้านที่ประเมินผ่านอัตโนมัติ" label="Auto Pass" value={k.autoPass} icon={Bot} tone="success" hint={`จาก ${k.processed} ร้านที่ประมวลผล`} />
        <Stat th="ร้านที่ต้องเพิ่มข้อมูลเอง" label="Auto Request Info" value={k.requestInfo} tone="warning" hint="ไม่ใช้เจ้าหน้าที่" />
        <Stat th="ร้านที่ส่งให้เจ้าหน้าที่" label="Manual Review" value={k.manual} tone="error" hint={`อัตราส่วน ${k.manualRatio}%`} />
        <Stat th="งานกรณียกเว้นที่สร้าง" label="Officer Tasks" value={k.tasksCreated} tone="info" hint={`ค้าง ${k.tasksOpen} งาน`} />
        <Stat th="งานที่ปิดแล้ว" label="Closed Tasks" value={k.tasksClosed} tone="neutral" hint={`Badge ที่แสดงอยู่ ${k.badgesActive}`} />
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">ตัวเลขคำนวณจากข้อมูลจำลองใน Prototype (ผลการประมวลผลล่าสุดของแต่ละร้าน) — ไม่ใช่ผลการลดภาระงานที่วัดจากการใช้งานจริง</p>
    </div>
  );
}

export default function AutomationPolicyPage() {
  const runs = useAutomationRunStore((s) => [...s.items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15));
  const merchants = useMerchantStore((s) => s.items);
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const simulate = async () => {
    const r = await confirmDialog({ title: 'Run Simulation', body: 'ระบบจะประมวลผลทุกร้านที่มีข้อมูลด้วยกฎปัจจุบัน (จำลองการประมวลผลตามเหตุการณ์) — ข้อมูลเดิมไม่สร้างงานหรือประวัติซ้ำ', confirmText: 'ประมวลผล' });
    if (!r.ok) return;
    const res = processAll('simulation');
    const tasks = res.reduce((n, x) => n + x.createdTasks.length, 0);
    toast.success(`ประมวลผล ${res.length} ร้านแล้ว`, `งานใหม่ ${tasks} งาน · Badge เปลี่ยน ${res.filter((x) => x.badgeChanged).length} ร้าน`);
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Automation First — กฎและนโยบาย" subtitle="Automation First, Human by Exception · Decision Router · Certification Governance" icon={Settings2} action={<Button icon={Play} onClick={simulate}>Run Simulation</Button>} />
      <AutomationKpiRow />
      <p className="rounded-xl bg-bg p-3 text-xs text-ink-soft">{AUTOMATION_DISCLAIMER}</p>

      <Card>
        <CardHeader title="Decision Router" subtitle={`นโยบาย ${ROUTING_POLICY.version} — คัดกรองเพื่อจัดเส้นทางงาน ไม่ใช่การตัดสินว่าร้านค้าทุจริต`} icon={Bot} />
        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-3">
          {(Object.keys(ROUTE_LABEL) as (keyof typeof ROUTE_LABEL)[]).map((r) => (
            <div key={r} className="rounded-xl border border-line p-3 text-sm">
              <RouteBadge route={r} />
              <p className="mt-1 font-semibold text-ink">{ROUTE_LABEL[r].short}</p>
              <p className="text-xs text-ink-soft">{ROUTE_LABEL[r].desc}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1 border-t border-line px-4 py-3 text-xs text-ink-soft sm:px-5">
          <li>• ส่งเจ้าหน้าที่เสมอ: ชื่อเจ้าของบัญชีร้านไม่ตรงกับผู้ยืนยันตัวตน · สัญญาณร่วมหลายข้อ/ข้อร้องเรียนเร่งด่วนที่ยังไม่ปิด · สัญญาณทั่วไปตั้งแต่ {ROUTING_POLICY.softSignalThreshold} ข้อพร้อมกัน · คะแนนรีวิวต่างกันระหว่างแพลตฟอร์มตั้งแต่ {ROUTING_POLICY.ratingGapConflict} ดาว</li>
          <li>• ร้านค้าแก้เอง: ข้อมูลไม่พอ (Insufficient Data) · ความเชื่อมั่นต่ำ · ข้อมูลเก่ากว่า {ROUTING_POLICY.staleDays} วัน · ยังไม่ยืนยันตัวตน</li>
          <li>• ข้อสังเกต (ไม่ส่งตรวจ): สัญญาณทั่วไปข้อเดียว (Band สูงสุด B ตาม Engine) · ซิงก์บางแพลตฟอร์มไม่สำเร็จ</li>
          <li>• ไม่สร้างงานซ้ำ: หนึ่งงานต่อประเด็นต่อร้าน · ประเด็นที่มีเรื่องพิจารณาความเสี่ยง/มาตรการอยู่แล้วรวมเข้ากับเรื่องเดิม · ประเด็นที่เจ้าหน้าที่ตรวจแล้วไม่ส่งซ้ำจนกว่าจะมีข้อมูลใหม่</li>
          <li>• Badge แสดงเมื่อ: Band {ROUTING_POLICY.badgeBands.join('/')} · ยืนยันตัวตนแล้ว · ความเชื่อมั่นไม่ต่ำ · ไม่มีประเด็นค้าง · สถานะการรับรองปกติ</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Certification Governance" subtitle="Level ใดดำเนินการอัตโนมัติได้ภายใต้นโยบายที่ได้รับอนุมัติ — ค่าเริ่มต้นคงกฎเดิมทุกข้อ" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="cert-policy">
            <thead className="bg-bg text-left text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2">การดำเนินการ</th>
                <th className="px-4 py-2">อ้างอิง</th>
                <th className="px-4 py-2">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CERTIFICATION_POLICY.map((p) => (
                <tr key={p.level}>
                  <td className="px-4 py-2 font-medium text-ink">
                    Level {p.level} {TRUST_LEVELS[p.level].name}
                  </td>
                  <td className="px-4 py-2">{p.mode === 'automatic_existing' ? <Badge tone="success">อัตโนมัติ (กฎเดิม)</Badge> : <Badge tone="warning">เจ้าหน้าที่อนุมัติ</Badge>}</td>
                  <td className="px-4 py-2 text-ink-soft">{p.basis}</td>
                  <td className="px-4 py-2 text-xs text-ink-soft">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-ink-soft sm:px-5">Assessment Badge = ผลประเมินอัตโนมัติ · Certification Badge = สถานะการรับรอง · Suspension / Revocation = มาตรการที่แยกออกมาและอยู่ในอำนาจเจ้าหน้าที่ — ระบบอัตโนมัติไม่ออก ไม่ยกระดับ ไม่ระงับ และไม่เพิกถอนใบรับรอง</p>
      </Card>

      <Card>
        <CardHeader title="การแก้ไขข้อมูลร้านค้า" subtitle="ข้อมูลทั่วไปบันทึกเอง · ตรวจสอบอัตโนมัติเมื่อตรงกับแหล่งอ้างอิง · ส่งเจ้าหน้าที่เฉพาะที่ตรวจเองไม่ได้" />
        <ul className="divide-y divide-line text-sm">
          {PROFILE_CHANGE_POLICY.map((p) => (
            <li key={p.kind} className="px-4 py-2.5 sm:px-5">
              <p className="font-medium text-ink">{p.kind}</p>
              <p className="text-xs text-ink-soft">
                {p.fields} — {p.rule}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="การประมวลผลล่าสุด" subtitle="บันทึกจาก Mock State (Event-based)" />
        <ul className="divide-y divide-line text-sm" data-testid="automation-runs">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-5">
              <RouteBadge route={r.route} />
              <span className="font-medium text-ink">{shop(r.merchantId)}</span>
              <span className="text-xs text-ink-soft">
                {TRIGGER_LABEL[r.trigger]} · {BADGE_STATUS[r.badgeStatus].label} · {r.assessmentId} · โมเดล {r.modelVersion} · {fmtDate(r.at, true)}
                {r.taskIds.length ? ` · งาน ${r.taskIds.join(', ')}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
