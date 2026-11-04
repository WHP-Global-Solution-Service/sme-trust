import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Maximize2, MonitorSmartphone, Play, RotateCcw, ShieldCheck, Store, User, UserCog, X } from 'lucide-react';
import type { Role } from '@/types';
import { useSessionStore, toast, confirmDialog } from '@/stores';
import { resetAllDemoData } from '@/stores/workflows';
import { useOperatorStore } from '@/stores';
import { consumers, officers } from '@/mock/data';
import { allScenarios, demoMerchantAccounts, scenarioCode, trackOf } from '@/mock/scenarios';
import { ROLE_LABEL } from '@/constants/labels';
import { Button } from '@/components/common/ui';
import { Select } from '@/components/forms/Field';
import { cn } from '@/utils/cn';
import { roleHome, switchRole } from './demo';
import { startScenario } from '@/demo/controller';
import { useDemoStore } from '@/stores/demo';
import { DEVICES, isEmbedded, postToParent, previewUrl, type DeviceId } from '@/utils/devicePreview';

const roles: { role: Role; icon: typeof Store }[] = [
  { role: 'merchant', icon: Store },
  { role: 'consumer', icon: User },
  { role: 'officer', icon: Building2 },
  { role: 'admin', icon: UserCog },
];

export function DemoPanel() {
  const nav = useNavigate();
  const loc = useLocation();
  const embedded = isEmbedded();
  const activeScenario = useDemoStore((d) => d.activeScenario);
  const s = useSessionStore();
  const operators = useOperatorStore((st) => st.items);
  if (!s.demoPanelOpen) return null;
  const close = () => s.set({ demoPanelOpen: false });

  const pickRole = (role: Role) => {
    switchRole(role);
    if (role === 'merchant' && !useSessionStore.getState().operatorId) {
      nav('/');
    } else nav(roleHome[role]);
    toast.info(`สลับเป็นมุมมอง${ROLE_LABEL[role]}`, 'Role Switcher ใช้เพื่อการสาธิตเท่านั้น');
    close();
  };

  const extraOps = operators.filter((o) => !demoMerchantAccounts.some((a) => a.operatorId === o.id));

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-ink/30" onMouseDown={close}>
      <aside className="flex h-full w-full max-w-sm animate-slideUp flex-col bg-white shadow-pop" onMouseDown={(e) => e.stopPropagation()} aria-label="Demo Mode">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-semibold text-ink">Demo Mode</p>
            <p className="text-xs text-ink-soft">สลับบทบาท บัญชี และเรื่องราวสำหรับการสาธิต</p>
          </div>
          <button onClick={close} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-bg" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MonitorSmartphone className="h-4 w-4 text-primary" />
              มุมมองหน้าจอ (Responsive)
            </p>
            <p className="mb-2 text-xs text-ink-soft">แสดงแอปในขนาดจอของอุปกรณ์ที่เลือก โดยคงหน้าและข้อมูลปัจจุบัน</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(DEVICES).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    const path = loc.pathname + loc.search;
                    if (embedded) postToParent({ type: 'smetrust:device', device: d.id as DeviceId });
                    else nav(previewUrl(d.id, path));
                    close();
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line px-2 py-2.5 text-sm font-medium text-ink hover:border-primary/40 hover:bg-primary-50"
                >
                  <d.icon className="h-5 w-5 text-primary" />
                  {d.label}
                  <span className="text-[11px] font-normal text-ink-soft">{d.hint}</span>
                </button>
              ))}
            </div>
            {embedded && (
              <Button
                variant="outline"
                size="sm"
                icon={Maximize2}
                block
                className="mt-2"
                onClick={() => {
                  postToParent({ type: 'smetrust:exit', path: loc.pathname + loc.search });
                  close();
                }}
              >
                ออกจากโหมดจำลอง (แสดงเต็มจอ)
              </Button>
            )}
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold text-ink">1. เลือกบทบาท (Role)</p>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(({ role, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => pickRole(role)}
                  className={cn('flex h-14 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium', s.role === role ? 'border-primary bg-primary-50 text-primary' : 'border-line hover:bg-bg')}
                >
                  <Icon className="h-5 w-5" />
                  {ROLE_LABEL[role]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold text-ink">2. บัญชีสาธิต</p>
            <div className="space-y-2">
              <label className="block text-xs text-ink-soft">
                ผู้ประกอบการ
                <Select
                  value={s.operatorId}
                  onChange={(e) => {
                    s.set({ operatorId: e.target.value, activeMerchantId: undefined, merchantLoggedIn: !!e.target.value, role: 'merchant' });
                    nav(e.target.value ? '/m' : '/');
                    close();
                  }}
                  className="mt-1"
                >
                  <option value="">— ผู้ใช้ใหม่ (ยังไม่ลงทะเบียน) —</option>
                  {demoMerchantAccounts.map((a) => (
                    <option key={a.operatorId} value={a.operatorId}>
                      {a.label}
                    </option>
                  ))}
                  {extraOps.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} (ลงทะเบียนในการสาธิต)
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-xs text-ink-soft">
                ผู้บริโภค
                <Select
                  value={s.consumerId}
                  onChange={(e) => {
                    s.set({ consumerId: e.target.value, role: 'consumer' });
                    nav('/consumer/cases');
                    close();
                  }}
                  className="mt-1"
                >
                  {consumers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-xs text-ink-soft">
                เจ้าหน้าที่ / ผู้ดูแลระบบ
                <Select
                  value={s.officerId}
                  onChange={(e) => {
                    const o = officers.find((x) => x.id === e.target.value)!;
                    s.set({ officerId: o.id, role: o.role });
                    nav(roleHome[o.role]);
                    close();
                  }}
                  className="mt-1"
                >
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.position}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">3. Demo Scenario</p>
              <button
                onClick={() => {
                  nav('/demo');
                  close();
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                ดูรายละเอียดทั้งหมด
              </button>
            </div>
            <ul className="space-y-2">
              {allScenarios.map((sc, k) => (
                <li key={sc.id}>
                  {(k === 0 || trackOf(allScenarios[k - 1]) !== trackOf(sc)) && (
                    <p className="mb-1.5 mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{trackOf(sc) === 'v2' ? 'v2 — Marketplace Intelligence' : 'v1 — Consumer Protection'}</p>
                  )}
                  <button
                    onClick={async () => {
                      const r = await confirmDialog({ title: `เริ่ม Scenario ${scenarioCode(sc)}: ${sc.title}`, body: 'ระบบจะรีเซ็ตข้อมูลสาธิตทั้งหมดเป็นค่าเริ่มต้นก่อนเริ่มเรื่องราวนี้', confirmText: 'เริ่มสาธิต' });
                      if (r.ok) {
                        startScenario(sc.id, nav);
                        toast.success(`เริ่ม Scenario ${scenarioCode(sc)}`, sc.title);
                      }
                    }}
                    className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:bg-bg', activeScenario === sc.id ? 'border-primary bg-primary-50/60' : 'border-line')}
                  >
                    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white', trackOf(sc) === 'v2' ? 'bg-info' : 'bg-primary')}>{scenarioCode(sc)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{sc.title}</span>
                      <span className="block text-xs text-ink-soft">{sc.duration} · {sc.steps.length} ขั้นตอน</span>
                    </span>
                    <Play className="ml-auto mt-1 h-4 w-4 shrink-0 text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl bg-bg p-3 text-xs text-ink-soft">
            <ShieldCheck className="mb-1 h-4 w-4 text-primary" />
            Role Switcher เป็นเครื่องมือสำหรับการสาธิตเท่านั้น ไม่ใช่ระบบกำหนดสิทธิ์หรือการยืนยันตัวตนที่ปลอดภัยสำหรับใช้งานจริง
          </section>
        </div>
        <div className="border-t border-line p-4">
          <Button
            variant="outline"
            block
            icon={RotateCcw}
            onClick={async () => {
              const r = await confirmDialog({ title: 'Reset Demo Data', body: 'ข้อมูลที่เพิ่มหรือแก้ไขระหว่างการสาธิตทั้งหมดจะถูกล้าง และกลับเป็นข้อมูลตัวอย่างเริ่มต้น', confirmText: 'รีเซ็ตข้อมูล', tone: 'danger' });
              if (!r.ok) return;
              resetAllDemoData();
              nav('/');
              toast.success('รีเซ็ตข้อมูลสาธิตแล้ว');
            }}
          >
            Reset Demo Data
          </Button>
        </div>
      </aside>
    </div>
  );
}
