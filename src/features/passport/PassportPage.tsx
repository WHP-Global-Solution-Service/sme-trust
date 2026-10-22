import { Link } from 'react-router-dom';
import { Award, BadgeCheck, GraduationCap, IdCard, Printer, Store, TrendingUp, UserCheck } from 'lucide-react';
import { useCertificationStore, useTrainingStore, useWarningStore } from '@/stores';
import { useCurrentOperator, useMyMerchants } from '@/hooks/useCurrent';
import { courses } from '@/mock/data';
import { CERT_STATUS, CHANNEL_STATUS, CHANNEL_TYPES, TRUST_LEVELS } from '@/constants/labels';
import { currentCert, effectiveLevel, verdictFor } from '@/utils/trust';
import { fmtDate } from '@/utils/format';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/common/ui';
import { DemoLabel, TrustSeal, VerdictBadge } from '@/components/common/Trust';
import { Timeline } from '@/components/common/Timeline';

/** SME Trust Passport — ประวัติดิจิทัลของผู้ประกอบการ (รวมทุกร้าน) */
export default function PassportPage() {
  const op = useCurrentOperator();
  const { mine } = useMyMerchants();
  const certs = useCertificationStore((s) => s.items);
  const enrollments = useTrainingStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  if (!op) return null;

  const myEnroll = enrollments.filter((e) => e.operatorId === op.id && e.passed);
  const myIds = mine.map((m) => m.id);
  const improvements = warnings.filter((w) => myIds.includes(w.merchantId) && ['completed', 'correction_submitted', 'under_review'].includes(w.status));
  const allCertHistory = certs.filter((c) => myIds.includes(c.merchantId)).flatMap((c) => c.history.map((h) => ({ ...h, note: `${c.id}${h.note ? ` · ${h.note}` : ''}` })));

  return (
    <div>
      <PageHeader
        title="SME Trust Passport"
        subtitle="ประวัติดิจิทัลของผู้ประกอบการ (ข้อมูลสาธิต)"
        icon={IdCard}
        action={
          <Button variant="outline" icon={Printer} onClick={() => window.print()}>
            พิมพ์ / บันทึก PDF
          </Button>
        }
      />

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 bg-primary p-5 text-white sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-bold">{op.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold">{op.name}</p>
            <p className="text-sm text-white/80">Mock Identity ID: {op.mockIdentityId} · {op.province}</p>
            <p className="text-sm text-white/80">สมาชิกตั้งแต่ {fmtDate(op.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm">
              <UserCheck className="h-4 w-4" />
              {op.kycStatus === 'verified' ? `ยืนยันตัวตนแล้ว ${fmtDate(op.kycVerifiedAt)}` : 'ยังไม่ยืนยันตัวตน'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line text-center">
          <div className="p-3">
            <p className="text-2xl font-bold text-ink">{mine.length}</p>
            <p className="text-xs text-ink-soft">ร้านค้า</p>
          </div>
          <div className="p-3">
            <p className="text-2xl font-bold text-ink">{myEnroll.length}</p>
            <p className="text-xs text-ink-soft">หลักสูตรที่ผ่าน</p>
          </div>
          <div className="p-3">
            <p className="text-2xl font-bold text-ink">{improvements.length}</p>
            <p className="text-xs text-ink-soft">การปรับปรุงตามคำแนะนำ</p>
          </div>
        </div>
      </Card>

      {!mine.length && (
        <Card className="mb-4">
          <EmptyState icon={Store} title="ยังไม่มีร้านค้าใน Passport" desc="เมื่อลงทะเบียนร้านค้า ข้อมูลจะปรากฏที่นี่" />
        </Card>
      )}

      <div className="space-y-4">
        {mine.map((m) => {
          const cert = currentCert(certs, m.id);
          const verdict = verdictFor(m, op, cert);
          const level = effectiveLevel(op, cert);
          return (
            <Card key={m.id}>
              <CardHeader title={m.shopName} subtitle={`${m.id} · ${m.category}`} icon={Store} action={<VerdictBadge verdict={verdict} size="sm" />} />
              <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[auto_1fr]">
                <div className="flex justify-center">
                  <TrustSeal level={level} shopName={m.shopName} usable={verdict.usable} />
                </div>
                <div className="space-y-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-ink-soft">ระดับปัจจุบัน</p>
                      <p className="font-medium">Level {level} — {TRUST_LEVELS[level].name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-soft">ใบรับรอง</p>
                      {cert ? (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Link to={`/verify/${cert.id}`} className="font-mono text-primary hover:underline">{cert.id}</Link>
                          <StatusBadge map={CERT_STATUS} value={cert.status} />
                        </p>
                      ) : (
                        <p className="text-ink-soft">ยังไม่มี</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink">ช่องทางขายและสถานะการตรวจสอบ</p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {m.channels.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            <b>{CHANNEL_TYPES[c.type].label}</b> · {c.handle}
                          </span>
                          <StatusBadge map={CHANNEL_STATUS} value={c.status} />
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-xs text-ink-soft">การยืนยันตัวตนเจ้าของร้านหนึ่งครั้ง ไม่เท่ากับการตรวจสอบทุกบัญชีโซเชียลมีเดีย</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="การอบรมที่ผ่าน" icon={GraduationCap} />
          {myEnroll.length ? (
            <ul className="divide-y divide-line">
              {myEnroll.map((e) => {
                const c = courses.find((x) => x.id === e.courseId)!;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Award className="h-5 w-5 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{c.title}</p>
                      <p className="text-xs text-ink-soft">
                        {e.certificateNo} · คะแนน {e.bestScore}% · {fmtDate(e.completedAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={GraduationCap} title="ยังไม่มีการอบรมที่ผ่าน" action={<Link to="/m/training" className="text-sm text-primary">ไปศูนย์อบรม</Link>} />
          )}
        </Card>
        <Card>
          <CardHeader title="ประวัติการปรับปรุงตามคำแนะนำ" icon={TrendingUp} />
          {improvements.length ? (
            <ul className="divide-y divide-line">
              {improvements.map((w) => (
                <li key={w.id}>
                  <Link to={`/m/warnings/${w.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg sm:px-5">
                    <BadgeCheck className="h-5 w-5 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{w.title}</p>
                      <p className="text-xs text-ink-soft">
                        {w.id} · {w.kind === 'advisory' ? 'คำแนะนำ' : 'คำเตือน'} · ปรับปรุงเมื่อ {fmtDate(w.updatedAt)}
                      </p>
                    </div>
                    <Badge tone={w.status === 'completed' ? 'success' : 'info'}>{w.status === 'completed' ? 'เสร็จสิ้น' : 'รอตรวจ'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={TrendingUp} title="ยังไม่มีประวัติการปรับปรุง" />
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="ประวัติการรับรองและการต่ออายุ" icon={BadgeCheck} />
        <div className="p-4 sm:p-5">
          <Timeline events={allCertHistory} />
        </div>
      </Card>
      <DemoLabel className="mt-4 text-center" />
    </div>
  );
}
