import { AlertOctagon, ClipboardList, FileQuestion, Lightbulb, Tags } from 'lucide-react';
import type { ComplaintAnalysis } from '../types/ai.types';
import { COMPLAINT_KINDS } from '../rules/complaintRules';
import { FOLLOW_UP_LABEL } from '../services/complaintAnalyzer';
import { Badge } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { SectionCard } from './AiCommon';

const LEVEL_STYLE = { normal: 'border-line bg-white text-ink', attention: 'border-warning/30 bg-warning-50 text-warning', urgent: 'border-error/30 bg-error-50 text-error' };

export function ComplaintResult({ a }: { a: ComplaintAnalysis }) {
  const lvl = FOLLOW_UP_LABEL[a.level];
  return (
    <div className="space-y-4">
      {a.officerReviewSuggested && (
        <div className="flex gap-2 rounded-card border border-error/30 bg-error-50 p-4 text-sm text-error" role="alert">
          <AlertOctagon className="h-5 w-5 shrink-0" />
          <p>
            <b>แนะนำให้เจ้าหน้าที่ตรวจสอบโดยเร็ว</b> — {a.levelReasons.join(' · ')} ร้านค้าไม่ควรรอผลการเจรจาเพียงอย่างเดียว และผู้บริโภคยังมีสิทธิ์ร้องเรียนหรือส่งต่อหน่วยงานที่เกี่ยวข้องได้เสมอ
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-4 shadow-card">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Tags className="h-4 w-4" />
            ประเภทข้อร้องเรียน
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {COMPLAINT_KINDS[a.primary].th} <span className="text-sm font-medium text-ink-soft">({COMPLAINT_KINDS[a.primary].en})</span>
          </p>
          {a.kinds.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="text-xs text-ink-soft">ประเด็นอื่นที่พบ:</span>
              {a.kinds.slice(1).map((k) => (
                <Badge key={k}>{COMPLAINT_KINDS[k].th}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className={cn('rounded-card border p-4', LEVEL_STYLE[a.level])}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">ระดับการติดตามเบื้องต้น</p>
          <p className="mt-1 text-lg font-bold">{lvl.label}</p>
          <p className="mt-1 text-xs text-ink">{a.levelReasons.length ? a.levelReasons.join(' · ') : 'ไม่พบปัจจัยเร่งด่วนตามกฎ'}</p>
          <p className="mt-1 text-[11px] text-ink-soft">ไม่ใช่การประเมินความผิดของร้านค้า</p>
        </div>
      </div>
      <SectionCard title="สรุปประเด็นสำคัญ (Key Issues)" icon={ClipboardList}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {a.keyIssues.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-soft">สรุปจากข้อความที่ได้รับเท่านั้น ระบบไม่เติมข้อเท็จจริงที่ไม่มีในข้อร้องเรียน</p>
      </SectionCard>
      <SectionCard title="ข้อมูลที่ควรขอเพิ่มเติม" icon={FileQuestion}>
        {a.missing.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {a.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">ข้อความมีข้อมูลพื้นฐานที่เกี่ยวข้องครบตามกฎตรวจสอบ</p>
        )}
      </SectionCard>
      <SectionCard title="แนวทางแก้ไขเบื้องต้น" icon={Lightbulb}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
          {a.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-soft">คำแนะนำไม่ตัดสินว่าฝ่ายใดผิด ร้านค้าควรตรวจสอบข้อเท็จจริงก่อนเสนอแนวทางแก้ไข</p>
      </SectionCard>
    </div>
  );
}
