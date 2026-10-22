import { ArrowRight, CheckCircle2, Copy, Info, ListChecks, PencilLine, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import type { AdAnalysis, AdFinding, AdRiskLevel, Severity } from '../types/ai.types';
import { AD_LEVEL_LABEL, buildSegments } from '../services/advertisingAnalyzer';
import { Badge, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { copyWithToast, SectionCard } from './AiCommon';

const SEVERITY: Record<Severity, { label: string; tone: 'error' | 'warning' | 'neutral'; mark: string }> = {
  high: { label: 'ควรตรวจสอบอย่างละเอียด', tone: 'error', mark: 'bg-error-50 text-error decoration-error' },
  medium: { label: 'ควรตรวจสอบเพิ่มเติม', tone: 'warning', mark: 'bg-warning-50 text-[#7a4705] decoration-warning' },
  low: { label: 'ข้อสังเกต', tone: 'neutral', mark: 'bg-slate-100 text-ink decoration-slate-400' },
};

const LEVEL_STYLE: Record<AdRiskLevel, string> = {
  low: 'border-success/30 bg-success-50 text-success',
  medium: 'border-warning/30 bg-warning-50 text-warning',
  high: 'border-error/30 bg-error-50 text-error',
};

export function RiskLevelCard({ a }: { a: AdAnalysis }) {
  const l = AD_LEVEL_LABEL[a.level];
  return (
    <div className={cn('rounded-card border p-4', LEVEL_STYLE[a.level])} role="status">
      <p className="text-xs font-semibold uppercase tracking-wide">ระดับความเสี่ยงเบื้องต้น (Overall Risk)</p>
      <p className="mt-1 text-xl font-bold">{l.label}</p>
      <p className="mt-1 text-sm text-ink">{a.findings.length ? `${l.desc} · พบ ${a.findings.length} ประเด็น` : 'ไม่พบข้อความที่ตรงกับกฎตรวจสอบเบื้องต้น แต่ไม่ได้หมายความว่าโฆษณานี้ถูกต้องตามกฎหมายหรือไม่มีความเสี่ยง'}</p>
      <p className="mt-2 text-xs text-ink-soft">เป็นผลจากกฎจำลอง ไม่ใช่คะแนนรับรองความถูกต้องตามกฎหมาย และไม่ใช่การอนุมัติโฆษณา</p>
    </div>
  );
}

/** Highlight คำที่ตรวจพบ — Render เป็น Text node ของ React เท่านั้น (ไม่ใช้ innerHTML) */
export function HighlightedText({ a }: { a: AdAnalysis }) {
  const sev = new Map(a.findings.map((f) => [f.ruleId, f.severity]));
  const order: Severity[] = ['high', 'medium', 'low'];
  const segs = buildSegments(a.input, a.findings);
  return (
    <p className="whitespace-pre-wrap break-words rounded-xl bg-bg p-3 text-[15px] leading-loose text-ink">
      {segs.map((s, i) => {
        if (!s.findingIds.length) return <span key={i}>{s.text}</span>;
        const top = order.find((o) => s.findingIds.some((id) => sev.get(id) === o)) ?? 'low';
        const labels = a.findings.filter((f) => s.findingIds.includes(f.ruleId)).map((f) => f.label).join(', ');
        return (
          <mark key={i} title={labels} className={cn('rounded px-0.5 underline decoration-2 underline-offset-4', SEVERITY[top].mark)}>
            {s.text}
          </mark>
        );
      })}
    </p>
  );
}

export function FindingList({ findings }: { findings: AdFinding[] }) {
  if (!findings.length)
    return (
      <p className="flex items-start gap-2 text-sm text-ink-soft">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ไม่พบข้อความที่ตรงกับกฎตรวจสอบเบื้องต้น แต่ไม่ได้หมายความว่าโฆษณานี้ถูกต้องตามกฎหมายหรือไม่มีความเสี่ยง
      </p>
    );
  return (
    <ol className="space-y-3">
      {findings.map((f, i) => (
        <li key={f.ruleId} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bg text-xs font-semibold text-ink-soft">{i + 1}</span>
            <p className="font-semibold text-ink">{f.label}</p>
            <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
            {f.occurrences > 1 && f.matches.length > 0 && <span className="text-xs text-ink-soft">พบ {f.occurrences} ครั้ง</span>}
          </div>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div>
              <dt className="inline font-medium text-ink-soft">{f.category === 'missing' ? 'ข้อมูลที่ไม่พบ: ' : 'ข้อความที่ตรวจพบ: '}</dt>
              <dd className="inline text-ink">
                {f.matched.map((m, k) => (
                  <span key={k} className="mr-1 inline-block rounded bg-bg px-1.5 py-0.5">
                    {m}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink-soft">คำอธิบาย: </dt>
              <dd className="inline text-ink">{f.explanation}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink-soft">เหตุผลที่ควรตรวจสอบ: </dt>
              <dd className="inline text-ink">{f.why}</dd>
            </div>
            <div className="rounded-lg bg-primary-50 px-2.5 py-1.5 text-primary-dark">
              <dt className="inline font-medium">คำแนะนำ: </dt>
              <dd className="inline">{f.suggestion}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function SuggestedRevision({
  a,
  value,
  onChange,
  onReanalyze,
  loading,
}: {
  a: AdAnalysis;
  value: string;
  onChange: (v: string) => void;
  onReanalyze: () => void;
  loading: boolean;
}) {
  const edited = a.revision !== null && value !== a.revision;
  return (
    <SectionCard title="ข้อความฉบับเสนอแก้ไข (Suggested Revision)" icon={PencilLine} action={edited ? <Badge tone="info">แก้ไขแล้ว</Badge> : undefined}>
      {a.revision === null && (
        <div className="mb-3 space-y-2">
          <p className="flex gap-2 text-sm text-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            {a.revisionNote ?? 'ไม่มีข้อเสนอแก้ไข'}
          </p>
          {a.findings.length > 0 && (
            <ul className="list-disc space-y-1 pl-9 text-sm text-ink-soft">
              {a.findings.map((f) => (
                <li key={f.ruleId}>{f.suggestion}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-soft">เขียนข้อความใหม่ในช่องด้านล่าง แล้วกด "วิเคราะห์ใหม่" เพื่อเปรียบเทียบ</p>
        </div>
      )}
      <textarea
        aria-label="แก้ไขข้อความฉบับเสนอแก้ไข"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="เขียนข้อความโฆษณาฉบับปรับปรุง"
        className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <p className="mt-1 text-xs text-ink-soft">
        ข้อความใน <b>[วงเล็บเหลี่ยม]</b> คือข้อมูลที่ผู้ประกอบการต้องตรวจสอบและกรอกเองตามข้อเท็จจริง — ระบบไม่สร้างข้อมูลสินค้า ผลทดสอบ หรือหลักฐานแทน
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button icon={RefreshCw} onClick={onReanalyze} loading={loading} disabled={loading || !value.trim()} className="sm:flex-1">
          วิเคราะห์ใหม่เพื่อเปรียบเทียบ
        </Button>
        <Button variant="outline" icon={Copy} disabled={!value.trim()} onClick={() => copyWithToast(value, 'ข้อความฉบับแก้ไข')}>
          คัดลอกข้อความ
        </Button>
        {edited && (
          <Button variant="ghost" onClick={() => onChange(a.revision!)}>
            ย้อนกลับฉบับเสนอ
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

export function AdComparison({ before, after }: { before: AdAnalysis; after: AdAnalysis }) {
  const resolved = before.findings.filter((f) => !after.findings.some((x) => x.ruleId === f.ruleId));
  const remaining = after.findings;
  const better = after.score < before.score;
  return (
    <SectionCard title="เปรียบเทียบก่อน–หลังปรับข้อความ" icon={Sparkles}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className={cn('rounded-xl border p-3', LEVEL_STYLE[before.level])}>
          <p className="text-xs text-ink-soft">ก่อนปรับ</p>
          <p className="font-bold">{before.level.toUpperCase()}</p>
          <p className="text-xs text-ink">{before.findings.length} ประเด็น</p>
        </div>
        <ArrowRight className="h-5 w-5 text-ink-soft" />
        <div className={cn('rounded-xl border p-3', LEVEL_STYLE[after.level])}>
          <p className="text-xs text-ink-soft">หลังปรับ</p>
          <p className="font-bold">{after.level.toUpperCase()}</p>
          <p className="text-xs text-ink">{after.findings.length} ประเด็น</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink">{better ? `ประเด็นที่ควรตรวจสอบลดลง (คะแนนตามกฎ ${before.score} → ${after.score})` : after.score === before.score ? 'ผลตามกฎยังเท่าเดิม ลองปรับข้อความตามคำแนะนำเพิ่มเติม' : `ประเด็นเพิ่มขึ้น (คะแนนตามกฎ ${before.score} → ${after.score}) ตรวจสอบข้อความที่แก้ไขอีกครั้ง`}</p>
      {resolved.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            ประเด็นที่ไม่พบแล้ว ({resolved.length})
          </p>
          <ul className="list-disc space-y-0.5 pl-9 text-sm text-ink">
            {resolved.map((f) => (
              <li key={f.ruleId}>{f.label}</li>
            ))}
          </ul>
        </div>
      )}
      {remaining.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium text-warning">
            <ListChecks className="h-4 w-4" />
            ประเด็นที่ยังควรตรวจสอบ ({remaining.length})
          </p>
          <ul className="list-disc space-y-0.5 pl-9 text-sm text-ink">
            {remaining.map((f) => (
              <li key={f.ruleId}>{f.label}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 flex gap-1.5 rounded-lg bg-bg p-2.5 text-xs text-ink-soft">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        ผลที่ดีขึ้นไม่ได้หมายความว่าโฆษณาถูกต้องตามกฎหมาย และ AI Simulation ไม่ได้อนุมัติข้อความนี้ — ผู้ประกอบการต้องตรวจสอบข้อเท็จจริงก่อนเผยแพร่
      </p>
    </SectionCard>
  );
}
