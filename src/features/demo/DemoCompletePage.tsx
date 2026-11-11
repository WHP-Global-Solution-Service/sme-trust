import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Database, Flag, Info, Repeat, XCircle } from 'lucide-react';
import { confirmDialog } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { findScenario } from '@/mock/scenarios';
import { exitDemo, restartScenario, startScenario } from '@/demo/controller';
import { Badge, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { DemoFrame } from './DemoFrame';
import { BENEFIT_ROWS } from './DemoScenariosPage';

/** หน้าจบการสาธิต — สรุปผลจริงจากข้อมูลจำลอง พร้อม "จบการสาธิต" และ "เริ่ม Demo ใหม่" */
export default function DemoCompletePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useDemoStore();
  const sc = findScenario(id);
  if (!sc) return <NotFoundPage />;
  const done = d.completed.includes(sc.id);
  const ctx = d.results[sc.id] ?? (d.activeScenario === sc.id ? d.current : {});
  const isActive = d.activeScenario === sc.id;
  // ผลลัพธ์จริงของเรื่องนี้ (เช่น อนุมัติ / ขอข้อมูลเพิ่ม / ไม่อนุมัติ) — แสดงตามผลที่เกิดขึ้นจริง ไม่ใช่ผลสมมติ
  const outcome = done ? sc.outcome?.(ctx) : undefined;
  const tone = outcome?.tone ?? 'success';
  const HeadIcon = tone === 'error' ? XCircle : tone === 'warning' ? AlertTriangle : tone === 'info' ? Info : CheckCircle2;
  const toneCls = { success: 'border-success/30 text-success', warning: 'border-warning/40 text-warning', error: 'border-error/40 text-error', info: 'border-info/30 text-info' }[tone];

  const finish = () => {
    exitDemo();
    nav('/demo');
  };
  const again = async () => {
    const r = await confirmDialog({ title: `เริ่ม "${sc.title}" ใหม่`, body: 'ข้อมูลสาธิตจะกลับเป็นจุดเริ่มต้นของเรื่องนี้ และไม่สร้างข้อมูลซ้ำ', confirmText: 'เริ่มใหม่' });
    if (!r.ok) return;
    if (isActive) restartScenario(nav);
    else startScenario(sc.id, nav);
  };

  return (
    <DemoFrame menu>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <section className={cn('rounded-card border bg-white p-6 text-center shadow-card', toneCls.split(' ')[0])} data-outcome={outcome?.kind ?? (done ? 'completed' : 'incomplete')}>
          <HeadIcon className={cn('mx-auto h-14 w-14', toneCls.split(' ')[1])} />
          <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">{sc.title}</h1>
          <div className="mt-2 flex justify-center">
            <Badge tone={done ? 'success' : 'warning'}>{done ? 'สาธิตครบทุกขั้นแล้ว' : 'ยังไม่จบการสาธิตนี้'}</Badge>
          </div>
          {outcome && (
            <p className={cn('mt-3 text-lg font-semibold', toneCls.split(' ')[1])} role="status">
              ผลลัพธ์: {outcome.title}
            </p>
          )}
          <p className="mx-auto mt-4 max-w-2xl text-[15px] italic text-ink">“{sc.keyMessage}”</p>
        </section>

        {outcome && (
          <section className={cn('rounded-card border bg-white p-5 shadow-card', toneCls.split(' ')[0])} aria-label="ผลลัพธ์ของการสาธิต">
            <h2 className="mb-2 font-semibold text-ink">ผลลัพธ์จริงจากระบบ</h2>
            <ul className="space-y-1 text-sm text-ink">
              {outcome.facts.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm text-ink">
              <b>สิ่งที่ผู้บริโภคเห็น:</b> {outcome.consumerView}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              <b>ขั้นต่อไป:</b> {outcome.next}
            </p>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-card border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">ขั้นตอนที่ทำ</h2>
            <ol className="space-y-1.5">
              {sc.steps.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-ink">
                  <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', done ? 'text-success' : 'text-line')} />
                  {s.title}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-card border border-line bg-white p-5 shadow-card" data-testid="demo-summary">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <Database className="h-4 w-4 text-primary" />
              สิ่งที่เกิดขึ้นในระบบ (ข้อมูลจำลอง)
            </h2>
            <ul className="space-y-1.5 text-sm text-ink">
              {sc.summary(ctx).map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">คำนวณจากข้อมูลจำลองในเบราว์เซอร์ — ไม่ใช่ข้อมูลหรือผลการตรวจสอบจริง</p>
          </section>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          {BENEFIT_ROWS.map((b) => (
            <div key={b.key} className="rounded-card border border-line bg-white p-4 shadow-card">
              <p className={cn('flex items-center gap-1.5 text-sm font-semibold', b.cls)}>
                <b.icon className="h-4 w-4" />
                {b.key === 'ocpb' ? 'ลดภาระเจ้าหน้าที่ (สคบ.)' : `ประโยชน์ต่อ${b.label === 'SME' ? 'ผู้ประกอบการ' : b.label}`}
              </p>
              <p className="mt-1.5 text-sm text-ink">{sc.benefits[b.key]}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2 rounded-card border border-line bg-white p-4 shadow-card sm:flex-row" aria-label="จบการสาธิต">
          <Button size="lg" icon={Flag} className="sm:flex-1" onClick={finish}>
            จบการสาธิต
          </Button>
          <Button size="lg" variant="outline" icon={Repeat} onClick={() => void again()}>
            เริ่ม Demo ใหม่
          </Button>
        </section>
      </main>
    </DemoFrame>
  );
}
