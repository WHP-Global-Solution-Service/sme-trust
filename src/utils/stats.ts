import type { Certification, Complaint, Enrollment, Merchant, Operator, VerificationApplication, WarningRecord } from '@/types';
import { CERT_STATUS, COMPLAINT_CATEGORY } from '@/constants/labels';
import { courses } from '@/mock/data';
import { currentCert } from './trust';

export interface StatsInput {
  operators: Operator[];
  merchants: Merchant[];
  apps: VerificationApplication[];
  certs: Certification[];
  complaints: Complaint[];
  warnings: WarningRecord[];
  enrollments: Enrollment[];
}

export interface StatsFilter {
  province: string;
  months: number; // 0 = ทั้งหมด
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => `${TH_MONTHS[Number(key.slice(5, 7)) - 1]} ${String(Number(key.slice(0, 4)) + 543).slice(2)}`;

/** คำนวณ KPI และข้อมูลกราฟทั้งหมดจาก Mock State จริง (ไม่มีตัวเลขสุ่ม) */
export function computeStats(d: StatsInput, f: StatsFilter) {
  const since = f.months ? Date.now() - f.months * 30.5 * 86400_000 : 0;
  const inPeriod = (iso: string) => new Date(iso).getTime() >= since;
  const merchants = d.merchants.filter((m) => !f.province || m.province === f.province);
  const mIds = new Set(merchants.map((m) => m.id));
  const opIds = new Set(merchants.map((m) => m.operatorId));
  const complaints = d.complaints.filter((c) => mIds.has(c.merchantId) && inPeriod(c.createdAt));
  const apps = d.apps.filter((a) => mIds.has(a.merchantId));
  const warnings = d.warnings.filter((w) => mIds.has(w.merchantId) && inPeriod(w.createdAt));
  const operators = f.province ? d.operators.filter((o) => opIds.has(o.id) || o.province === f.province) : d.operators;
  const enrollments = d.enrollments.filter((e) => !f.province || opIds.has(e.operatorId));
  const current = merchants.map((m) => currentCert(d.certs, m.id)).filter(Boolean) as Certification[];

  const registered = merchants.filter((m) => m.registrationStatus !== 'draft');
  const kpi = {
    totalSme: operators.length,
    registered: registered.length,
    verified: merchants.filter((m) => m.registrationStatus === 'approved').length,
    certified: current.filter((c) => c.status === 'active' && c.level >= 3).length,
    pendingApps: apps.filter((a) => ['submitted', 'pending_review', 'under_verification', 'need_info'].includes(a.status)).length,
    complaints: complaints.length,
    resolvedByMerchant: complaints.filter((c) => c.status === 'resolved').length,
    escalated: complaints.filter((c) => c.status === 'escalated' || !!c.escalationReason).length,
    warningsIssued: warnings.filter((w) => w.kind === 'warning').length,
    advisories: warnings.filter((w) => w.kind === 'advisory').length,
    correctedMerchants: new Set(warnings.filter((w) => w.status === 'completed').map((w) => w.merchantId)).size,
    trainees: new Set(enrollments.map((e) => e.operatorId)).size,
    traineesPassed: new Set(enrollments.filter((e) => e.passed).map((e) => e.operatorId)).size,
    suspended: current.filter((c) => c.status === 'suspended').length,
    revoked: current.filter((c) => c.status === 'revoked').length,
  };

  // Registration trend (7 เดือนล่าสุด)
  const months: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  const trend = months.map((k) => ({ name: monthLabel(k), value: registered.filter((m) => monthKey(m.createdAt) === k).length }));

  const certStatusColor = { active: '#137552', expired: '#94A3B8', suspended: '#975807', revoked: '#B51F31' };
  const certStatus = (Object.keys(CERT_STATUS) as (keyof typeof CERT_STATUS)[]).map((s) => ({ name: CERT_STATUS[s].label, value: current.filter((c) => c.status === s).length, color: certStatusColor[s] }));

  const categories = (Object.keys(COMPLAINT_CATEGORY) as (keyof typeof COMPLAINT_CATEGORY)[])
    .map((k) => ({ name: COMPLAINT_CATEGORY[k], value: complaints.filter((c) => (c.officerCategory ?? c.category) === k).length }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const funnel = [
    { name: 'ยื่นเรื่อง', value: complaints.length },
    { name: 'ร้านค้าตอบกลับ', value: complaints.filter((c) => c.firstMerchantResponseAt).length },
    { name: 'ตกลงข้อเสนอได้', value: complaints.filter((c) => c.offers.some((o) => o.status === 'accepted')).length },
    { name: 'แก้ไขสำเร็จ', value: kpi.resolvedByMerchant },
  ];

  const byMerchant = merchants
    .map((m) => {
      const rs = complaints.filter((c) => c.merchantId === m.id && c.firstMerchantResponseAt);
      if (!rs.length) return null;
      const avg = rs.reduce((s, c) => s + (new Date(c.firstMerchantResponseAt!).getTime() - new Date(c.createdAt).getTime()) / 3600_000, 0) / rs.length;
      return { name: m.shopName, value: Math.round(avg) };
    })
    .filter(Boolean)
    .sort((a, b) => a!.value - b!.value) as { name: string; value: number }[];

  const training = courses.map((c) => {
    const es = enrollments.filter((e) => e.courseId === c.id);
    return { name: c.title, value: es.length ? Math.round((es.filter((e) => e.passed).length / es.length) * 100) : 0, enrolled: es.length };
  });

  const provinceMap = new Map<string, number>();
  registered.forEach((m) => provinceMap.set(m.province, (provinceMap.get(m.province) ?? 0) + 1));
  const provinces = [...provinceMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return { kpi, trend, certStatus, categories, funnel, responseTime: byMerchant, training, provinces };
}
