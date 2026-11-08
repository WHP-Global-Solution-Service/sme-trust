import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calculator, CheckCircle2, Circle, FileText, Gavel, Gauge } from 'lucide-react';
import { toast, useAssessmentStore, useMerchantStore, useOperatorStore, useVerificationStore } from '@/stores';
import { REGISTRATION_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { decideAssessment, v1CriteriaFor } from '@/stores/workflowsV2';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/common/ui';
import { OfficerBadgeStatus } from '@/features/automation/components/AutomationParts';
import { Textarea } from '@/components/forms/Field';
import { fmtDate } from '@/utils/format';
import { MarketplaceDisclaimer } from '@/features/marketplace/components/MarketplaceParts';
import { useAssessmentState } from '../hooks';
import { ASSESSMENT_DISCLAIMER, ASSESSMENT_STATUS, BAND_LABEL, DECISION_LABEL, RECOMMENDATION_LABEL } from '../labels';
import type { OfficerDecisionKind } from '../types';
import { AnalysisPanels, BandBadge, CalculationTable, DataQuality, FactorList, SourcesLine, StandingBanner } from '../components/AssessmentParts';
import { MarketplaceEvidence } from '../components/AssessmentSupportPanel';
import { ImportReviewSection } from '@/features/marketplace/components/ImportReviewSection';

const KINDS: OfficerDecisionKind[] = ['approved', 'need_info', 'rejected', 'escalated'];

export default function OfficerAssessmentDetail() {
  const { id } = useParams();
  const a = useAssessmentStore((s) => s.items.find((x) => x.id === id));
  const m = useMerchantStore((s) => s.items.find((x) => x.id === a?.merchantId));
  const { latest, stale } = useAssessmentState(a?.merchantId);
  const op = useOperatorStore((s) => s.items.find((o) => o.id === m?.operatorId));
  const app = useVerificationStore((s) => s.items.find((x) => x.id === (a?.decision?.applicationId ?? a?.applicationId)));
  const [kind, setKind] = useState<OfficerDecisionKind>();
  const [level, setLevel] = useState<3 | 4>(3);
  const [reason, setReason] = useState('');

  if (!a || !m)
    return (
      <div>
        <PageHeader title="ผลประเมิน" back={{ to: '/o/assessments', label: 'Trust Assessment Review' }} />
        <EmptyState title="ไม่พบผลประเมิน" />
      </div>
    );

  const r = a.result;
  const recLevel = r.recommendation.kind === 'consider_l4' ? 4 : 3;
  const criteria = v1CriteriaFor(m.id, kind === 'approved' ? level : recLevel);
  const decide = () => {
    if (!kind) return toast.error('กรุณาเลือกผลการพิจารณา');
    const res = decideAssessment(a.id, kind, reason, kind === 'approved' ? level : undefined);
    if (res.ok) toast.success('บันทึกผลการพิจารณาแล้ว', DECISION_LABEL[kind].label);
    else toast.error('บันทึกไม่ได้', res.error);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={`${a.id} — ${m.shopName}`}
        subtitle={`ประเมินเมื่อ ${fmtDate(a.createdAt, true)}`}
        icon={Gauge}
        back={{ to: '/o/assessments', label: 'Trust Assessment Review' }}
        action={<StatusBadge map={ASSESSMENT_STATUS} value={a.status} />}
      />
      <MarketplaceDisclaimer />
      <OfficerBadgeStatus merchantId={m.id} />
      {stale && latest?.id === a.id && <Alert tone="warning">ข้อมูลของร้านเปลี่ยนแปลงหลังการประเมินนี้ — ผลอาจไม่ตรงกับข้อมูลปัจจุบัน</Alert>}
      {/* Scenario 9: ข้อมูลที่ร้านนำเข้าจาก Marketplace และแก้ไขก่อนยืนยัน (ต้นฉบับเทียบกับข้อมูลที่ส่ง) */}
      <ImportReviewSection merchantId={m.id} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="space-y-4 p-4 sm:p-5">
              <StandingBanner standing={r.standing} reason={r.standingReason} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <BandBadge band={r.band} large />
                <div className="text-right">
                  <p className="text-xs text-ink-soft">คะแนน (เฉพาะเจ้าหน้าที่)</p>
                  <p className="text-3xl font-bold text-ink">{r.score.toFixed(1)}</p>
                </div>
              </div>
              <p className="text-sm text-ink-soft">{BAND_LABEL[r.band].desc}</p>
              <DataQuality result={r} detail />
              <SourcesLine result={r} />
            </div>
          </Card>
          <Card>
            <CardHeader title="วิธีคำนวณ" subtitle={`น้ำหนักที่ใช้ในการประเมินนี้ C1 ${r.weights.C1} · C2 ${r.weights.C2} · C3 ${r.weights.C3} · C4 ${r.weights.C4} · C5 ${r.weights.C5}`} icon={Calculator} />
            <div className="p-4 sm:p-5">
              <CalculationTable result={r} />
            </div>
          </Card>
          <Card>
            <CardHeader title="ปัจจัยและหลักฐาน" />
            <div className="p-4 sm:p-5">
              <FactorList result={r} showNumbers />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="คำขอ ตัวตน และหลักฐาน" icon={FileText} />
            <div className="space-y-3 p-4 text-sm">
              <p>
                คำขอ:{' '}
                {app ? (
                  <>
                    <Link to={`/o/applications/${app.id}`} className="font-mono text-primary hover:underline">
                      {app.id}
                    </Link>{' '}
                    · {app.type === 'registration' ? 'ลงทะเบียนร้านค้า' : `ขอรับรอง ${TRUST_LEVELS[app.requestedLevel].name}`} <StatusBadge map={REGISTRATION_STATUS} value={app.status} />
                  </>
                ) : (
                  <span className="text-ink-soft">ไม่มีคำขอที่ผูกกับผลประเมินนี้</span>
                )}
              </p>
              <p>
                ยืนยันตัวตนเจ้าของร้าน: <Badge tone={op?.kycStatus === 'verified' ? 'success' : 'warning'}>{op?.kycStatus === 'verified' ? 'e-KYC ผ่าน (จำลอง)' : 'ยังไม่ยืนยันตัวตน'}</Badge>
              </p>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-soft">Marketplace Evidence</p>
                <MarketplaceEvidence merchantId={m.id} />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="ข้อเสนอของระบบ" subtitle="ข้อมูลประกอบ — ไม่ออก Badge อัตโนมัติ" />
            <div className="space-y-2 p-4 text-sm">
              <StatusBadge map={RECOMMENDATION_LABEL} value={r.recommendation.kind} />
              <ul className="text-ink-soft">
                {r.recommendation.reasons.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title={`เกณฑ์ v1 ของ Level ${kind === 'approved' ? level : recLevel}`} subtitle="ต้องผ่านครบจึงอนุมัติยกระดับได้ (D3)" />
            <ul className="space-y-1 p-4 text-sm">
              {criteria.map((c) => (
                <li key={c.label} className="flex gap-2">
                  {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-line" />}
                  <span className={c.met ? 'text-ink' : 'text-ink-soft'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="ผลการพิจารณา" icon={Gavel} />
            <div className="space-y-3 p-4 text-sm">
              {a.decision ? (
                <Alert tone={DECISION_LABEL[a.decision.kind].tone} title={`${DECISION_LABEL[a.decision.kind].label}${a.decision.level ? ` Level ${a.decision.level}` : ''}`}>
                  {a.decision.reason} — {a.decision.officerName} · {fmtDate(a.decision.at, true)}
                  {a.decision.overridesRecommendation && <span className="mt-1 block font-medium">ตัดสินต่างจากข้อเสนอของระบบ (บันทึกเหตุผลแล้ว)</span>}
                  {a.decision.certId && (
                    <span className="mt-1 block">
                      ใบรับรอง{' '}
                      <Link to={`/verify/${a.decision.certId}`} className="font-mono underline">
                        {a.decision.certId}
                      </Link>
                    </span>
                  )}
                  {a.decision.riskCaseId && (
                    <span className="mt-1 block">
                      เปิดเรื่องพิจารณาความเสี่ยง{' '}
                      <Link to={`/o/risk/${a.decision.riskCaseId}`} className="font-mono underline">
                        {a.decision.riskCaseId}
                      </Link>
                    </span>
                  )}
                </Alert>
              ) : a.status !== 'pending_review' ? (
                <p className="text-ink-soft">ร้านค้ายังไม่ได้ส่งผลประเมินนี้ให้พิจารณา</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ผลการพิจารณา">
                    {KINDS.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-xl border px-3 py-2 text-left text-sm ${kind === k ? 'border-primary bg-primary-50 font-medium text-primary' : 'border-line hover:bg-bg'}`}>
                        {DECISION_LABEL[k].label}
                      </button>
                    ))}
                  </div>
                  {kind === 'approved' && (
                    <label className="block text-sm">
                      ระดับที่อนุมัติ
                      <select value={level} onChange={(e) => setLevel(Number(e.target.value) as 3 | 4)} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2">
                        <option value={3}>Level 3 — Trusted SME</option>
                        <option value={4}>Level 4</option>
                      </select>
                    </label>
                  )}
                  <label className="block text-sm">
                    เหตุผล (บันทึกใน Audit Log)
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="อธิบายเหตุผลของการพิจารณา" />
                  </label>
                  <Button block onClick={decide}>
                    บันทึกผลการพิจารณา
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
      <AnalysisPanels result={r} />
      <p className="rounded-lg bg-bg p-3 text-xs text-ink-soft">{ASSESSMENT_DISCLAIMER}</p>
    </div>
  );
}
