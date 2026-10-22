import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileSearch, MessageSquareHeart, SearchX } from 'lucide-react';
import type { Complaint } from '@/types';
import { useComplaintStore, confirmDialog, toast } from '@/stores';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { recordAiAnalysis } from '@/stores/workflows';
import { useMyMerchants } from '@/hooks/useCurrent';
import { COMPLAINT_STATUS } from '@/constants/labels';
import { Alert, LinkButton, StatusBadge, Tabs } from '@/components/common/ui';
import { Select } from '@/components/forms/Field';
import { COMPLAINT_EXAMPLES } from '../data/aiExamples';
import { COMPLAINT_KINDS, COMPLAINT_MAX_LENGTH } from '../rules/complaintRules';
import { analyzeComplaint, FOLLOW_UP_LABEL, validateComplaintInput } from '../services/complaintAnalyzer';
import { generateDraft } from '../services/responseDraftGenerator';
import { complaintCaseText, pendingOffers } from '../services/caseText';
import type { ComplaintAnalysis, DraftTone, Particle } from '../types/ai.types';
import { AiDisclaimer, AiHeader } from '../components/AiCommon';
import { AnalysisInput } from '../components/AnalysisInput';
import { ComplaintResult } from '../components/ComplaintResult';
import { ResponseDraftEditor } from '../components/ResponseDraftEditor';
import { useSimulatedRun } from '../hooks/useSimulatedRun';

/** AI-02 — AI ผู้ช่วยจัดการข้อร้องเรียน */
export default function ComplaintAssistant() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const caseParam = params.get('case') ?? undefined;
  const { mine } = useMyMerchants();
  const allComplaints = useComplaintStore((s) => s.items);
  const myCases = useMemo(() => allComplaints.filter((c) => mine.some((m) => m.id === c.merchantId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [allComplaints, mine]);
  const { complaint: ws, setComplaint, setReplyDraft } = useAiWorkspaceStore();
  const [mode, setMode] = useState<'case' | 'text'>(caseParam || ws.source === 'case' ? 'case' : 'text');
  const [error, setError] = useState<string>();
  const { loading, run } = useSimulatedRun();

  const linkedCase: Complaint | undefined = ws.caseId ? myCases.find((c) => c.id === ws.caseId) : undefined;
  const missingCase = caseParam && !myCases.some((c) => c.id === caseParam);

  const draftFor = (a: ComplaintAnalysis, tone: DraftTone, particle: Particle, variant: number, c?: Complaint) =>
    generateDraft(a, { tone, particle, variant, context: c ? { caseId: c.id, confirmedOffers: pendingOffers(c) } : undefined });

  const analyzeNow = (text: string, source: string, c?: Complaint) => {
    const err = validateComplaintInput(text);
    setError(err ?? undefined);
    if (err) return;
    run(() => {
      const analysis = analyzeComplaint(text);
      const { tone, particle } = useAiWorkspaceStore.getState().complaint;
      setComplaint({ analysis, variant: 0, draft: draftFor(analysis, tone, particle, 0, c), draftEdited: false });
      recordAiAnalysis({
        type: 'complaint',
        source: c ? `เคส ${c.id}` : COMPLAINT_EXAMPLES.find((e) => e.id === source && e.text === text) ? `ตัวอย่าง: ${COMPLAINT_EXAMPLES.find((e) => e.id === source)!.title}` : 'ข้อความที่พิมพ์เอง (ไม่บันทึกเนื้อหา)',
        resultCategory: COMPLAINT_KINDS[analysis.primary].th,
        level: FOLLOW_UP_LABEL[analysis.level].label.split(' — ')[0],
      });
    });
  };

  // เปิดจากหน้าเคส (?case=ID): เติมรายละเอียดจากเคสและวิเคราะห์ทันที
  const autoRan = useRef<string>();
  useEffect(() => {
    if (!caseParam || missingCase || autoRan.current === caseParam) return;
    autoRan.current = caseParam;
    const c = myCases.find((x) => x.id === caseParam)!;
    setMode('case');
    if (ws.caseId === c.id && ws.analysis) return; // กลับมาหน้าเดิม/Refresh — ใช้ผลเดิม
    const text = complaintCaseText(c);
    setComplaint({ caseId: c.id, source: 'case', text, analysis: undefined, draft: undefined, draftEdited: false });
    analyzeNow(text, 'case', c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseParam, missingCase]);

  const selectCase = (id: string) => {
    if (!id) return;
    const c = myCases.find((x) => x.id === id)!;
    setParams({ case: id }, { replace: true });
    autoRan.current = id;
    const text = complaintCaseText(c);
    setComplaint({ caseId: id, source: 'case', text, analysis: undefined, draft: undefined, draftEdited: false });
    analyzeNow(text, 'case', c);
  };

  const confirmReplaceDraft = async () => {
    if (!ws.draftEdited) return true;
    const r = await confirmDialog({ title: 'แทนที่ร่างที่แก้ไขแล้ว?', body: 'ข้อความที่คุณแก้ไขในร่างจะถูกแทนที่ด้วยร่างใหม่', confirmText: 'แทนที่' });
    return r.ok;
  };

  const a = ws.analysis;
  const stale = !!a && a.input !== ws.text;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <AiHeader
        icon={MessageSquareHeart}
        title="AI ผู้ช่วยจัดการข้อร้องเรียน"
        desc="สรุปประเด็น ตรวจข้อมูลที่ควรขอเพิ่ม และร่างคำตอบ เพื่อแก้ไขข้อพิพาทเบื้องต้นก่อนส่งต่อเจ้าหน้าที่"
        back={linkedCase ? { to: `/m/complaints/${linkedCase.id}`, label: `กลับไปเคส ${linkedCase.id}` } : { to: '/m/ai', label: 'AI ผู้ช่วย SME' }}
      />
      <AiDisclaimer />

      {missingCase && (
        <Alert tone="error" icon={SearchX} title={`ไม่พบเคส ${caseParam}`} action={<LinkButton to="/m/complaints" size="sm" variant="outline">ไปที่ข้อร้องเรียนของร้าน</LinkButton>}>
          ไม่มีเคสนี้ใน Complaint Center ของร้านค้าที่ใช้งานอยู่ (อาจเป็นเคสของร้านอื่น หรือข้อมูลถูกรีเซ็ตแล้ว) — เลือกเคสอื่นหรือพิมพ์ข้อความเองได้
        </Alert>
      )}

      <section className="rounded-card border border-line bg-white p-4 shadow-card">
        <Tabs
          value={mode}
          onChange={(m) => setMode(m)}
          tabs={[
            { value: 'case', label: 'เลือกเคสจาก Complaint Center', count: myCases.length },
            { value: 'text', label: 'พิมพ์เอง / ตัวอย่าง' },
          ]}
        />
        <div className="mt-4">
          {mode === 'case' ? (
            myCases.length ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-ink">
                  เคสของร้าน
                  <Select value={ws.source === 'case' ? ws.caseId ?? '' : ''} onChange={(e) => selectCase(e.target.value)} className="mt-1.5" disabled={loading}>
                    <option value="">— เลือกเคส —</option>
                    {myCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.title} · {COMPLAINT_STATUS[c.status].label}
                      </option>
                    ))}
                  </Select>
                </label>
                {linkedCase && ws.source === 'case' && (
                  <div className="rounded-xl bg-bg p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{linkedCase.id}</span>
                      <StatusBadge map={COMPLAINT_STATUS} value={linkedCase.status} />
                      <Link to={`/m/complaints/${linkedCase.id}`} className="text-xs text-primary hover:underline">
                        เปิดเคส
                      </Link>
                    </div>
                    <p className="whitespace-pre-wrap text-ink">{ws.text}</p>
                    <p className="mt-1 text-xs text-ink-soft">ใช้ข้อมูลจากเคสในระบบสาธิตเท่านั้น (ไม่แสดงข้อมูลส่วนบุคคลของผู้ร้องเรียน)</p>
                  </div>
                )}
                {loading && <p className="text-sm text-ink-soft">กำลังวิเคราะห์ตามกฎ…</p>}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">ร้านค้านี้ยังไม่มีข้อร้องเรียนในระบบ — ลองพิมพ์ข้อความเองหรือเลือกตัวอย่าง</p>
            )
          ) : (
            <AnalysisInput
              id="complaint-input"
              label="ข้อร้องเรียนที่ได้รับ"
              value={ws.source === 'case' ? '' : ws.text}
              onChange={(v) => {
                setComplaint({ text: v, caseId: undefined, source: COMPLAINT_EXAMPLES.some((e) => e.id === ws.source && e.text === v) ? ws.source : 'custom' });
                if (error) setError(undefined);
              }}
              placeholder="วางหรือพิมพ์ข้อความที่ลูกค้าแจ้ง เช่น โอนเงินแล้วยังไม่ได้รับสินค้า..."
              max={COMPLAINT_MAX_LENGTH}
              examples={COMPLAINT_EXAMPLES}
              activeExample={ws.source}
              onExample={(id) => {
                const ex = COMPLAINT_EXAMPLES.find((e) => e.id === id)!;
                setParams({}, { replace: true });
                setComplaint({ text: ex.text, source: ex.id, caseId: undefined, analysis: undefined, draft: undefined, draftEdited: false });
                setError(undefined);
              }}
              onAnalyze={() => analyzeNow(ws.text, ws.source)}
              onClear={() => {
                setComplaint({ text: '', source: 'custom', analysis: undefined, draft: undefined, draftEdited: false });
                setError(undefined);
              }}
              loading={loading}
              error={error}
              analyzeLabel="วิเคราะห์ข้อร้องเรียน"
              stale={stale && ws.source !== 'case'}
            />
          )}
        </div>
      </section>

      {!a && !loading && (
        <div className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-ink-soft">
          <FileSearch className="mx-auto mb-2 h-8 w-8 text-primary" />
          เลือกเคสหรือพิมพ์ข้อร้องเรียน แล้วกดวิเคราะห์
        </div>
      )}

      {a && !(stale && ws.source !== 'case') && (
        <>
          <ComplaintResult a={a} />
          <ResponseDraftEditor
            tone={ws.tone}
            particle={ws.particle}
            draft={ws.draft ?? ''}
            edited={ws.draftEdited}
            onTone={async (t) => {
              if (t === ws.tone || !(await confirmReplaceDraft())) return;
              setComplaint({ tone: t, variant: 0, draft: draftFor(a, t, ws.particle, 0, linkedCase), draftEdited: false });
            }}
            onParticle={async (p) => {
              if (!(await confirmReplaceDraft())) return;
              setComplaint({ particle: p, draft: draftFor(a, ws.tone, p, ws.variant, linkedCase), draftEdited: false });
            }}
            onChange={(v) => setComplaint({ draft: v, draftEdited: true })}
            onRegenerate={async () => {
              if (!(await confirmReplaceDraft())) return;
              const v = ws.variant + 1;
              setComplaint({ variant: v, draft: draftFor(a, ws.tone, ws.particle, v, linkedCase), draftEdited: false });
            }}
            onReset={() => setComplaint({ variant: 0, draft: draftFor(a, ws.tone, ws.particle, 0, linkedCase), draftEdited: false })}
            onInsert={() => {
              if (!linkedCase || !ws.draft) return;
              setReplyDraft(linkedCase.id, { text: ws.draft, suggestedType: a.missing.length ? 'request_info' : 'explain', createdAt: new Date().toISOString() });
              toast.success('นำร่างไปใส่ช่องตอบกลับแล้ว', 'ยังไม่ได้ส่ง — ตรวจสอบและกด "ส่งการตอบกลับ" ด้วยตนเอง');
              nav(`/m/complaints/${linkedCase.id}`);
            }}
            insertDisabledReason={
              !linkedCase || ws.source !== 'case'
                ? 'ใช้ได้เมื่อเลือกเคสจาก Complaint Center — ข้อความที่พิมพ์เองให้คัดลอกไปใช้'
                : ['resolved', 'closed'].includes(linkedCase.status)
                  ? 'เคสนี้ปิดแล้ว ไม่สามารถตอบกลับเพิ่มได้'
                  : undefined
            }
          />
        </>
      )}
    </div>
  );
}
