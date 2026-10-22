/** ตรวจ Referential Integrity ของ Mock IDs และความสอดคล้องข้าม Store — คืนรายการปัญหา (ว่าง = ผ่าน) */
import { S, MOCK } from './harness.mts';

export function integrityProblems(): string[] {
  const p: string[] = [];
  const ops = S.useOperatorStore.getState().items;
  const merchants = S.useMerchantStore.getState().items;
  const apps = S.useVerificationStore.getState().items;
  const certs = S.useCertificationStore.getState().items;
  const complaints = S.useComplaintStore.getState().items;
  const warnings = S.useWarningStore.getState().items;
  const risks = S.useRiskStore.getState().items;
  const enrollments = S.useTrainingStore.getState().items;
  const notifications = S.useNotificationStore.getState().items;

  const ids = {
    op: new Set(ops.map((x) => x.id)),
    m: new Set(merchants.map((x) => x.id)),
    app: new Set(apps.map((x) => x.id)),
    cert: new Set(certs.map((x) => x.id)),
    cmp: new Set(complaints.map((x) => x.id)),
    wrn: new Set(warnings.map((x) => x.id)),
    rsk: new Set(risks.map((x) => x.id)),
    cs: new Set(MOCK.consumers.map((x) => x.id)),
    of: new Set(MOCK.officers.map((x) => x.id)),
    crs: new Set(MOCK.courses.map((x) => x.id)),
  };
  const unique = (name: string, list: { id: string }[]) => {
    if (new Set(list.map((x) => x.id)).size !== list.length) p.push(`${name}: มี ID ซ้ำ`);
  };
  unique('operators', ops);
  unique('merchants', merchants);
  unique('applications', apps);
  unique('certifications', certs);
  unique('complaints', complaints);
  unique('warnings', warnings);
  unique('risk', risks);
  unique('enrollments', enrollments);
  unique('notifications', notifications);
  if (new Set(ops.map((o) => o.mockIdentityId)).size !== ops.length) p.push('operators: Mock Identity ID ซ้ำ');

  for (const m of merchants) {
    if (!ids.op.has(m.operatorId)) p.push(`${m.id}.operatorId → ${m.operatorId} ไม่มีอยู่`);
    if (new Set(m.channels.map((c) => c.id)).size !== m.channels.length) p.push(`${m.id}: channel ID ซ้ำ`);
  }
  for (const a of apps) if (!ids.m.has(a.merchantId)) p.push(`${a.id}.merchantId → ${a.merchantId} ไม่มีอยู่`);

  for (const c of certs) {
    if (!ids.m.has(c.merchantId)) p.push(`${c.id}.merchantId → ${c.merchantId} ไม่มีอยู่`);
    if (c.supersededBy && !ids.cert.has(c.supersededBy)) p.push(`${c.id}.supersededBy → ${c.supersededBy} ไม่มีอยู่`);
    if (c.supersededBy && c.status === 'active') p.push(`${c.id}: ถูกแทนที่แล้วแต่ยัง active`);
  }
  for (const m of merchants) {
    const active = certs.filter((c) => c.merchantId === m.id && c.status === 'active');
    if (active.length > 1) p.push(`${m.id}: มีใบรับรอง active มากกว่า 1 ใบ`);
    const op = ops.find((o) => o.id === m.operatorId);
    if (active.length && op?.kycStatus !== 'verified') p.push(`${m.id}: มีใบรับรอง active แต่เจ้าของยังไม่ผ่าน e-KYC`);
    if (active.length && m.registrationStatus !== 'approved') p.push(`${m.id}: มีใบรับรอง active แต่คำขอลงทะเบียนยังไม่อนุมัติ`);
    if (m.registrationStatus === 'approved' && !certs.some((c) => c.merchantId === m.id)) p.push(`${m.id}: อนุมัติแล้วแต่ไม่มีใบรับรอง`);
    const latest = certs.filter((c) => c.merchantId === m.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
    if (latest?.status === 'suspended' && !['suspended', 'appeal_submitted'].includes(m.riskStatus)) p.push(`${m.id}: ใบรับรองถูกระงับแต่ riskStatus=${m.riskStatus}`);
    if (latest?.status === 'revoked' && !['revoked', 'appeal_submitted', 'appeal_reviewed'].includes(m.riskStatus)) p.push(`${m.id}: ใบรับรองถูกเพิกถอนแต่ riskStatus=${m.riskStatus}`);
    if (latest?.status === 'active' && ['suspended', 'revoked'].includes(m.riskStatus)) p.push(`${m.id}: ใบรับรอง active แต่ riskStatus=${m.riskStatus}`);
  }

  for (const c of complaints) {
    if (!ids.m.has(c.merchantId)) p.push(`${c.id}.merchantId → ${c.merchantId} ไม่มีอยู่`);
    if (!ids.cs.has(c.consumerId)) p.push(`${c.id}.consumerId → ${c.consumerId} ไม่มีอยู่`);
    if (new Set(c.offers.map((o) => o.id)).size !== c.offers.length) p.push(`${c.id}: offer ID ซ้ำ`);
    for (const d of c.screening.duplicateOf) if (!ids.cmp.has(d)) p.push(`${c.id}.duplicateOf → ${d} ไม่มีอยู่`);
    if (c.firstMerchantResponseAt && c.firstMerchantResponseAt < c.createdAt) p.push(`${c.id}: ตอบกลับก่อนวันที่ยื่นเรื่อง`);
    if (c.status === 'resolved' && !c.offers.some((o) => o.status === 'accepted')) p.push(`${c.id}: resolved แต่ไม่มีข้อเสนอที่ยอมรับ`);
    if (c.status === 'waiting_consumer' && !c.offers.some((o) => o.status === 'accepted' || (o.status === 'pending' && o.type !== 'explain')))
      p.push(`${c.id}: waiting_consumer แต่ไม่มีข้อเสนอให้ผู้บริโภคตอบ/ยืนยัน`);
    if (['resolved', 'closed'].includes(c.status) && !c.resolvedAt) p.push(`${c.id}: ปิดแล้วแต่ไม่มี resolvedAt`);
    const times = c.timeline.map((t) => t.at);
    if (times.some((t, i) => i > 0 && t < times[0])) p.push(`${c.id}: Timeline มีเหตุการณ์ก่อนการยื่นเรื่อง`);
  }

  for (const w of warnings) {
    if (!ids.m.has(w.merchantId)) p.push(`${w.id}.merchantId → ${w.merchantId} ไม่มีอยู่`);
    if (!ids.of.has(w.officerId)) p.push(`${w.id}.officerId → ${w.officerId} ไม่มีอยู่`);
    for (const c of w.courseIds) if (!ids.crs.has(c)) p.push(`${w.id}.courseIds → ${c} ไม่มีอยู่`);
    for (const c of w.relatedComplaintIds) {
      const cmp = complaints.find((x) => x.id === c);
      if (!cmp) p.push(`${w.id}.relatedComplaintIds → ${c} ไม่มีอยู่`);
      else if (cmp.merchantId !== w.merchantId) p.push(`${w.id}: อ้างอิง ${c} ของร้านอื่น`);
    }
  }
  for (const r of risks) {
    if (!ids.m.has(r.merchantId)) p.push(`${r.id}.merchantId → ${r.merchantId} ไม่มีอยู่`);
    for (const c of r.relatedComplaintIds) {
      const cmp = complaints.find((x) => x.id === c);
      if (!cmp) p.push(`${r.id}.relatedComplaintIds → ${c} ไม่มีอยู่`);
      else if (cmp.merchantId !== r.merchantId) p.push(`${r.id}: อ้างอิง ${c} ของร้านอื่น`);
    }
  }
  const pairs = new Set<string>();
  for (const e of enrollments) {
    if (!ids.op.has(e.operatorId)) p.push(`${e.id}.operatorId → ${e.operatorId} ไม่มีอยู่`);
    const course = MOCK.courses.find((c) => c.id === e.courseId);
    if (!course) p.push(`${e.id}.courseId → ${e.courseId} ไม่มีอยู่`);
    else if (e.completedLessonIds.some((l) => !course.lessons.some((x) => x.id === l))) p.push(`${e.id}: บทเรียนไม่อยู่ในหลักสูตร`);
    if (e.passed && (!e.certificateNo || !e.completedAt)) p.push(`${e.id}: ผ่านแล้วแต่ไม่มีเลขใบรับรอง/วันที่ผ่าน`);
    const key = `${e.operatorId}|${e.courseId}`;
    if (pairs.has(key)) p.push(`${e.id}: ลงทะเบียนหลักสูตรซ้ำ ${key}`);
    pairs.add(key);
  }

  // การแจ้งเตือน: ผู้รับและลิงก์ต้องชี้ไปข้อมูลที่มีอยู่จริง
  const linkRules: [RegExp, Set<string>][] = [
    [/^\/(?:m\/complaints|consumer\/cases|o\/complaints)\/(.+)$/, ids.cmp],
    [/^\/o\/applications\/(.+)$/, ids.app],
    [/^\/(?:m|o)\/warnings\/(.+)$/, ids.wrn],
    [/^\/o\/risk\/(.+)$/, ids.rsk],
    [/^\/m\/training\/(.+)$/, ids.crs],
    [/^\/verify\/(.+)$/, ids.cert],
  ];
  for (const n of notifications) {
    if (n.recipientId) {
      const pool = n.recipientRole === 'merchant' ? ids.op : n.recipientRole === 'consumer' ? ids.cs : ids.of;
      if (!pool.has(n.recipientId)) p.push(`${n.id}: ผู้รับ ${n.recipientRole}/${n.recipientId} ไม่มีอยู่`);
    }
    for (const [re, set] of linkRules) {
      const mm = n.link?.match(re);
      if (mm && !set.has(mm[1])) p.push(`${n.id}: ลิงก์ ${n.link} ชี้ไปข้อมูลที่ไม่มีอยู่`);
    }
  }
  return p;
}
