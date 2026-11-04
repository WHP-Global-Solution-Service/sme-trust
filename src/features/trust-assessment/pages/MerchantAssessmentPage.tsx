import { Gauge, Link2, RefreshCw, Send } from 'lucide-react';
import { toast } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { runAssessment, submitAssessment } from '@/stores/workflowsV2';
import { Alert, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import { MarketplaceDisclaimer } from '@/features/marketplace/components/MarketplaceParts';
import { useAssessmentState } from '../hooks';
import { ASSESSMENT_DISCLAIMER, ASSESSMENT_STATUS, BAND_LABEL, DECISION_LABEL, RECOMMENDATION_LABEL } from '../labels';
import { AnalysisPanels, BandBadge, DataQuality, DimensionGrid, FactorList, ImproveList, SourcesLine, StandingBanner } from '../components/AssessmentParts';

/** มุมร้านค้า: Band, Coverage, Confidence, ปัจจัย (ทิศทาง +/−) และคำแนะนำ — ไม่แสดงคะแนนตัวเลข (D2) */
export default function MerchantAssessmentPage() {
  const { active: m } = useMyMerchants();
  const { latest: a, stale, history } = useAssessmentState(m?.id);

  if (!m)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="ผลประเมินความน่าเชื่อถือ" back={{ to: '/m', label: 'หน้าหลัก' }} />
        <EmptyState title="ยังไม่มีร้านค้า" action={<LinkButton to="/m/register-shop">ลงทะเบียนร้านค้า</LinkButton>} />
      </div>
    );

  const run = () => {
    const r = runAssessment(m.id);
    if (r) toast.success('ประเมินความน่าเชื่อถือแล้ว', BAND_LABEL[r.result.band].label);
  };
  const submit = () => {
    if (!a) return;
    const r = submitAssessment(a.id);
    if (r.ok) toast.success('ส่งผลประเมินให้เจ้าหน้าที่พิจารณาแล้ว', 'ผลการพิจารณาจะแจ้งผ่านการแจ้งเตือน');
    else toast.error('ส่งพิจารณาไม่ได้', r.error);
  };
  const rec = a?.result.recommendation;
  // ส่งได้ทุกผลที่สถานะการรับรองปกติ — ผลที่ข้อมูลยังไม่พอใช้ขอให้เจ้าหน้าที่พิจารณาหลักฐานเพิ่มเติม (ไม่ออก Badge อัตโนมัติ)
  const canSubmit = !!a && a.status === 'draft' && !stale && a.result.standing === 'normal';
  const forUpgrade = rec?.kind === 'consider_l3' || rec?.kind === 'consider_l4';

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title="ผลประเมินความน่าเชื่อถือ (Trust Assessment v2)"
        subtitle={`${m.shopName} — ใช้ประกอบการพิจารณา Level 3–4 โดยเจ้าหน้าที่ ไม่ใช่การรับรองอัตโนมัติ`}
        icon={Gauge}
        back={{ to: '/m', label: 'หน้าหลัก' }}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/m/marketplace" variant="outline" icon={Link2}>
              จัดการการเชื่อมต่อ
            </LinkButton>
            <Button icon={RefreshCw} onClick={run}>
              {a ? 'ประเมินใหม่' : 'ประเมินความน่าเชื่อถือ'}
            </Button>
          </div>
        }
      />
      <MarketplaceDisclaimer />

      {!a ? (
        <Card>
          <EmptyState title="ยังไม่มีผลประเมิน" desc="เชื่อมต่อ Marketplace (จำลอง) แล้วกด ประเมินความน่าเชื่อถือ — ร้านที่ยังไม่เชื่อมต่อจะได้ผล Insufficient Data ซึ่งไม่ใช่ผลลบ" />
        </Card>
      ) : (
        <>
          {stale && (
            <Alert tone="warning" title="ข้อมูลเปลี่ยนแปลงหลังการประเมิน" action={<Button size="sm" onClick={run}>ประเมินใหม่</Button>}>
              ผลด้านล่างคำนวณจากข้อมูลเดิม กด "ประเมินใหม่" เพื่อใช้ข้อมูลล่าสุดก่อนส่งให้เจ้าหน้าที่
            </Alert>
          )}
          <Card>
            <div className="space-y-4 p-4 sm:p-5">
              <StandingBanner standing={a.result.standing} reason={a.result.standingReason} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <BandBadge band={a.result.band} large />
                  <p className="mt-1 text-sm text-ink-soft">{BAND_LABEL[a.result.band].desc}</p>
                  {a.result.insufficientReasons.length > 0 && <p className="mt-1 text-sm text-ink">ข้อมูลที่ยังขาด: {a.result.insufficientReasons.join(' · ')}</p>}
                </div>
                <div className="text-right text-sm">
                  <StatusBadge map={ASSESSMENT_STATUS} value={a.status} />
                  <p className="mt-1 text-xs text-ink-soft">
                    {a.id} · {fmtDate(a.createdAt, true)}
                  </p>
                </div>
              </div>
              <DataQuality result={a.result} detail />
              <SourcesLine result={a.result} />
            </div>
          </Card>

          <Card>
            <CardHeader title="การพิจารณาของเจ้าหน้าที่" subtitle="ผลประเมินเป็นข้อมูลประกอบ — การให้หรือยกระดับ Badge ต้องผ่านเจ้าหน้าที่และเกณฑ์ v1 เสมอ" />
            <div className="space-y-3 p-4 text-sm">
              {rec && (
                <p>
                  ข้อเสนอของระบบ: <StatusBadge map={RECOMMENDATION_LABEL} value={rec.kind} />
                  <span className="mt-1 block text-ink-soft">{rec.reasons.join(' · ')}</span>
                </p>
              )}
              {a.status === 'draft' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button icon={Send} onClick={submit} disabled={!canSubmit}>
                    ส่งให้เจ้าหน้าที่พิจารณา
                  </Button>
                  <span className="text-xs text-ink-soft">
                    {!canSubmit
                      ? stale
                        ? 'ประเมินใหม่ก่อนส่ง'
                        : 'สถานะการรับรองไม่ปกติ จึงยังส่งไม่ได้'
                      : forUpgrade
                        ? 'ระบบยื่นคำขอรับรองระดับที่แนะนำผ่าน Workflow v1 (หรือใช้คำขอที่ค้างอยู่)'
                        : 'ผลยังไม่ถึงเกณฑ์ยกระดับ — ส่งเพื่อให้เจ้าหน้าที่พิจารณาและแจ้งหลักฐานที่ควรเพิ่ม'}
                  </span>
                </div>
              )}
              {a.status === 'pending_review' && (
                <Alert tone="info">
                  ส่งให้เจ้าหน้าที่พิจารณาแล้วเมื่อ {fmtDate(a.submittedAt!, true)}
                  {a.applicationId && ` · คำขอ ${a.applicationId}`}
                </Alert>
              )}
              {a.decision && (
                <Alert tone={DECISION_LABEL[a.decision.kind].tone} title={`${DECISION_LABEL[a.decision.kind].label}${a.decision.level ? ` Level ${a.decision.level}` : ''}`}>
                  {a.decision.reason} — {a.decision.officerName} · {fmtDate(a.decision.at, true)}
                </Alert>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="5 Assessment Dimensions" subtitle="น้ำหนักจาก Assessment Configuration ปัจจุบัน — มิติที่ไม่มีข้อมูลไม่ถูกนับเป็นศูนย์" />
            <div className="p-4 sm:p-5">
              <DimensionGrid result={a.result} />
            </div>
          </Card>
          <Card>
            <CardHeader title="ข้อมูลที่ควรเพิ่มเติม" subtitle="สิ่งที่ร้านทำได้เพื่อเพิ่มความครอบคลุมและความน่าเชื่อถือของผลประเมิน" />
            <div className="p-4 sm:p-5">
              <ImproveList result={a.result} />
            </div>
          </Card>

          <Card>
            <CardHeader title="ปัจจัยที่มีผลและสิ่งที่ปรับปรุงได้" subtitle="↑ ส่งผลบวก · ↓ ส่งผลลบ — ผลประเมินอธิบายได้ทุกปัจจัย" />
            <div className="p-4 sm:p-5">
              <FactorList result={a.result} />
            </div>
          </Card>
          <AnalysisPanels result={a.result} />
          {history.length > 1 && (
            <Card>
              <CardHeader title="ประวัติผลประเมิน" />
              <ul className="divide-y divide-line text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span>
                      {h.id} · {fmtDate(h.createdAt, true)}
                    </span>
                    <span className="flex gap-2">
                      <StatusBadge map={BAND_LABEL} value={h.result.band} />
                      <StatusBadge map={ASSESSMENT_STATUS} value={h.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <p className="rounded-lg bg-bg p-3 text-xs text-ink-soft">{ASSESSMENT_DISCLAIMER}</p>
    </div>
  );
}
