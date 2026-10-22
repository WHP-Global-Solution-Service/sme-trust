import { useState } from 'react';
import { Gavel, MessageSquare, Scale, ShieldCheck } from 'lucide-react';
import { useRiskStore, confirmDialog, toast } from '@/stores';
import { merchantStatement, submitAppeal } from '@/stores/workflows';
import { useMyMerchants } from '@/hooks/useCurrent';
import { RISK_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/common/ui';
import { Timeline } from '@/components/common/Timeline';
import { Field, Textarea } from '@/components/forms/Field';
import { RiskLadder } from './RiskParts';

export default function MerchantReview() {
  const { mine } = useMyMerchants();
  const risks = useRiskStore((s) => s.items);
  const ids = mine.map((m) => m.id);
  const list = risks.filter((r) => ids.includes(r.merchantId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [text, setText] = useState<Record<string, string>>({});

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="สถานะความเสี่ยงและการอุทธรณ์" subtitle="ชี้แจงข้อเท็จจริงและยื่นอุทธรณ์ภายในระบบสาธิต" icon={Scale} />
      <Alert tone="info" className="mb-4">
        ข้อกล่าวหา (Allegation) ยังไม่ใช่ข้อสรุปว่ากระทำผิด ระบบไม่ระงับหรือ Blacklist ร้านค้าอัตโนมัติจากข้อร้องเรียนเพียงครั้งเดียว ทุกมาตรการต้องมีเหตุผลและเปิดให้ร้านค้าชี้แจงเสมอ
      </Alert>
      {!list.length ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="ไม่มีเรื่องพิจารณาความเสี่ยง" desc="ร้านค้าของคุณไม่มีข้อกล่าวหาหรือมาตรการใด ๆ" />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((r) => {
            const shop = mine.find((m) => m.id === r.merchantId)!;
            const canState = ['allegation', 'under_investigation', 'warning', 'suspended'].includes(r.status);
            const canAppeal = ['suspended', 'revoked'].includes(r.status) && !r.appeal;
            const t = text[r.id] ?? '';
            return (
              <Card key={r.id}>
                <CardHeader title={`${shop.shopName}`} subtitle={`${r.id} · เปิดเมื่อ ${fmtDate(r.createdAt)}`} icon={Gavel} action={<StatusBadge map={RISK_STATUS} value={r.status} />} />
                <div className="space-y-4 p-4 sm:p-5">
                  <RiskLadder status={r.status} />
                  <div>
                    <p className="text-xs font-medium text-ink-soft">เหตุผล</p>
                    <p className="text-sm text-ink">{r.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-soft">หลักฐานโดยสรุป (ไม่แสดงข้อมูลส่วนบุคคลของผู้ร้องเรียน)</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                      {r.evidenceSummary.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  {r.merchantStatement && (
                    <Alert tone="neutral" icon={MessageSquare} title="คำชี้แจงของร้านค้า">
                      {r.merchantStatement}
                    </Alert>
                  )}
                  {r.appeal && (
                    <Alert tone={r.appeal.result === 'overturned' ? 'success' : r.appeal.result ? 'error' : 'info'} title={r.appeal.result ? `ผลอุทธรณ์: ${r.appeal.result === 'overturned' ? 'รับอุทธรณ์ — คืนสถานะการรับรอง' : 'ยกอุทธรณ์ — คงผลเดิม'}` : 'ยื่นอุทธรณ์แล้ว — รอพิจารณา'}>
                      คำอุทธรณ์: {r.appeal.text} ({fmtDate(r.appeal.submittedAt)})
                      {r.appeal.resultNote && <span className="mt-1 block">เหตุผล: {r.appeal.resultNote}</span>}
                    </Alert>
                  )}
                  {(canState || canAppeal) && (
                    <div className="space-y-2 rounded-xl border border-line p-3">
                      <Field label={canAppeal ? 'คำชี้แจง / เหตุผลในการอุทธรณ์' : 'คำชี้แจงถึงเจ้าหน้าที่'}>
                        <Textarea value={t} onChange={(e) => setText({ ...text, [r.id]: e.target.value })} placeholder="อธิบายข้อเท็จจริง สิ่งที่แก้ไขแล้ว และหลักฐานที่มี" />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        {canState && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (t.trim().length < 10) return toast.error('กรุณาเขียนคำชี้แจงอย่างน้อย 10 ตัวอักษร');
                              merchantStatement(r.id, t.trim());
                              setText({ ...text, [r.id]: '' });
                              toast.success('ส่งคำชี้แจงแล้ว');
                            }}
                          >
                            ส่งคำชี้แจง
                          </Button>
                        )}
                        {canAppeal && (
                          <Button
                            icon={Gavel}
                            onClick={async () => {
                              if (t.trim().length < 10) return toast.error('กรุณาเขียนเหตุผลอุทธรณ์อย่างน้อย 10 ตัวอักษร');
                              const ok = await confirmDialog({ title: 'ยืนยันการยื่นอุทธรณ์', body: 'เจ้าหน้าที่จะพิจารณาอุทธรณ์และแจ้งผลผ่านระบบสาธิต' });
                              if (!ok.ok) return;
                              submitAppeal(r.id, t.trim());
                              setText({ ...text, [r.id]: '' });
                              toast.success('ยื่นอุทธรณ์แล้ว');
                            }}
                          >
                            ยื่นอุทธรณ์
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">ดู Timeline</summary>
                    <div className="mt-3">
                      <Timeline events={r.timeline} />
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
