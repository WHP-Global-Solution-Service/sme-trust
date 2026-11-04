import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MessageSquareWarning,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PROVINCES } from '@/constants/labels';
import { useStats } from '@/hooks/useStats';
import { Alert, Card, CardHeader, PageHeader, Stat } from '@/components/common/ui';
import { Select } from '@/components/forms/Field';
import { ChartTable, HBarChart, TimeBarChart } from '@/components/common/Charts';
import V2KpiSection from './V2KpiSection';

export default function AdminDashboard() {
  const [province, setProvince] = useState('');
  const [months, setMonths] = useState(0);
  const filter = useMemo(() => ({ province, months }), [province, months]);
  const s = useStats(filter);
  const k = s.kpi;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="ภาพรวมระบบ — คำนวณจากข้อมูลสาธิตใน Mock State แบบ Real-time" icon={LayoutDashboard} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={province} onChange={(e) => setProvince(e.target.value)} className="sm:w-56" aria-label="จังหวัด">
          <option value="">ทุกจังหวัด</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="sm:w-56" aria-label="ช่วงเวลา">
          <option value={0}>ทุกช่วงเวลา</option>
          <option value={1}>1 เดือนล่าสุด</option>
          <option value={3}>3 เดือนล่าสุด</option>
          <option value={6}>6 เดือนล่าสุด</option>
        </Select>
        <p className="text-xs text-ink-soft sm:ml-auto">ช่วงเวลามีผลกับข้อร้องเรียนและคำเตือน · จังหวัดมีผลกับทุกตัวชี้วัด</p>
      </div>
      <Alert tone="warning" className="mb-4">ข้อมูลทั้งหมดเป็นข้อมูลสาธิต (Demo Data) ไม่ใช่สถิติจริงของหน่วยงานใด</Alert>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="จำนวน SME ทั้งหมด" value={k.totalSme} icon={Users} />
        <Stat label="ร้านค้าที่ลงทะเบียน" value={k.registered} icon={Store} />
        <Stat label="ร้านค้าที่ตรวจสอบแล้ว" value={k.verified} icon={ShieldCheck} tone="success" hint={`${pct(k.verified, k.registered)} ของร้านที่ลงทะเบียน`} />
        <Stat label="ร้านค้าที่ได้รับการรับรอง" value={k.certified} icon={BadgeCheck} tone="success" hint="Trusted SME ขึ้นไป" />
        <Stat label="คำขอรอตรวจสอบ" value={k.pendingApps} icon={ClipboardCheck} tone="warning" to="/o/applications" />
        <Stat label="ข้อร้องเรียนทั้งหมด" value={k.complaints} icon={MessageSquareWarning} tone="info" />
        <Stat label="ร้านค้าแก้ไขสำเร็จ" value={k.resolvedByMerchant} icon={CheckCircle2} tone="success" hint={`${pct(k.resolvedByMerchant, k.complaints)} ของข้อร้องเรียน`} />
        <Stat label="ข้อร้องเรียนที่ส่งต่อ" value={k.escalated} icon={ArrowUpRight} tone="error" hint={`${pct(k.escalated, k.complaints)} ของข้อร้องเรียน`} />
        <Stat label="คำเตือนที่ออก" value={k.warningsIssued} icon={AlertTriangle} tone="warning" hint={`+ คำแนะนำ ${k.advisories} รายการ`} />
        <Stat label="ร้านค้าที่แก้ไขตามคำแนะนำ" value={k.correctedMerchants} icon={TrendingUp} tone="success" />
        <Stat label="ผู้เข้าอบรม" value={k.trainees} icon={GraduationCap} hint={`ผ่านอย่างน้อย 1 หลักสูตร ${k.traineesPassed} คน`} />
        <Stat label="ใบรับรองถูกระงับ" value={k.suspended} icon={Ban} tone="error" hint={`เพิกถอน ${k.revoked}`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Merchant Registration Trend" subtitle="ร้านค้าที่ลงทะเบียนต่อเดือน (7 เดือนล่าสุด)" />
          <div className="p-4">
            <TimeBarChart data={s.trend} label="ร้านค้า" />
            <ChartTable data={s.trend} valueLabel="ร้านค้า" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Certification Status" subtitle="สถานะใบรับรองฉบับปัจจุบันของแต่ละร้าน" />
          <div className="p-4">
            <HBarChart data={s.certStatus} />
            <ChartTable data={s.certStatus} valueLabel="ใบ" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Complaint Category Distribution" subtitle="ใช้ประเภทที่เจ้าหน้าที่ปรับแล้ว (ถ้ามี)" />
          <div className="p-4">
            {s.categories.length ? <HBarChart data={s.categories} /> : <p className="py-8 text-center text-sm text-ink-soft">ไม่มีข้อร้องเรียนในช่วงที่เลือก</p>}
            <ChartTable data={s.categories} valueLabel="เรื่อง" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Complaint Resolution Funnel" subtitle="จากการยื่นเรื่องจนแก้ไขสำเร็จโดยร้านค้า" />
          <div className="p-4">
            <HBarChart data={s.funnel} />
            <ChartTable data={s.funnel} valueLabel="เรื่อง" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Merchant Response Time" subtitle="เวลาเฉลี่ยที่ร้านค้าตอบกลับครั้งแรก (ชั่วโมง)" />
          <div className="p-4">
            {s.responseTime.length ? <HBarChart data={s.responseTime} unit=" ชม." /> : <p className="py-8 text-center text-sm text-ink-soft">ยังไม่มีข้อมูลการตอบกลับ</p>}
            <ChartTable data={s.responseTime} unit=" ชม." valueLabel="เฉลี่ย" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Training Completion Rate" subtitle="ร้อยละของผู้สอบผ่านต่อผู้ลงทะเบียนเรียนในแต่ละหลักสูตร" />
          <div className="p-4">
            <HBarChart data={s.training} unit="%" />
            <ChartTable data={s.training} unit="%" valueLabel="อัตราผ่าน" />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Geographic Distribution" subtitle="จำนวนร้านค้าที่ลงทะเบียนแยกตามจังหวัด" />
          <div className="p-4">
            <HBarChart data={s.provinces} />
            <ChartTable data={s.provinces} valueLabel="ร้านค้า" />
          </div>
        </Card>
      </div>
      <V2KpiSection />
    </div>
  );
}
