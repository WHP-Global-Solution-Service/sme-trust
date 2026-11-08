import { useMemo } from 'react';
import { BadgeCheck, Ban, ClipboardList, DatabaseZap, FileQuestion, Gauge, Link2, PlugZap, Store, UserPlus } from 'lucide-react';
import { useAssessmentStore, useCertificationStore, useMarketplaceStore, useMerchantStore } from '@/stores';
import { computeV2Stats } from '@/utils/statsV2';
import { Alert, Card, CardHeader, Stat } from '@/components/common/ui';
import { ChartTable, HBarChart } from '@/components/common/Charts';

/** ตัวชี้วัด SME Trust v2 — คำนวณจาก Mock State ปัจจุบัน (เปลี่ยนตาม Scenario และกลับค่าเริ่มต้นเมื่อ Reset) */
export default function V2KpiSection() {
  const merchants = useMerchantStore((s) => s.items);
  const connections = useMarketplaceStore((s) => s.items);
  const assessments = useAssessmentStore((s) => s.items);
  const certifications = useCertificationStore((s) => s.items);
  const s = useMemo(() => computeV2Stats({ merchants, connections, assessments, certifications }), [merchants, connections, assessments, certifications]);
  const k = s.kpi;

  return (
    <section className="mt-8" aria-labelledby="v2-kpi" data-testid="v2-kpi">
      <h2 id="v2-kpi" className="text-lg font-bold text-ink">
        SME Trust — Marketplace & Trust Assessment
      </h2>
      <p className="mb-3 text-sm text-ink-soft">การเชื่อมต่อ Marketplace (จำลอง) ผลประเมินความน่าเชื่อถือล่าสุดของแต่ละร้าน และผลการพิจารณาของเจ้าหน้าที่</p>
      <Alert tone="warning" className="mb-4">
        ข้อมูลจำลองทั้งหมด — ไม่มีการเชื่อมต่อ Shopee หรือ Lazada จริง และไม่ใช่สถิติของหน่วยงานใด
      </Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="ร้านที่เชื่อม Marketplace" value={k.connectedMerchants} icon={Link2} tone="info" hint="มีการเชื่อมต่อที่ซิงก์สำเร็จ" />
        <Stat label="ร้านที่ลงทะเบียนด้วยตนเอง" value={k.selfRegistered} icon={UserPlus} hint="ไม่มีข้อมูล Marketplace — ไม่เสียคะแนน" />
        <Stat label="Connection สำเร็จ" value={k.connectionSuccess} icon={PlugZap} tone="success" hint={`จาก ${k.connections} การเชื่อมต่อ${k.connectionPending ? ` · รอดำเนินการ ${k.connectionPending}` : ''}`} />
        <Stat label="Connection ไม่สำเร็จ" value={k.connectionFailed} icon={DatabaseZap} tone="error" hint="รอร้านกดซิงก์ใหม่" />
        <Stat label="Insufficient Data" value={k.insufficient} icon={FileQuestion} hint={`จาก ${k.assessed} ร้านที่มีผลประเมิน — ไม่ใช่ผลลบ`} />
        <Stat label="Data Coverage เฉลี่ย" value={`${k.avgCoverage}%`} icon={Gauge} tone="info" hint="ผลประเมินล่าสุดของแต่ละร้าน" />
        <Stat label="ผลประเมินรอพิจารณา" value={k.pendingReview} icon={ClipboardList} tone="warning" to="/o/assessments" />
        <Stat label="อนุมัติการรับรองจากผลประเมิน" value={k.approved} icon={BadgeCheck} tone="success" hint={`ขอข้อมูลเพิ่ม ${k.needInfo} · ไม่อนุมัติ ${k.rejected}`} />
        <Stat label="ขอข้อมูลเพิ่มเติม" value={k.needInfo} icon={Store} tone="warning" />
        <Stat label="ใบรับรองถูกระงับ / เพิกถอน" value={`${k.suspended} / ${k.revoked}`} icon={Ban} tone="error" hint="แยกจาก Trust Band" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="ร้านค้าตาม Trust Band" subtitle="ผลประเมินล่าสุดของแต่ละร้าน (นับร้านละ 1 ครั้ง)" />
          <div className="p-4">
            <HBarChart data={s.bandData} />
            <ChartTable data={s.bandData} valueLabel="ร้าน" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Data Confidence" subtitle="ความเชื่อมั่นของข้อมูลในผลประเมินล่าสุด — แยกจาก Coverage" />
          <div className="p-4">
            <HBarChart data={s.confidenceData} />
            <ChartTable data={s.confidenceData} valueLabel="ร้าน" />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="การเชื่อมต่อตามแพลตฟอร์ม (จำลอง)" subtitle="นับการเชื่อมต่อที่ยังไม่ยกเลิก" />
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-xs text-ink-soft">
                <tr>
                  <th className="py-1.5 font-medium">แพลตฟอร์ม</th>
                  <th className="py-1.5 text-right font-medium">ทั้งหมด</th>
                  <th className="py-1.5 text-right font-medium">สำเร็จ</th>
                  <th className="py-1.5 text-right font-medium">ไม่สำเร็จ</th>
                </tr>
              </thead>
              <tbody>
                {s.platforms.map((p) => (
                  <tr key={p.platform} className="border-t border-line">
                    <td className="py-2">{p.label}</td>
                    <td className="text-right">{p.total}</td>
                    <td className="text-right text-success">{p.success}</td>
                    <td className="text-right text-error">{p.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
