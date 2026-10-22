import { useState } from 'react';
import { FileSearch, ListChecks, RotateCcw, ScanText, Shuffle } from 'lucide-react';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { confirmDialog, toast } from '@/stores';
import { recordAiAnalysis } from '@/stores/workflows';
import { Button } from '@/components/common/ui';
import { AD_EXAMPLES } from '../data/aiExamples';
import { AD_MAX_LENGTH } from '../rules/advertisingRules';
import { AD_LEVEL_LABEL, analyzeAd, validateAdInput } from '../services/advertisingAnalyzer';
import { AiDisclaimer, AiHeader, SectionCard } from '../components/AiCommon';
import { AnalysisInput } from '../components/AnalysisInput';
import { AdComparison, FindingList, HighlightedText, RiskLevelCard, SuggestedRevision } from '../components/AdResult';
import { useSimulatedRun } from '../hooks/useSimulatedRun';

const levelShort = (l: string) => AD_LEVEL_LABEL[l as keyof typeof AD_LEVEL_LABEL].label.split(' — ')[0];

/** AI-01 — AI ผู้ช่วยตรวจสอบข้อความโฆษณา */
export default function AdvertisingChecker() {
  const { ad, setAd } = useAiWorkspaceStore();
  const [error, setError] = useState<string>();
  const main = useSimulatedRun();
  const re = useSimulatedRun();
  const before = ad.before;
  const stale = !!before && before.input !== ad.text;
  const revisionValue = ad.revisionDraft ?? before?.revision ?? '';
  const exampleTitle = AD_EXAMPLES.find((e) => e.id === ad.source)?.title;

  const analyze = () => {
    const err = validateAdInput(ad.text);
    setError(err ?? undefined);
    if (err) return;
    const text = ad.text;
    main.run(() => {
      const result = analyzeAd(text);
      setAd({ before: result, after: undefined, revisionDraft: result.revision ?? '' });
      recordAiAnalysis({
        type: 'advertising',
        source: exampleTitle && AD_EXAMPLES.find((e) => e.id === ad.source)?.text === text ? `ตัวอย่าง: ${exampleTitle}` : 'ข้อความที่พิมพ์เอง (ไม่บันทึกเนื้อหา)',
        resultCategory: result.findings[0]?.label ?? 'ไม่พบตามกฎ',
        level: levelShort(result.level),
      });
    });
  };

  const reanalyze = () => {
    const err = validateAdInput(revisionValue);
    if (err) return toast.error('วิเคราะห์ใหม่ไม่ได้', err);
    const text = revisionValue;
    re.run(() => {
      const result = analyzeAd(text);
      setAd({ after: result });
      recordAiAnalysis({ type: 'advertising', source: 'ข้อความที่ปรับตามข้อเสนอ', resultCategory: result.findings[0]?.label ?? 'ไม่พบตามกฎ', level: levelShort(result.level) });
      toast.success('วิเคราะห์ข้อความฉบับปรับปรุงแล้ว', 'ดูผลเปรียบเทียบก่อน–หลังด้านล่าง');
    });
  };

  const pickExample = (id: string) => {
    const ex = AD_EXAMPLES.find((e) => e.id === id)!;
    setAd({ text: ex.text, source: ex.id, before: undefined, after: undefined, revisionDraft: undefined });
    setError(undefined);
  };

  const resetAll = async () => {
    if (before) {
      const r = await confirmDialog({ title: 'เริ่มใหม่ทั้งหมด?', body: 'ข้อความและผลวิเคราะห์ในหน้านี้จะถูกล้าง', confirmText: 'เริ่มใหม่' });
      if (!r.ok) return;
    }
    setAd({ text: '', source: 'custom', before: undefined, after: undefined, revisionDraft: undefined });
    setError(undefined);
  };

  const tryAnother = () => {
    const pool = AD_EXAMPLES.filter((e) => e.id !== ad.source);
    pickExample(pool[Math.floor(Math.random() * pool.length)].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <AiHeader icon={ScanText} title="AI ผู้ช่วยตรวจสอบข้อความโฆษณา" desc="ตรวจสอบความเสี่ยงของข้อความโฆษณาก่อนเผยแพร่" back={{ to: '/m/ai', label: 'AI ผู้ช่วย SME' }} />
      <AiDisclaimer />

      <section className="rounded-card border border-line bg-white p-4 shadow-card">
        <AnalysisInput
          id="ad-input"
          label="ข้อความโฆษณาที่ต้องการตรวจสอบ"
          value={ad.text}
          onChange={(v) => {
            setAd({ text: v, source: AD_EXAMPLES.some((e) => e.id === ad.source && e.text === v) ? ad.source : 'custom' });
            if (error) setError(undefined);
          }}
          placeholder="ตัวอย่าง: อาหารเสริมของเราเห็นผลทันที 100% รักษาได้ทุกโรค รับประกันผลลัพธ์..."
          max={AD_MAX_LENGTH}
          examples={AD_EXAMPLES}
          activeExample={ad.source}
          onExample={pickExample}
          onAnalyze={analyze}
          onClear={() => {
            setAd({ text: '', source: 'custom' });
            setError(undefined);
          }}
          loading={main.loading}
          error={error}
          analyzeLabel="วิเคราะห์ข้อความโฆษณา"
          stale={stale}
        />
      </section>

      {!before && !main.loading && (
        <div className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-ink-soft">
          <FileSearch className="mx-auto mb-2 h-8 w-8 text-primary" />
          เลือกตัวอย่างหรือพิมพ์ข้อความโฆษณา แล้วกด "วิเคราะห์ข้อความโฆษณา"
        </div>
      )}

      {before && (
        <>
          {stale && <p className="rounded-xl bg-warning-50 px-3 py-2 text-sm text-[#7a4705]">ผลด้านล่างเป็นของข้อความก่อนแก้ไข กด "วิเคราะห์ข้อความโฆษณา" อีกครั้งเพื่ออัปเดต</p>}
          <RiskLevelCard a={before} />
          <SectionCard title="ข้อความต้นฉบับ (Highlight จุดที่ตรวจพบ)" icon={ScanText}>
            <HighlightedText a={before} />
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
              <span><mark className="rounded bg-error-50 px-1 text-error">แดง</mark> ควรตรวจสอบอย่างละเอียด</span>
              <span><mark className="rounded bg-warning-50 px-1 text-[#7a4705]">ส้ม</mark> ควรตรวจสอบเพิ่มเติม</span>
              <span><mark className="rounded bg-slate-100 px-1 text-ink">เทา</mark> ข้อสังเกต</span>
            </p>
          </SectionCard>
          <SectionCard title={`ประเด็นที่ตรวจพบ (${before.findings.length})`} icon={ListChecks}>
            <FindingList findings={before.findings} />
          </SectionCard>
          {before.findings.length > 0 && <SuggestedRevision a={before} value={revisionValue} onChange={(v) => setAd({ revisionDraft: v })} onReanalyze={reanalyze} loading={re.loading} />}
          {ad.after && <AdComparison before={before} after={ad.after} />}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" icon={Shuffle} onClick={tryAnother}>
              ลองตัวอย่างอื่น
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={resetAll}>
              เริ่มใหม่ (Reset)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
