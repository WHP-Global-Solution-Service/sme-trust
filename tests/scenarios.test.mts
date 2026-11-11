/**
 * Demo Flow Validation — ขับ Demo Controller จริงทีละขั้นแบบเดียวกับ UI
 * (กด "ถัดไป" → ยืนยัน Role Transition → ทำ Business Action ผ่าน Workflow เดิม) และตรวจทุกเงื่อนไขของการสาธิต
 */
import { S, W, MOCK, storage, view, describe, check, finish, merchant, operator, cert, verdict, complaint, stats, actAs, asOwner } from './harness.mts';
import { integrityProblems } from './integrity.mts';

const { scenarios, findScenario } = await import('@/mock/scenarios');
const C = await import('@/demo/controller');
const { useDemoStore, reportDemo } = await import('@/stores/demo');
const { useAiWorkspaceStore } = await import('@/stores/aiWorkspace');
const { analyzeAd } = await import('@/features/ai-assistant/services/advertisingAnalyzer');
const { analyzeComplaint } = await import('@/features/ai-assistant/services/complaintAnalyzer');
const { generateDraft } = await import('@/features/ai-assistant/services/responseDraftGenerator');
const { complaintCaseText } = await import('@/features/ai-assistant/services/caseText');
const { AD_EXAMPLES } = await import('@/features/ai-assistant/data/aiExamples');

let cur = '';
const nav = ((to: string) => {
  cur = to;
}) as never;
const demo = () => useDemoStore.getState();
const sc = () => findScenario(demo().activeScenario)!;
const stepNow = () => sc().steps[demo().stepIndex];

/** ตรวจขั้นปัจจุบัน: บทบาท, หน้าจอ, Progress และหน้าจอเปิดได้ */
function assertStep(label: string) {
  const s = stepNow();
  const sess = S.useSessionStore.getState();
  const page = view(cur);
  const ok = sess.role === s.role && cur === C.stepRoute(s) && !page.includes('Permission Denied') && !page.includes('ไม่พบหน้าที่ต้องการ') && page.length > 50;
  check(ok, `${sc().no}.${demo().stepIndex + 1}/${sc().steps.length} ${s.title} — ${s.role} @ ${cur}${label ? ` · ${label}` : ''}`);
  return page;
}

/** กด "ถัดไป" แบบผู้ใช้ — ถ้าต้องเปลี่ยนบทบาทจะได้ 'transition' ก่อน แล้วจึงยืนยัน */
function go(): string {
  const r = C.next(nav, cur);
  if (r === 'transition') {
    const to = sc().steps[demo().stepIndex + 1];
    if (!to.transition) check(false, `ขั้น "${to.title}" เปลี่ยนบทบาทแต่ไม่มีคำอธิบาย`);
    return C.next(nav, cur, true) === 'moved' ? 'transition→moved' : 'transition→?';
  }
  return r;
}

/** ขั้นที่มีเงื่อนไขต้องไม่ผ่านก่อนทำ Action (ไม่ข้ามขั้นจำเป็น) */
function assertBlocked() {
  const before = demo().stepIndex;
  const r = C.next(nav, cur);
  check(r === 'blocked' && demo().stepIndex === before, `  ⛔ ปุ่มถัดไปถูกปิดจนกว่าจะ: ${stepNow().gate?.hint}`);
}

const integrity = (label: string) => {
  const p = integrityProblems();
  check(p.length === 0, `ข้อมูลสอดคล้องกันหลัง ${label}${p.length ? ' — ' + p.slice(0, 3).join(' | ') : ''}`);
};

// ================================================================ static checks
describe('โครงสร้าง Scenario');
check(scenarios.length === 7 && scenarios.map((s) => s.no).join() === '1,2,4,5,6,7,8', 'ฟังก์ชันอื่นของระบบ 7 เรื่อง (ยกเลิกเรื่องผู้บริโภคตรวจสอบที่ซ้ำกับ Demo หลัก)');
for (const s of scenarios) {
  const missing = s.steps.filter((st, i) => i > 0 && st.role !== s.steps[i - 1].role && !st.transition).map((st) => st.id);
  check(missing.length === 0, `S${s.no}: ทุกการเปลี่ยนบทบาทมีคำอธิบาย (Role Transition)${missing.length ? ' — ขาด: ' + missing.join(', ') : ''}`);
  check(new Set(s.steps.map((st) => st.id)).size === s.steps.length && !!s.benefits.sme && !!s.benefits.consumer && !!s.benefits.ocpb && !!s.keyMessage, `S${s.no}: Step ID ไม่ซ้ำ มีประโยชน์ 3 กลุ่ม และ Key Message`);
}

// ================================================================ แต่ละเรื่อง (เล่นทีละเรื่อง ไม่มี Full Journey)
describe('การสาธิต — Scenario 1: สมัครสมาชิกและยืนยันตัวตน');
C.startScenario('s1', nav);
check(demo().status === 'running' && demo().activeScenario === 's1', 'เริ่มการสาธิตสมัครสมาชิกและยืนยันตัวตน');
check(assertStep('').includes('ลงทะเบียนด้วยตนเอง'), '  หน้าเริ่มต้นมีปุ่ม "ลงทะเบียนด้วยตนเอง"');
go();
assertStep('');
assertBlocked();
reportDemo('register.step', 1);
go();
assertStep('OTP');
reportDemo('register.step', 2);
go();
reportDemo('register.step', 3);
go();
assertStep('ID');
assertBlocked();
reportDemo('ekyc.phase', 'face');
go();
assertBlocked();
reportDemo('register.kyc', 'ok');
go();
reportDemo('register.step', 5);
go();
assertStep('success');
assertBlocked();
// สิ่งที่หน้าลงทะเบียนทำเมื่อผู้ใช้ตั้ง PIN และกด "เข้าสู่หน้าหลัก"
const newOp = W.registerOperator({ name: 'สาธิต ต่อเนื่อง', phone: '0897771111', email: 'journey@demo.local', province: 'ชลบุรี', pin: '246810' });
asOwner(newOp.id, () => W.setKycResult(newOp.id, true));
S.useSessionStore.getState().set({ operatorId: newOp.id, merchantLoggedIn: true });
go();
check(assertStep('').includes('ยืนยันตัวตนแล้ว (Level 1)'), '  Merchant Home แสดง Identity Verified');
check(demo().current.operatorId === newOp.id, '  บันทึก currentOperatorId ของบัญชีที่เพิ่งสร้าง');
check(go() === 'completed' && cur === '/demo/complete/s1', 'จบ Scenario 1 → Summary Screen');
let page = view(cur);
check(page.includes('สาธิตครบทุกขั้นแล้ว') && page.includes('จบการสาธิต') && page.includes(newOp.name), '  Summary มีสถานะ Completed, สิ่งที่เปลี่ยน และ CTA ไป Scenario 2');

describe('การสาธิต — Scenario 2: สมัครร้านค้าและได้รับการรับรอง');
const merchantsBefore = S.useMerchantStore.getState().items.length;
C.startScenario('s2', nav);
const s2Op = operator(demo().current.operatorId!)!;
check(s2Op.id === 'OP-012' && s2Op.kycStatus === 'verified', 'เริ่มด้วยบัญชีตัวอย่างที่ยืนยันตัวตนแล้วแต่ยังไม่มีร้าน');
assertStep('');
go();
assertStep('');
assertBlocked();
for (const n of [1, 3, 4, 5]) {
  reportDemo('shop.step', n);
  go();
}
assertStep('submit');
assertBlocked();
const { merchant: shop, app } = asOwner(s2Op.id, () => W.submitShopRegistration(s2Op.id, {
  businessType: 'individual', ownerName: s2Op.name, shopName: 'ร้านสาธิตต่อเนื่อง', category: 'บริการ', province: 'ชลบุรี', district: 'เมือง', phone: s2Op.phone, email: s2Op.email,
  description: 'ร้านสำหรับทดสอบการสาธิตการลงทะเบียนและการรับรอง', channels: [{ type: 'facebook', handle: 'journey.demo' }],
  documents: [{ id: 'd-j', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 1, addedAt: new Date().toISOString() }],
}));
go();
check(demo().current.applicationId === app.id && demo().current.merchantId === shop.id, `  บันทึก currentApplicationId ${app.id} และ currentMerchantId ${shop.id}`);
// Automation First: ระบบตรวจคำขอลงทะเบียนอัตโนมัติ — ไม่มีขั้นตอนเจ้าหน้าที่อนุมัติการลงทะเบียน และไม่ออกใบรับรอง
check(app.autoDecision?.route === 'AUTO_PASS' && merchant(shop.id).registrationStatus === 'approved' && !cert(shop.id), '  ระบบตรวจคำขออัตโนมัติ (AUTO_PASS) — ลงทะเบียนแล้ว ไม่ออกใบรับรอง');
check(assertStep('').includes('ผ่านการตรวจสอบอัตโนมัติ') && S.useSessionStore.getState().role === 'merchant', '  ร้านค้าเห็นว่าผ่านการตรวจสอบอัตโนมัติ (ไม่ต้องรอเจ้าหน้าที่)');
check(go() === 'moved' && S.useSessionStore.getState().role === 'merchant', 'ไปขั้นยื่นขอใบรับรองในมุมผู้ประกอบการ (ไม่มีขั้นเจ้าหน้าที่อนุมัติการลงทะเบียน)');
check(assertStep('').includes('ยื่นขอ Business Verified'), '  หน้าใบรับรองมีปุ่มยื่นขอ Business Verified');
assertBlocked();
const certReq = asOwner(shop.id, () => W.applyCertification(shop.id, 2));
check(go() === 'transition→moved' && S.useSessionStore.getState().role === 'officer', 'CTA "ดูในมุมเจ้าหน้าที่" → Role Transition → เจ้าหน้าที่');
check(demo().current.applicationId === certReq.id && assertStep('').includes(certReq.id), '  เจ้าหน้าที่เปิดคำขอรับรองเดิม (Application ID เดียวกัน)');
assertBlocked();
actAs(['officer', 'admin'], () => W.startReview(certReq.id));
go();
assertBlocked();
check(!cert(shop.id), '  กดถัดไปไม่ออกใบรับรองแทนเจ้าหน้าที่');
actAs(['officer', 'admin'], () => W.approveApplication(certReq.id));
check(go() === 'transition→moved' && S.useSessionStore.getState().operatorId === s2Op.id && S.useSessionStore.getState().activeMerchantId === shop.id, 'CTA "ดูผลในมุมผู้ประกอบการ" → กลับเป็นร้านเดิม (Operator/Merchant ID เดิม)');
check(assertStep('').includes('ได้รับอนุมัติ'), '  ร้านค้าเห็นการแจ้งเตือนผลอนุมัติ');
go();
check(assertStep('').includes('Business Verified'), '  Trust Badge อัปเดตจริง');
go();
check(assertStep('').includes('ร้านสาธิตต่อเนื่อง'), '  SME Trust Passport แสดงร้านใหม่');
go();
check(cur === '/demo/complete/s2' && demo().results.s2?.merchantId === shop.id && demo().results.s2?.certId === cert(shop.id)!.id, 'จบการสาธิต — บันทึก Merchant/Certificate ID ในสรุป');
integrity('Scenario 2');

describe('การสาธิต — Scenario 4: ร้องเรียนและร้านค้าแก้ไข');
C.startScenario('s4', nav);
const shop4 = merchant(demo().current.merchantId!)!;
check(!!shop4 && shop4.registrationStatus === 'approved', 'เริ่มด้วยร้านตัวอย่างที่ลงทะเบียนแล้ว');
assertStep('');
go();
assertStep('');
assertBlocked();
reportDemo('report.step', 5);
go();
assertBlocked();
const complaintForm = {
  merchantId: shop4.id, consumerId: 'CS-003', category: 'not_as_described' as const, title: 'บริการไม่ตรงตามที่ตกลง', description: 'ได้รับบริการไม่ตรงตามแพ็กเกจที่ตกลงไว้ ต้องการให้ร้านแก้ไขหรือคืนเงิน',
  incidentDate: '2026-10-19', orderRef: 'JRN-001', orderAmount: 1200, channel: 'facebook' as const, evidence: [],
};
const cmpBefore = S.useComplaintStore.getState().items.length;
actAs('consumer', () => W.submitComplaint(complaintForm));
// Restart Scenario กลางทาง: คืนข้อมูลเป็นจุดเริ่มต้นของเรื่อง ไม่สร้างข้อมูลซ้ำ และไม่กระทบผลของ Scenario ก่อนหน้า
C.restartScenario(nav);
check(S.useComplaintStore.getState().items.length === cmpBefore && demo().stepIndex === 0, 'Restart Scenario: เรื่องที่สร้างระหว่างทางถูกถอยกลับ (ไม่ซ้ำ) และกลับขั้นแรก');
check(merchant(shop4.id)?.registrationStatus === 'approved' && demo().current.merchantId === shop4.id, '  ผลของ Scenario 1–3 ยังอยู่ (ร้านที่อนุมัติแล้ว)');
go();
reportDemo('report.step', 5);
go();
const cmp = actAs('consumer', () => W.submitComplaint(complaintForm));
go();
check(demo().current.complaintId === cmp.id && S.useComplaintStore.getState().items.length === cmpBefore + 1, `บันทึก currentComplaintId ${cmp.id} (มีเพียง 1 เรื่อง)`);
check(assertStep('').includes(cmp.id), '  หน้าติดตามสถานะแสดงเรื่องที่เพิ่งสร้าง');
check(go() === 'transition→moved' && S.useSessionStore.getState().operatorId === shop4.operatorId, 'CTA "ดูการรับเรื่องของร้านค้า" → ร้านเดิม');
check(assertStep('').includes(cmp.id), '  ร้านค้าเปิด Complaint ID เดิม');
assertBlocked();
S.useSessionStore.getState().set({ role: 'merchant' });
asOwner(cmp.id, () => W.merchantRespond(cmp.id, { type: 'refund', amount: 1200, note: 'ร้านขออภัย ยินดีคืนเงินเต็มจำนวน' }));
check(go() === 'transition→moved' && S.useSessionStore.getState().consumerId === 'CS-003', 'สลับเป็นผู้บริโภคคนเดิมเมื่อร้านส่งคำตอบแล้ว');
check(assertStep('').includes('ยินดีคืนเงินเต็มจำนวน'), '  ผู้บริโภคเห็นข้อเสนอที่ร้านส่ง');
assertBlocked();
actAs('consumer', () => W.consumerReplyOffer(cmp.id, complaint(cmp.id).offers[0].id, 'accepted', ''));
go();
assertBlocked();
actAs('consumer', () => W.consumerConfirmResolved(cmp.id));
go();
check(assertStep('').includes('แก้ไขสำเร็จ'), '  Case Resolved พร้อม Timeline');
go();
check(cur === '/demo/complete/s4' && demo().results.s4?.complaintId === cmp.id, 'จบ Scenario 4');
integrity('Scenario 4');

describe('การสาธิต — Scenario 5: คำเตือนและการอบรม');
C.startScenario('s5', nav);
check(demo().current.merchantId === 'M-003' && !!sc().caseNote, 'ใช้กรณีศึกษาแยก (ร้านสวยใสคอสเมติก) พร้อมคำอธิบายว่าเป็นคนละเหตุการณ์');

assertStep('');
go();
assertStep('');
go();
assertStep('');
assertBlocked();
S.useSessionStore.getState().set({ role: 'officer', officerId: 'OF-001' });
const w = actAs(['officer', 'admin'], () => W.issueWarning({ merchantId: 'M-003', kind: 'warning', title: 'ข้อความโฆษณาที่อาจทำให้เข้าใจผิด', issue: 'พบข้อความเห็นผลทันที 100% โดยไม่มีข้อมูลรองรับ', guidance: 'แก้ไขข้อความให้ตรงกับข้อมูลผลิตภัณฑ์', items: ['แก้ไขโพสต์', 'เข้าอบรมหลักสูตรการโฆษณา'], courseIds: ['CRS-02'], dueDate: '2026-11-30', relatedComplaintIds: ['CMP-2569-0004'] }));
check(go() === 'transition→moved' && demo().current.warningId === w.id && S.useSessionStore.getState().operatorId === 'OP-003', `คำเตือนสร้างโดยเจ้าหน้าที่ (${w.id}) → สลับเป็นร้านเดียวกัน`);
check(assertStep('').includes(w.id), '  ร้านค้าเปิด Warning ID เดิม');
assertBlocked();
asOwner(w.id, () => W.acknowledgeWarning(w.id));
go();
go();
assertStep('course');
assertBlocked();
MOCK.courses.find((c) => c.id === 'CRS-02')!.lessons.forEach((l) => asOwner('OP-003', () => W.completeLesson('OP-003', 'CRS-02', l.id)));
go();
assertBlocked();
check(!asOwner('OP-003', () => W.submitQuiz('OP-003', 'CRS-02', [0, 0, 0, 0])).passed, '  แบบทดสอบตรวจคำตอบจริง (ตอบผิดไม่ผ่าน)');
assertBlocked();
asOwner('OP-003', () => W.submitQuiz('OP-003', 'CRS-02', [2, 1, 1, 1]));
go();
assertBlocked();
asOwner(w.id, () => W.submitCorrection(w.id, 'แก้ไขโพสต์ทุกช่องทางแล้ว', [{ id: 'e', name: 'หลังแก้ไข.png', kind: 'หลักฐาน', sizeKb: 1, addedAt: new Date().toISOString() }]));
check(go() === 'transition→moved', 'ส่งหลักฐานแล้ว → สลับเป็นเจ้าหน้าที่');
assertBlocked();
actAs(['officer', 'admin'], () => W.reviewCorrection(w.id, 'start'));
actAs(['officer', 'admin'], () => W.reviewCorrection(w.id, 'approve', 'ผ่าน'));
go();
check(cur === '/demo/complete/s5' && S.useTrainingStore.getState().items.some((e) => e.operatorId === 'OP-003' && e.courseId === 'CRS-02' && e.passed), 'จบ Scenario 5 — Training Record อัปเดต');
check(merchant('M-003').riskStatus === 'none' && merchant('M-003').riskStatus !== 'suspended', '  คำเตือน/การอบรมไม่ทำให้ร้านถูกระงับ');
integrity('Scenario 5');

describe('การสาธิต — Scenario 6: ระงับและอุทธรณ์');
C.startScenario('s6', nav);
check(demo().current.riskCaseId === 'RSK-2569-0001' && verdict('M-004').key === 'business', 'เริ่มก่อนการระงับ (เคสความเสี่ยงแยก ร้านไอทีแกดเจ็ตช็อป)');
assertStep('');
go();
go();
assertBlocked();
check(cert('M-004')!.status === 'active', '  ไม่ระงับจนกว่าเจ้าหน้าที่จะยืนยันเอง');
actAs(['officer', 'admin'], () => W.riskAction('RSK-2569-0001', 'suspended', 'ข้อร้องเรียนไม่ได้รับสินค้าหลายเรื่องพร้อมหลักฐาน'));
check(go() === 'transition→moved' && S.useSessionStore.getState().operatorId === 'OP-004', 'สลับเป็นร้านที่ถูกระงับ');
check(assertStep('').includes('ยื่นอุทธรณ์'), '  ร้านค้าเห็นประกาศการระงับและช่องทางอุทธรณ์');
go();
assertBlocked();
asOwner('RSK-2569-0001', () => W.merchantStatement('RSK-2569-0001', 'ได้จัดส่งครบแล้ว'));
asOwner('RSK-2569-0001', () => W.submitAppeal('RSK-2569-0001', 'ขอให้ทบทวน'));
check(go() === 'transition→moved', 'ยื่นอุทธรณ์แล้ว → เจ้าหน้าที่พิจารณาอีกครั้ง');
assertBlocked();
actAs(['officer', 'admin'], () => W.reviewAppeal('RSK-2569-0001', 'upheld', 'หลักฐานยังไม่เพียงพอ'));
check(go() === 'transition→moved', 'สลับเป็นผู้บริโภค');
assertStep('');
check(verdict('M-004').key === 'suspended', '  ผลอุทธรณ์ "ยืนยันการระงับ" — ผู้บริโภคเห็น Suspended และไม่กระทบร้านอื่น');
go();
integrity('Scenario 6');

describe('การสาธิต — Scenario 7: AI ตรวจสอบโฆษณา');
C.startScenario('s7', nav);
check(!!demo().current.operatorId, 'เริ่มด้วยบัญชีผู้ประกอบการตัวอย่าง');
check(assertStep('').includes('AI ผู้ช่วย SME'), '  Merchant Home มีส่วน AI ผู้ช่วย SME');
go();
assertStep('');
go();
assertStep('');
assertBlocked();
const ws = useAiWorkspaceStore.getState();
ws.setAd({ text: AD_EXAMPLES[0].text, source: AD_EXAMPLES[0].id });
go();
assertBlocked();
const before = analyzeAd(AD_EXAMPLES[0].text);
useAiWorkspaceStore.getState().setAd({ before, revisionDraft: before.revision ?? '' });
go();
check(assertStep('').includes('High'), '  แสดงระดับความเสี่ยงที่ขึ้นกับข้อความจริง');
go();
go();
assertStep('edit');
useAiWorkspaceStore.getState().setAd({ revisionDraft: `${before.revision} (ปรับโดยผู้ประกอบการ)` });
go();
assertBlocked();
useAiWorkspaceStore.getState().setAd({ after: analyzeAd(useAiWorkspaceStore.getState().ad.revisionDraft!) });
go();
check(assertStep('').includes('เปรียบเทียบก่อน') && view(cur).includes('ไม่ได้อนุมัติ'), '  Before/After Comparison และไม่แสดงว่า AI อนุมัติโฆษณา');
go();
check(cur === '/demo/complete/s7', 'จบ Scenario 7');

describe('การสาธิต — Scenario 8: AI ช่วยแก้ไขข้อร้องเรียน');
C.startScenario('s8', nav);
const cid = demo().current.complaintId!;
check(cid === 'CMP-2569-0005' && !!complaint(cid), `ใช้ Complaint ID ที่มีอยู่ใน Mock Store (${cid})`);
assertStep('');
go();
check(assertStep('').includes('ให้ AI ช่วยวิเคราะห์'), '  หน้าเคสมีปุ่ม "ให้ AI ช่วยวิเคราะห์"');
go();
assertStep('');
assertBlocked();
const c0 = complaint(cid);
const a8 = analyzeComplaint(complaintCaseText(c0));
useAiWorkspaceStore.getState().setComplaint({ caseId: cid, source: 'case', text: complaintCaseText(c0), analysis: a8, draft: generateDraft(a8, { tone: 'formal', context: { caseId: cid } }) });
check(a8.primary === 'mismatch' && view(cur).includes(cid), '  วิเคราะห์เคสเดิม: สินค้าไม่ตรงรายละเอียด');
go();
go();
go();
assertStep('tone');
const friendly = generateDraft(a8, { tone: 'friendly', context: { caseId: cid } });
useAiWorkspaceStore.getState().setComplaint({ tone: 'friendly', draft: friendly });
go();
go();
assertBlocked();
const msgsBefore = complaint(cid).messages.length;
useAiWorkspaceStore.getState().setReplyDraft(cid, { text: friendly, suggestedType: 'request_info', createdAt: new Date().toISOString() });
go();
page = assertStep('');
check(page.includes('ยังไม่ได้ส่งถึงลูกค้า') && page.includes(friendly.slice(0, 20)), '  ร่างถูกนำไปใส่ช่องตอบกลับของเคสเดิม พร้อมแจ้งว่ายังไม่ได้ส่ง');
check(complaint(cid).messages.length === msgsBefore && complaint(cid).status === 'awaiting_merchant', '  ไม่มีการส่งอัตโนมัติ — สถานะเคสยังไม่เปลี่ยน');
assertBlocked();
asOwner(cid, () => W.merchantRespond(cid, { type: 'request_info', note: friendly }));
check(go() === 'transition→moved' && S.useSessionStore.getState().consumerId === 'CS-007', 'ร้านค้ากดส่งเอง → สลับเป็นผู้บริโภคของเคสเดิม');
check(assertStep('').includes(friendly.slice(0, 20)), '  ผู้บริโภคเห็นคำตอบที่ส่งแล้ว');
go();
go();
check(cur === '/demo/complete/s8' && view(cur).includes('จบการสาธิต') && view(cur).includes('เริ่ม Demo ใหม่'), 'จบการสาธิต — หน้าสรุปมีปุ่ม "จบการสาธิต" และ "เริ่ม Demo ใหม่"');
check(demo().completed.length === 7 && scenarios.every((s) => C.scenarioStatus(s.id) === 'completed'), 'ฟังก์ชันอื่นทั้ง 7 เรื่องเล่นจบได้ทีละเรื่อง');
check(S.useMerchantStore.getState().items.length === MOCK.seed.merchants().length, 'แต่ละเรื่องเริ่มจากข้อมูลตั้งต้น — ไม่มีร้านค้าค้างหรือซ้ำจากเรื่องก่อน');
integrity('ทุกเรื่อง');
check(view('/demo/complete/s2').includes('สาธิตครบทุกขั้นแล้ว'), 'ย้อนดูหน้าสรุปของเรื่องที่จบแล้วได้');
page = view('/demo');
check(page.includes('ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ') && !page.includes('สรุปภาพรวม SME Trust Platform'), 'หน้า Demo แสดง Demo หลัก (ไม่มีหน้าสรุป Full Journey แล้ว)');

// ================================================================ Refresh
describe('Refresh Browser ระหว่างสาธิต');
C.startScenario('s4', nav);
go();
reportDemo('report.step', 5);
go();
const snap = storage['smetrust:v2:demo'];
useDemoStore.setState({ activeScenario: undefined, stepIndex: 0, current: {}, signals: {} });
storage['smetrust:v2:demo'] = snap;
await (useDemoStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
check(demo().activeScenario === 's4' && demo().stepIndex === 2 && demo().current.merchantId === 'M-001' && demo().signals['report.step'] === 5, 'หลัง Refresh: Scenario, ขั้นตอน, Context IDs และสัญญาณยังอยู่');
assertBlocked();

// ================================================================ Standalone
describe('Scenario แบบเดี่ยว');
for (const s of scenarios) {
  C.startScenario(s.id, nav);
  const ok = demo().activeScenario === s.id && demo().stepIndex === 0;
  check(ok, `S${s.no} เริ่มแบบเดี่ยว → ${cur}`);
  assertStep('');
  const firstProblems = integrityProblems();
  check(firstProblems.length === 0, `  จุดเริ่มต้นสอดคล้องกัน${firstProblems.length ? ' — ' + firstProblems.slice(0, 2).join(' | ') : ''}`);
  const startData = JSON.stringify(S.domainStores.map((x) => x.getState().items));
  C.restartScenario(nav);
  check(JSON.stringify(S.domainStores.map((x) => x.getState().items)) === startData, '  Restart Scenario ได้จุดเริ่มต้นเดิมทุกไบต์');
}
C.startScenario('s2', nav);
check(demo().current.operatorId === 'OP-012', 'S2 แบบเดี่ยวใช้ผู้ประกอบการตัวอย่าง (ยืนยันตัวตนแล้ว ยังไม่มีร้าน)');
C.startScenario('s6', nav);
for (let k = 0; k < 2; k++) go();
actAs(['officer', 'admin'], () => W.riskAction('RSK-2569-0001', 'suspended', 'ระงับ'));
go();
go();
asOwner('RSK-2569-0001', () => W.submitAppeal('RSK-2569-0001', 'ขอทบทวน'));
go();
actAs(['officer', 'admin'], () => W.reviewAppeal('RSK-2569-0001', 'overturned', 'พบหลักฐานจัดส่งครบ'));
go();
check(verdict('M-004').key === 'business', 'S6 ผลอุทธรณ์ "ยกเลิกการระงับ" — ผู้บริโภคเห็นสถานะคืน');
C.resetScenarioData('s5');
check(demo().status === 'idle' && S.useWarningStore.getState().items.find((x) => x.id === 'WRN-2569-0001')!.status === 'completed', 'Reset Scenario จากหน้ารวม: เตรียมจุดเริ่มต้นโดยยังไม่เริ่มสาธิต');

describe('ย้อนกลับไปขั้นที่ทำแล้ว — ไม่ต้องทำ Action ซ้ำ');
C.startScenario('s4', nav);
go();
reportDemo('report.step', 5);
go();
const cmpCount = S.useComplaintStore.getState().items.length;
actAs('consumer', () => W.submitComplaint({ ...complaintForm, merchantId: 'M-001' }));
go();
C.back(nav, cur, true);
C.back(nav, cur, true);
reportDemo('report.step', 1); // แบบฟอร์มเริ่มใหม่เมื่อเปิดหน้าอีกครั้ง
const g = C.gateState(stepNow());
check(g.ok && g.done === true, 'ขั้นแบบฟอร์มที่ผ่านแล้ว: ปุ่มถัดไปยังใช้ได้ พร้อมแจ้ง "ขั้นนี้ทำเสร็จแล้ว"');
go();
go();
check(S.useComplaintStore.getState().items.length === cmpCount + 1 && demo().stepIndex === 3, '  ไปต่อได้โดยไม่ต้องส่งเรื่องซ้ำ (มีเรื่องเดียว)');
C.restartScenario(nav);
go();
check(!C.gateState(stepNow()).ok, '  Restart Scenario ล้างสถานะ "ทำแล้ว" — ต้องทำขั้นใหม่');

describe('Back / Next ไม่ทำให้เกิด Business Action ซ้ำ');
C.startScenario('s6', nav);
go();
go();
actAs(['officer', 'admin'], () => W.riskAction('RSK-2569-0001', 'suspended', 'ระงับเพื่อทดสอบ'));
const afterAction = JSON.stringify(S.domainStores.map((x) => x.getState().items));
go();
C.back(nav, cur, true);
C.back(nav, cur, true);
go();
go();
check(JSON.stringify(S.domainStores.map((x) => x.getState().items)) === afterAction, 'กด ย้อนกลับ/ถัดไป ซ้ำหลายครั้ง — ข้อมูลธุรกิจไม่เปลี่ยน (ไม่ระงับซ้ำ ไม่เพิ่ม Audit/การแจ้งเตือน)');

// ================================================================ Pause / Resume / เริ่มใหม่
describe('Pause / Resume / เริ่มใหม่');
C.startScenario('s1', nav);
C.pauseDemo();
check(demo().status === 'paused' && view('/m').length > 0 && view('/demo').includes('สาธิตต่อ'), 'Exit Demo: หยุดไว้และกลับมาสาธิตต่อได้');
C.resumeDemo(nav);
check(demo().status === 'running' && cur === '/', 'Resume กลับขั้นเดิม');
C.startScenario('s1', nav);
check(JSON.stringify(S.useMerchantStore.getState().items) === JSON.stringify(MOCK.seed.merchants()) && JSON.stringify(S.useOperatorStore.getState().items) === JSON.stringify(MOCK.seed.operators()), 'Restart Full Journey คืนข้อมูลสาธิตเริ่มต้น (ร้านค้าและบัญชีตรงกับ Seed ทุกรายการ)');

// ================================================================ AI integration
describe('AI Integration กับระบบเดิม');
W.resetAllDemoData();
S.useSessionStore.getState().set({ role: 'merchant', operatorId: 'OP-003', merchantLoggedIn: true });
page = view('/m');
check(page.includes('ตรวจสอบข้อความโฆษณา') && page.includes('ช่วยจัดการข้อร้องเรียน'), 'Merchant Home มีบริการ AI ทั้ง 2 รายการ');
check(view('/m/ai').includes('AI Simulation') && view('/m/ai/ad-checker').includes('ไม่ใช่ AI Model จริง'), 'หน้า AI ระบุว่าเป็น AI Simulation ไม่ใช่ AI Model จริง');
check(view('/m/ai/complaint?case=CMP-2569-0005').includes('CMP-2569-0005'), 'เลือกเคสที่มีอยู่จาก Complaint Center');
check(view('/m/ai/complaint?case=CMP-9999-0001').includes('ไม่พบเคส'), 'Case ID ไม่พบใน Mock Store → แสดงข้อผิดพลาด');
check(view('/m/ai/complaint?case=CMP-2569-0001').includes('ไม่พบเคส'), 'เคสของร้านอื่นเข้าไม่ได้');
W.recordAiAnalysis({ type: 'advertising', source: 'ข้อความที่พิมพ์เอง (ไม่บันทึกเนื้อหา)', resultCategory: 'x', level: 'Low' });
for (let k = 0; k < 25; k++) W.recordAiAnalysis({ type: 'complaint', source: `ตัวอย่าง ${k}`, resultCategory: 'x', level: 'Normal' });
check(S.useAiHistoryStore.getState().items.length === 20, 'ประวัติ AI เก็บล่าสุด 20 รายการ');
useAiWorkspaceStore.getState().setReplyDraft('CMP-2569-0005', { text: 'ร่างทดสอบ', suggestedType: 'explain', createdAt: new Date().toISOString() });
W.resetAllDemoData();
check(S.useAiHistoryStore.getState().items.length === 4 && Object.keys(useAiWorkspaceStore.getState().replyDrafts).length === 0, 'Reset Demo Data คืนประวัติ AI ตัวอย่าง และล้างร่างที่ค้าง');
useAiWorkspaceStore.getState().setComplaint({ source: 'custom', text: 'ข้อความส่วนตัวที่พิมพ์เอง' });
check(!storage['smetrust:v2:ai-workspace'].includes('ข้อความส่วนตัวที่พิมพ์เอง'), 'ข้อร้องเรียนที่พิมพ์เองไม่ถูกบันทึกลง localStorage');
check(stats().kpi.complaints === 20, 'AI ไม่เปลี่ยนข้อมูลธุรกิจโดยตรง');


describe('localStorage เสียหาย / เวอร์ชันเก่า');
type Rehydratable = { persist: { rehydrate: () => Promise<void> } };
const seedCount = S.useMerchantStore.getState().items.length;
for (const [label, raw] of [
  ['JSON เสีย', '{not json'],
  ['items ไม่ใช่ Array', JSON.stringify({ state: { items: 'x' }, version: 1 })],
  ['รายการไม่มี id', JSON.stringify({ state: { items: [{ shopName: 'x' }] }, version: 1 })],
  ['เวอร์ชันเก่า (0)', JSON.stringify({ state: { items: [] }, version: 0 })],
] as const) {
  storage['smetrust:v2:merchants'] = raw;
  const origErr = console.error;
  console.error = () => {};
  await (S.useMerchantStore as unknown as Rehydratable).persist.rehydrate();
  console.error = origErr;
  check(S.useMerchantStore.getState().items.length === seedCount, `${label} → ใช้ข้อมูลตัวอย่าง ไม่เกิด Error`);
}
storage['smetrust:v2:demo'] = JSON.stringify({ state: { activeScenario: 's99', stepIndex: 50, status: 'running' }, version: 1 });
await (useDemoStore as unknown as Rehydratable).persist.rehydrate();
check(!C.activeScenario() && view('/demo').length > 0 && view('/m').length > 0, 'Demo State อ้าง Scenario ที่ไม่มีอยู่ → ไม่แสดงตัวควบคุม และหน้าจอไม่พัง');
W.resetAllDemoData();

finish();
