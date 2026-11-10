// End-to-end workflow test (Node) — runs real stores/workflows with a localStorage shim
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => (mem[k] = v), removeItem: (k: string) => delete mem[k] };
(globalThis as any).window = globalThis;


const S = await import('@/stores');
const W = await import('@/stores/workflows');
const T = await import('@/utils/trust');
const ST = await import('@/utils/stats');

let fails = 0;
const ok = (cond: any, msg: string) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) fails++;
};
const m = (id: string) => S.useMerchantStore.getState().items.find((x: any) => x.id === id)!;
const op = (id: string) => S.useOperatorStore.getState().items.find((x: any) => x.id === id)!;
const cert = (mid: string) => T.currentCert(S.useCertificationStore.getState().items, mid);
const verdict = (mid: string) => T.verdictFor(m(mid), op(m(mid).operatorId), cert(mid)).key;
const sess = S.useSessionStore.getState();
// ทำรายการในนามบทบาทที่ทำได้จริง (Store ตรวจสิทธิ์ด้วย authorize()) — บทบาทปัจจุบันมีสิทธิ์อยู่แล้วเรียกตรง ไม่มีสิทธิ์สลับเฉพาะรายการนี้
const actAs = <T,>(roles: string | string[], fn: () => T): T => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const prev = S.useSessionStore.getState().role;
  if (allowed.includes(prev)) return fn();
  S.useSessionStore.setState({ role: allowed[0] as any });
  try {
    return fn();
  } finally {
    S.useSessionStore.setState({ role: prev });
  }
};
// ทำรายการในนามเจ้าของร้านของรายการ ref (Store ตรวจ Role + Ownership)
const asOwner = <T,>(ref: string, fn: () => T): T => {
  const st = S.useSessionStore.getState();
  const prev = { role: st.role, operatorId: st.operatorId, merchantLoggedIn: st.merchantLoggedIn };
  const all = [S.useMarketplaceStore, S.useVerificationStore, S.useWarningStore, S.useComplaintStore, S.useRiskStore] as any[];
  const mid = S.useMerchantStore.getState().items.some((x: any) => x.id === ref) ? ref : all.map((s) => s.getState().items.find((x: any) => x.id === ref)?.merchantId).find(Boolean);
  const owner = S.useOperatorStore.getState().items.some((o: any) => o.id === ref) ? ref : S.useMerchantStore.getState().items.find((x: any) => x.id === mid)?.operatorId;
  S.useSessionStore.setState({ role: 'merchant', operatorId: owner ?? st.operatorId, merchantLoggedIn: true });
  try {
    return fn();
  } finally {
    S.useSessionStore.setState(prev);
  }
};
const C = () => S.useComplaintStore.getState().items as any[];

ok(S.useMerchantStore.getState().items.length >= 12, 'seed 12 merchants');
ok(C().length >= 20, 'seed 20 complaints');
ok(S.useVerificationStore.getState().items.length >= 10, 'seed 10 applications');
ok(S.useWarningStore.getState().items.length >= 8, 'seed 8 warnings');
ok(S.useTrainingStore.getState().items.length >= 15, 'seed 15 enrollments');
ok(S.useCertificationStore.getState().items.length >= 10, 'seed 10 certs');
ok(S.useNotificationStore.getState().items.length >= 20, 'seed 20 notifications');
const mids = new Set(S.useMerchantStore.getState().items.map((x: any) => x.id));
ok(C().every((c) => mids.has(c.merchantId)), 'complaints -> merchants FK');
ok(S.useCertificationStore.getState().items.every((c: any) => mids.has(c.merchantId)), 'certs -> merchants FK');
ok(S.useWarningStore.getState().items.every((c: any) => mids.has(c.merchantId)), 'warnings -> merchants FK');

ok(verdict('M-001') === 'certified', 'Merchant A certified');
ok(verdict('M-002') === 'pending', 'Merchant B pending');
ok(verdict('M-004') === 'suspended', 'Merchant D suspended');
ok(verdict('M-007') === 'expired', 'M-007 expired');
ok(verdict('M-008') === 'revoked', 'M-008 revoked');
ok(verdict('M-011') === 'unverified', 'M-011 unverified');

// Scenario 1
sess.set({ role: 'merchant' });
const newOp = W.registerOperator({ name: 'ทดสอบ ระบบ', phone: '0899999999', email: 'a@b.c', province: 'ชลบุรี', pin: '246810' });
ok(/^OP-\d{3}$/.test(newOp.id), `new operator id ${newOp.id}`);
asOwner(newOp.id, () => W.setKycResult(newOp.id, true));
ok(op(newOp.id).kycStatus === 'verified', 'kyc verified');
sess.set({ operatorId: newOp.id });
const form = { businessType: 'individual' as const, ownerName: 'x', shopName: 'ร้านทดสอบ', category: 'บริการ', province: 'ชลบุรี', district: 'เมือง', phone: '0899999999', email: 'a@b.c', description: 'รายละเอียดทดสอบยาวพอสมควร', channels: [{ type: 'facebook' as const, handle: 'testshop' }], documents: [] };
const officerNotes = () => S.useNotificationStore.getState().items.filter((n: any) => n.recipientRole === 'officer').length;
const officerBefore = officerNotes();
const { merchant: nm, app } = asOwner(newOp.id, () => W.submitShopRegistration(newOp.id, form));
// Automation First: ไม่มีเอกสาร → ระบบส่งกลับให้ร้านค้าเพิ่มข้อมูลเอง (AUTO_REQUEST_INFO) ไม่เข้าคิวเจ้าหน้าที่
ok(nm.id === 'M-013' && app.status === 'need_info' && app.autoDecision?.route === 'AUTO_REQUEST_INFO' && app.autoDecision.reasons.some((r) => r.includes('เอกสาร')), `shop ${nm.id} ${app.id} AUTO_REQUEST_INFO (missing documents)`);
ok(m(nm.id).registrationStatus === 'need_info' && officerNotes() === officerBefore, 'merchant fixes it — no officer task/notification');
ok(verdict(nm.id) === 'pending', 'consumer sees pending');
asOwner(app.id, () => W.resubmitApplication(app.id, 'แนบเอกสารแล้ว', [{ id: 'doc-wf-1', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 90, addedAt: new Date().toISOString() }]));
const regApp = S.useVerificationStore.getState().items.find((a: any) => a.id === app.id)!;
ok(regApp.status === 'approved' && regApp.autoDecision?.route === 'AUTO_PASS' && m(nm.id).registrationStatus === 'approved', 'resubmitted → AUTO_PASS (registration accepted by the system)');
ok(!cert(nm.id) && verdict(nm.id) === 'identity' && officerNotes() === officerBefore, 'registration ≠ certificate (no cert, no officer)');
ok(S.useAuditStore.getState().items.some((a: any) => a.target === app.id && a.action.includes('AUTO_PASS')), 'audit logged (AUTO_PASS)');
// Level 2 certificate stays an officer decision (Certification Policy)
const l2 = asOwner(nm.id, () => W.applyCertification(nm.id, 2));
sess.set({ role: 'officer', officerId: 'OF-001' });
actAs(['officer', 'admin'], () => W.startReview(l2.id));
ok(S.useVerificationStore.getState().items.find((a: any) => a.id === l2.id)!.status === 'under_verification', 'certification request under verification');
actAs(['officer', 'admin'], () => W.approveApplication(l2.id));
ok(m(nm.id).registrationStatus === 'approved', 'approved on merchant');
ok(cert(nm.id)?.status === 'active' && cert(nm.id)?.level === 2, 'cert L2 issued');
ok(verdict(nm.id) === 'business', 'consumer sees business verified');
ok(S.useNotificationStore.getState().items.some((n: any) => n.recipientId === newOp.id && n.title.includes('อนุมัติ')), 'merchant notified');
ok(S.useAuditStore.getState().items.some((a: any) => a.target === l2.id && a.action === 'อนุมัติคำขอ'), 'audit logged');

// Legacy seed application (before automation): officer asks for info → merchant resubmits → system re-checks automatically
actAs(['officer', 'admin'], () => W.requestInfo('APP-2569-0002', 'ขอเอกสารเพิ่ม'));
ok(m('M-002').registrationStatus === 'need_info', 'need_info');
asOwner('APP-2569-0002', () => W.resubmitApplication('APP-2569-0002', 'ส่งแล้ว', []));
ok(m('M-002').registrationStatus === 'approved' && S.useVerificationStore.getState().items.find((a: any) => a.id === 'APP-2569-0002')!.autoDecision?.route === 'AUTO_PASS' && !cert('M-002'), 'resubmitted → system re-check AUTO_PASS (no certificate)');

const r3 = asOwner('OP-008', () => W.submitShopRegistration('OP-008', { ...form, shopName: 'ร้านใหม่อีก', documents: [{ id: 'doc-wf-2', name: 'บัตร.pdf', kind: 'บัตรประชาชน', sizeKb: 40, addedAt: new Date().toISOString() }] }));
ok(!!r3.merchant.identityFlag && r3.merchant.riskStatus === 'allegation', 'identity flag on re-open');
ok(S.useRiskStore.getState().items.some((r: any) => r.merchantId === r3.merchant.id && r.status === 'allegation'), 'risk allegation created');
ok(r3.app.status === 'pending_review' && r3.app.autoDecision?.route === 'MANUAL_REVIEW', 'not auto-rejected — MANUAL_REVIEW');
ok(S.useNotificationStore.getState().items.some((n: any) => n.recipientRole === 'officer' && n.link === `/o/applications/${r3.app.id}`), 'exception sent to officer');
actAs(['officer', 'admin'], () => W.rejectApplication(r3.app.id, 'เหตุผลทดสอบ'));
ok(m(r3.merchant.id).registrationStatus === 'rejected', 'rejected');

// Scenario 4
sess.set({ role: 'consumer', consumerId: 'CS-003' });
const c = actAs('consumer', () => W.submitComplaint({ merchantId: 'M-001', consumerId: 'CS-003', category: 'not_as_described', title: 'ทดสอบ', description: 'สั่งไซซ์ L ได้ไซซ์ M ไม่ตรงตามรายละเอียดในโพสต์ ต้องการเปลี่ยนสินค้า', incidentDate: '2026-10-19', orderRef: 'T-1', orderAmount: 890, channel: 'facebook', evidence: [] }));
ok(c.status === 'awaiting_merchant' && c.id.endsWith('-0021'), `complaint ${c.id}`);
ok(S.useNotificationStore.getState().items.some((n: any) => n.recipientId === 'OP-001' && n.body.includes(c.id)), 'merchant notified of complaint');
sess.set({ role: 'merchant', operatorId: 'OP-001' });
asOwner(c.id, () => W.merchantRespond(c.id, { type: 'refund', amount: 890, note: 'คืนเงินเต็มจำนวน' }));
let cc = C().find((x) => x.id === c.id);
ok(cc.status === 'waiting_consumer' && !!cc.firstMerchantResponseAt, 'offer -> waiting consumer');
sess.set({ role: 'consumer' });
actAs('consumer', () => W.consumerReplyOffer(c.id, cc.offers[0].id, 'accepted', ''));
actAs('consumer', () => W.consumerConfirmResolved(c.id));
cc = C().find((x) => x.id === c.id);
ok(cc.status === 'resolved' && cc.offers[0].status === 'accepted', 'resolved');

const dup = actAs('consumer', () => W.submitComplaint({ merchantId: 'M-001', consumerId: 'CS-003', category: 'not_as_described', title: 'ซ้ำ', description: 'ซ้ำ', incidentDate: '', orderRef: 'T-1', orderAmount: 0, channel: 'facebook', evidence: [] }));
ok(dup.screening.duplicateOf.includes(c.id), 'duplicate detected');
ok(dup.screening.missing.length >= 3, 'incomplete detected');
const sev = actAs('consumer', () => W.submitComplaint({ merchantId: 'M-005', consumerId: 'CS-001', category: 'defective', title: 'อันตราย', description: 'ใช้แล้วเกิดไฟช็อตและบาดเจ็บ ต้องไปโรงพยาบาล', incidentDate: '2026-10-18', orderRef: 'S-1', orderAmount: 500, channel: 'facebook', evidence: [], escalateNow: true }));
ok(sev.screening.severe && sev.screening.priority === 'urgent' && sev.status === 'escalated', 'severe -> urgent + escalated');
sess.set({ role: 'officer' });
actAs(['officer', 'admin'], () => W.officerClassify(sev.id, 'other', 'high', 'note'));
ok(C().find((x) => x.id === sev.id).officerCategory === 'other', 'officer override');
actAs(['officer', 'admin'], () => W.officerClose(sev.id, 'ปิดเรื่อง'));
ok(C().find((x) => x.id === sev.id).status === 'closed', 'officer close');

// Scenario 5
const wid = 'WRN-2569-0001';
sess.set({ role: 'merchant', operatorId: 'OP-003' });
const quiz = asOwner('OP-003', () => W.submitQuiz('OP-003', 'CRS-02', [2, 1, 1, 1]));
ok(quiz.passed && quiz.score === 100, 'quiz pass 100');
const w = S.useWarningStore.getState().items.find((x: any) => x.id === wid);
ok(w.items.find((i: any) => i.text.includes('อบรม')).done, 'training auto-ticks warning item');
const fail = asOwner('OP-003', () => W.submitQuiz('OP-003', 'CRS-02', [0, 0, 0, 0]));
ok(!fail.passed && S.useTrainingStore.getState().items.find((e: any) => e.operatorId === 'OP-003' && e.courseId === 'CRS-02').passed, 'failed retry keeps passed');
asOwner(wid, () => W.submitCorrection(wid, 'แก้ไขแล้ว', [{ id: 'd', name: 'x', kind: 'x', sizeKb: 1, addedAt: '' }]));
sess.set({ role: 'officer' });
actAs(['officer', 'admin'], () => W.reviewCorrection(wid, 'start'));
actAs(['officer', 'admin'], () => W.reviewCorrection(wid, 'approve', 'ผ่าน'));
ok(S.useWarningStore.getState().items.find((x: any) => x.id === wid).status === 'completed', 'warning completed');
ok(m('M-003').riskStatus === 'none', 'M-003 risk none after completion');
const nw = actAs(['officer', 'admin'], () => W.issueWarning({ merchantId: 'M-005', kind: 'warning', title: 't', issue: 'issue', guidance: 'g', items: ['a'], courseIds: [], dueDate: '2026-11-01', relatedComplaintIds: [] }));
ok(m('M-005').riskStatus === 'warning', 'warning sets risk');
asOwner(nw.id, () => W.acknowledgeWarning(nw.id));
ok(S.useWarningStore.getState().items.find((x: any) => x.id === nw.id).status === 'correction_required', 'ack -> correction_required');
actAs(['officer', 'admin'], () => W.issueWarning({ merchantId: 'M-006', kind: 'advisory', title: 't', issue: 'issue', guidance: 'g', items: [], courseIds: [], dueDate: '2026-11-01', relatedComplaintIds: [] }));
ok(m('M-006').riskStatus === 'none', 'advisory does not change risk');

// Scenario 6
sess.set({ role: 'merchant', operatorId: 'OP-004' });
asOwner('RSK-2569-0001', () => W.submitAppeal('RSK-2569-0001', 'ขออุทธรณ์'));
ok(m('M-004').riskStatus === 'appeal_submitted', 'appeal submitted');
sess.set({ role: 'officer', officerId: 'OF-003' });
actAs(['officer', 'admin'], () => W.reviewAppeal('RSK-2569-0001', 'overturned', 'พบหลักฐานจัดส่ง'));
ok(cert('M-004')?.status === 'active', 'cert reinstated');
ok(m('M-004').riskStatus === 'warning', `M-004 risk recomputed = ${m('M-004').riskStatus}`);
ok(verdict('M-004') === 'business', 'public verdict updated');
actAs(['officer', 'admin'], () => W.riskAction('RSK-2569-0003', 'suspended', 'ระงับ'));
ok(verdict('M-009') === 'suspended', 'suspend reflected');
actAs(['officer', 'admin'], () => W.riskAction('RSK-2569-0003', 'dismissed', 'ยุติ'));
ok(verdict('M-009') === 'business' && m('M-009').riskStatus !== 'suspended', `dismiss reinstates cert (${verdict('M-009')}, risk=${m('M-009').riskStatus})`);

const ren = asOwner('M-007', () => W.applyCertification('M-007', 2, true));
actAs(['officer', 'admin'], () => W.approveApplication(ren.id));
ok(verdict('M-007') === 'business', 'renewal -> active');
ok(S.useCertificationStore.getState().items.find((x: any) => x.id === 'SMT-2568-000044').supersededBy === cert('M-007')!.id, 'old cert superseded');

const st = ST.computeStats({ operators: S.useOperatorStore.getState().items, merchants: S.useMerchantStore.getState().items, apps: S.useVerificationStore.getState().items, certs: S.useCertificationStore.getState().items, complaints: C(), warnings: S.useWarningStore.getState().items, enrollments: S.useTrainingStore.getState().items }, { province: '', months: 0 });
ok(st.kpi.complaints === C().length, `KPI complaints = ${st.kpi.complaints}`);
ok(st.kpi.resolvedByMerchant === C().filter((x) => x.status === 'resolved').length, `KPI resolved = ${st.kpi.resolvedByMerchant}`);
console.log('KPI', JSON.stringify(st.kpi));
console.log('trend', JSON.stringify(st.trend));

W.resetAllDemoData();
ok(S.useMerchantStore.getState().items.length === 12 && verdict('M-004') === 'suspended', 'reset restores seed');
ok(C().length === 20, 'reset complaints');
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
process.exit(fails ? 1 : 0);
