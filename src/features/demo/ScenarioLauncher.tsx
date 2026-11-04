import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Info, Undo2 } from 'lucide-react';
import type { ContinuityIssue } from '@/demo/types';
import { continuityIssue, goFixScenario, startScenario } from '@/demo/controller';
import { findScenario, scenarioCode } from '@/mock/scenarios';
import { useDemoStore } from '@/stores/demo';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/ui';

type Mode = 'continue' | 'jump';
type Pending = { id: string; mode: Mode; issue?: ContinuityIssue; caseNote?: string; replayNote?: string };

/**
 * เริ่ม Scenario ถัดไปในการสาธิตต่อเนื่อง — ไม่สลับข้อมูลแบบเงียบ:
 * - ข้อมูลจากเรื่องก่อนหน้าใช้ไม่ได้ → ให้เลือกย้อนกลับไปทำให้ครบ หรือใช้ข้อมูลตัวอย่าง
 * - เรื่องถัดไปเป็นกรณีศึกษาแยก → แจ้งก่อนเปลี่ยนกรณี
 */
export function useScenarioLauncher() {
  const nav = useNavigate();
  const journeyMode = useDemoStore((d) => d.journeyMode);
  const [pending, setPending] = useState<Pending>();

  const run = (id: string, mode: Mode) => startScenario(id, nav, mode === 'jump' ? { carry: true, journey: true } : { carry: true });

  const launch = (id: string, mode: Mode = 'continue') => {
    const issue = continuityIssue(id);
    const caseNote = journeyMode ? findScenario(id)?.caseNote : undefined;
    const replayNote = findScenario(id)?.replayNote?.();
    if (issue || caseNote || replayNote) setPending({ id, mode, issue, caseNote, replayNote });
    else run(id, mode);
  };

  const close = () => setPending(undefined);
  const sc = findScenario(pending?.id);
  const fix = findScenario(pending?.issue?.fixScenario);

  const dialog = (
    <Modal
      open={!!pending}
      onClose={close}
      title={pending?.issue ? `ข้อมูลสำหรับ Scenario ${sc && scenarioCode(sc)} ยังไม่ครบ` : pending?.replayNote ? `เริ่ม Scenario ${sc && scenarioCode(sc)} ใหม่` : `Scenario ${sc && scenarioCode(sc)} ใช้กรณีศึกษาแยก`}
      footer={
        pending?.issue ? (
          <>
            <Button variant="ghost" onClick={close}>
              ยกเลิก
            </Button>
            <Button variant="outline" onClick={() => (close(), run(pending.id, pending.mode))}>
              ใช้ข้อมูลตัวอย่าง
            </Button>
            <Button icon={Undo2} onClick={() => (close(), goFixScenario(pending.issue!.fixScenario, nav))}>
              กลับไปทำ Scenario {fix && scenarioCode(fix)} ให้ครบ
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              ยกเลิก
            </Button>
            <Button icon={ArrowRight} onClick={() => pending && (close(), run(pending.id, pending.mode))}>
              {pending?.replayNote ? 'ล้างร้านเดิมและเริ่มใหม่' : `เริ่ม Scenario ${sc && scenarioCode(sc)}`}
            </Button>
          </>
        )
      }
    >
      {pending?.issue ? (
        <div className="space-y-3 text-sm text-ink">
          <p className="flex gap-2 rounded-xl bg-warning-50 p-3 text-[#7a4705]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {pending.issue.message}
          </p>
          <p>
            <b>กลับไปทำ Scenario {fix && scenarioCode(fix)} ให้ครบ</b> — สาธิตต่อด้วยข้อมูลเดียวกันทั้ง Journey
          </p>
          <p>
            <b>ใช้ข้อมูลตัวอย่าง</b> — ใช้{pending.issue.fallbackLabel}แทน ตัวควบคุมการสาธิตจะแสดงหมายเหตุนี้ตลอดทั้งเรื่อง
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending?.replayNote && (
            <p className="flex gap-2 rounded-xl bg-warning-50 p-3 text-sm text-[#7a4705]" data-testid="replay-note">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {pending.replayNote}
            </p>
          )}
          {pending?.caseNote && (
            <p className="flex gap-2 rounded-xl bg-info-50 p-3 text-sm text-[#1d4ab8]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {pending.caseNote}
            </p>
          )}
        </div>
      )}
    </Modal>
  );

  return { launch, dialog };
}
