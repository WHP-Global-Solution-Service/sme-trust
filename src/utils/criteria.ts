import type { Certification, Complaint, Enrollment, Merchant, Operator, RiskCase, WarningRecord } from '@/types';

export interface Criterion {
  label: string;
  met: boolean;
}

/** เกณฑ์ระดับการรับรอง (แนวคิดสำหรับสาธิต) */
export function levelCriteria(
  m: Merchant,
  op: Operator | undefined,
  data: { enrollments: Enrollment[]; warnings: WarningRecord[]; complaints: Complaint[]; risks: RiskCase[]; cert?: Certification },
): Record<1 | 2 | 3 | 4, Criterion[]> {
  const passed = data.enrollments.filter((e) => e.operatorId === m.operatorId && e.passed).length;
  const openWarnings = data.warnings.filter((w) => w.merchantId === m.id && w.kind === 'warning' && w.status !== 'completed').length;
  const openRisk = data.risks.some((r) => r.merchantId === m.id && !['dismissed', 'appeal_reviewed'].includes(r.status));
  const mine = data.complaints.filter((c) => c.merchantId === m.id);
  const sixMonths = Date.now() - 182 * 86400_000;
  const escalated = mine.filter((c) => c.status === 'escalated' && new Date(c.createdAt).getTime() > sixMonths).length;
  const finished = mine.filter((c) => ['resolved', 'closed', 'escalated'].includes(c.status));
  const resolvedRate = finished.length ? mine.filter((c) => c.status === 'resolved').length / finished.length : 1;

  const l1 = [{ label: 'ยืนยันตัวตนผู้ประกอบการ (Mock e-KYC)', met: op?.kycStatus === 'verified' }];
  const l2 = [...l1, { label: 'คำขอลงทะเบียนร้านค้าได้รับอนุมัติ', met: m.registrationStatus === 'approved' }];
  const l3 = [
    ...l2,
    { label: `ผ่านการอบรมอย่างน้อย 1 หลักสูตร (ผ่านแล้ว ${passed})`, met: passed >= 1 },
    { label: 'ไม่มีคำเตือนที่ยังไม่แก้ไข', met: openWarnings === 0 },
    { label: 'ไม่มีเรื่องพิจารณาความเสี่ยงค้างอยู่', met: !openRisk && !['suspended', 'revoked'].includes(m.riskStatus) },
  ];
  const l4 = [
    ...l3,
    { label: 'ช่องทางขายทุกช่องทางผ่านการตรวจสอบ', met: m.channels.length > 0 && m.channels.every((c) => c.status === 'verified') },
    { label: `ผ่านการอบรมอย่างน้อย 3 หลักสูตร (ผ่านแล้ว ${passed})`, met: passed >= 3 },
    { label: 'ไม่มีข้อร้องเรียนที่ถูกส่งต่อในช่วง 6 เดือน', met: escalated === 0 },
    { label: `อัตราแก้ไขข้อร้องเรียนสำเร็จ ≥ 80% (ปัจจุบัน ${Math.round(resolvedRate * 100)}%)`, met: resolvedRate >= 0.8 },
  ];
  return { 1: l1, 2: l2, 3: l3, 4: l4 };
}
