/**
 * Cross-role flow tests — ตรวจ State Transition, การแจ้งเตือน, สิ่งที่แต่ละบทบาทเห็นบนหน้าจอ,
 * Referential Integrity, Persistence (localStorage), KPI บน Dashboard และ Reset
 * รัน: npm test
 */
import { S, W, T, MOCK, storage, view, describe, check, finish, merchant, operator, cert, verdict, complaint, notesFor, stats } from './harness.mts';
import { integrityProblems } from './integrity.mts';

const integrity = (label: string) => {
  const p = integrityProblems();
  check(p.length === 0, `Referential integrity หลัง${label}${p.length ? ' — ' + p.slice(0, 4).join(' | ') : ''}`);
};
const as = (role: 'merchant' | 'consumer' | 'officer' | 'admin', extra: Record<string, unknown> = {}) => {
  S.useSessionStore.setState({ role, ...extra });
};

describe('0. ข้อมูลเริ่มต้น');
integrity('โหลด Seed');
const kpi0 = stats().kpi;
check(kpi0.registered === S.useMerchantStore.getState().items.filter((m) => m.registrationStatus !== 'draft').length, `KPI ร้านที่ลงทะเบียน = ${kpi0.registered} (นับจาก Store)`);
check(kpi0.complaints === 20 && kpi0.resolvedByMerchant === 4, `KPI ข้อร้องเรียน ${kpi0.complaints} / แก้ไขสำเร็จ ${kpi0.resolvedByMerchant}`);

// ---------------------------------------------------------------- 1
describe('1. Merchant ลงทะเบียนร้านค้า → Officer ได้รับคำขอ');
as('merchant');
const op = W.registerOperator({ name: 'ทดสอบ ข้ามบทบาท', phone: '0897770000', email: 'flow@demo.local', province: 'ชลบุรี', pin: '246810' });
W.setKycResult(op.id, true);
as('merchant', { operatorId: op.id });
const { merchant: shop, app } = W.submitShopRegistration(op.id, {
  businessType: 'individual', ownerName: op.name, shopName: 'ร้านทดสอบข้ามบทบาท', category: 'บริการ', province: 'ชลบุรี', district: 'เมือง',
  phone: op.phone, email: op.email, description: 'ร้านสำหรับทดสอบ Flow ข้ามบทบาททั้งหมด', channels: [{ type: 'facebook', handle: 'flowtest.demo' }],
  documents: [{ id: 'doc-flow-1', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 100, addedAt: new Date().toISOString() }],
});
const M = { role: 'merchant' as const, operatorId: op.id, activeMerchantId: shop.id };
const O = { role: 'officer' as const, officerId: 'OF-001' };
const C = { role: 'consumer' as const, consumerId: 'CS-004' };
check(shop.registrationStatus === 'submitted' && app.status === 'submitted' && app.merchantId === shop.id, `สร้างร้าน ${shop.id} และคำขอ ${app.id} สถานะ submitted`);
check(notesFor('officer').some((n) => n.link === `/o/applications/${app.id}`), 'เจ้าหน้าที่ได้รับการแจ้งเตือนพร้อมลิงก์ไปที่คำขอ');
let page = view('/o/applications', O);
check(page.includes(app.id) && page.includes(shop.shopName), 'หน้า Merchant Applications (Officer) แสดงคำขอใหม่');
check(view('/o', O).includes(app.id), 'Work Queue ของ Officer Dashboard มีคำขอใหม่');
check(view('/m/shop', M).includes('Pending Approval'), 'ร้านค้าเห็นสถานะ Pending Approval');
check(verdict(shop.id).key === 'pending', 'ผู้บริโภคเห็นสถานะ "อยู่ระหว่างยื่นคำขอ" (ยังไม่ใช่การรับรอง)');
integrity(' Flow 1');

// ---------------------------------------------------------------- 2
describe('2. Officer อนุมัติ → Merchant เห็นสถานะรับรอง');
as('officer', { officerId: 'OF-001' });
W.startReview(app.id);
check(merchant(shop.id).registrationStatus === 'under_verification', 'เริ่มตรวจ → ร้านค้าเป็น under_verification');
const approved = W.approveApplication(app.id);
check(approved.ok, 'อนุมัติสำเร็จ');
const c1 = cert(shop.id)!;
check(merchant(shop.id).registrationStatus === 'approved' && !!merchant(shop.id).approvedAt, 'สถานะร้าน approved พร้อมวันที่อนุมัติ');
check(c1?.status === 'active' && c1.level === 2, `ออกใบรับรอง ${c1?.id} Level 2 active`);
check(S.useVerificationStore.getState().items.find((a) => a.id === app.id)!.checks.every((c) => c.result === 'pass'), 'รายการตรวจทั้งหมดเป็น "ผ่าน"');
check(notesFor('merchant', op.id).some((n) => n.title.includes('อนุมัติ') && n.body.includes(c1.id)), 'ร้านค้าได้รับแจ้งเตือนการอนุมัติพร้อมเลขใบรับรอง');
check(S.useAuditStore.getState().items.some((a) => a.target === app.id && a.action === 'อนุมัติคำขอ' && a.actorName === 'ปรียา ตรวจละเอียด'), 'Audit Log บันทึกผู้อนุมัติ');
page = view('/m/certification', M);
check(page.includes(c1.id) && page.includes('ใช้งานได้'), 'หน้าขอรับรอง (Merchant) แสดงใบรับรองที่ใช้งานได้');
check(view('/m', M).includes('อนุมัติแล้ว'), 'Merchant Home แสดง "อนุมัติแล้ว"');
check(W.approveApplication(app.id).ok === false, 'อนุมัติซ้ำไม่ได้ (ไม่ออกใบรับรองซ้ำ)');
integrity(' Flow 2');

// ---------------------------------------------------------------- 3
describe('3. Merchant ได้รับ Badge → Consumer ตรวจสอบพบข้อมูลตรงกัน');
page = view('/m/toolkit', M);
check(page.includes('Business Verified') && page.includes(`/verify/${c1.id}`), 'Toolkit แสดง Badge ระดับ Business Verified และลิงก์ตรวจสอบของใบรับรองนี้');
check(!page.includes('ยังไม่สามารถใช้ Badge'), 'Toolkit ไม่แสดงคำเตือนห้ามใช้ Badge');
const pub = view(`/shop/${shop.id}`, C);
check(pub.includes('ผ่านเกณฑ์ธุรกิจ') && pub.includes(c1.id) && pub.includes('Level 2'), 'หน้าร้านสาธารณะแสดงผลตรงกับ Badge (ผ่านเกณฑ์ธุรกิจ, เลขใบรับรอง, Level 2)');
check(view(`/check?q=${encodeURIComponent('ร้านทดสอบข้ามบทบาท')}`, C).includes('ผ่านเกณฑ์ธุรกิจ'), 'ค้นหาร้านจากหน้าผู้บริโภคพบสถานะเดียวกัน');
check(T.effectiveLevel(operator(op.id), c1) === 2 && verdict(shop.id).usable, 'ระดับที่ใช้งานได้ = 2 และสถานะใช้งานได้');
check(!pub.includes('flowtest') || pub.includes('ลิงก์จำลอง') || pub.includes('Facebook'), 'ช่องทางขายแสดงเป็นลิงก์จำลองภายในระบบ');

// ---------------------------------------------------------------- 4
describe('4. Consumer แจ้งปัญหา → Merchant ได้รับเคส');
as('consumer', { consumerId: 'CS-004' });
const cmp = W.submitComplaint({
  merchantId: shop.id, consumerId: 'CS-004', category: 'not_as_described', title: 'สินค้าไม่ตรงปก',
  description: 'สั่งบริการแพ็กเกจ A แต่ได้รับแพ็กเกจ B ซึ่งไม่ตรงตามรายละเอียดที่โฆษณาไว้ ต้องการให้ร้านแก้ไข',
  incidentDate: '2026-10-18', orderRef: 'FLOW-001', orderAmount: 1500, channel: 'facebook', evidence: [],
});
check(cmp.status === 'awaiting_merchant' && cmp.merchantId === shop.id, `สร้างเคส ${cmp.id} สถานะ awaiting_merchant`);
check(cmp.screening.missing.some((m) => m.includes('หลักฐาน')), 'Screening ระบุว่าขาดหลักฐาน');
check(notesFor('merchant', op.id).some((n) => n.link === `/m/complaints/${cmp.id}`), 'ร้านค้าได้รับการแจ้งเตือนพร้อมลิงก์เคส');
check(notesFor('consumer', 'CS-004').some((n) => n.link === `/consumer/cases/${cmp.id}`), 'ผู้บริโภคได้รับการยืนยันการยื่นเรื่อง');
check(!notesFor('merchant', 'OP-001').some((n) => n.body.includes(cmp.id)), 'ร้านค้าอื่นไม่ได้รับการแจ้งเตือนของเคสนี้');
check(view('/m/complaints', M).includes(cmp.id), 'หน้าข้อร้องเรียน (Merchant) แท็บ "ต้องดำเนินการ" มีเคสใหม่');
check(view(`/m/complaints/${cmp.id}`, { role: 'merchant', operatorId: 'OP-001' }).includes('ไม่มีสิทธิ์'), 'ร้านค้าอื่นเปิดเคสนี้ไม่ได้');
integrity(' Flow 4');

// ---------------------------------------------------------------- 5
describe('5. Merchant ตอบกลับ → Consumer เห็นคำตอบ');
as('merchant', { operatorId: op.id });
const OFFER = 'ร้านขออภัย ยินดีคืนเงินเต็มจำนวนภายใน 3 วันทำการ';
W.merchantRespond(cmp.id, { type: 'refund', amount: 1500, note: OFFER });
let x = complaint(cmp.id);
check(x.status === 'waiting_consumer' && x.offers[0]?.status === 'pending' && !!x.firstMerchantResponseAt, 'เคสเป็น waiting_consumer และมีข้อเสนอรอตอบ');
check(notesFor('consumer', 'CS-004').some((n) => n.body.includes(OFFER)), 'ผู้บริโภคได้รับแจ้งเตือนพร้อมข้อความของร้าน');
page = view(`/consumer/cases/${cmp.id}`, C);
check(page.includes(OFFER) && page.includes('ยอมรับข้อเสนอ') && page.includes('฿1,500'), 'หน้าติดตามเรื่อง (Consumer) แสดงข้อเสนอ จำนวนเงิน และปุ่มยอมรับ');
check(view(`/consumer/cases/${cmp.id}`, { role: 'consumer', consumerId: 'CS-001' }).includes('ไม่มีสิทธิ์'), 'ผู้บริโภคคนอื่นเปิดเรื่องนี้ไม่ได้');

// ---------------------------------------------------------------- 6
describe('6. Consumer ยอมรับการแก้ไข → Case เป็น Resolved');
as('consumer', { consumerId: 'CS-004' });
W.consumerReplyOffer(cmp.id, x.offers[0].id, 'accepted', '');
x = complaint(cmp.id);
check(x.status === 'waiting_consumer' && x.offers[0].status === 'accepted', 'ยอมรับแล้ว → รอผู้บริโภคยืนยันผล');
check(view(`/consumer/cases/${cmp.id}`, C).includes('ได้รับการแก้ไขแล้ว'), 'ผู้บริโภคเห็นปุ่มยืนยันผล');
// ร้านค้าส่งคำชี้แจงเพิ่มหลังผู้บริโภคยอมรับ — ข้อตกลงต้องไม่หาย (regression)
as('merchant', { operatorId: op.id });
W.merchantRespond(cmp.id, { type: 'explain', note: 'โอนเงินคืนแล้ว แนบสลิปให้ค่ะ' });
check(complaint(cmp.id).status === 'waiting_consumer', 'ร้านส่งคำชี้แจงเพิ่ม → ยังรอผู้บริโภคยืนยัน (ข้อตกลงไม่หาย)');
as('consumer', { consumerId: 'CS-004' });
W.consumerConfirmResolved(cmp.id);
x = complaint(cmp.id);
check(x.status === 'resolved' && !!x.resolvedAt, 'เคสเป็น resolved พร้อม resolvedAt');
check(x.timeline.some((t) => t.title.includes('ยืนยัน')) && x.timeline.some((t) => t.title.includes('แก้ไขสำเร็จ')), 'Timeline บันทึกการยืนยันและการปิดเรื่อง');
check(notesFor('merchant', op.id).some((n) => n.title === 'ข้อร้องเรียนแก้ไขสำเร็จ'), 'ร้านค้าได้รับแจ้งว่าแก้ไขสำเร็จ');
check(view(`/consumer/cases/${cmp.id}`, C).includes('แก้ไขสำเร็จ'), 'หน้าผู้บริโภคแสดง "แก้ไขสำเร็จ"');
check(stats().kpi.resolvedByMerchant === kpi0.resolvedByMerchant + 1 && stats().kpi.complaints === kpi0.complaints + 1, 'Admin KPI: ข้อร้องเรียน +1 และร้านค้าแก้ไขสำเร็จ +1');
check(stats().funnel[3].value === stats().kpi.resolvedByMerchant, 'Funnel ขั้น "แก้ไขสำเร็จ" ตรงกับ KPI');
W.merchantRespond(cmp.id, { type: 'refund', amount: 1, note: 'หลังปิดเรื่อง' });
check(complaint(cmp.id).status === 'resolved' && complaint(cmp.id).offers.length === 2, 'เคสที่ปิดแล้วไม่รับข้อเสนอใหม่');
integrity(' Flow 6');

// ---------------------------------------------------------------- 7
describe('7. Officer ออกคำเตือน → Merchant ได้รับแจ้งเตือน');
as('officer', { officerId: 'OF-001' });
const wrn = W.issueWarning({
  merchantId: shop.id, kind: 'warning', title: 'ข้อความโฆษณาไม่ชัดเจน', issue: 'โพสต์ขายไม่ระบุเงื่อนไขแพ็กเกจให้ครบถ้วน',
  guidance: 'ระบุรายละเอียดแพ็กเกจและเงื่อนไขให้ครบ', items: ['แก้ไขโพสต์ขาย', 'เข้าอบรมหลักสูตรการแสดงราคา'], courseIds: ['CRS-03'],
  dueDate: '2026-11-30', relatedComplaintIds: [cmp.id],
});
check(wrn.status === 'warning_issued' && wrn.officerId === 'OF-001', `ออกคำเตือน ${wrn.id}`);
check(merchant(shop.id).riskStatus === 'warning', 'สถานะความเสี่ยงของร้านเป็น "มีคำเตือน"');
check(notesFor('merchant', op.id).some((n) => n.link === `/m/warnings/${wrn.id}`), 'ร้านค้าได้รับแจ้งเตือนพร้อมลิงก์คำเตือน');
check(view('/m/notifications', M).includes('คุณได้รับคำเตือน'), 'หน้าแจ้งเตือน (Merchant) แสดงคำเตือน');
check(view('/m/warnings', M).includes(wrn.id), 'หน้าคำเตือน (Merchant) แสดงรายการ');
check(verdict(shop.id).key === 'business', 'คำเตือนไม่เปลี่ยนสถานะการรับรองที่ผู้บริโภคเห็น (แยกจากมาตรการ)');
as('merchant', { operatorId: op.id });
W.acknowledgeWarning(wrn.id);
check(S.useWarningStore.getState().items.find((w) => w.id === wrn.id)!.status === 'correction_required', 'รับทราบ → ต้องแก้ไข');
integrity(' Flow 7');

// ---------------------------------------------------------------- 8
describe('8. Merchant ผ่านการอบรม → Training Record และ Passport อัปเดต');
const course = MOCK.courses.find((c) => c.id === 'CRS-03')!;
W.startCourse(op.id, course.id);
course.lessons.forEach((l) => W.completeLesson(op.id, course.id, l.id));
const res = W.submitQuiz(op.id, course.id, course.quiz.map((q) => q.answer));
const enr = S.useTrainingStore.getState().items.find((e) => e.operatorId === op.id && e.courseId === course.id)!;
check(res.passed && res.score === 100, 'สอบผ่าน 100%');
check(enr.passed && !!enr.certificateNo && enr.completedLessonIds.length === course.lessons.length, `Training Record: ผ่าน, เลขที่ ${enr.certificateNo}, เรียนครบ ${enr.completedLessonIds.length} บท`);
check(view('/o/training', O).includes(enr.certificateNo!), 'Training Records (Officer) แสดงผลการอบรม');
page = view('/m/passport', M);
check(page.includes(course.title) && page.includes(enr.certificateNo!), 'SME Trust Passport แสดงหลักสูตรที่ผ่านและเลขใบรับรอง');
check(S.useWarningStore.getState().items.find((w) => w.id === wrn.id)!.items.find((i) => i.text.includes('อบรม'))!.done, 'รายการ "เข้าอบรม" ในคำเตือนถูกติ๊กอัตโนมัติ');
W.submitQuiz(op.id, course.id, course.quiz.map(() => -1));
const enr2 = S.useTrainingStore.getState().items.find((e) => e.id === enr.id)!;
check(enr2.passed && enr2.bestScore === 100 && enr2.certificateNo === enr.certificateNo, 'สอบซ้ำแล้วตก → ผลผ่านและเลขใบรับรองเดิมยังอยู่');
check(W.submitQuiz(op.id, 'CRS-01', [0, 1, 2, 1]).passed, 'ทำแบบทดสอบโดยยังไม่ลงทะเบียนเรียน → ระบบลงทะเบียนให้ ไม่ Error');
integrity(' Flow 8');

// ---------------------------------------------------------------- 9
describe('9. Officer ระงับใบรับรอง → Consumer เห็นสถานะ Suspended');
as('officer', { officerId: 'OF-003' });
const kpiBefore = stats().kpi.suspended;
const susp = W.setCertStatus(c1.id, 'suspended', 'อยู่ระหว่างตรวจสอบเพิ่มเติม');
check(susp.ok, 'ระงับใบรับรองสำเร็จ');
check(cert(shop.id)!.status === 'suspended' && merchant(shop.id).riskStatus === 'suspended', 'ใบรับรองและสถานะร้านเป็น suspended');
check(verdict(shop.id).key === 'suspended' && !verdict(shop.id).usable, 'ผลตรวจสอบสาธารณะ = ถูกระงับ และใช้งานไม่ได้');
page = view(`/shop/${shop.id}`, C);
check(page.includes('ถูกระงับการรับรอง') && page.includes('ไม่สามารถใช้อ้างอิงความน่าเชื่อถือได้'), 'หน้าร้าน (Consumer) แสดง "ถูกระงับการรับรอง"');
check(view('/m/toolkit', M).includes('ยังไม่สามารถใช้ Badge'), 'Toolkit ของร้านห้ามใช้ Badge');
check(view('/m/certification', M).includes('Certificate Suspended'), 'หน้าขอรับรอง (Merchant) แจ้ง Certificate Suspended');
check(stats().kpi.suspended === kpiBefore + 1, 'Admin KPI ใบรับรองถูกระงับ +1');
check(notesFor('merchant', op.id).some((n) => n.title === 'ระงับใบรับรอง'), 'ร้านค้าได้รับแจ้งการระงับ');
check(W.setCertStatus(c1.id, 'active', 'คืนสถานะหลังตรวจสอบ').ok && verdict(shop.id).key === 'business', 'คืนสถานะ → ผู้บริโภคเห็น "ผ่านเกณฑ์ธุรกิจ" อีกครั้ง');
check(merchant(shop.id).riskStatus === 'warning', 'หลังคืนสถานะ ความเสี่ยงกลับเป็น "มีคำเตือน" (คำเตือนยังค้าง)');
integrity(' Flow 9');

// ---------------------------------------------------------------- guards
describe('Regression: เงื่อนไขป้องกันสถานะขัดกัน');
as('merchant', { operatorId: 'OP-011' });
const unverified = W.submitShopRegistration('OP-011', {
  businessType: 'individual', ownerName: 'x', shopName: 'ร้านยังไม่ e-KYC', category: 'บริการ', province: 'ภูเก็ต', district: 'x',
  phone: '0810000011', email: 'x@demo.local', description: 'ทดสอบการอนุมัติผู้ที่ยังไม่ยืนยันตัวตน', channels: [{ type: 'line', handle: 'abcdef' }], documents: [],
});
as('officer', { officerId: 'OF-001' });
const blocked = W.approveApplication(unverified.app.id);
check(!blocked.ok && cert(unverified.merchant.id) === undefined, 'อนุมัติร้านของผู้ที่ยังไม่ผ่าน e-KYC ไม่ได้ และไม่มีการออกใบรับรอง');
check(view(`/o/applications/${unverified.app.id}`, O).includes('ยังอนุมัติไม่ได้'), 'หน้าคำขอแสดงเหตุผลที่อนุมัติไม่ได้');
const m4cert = cert('M-004')!;
check(!W.setCertStatus(m4cert.id, 'active', 'คืนสถานะตรงจากหน้าใบรับรอง').ok && cert('M-004')!.status === 'suspended', 'คืนสถานะใบรับรองที่มี Risk Review เปิดอยู่จากหน้าใบรับรองไม่ได้');
const esc = complaint('CMP-2569-0007');
as('merchant', { operatorId: 'OP-004' });
W.merchantRespond(esc.id, { type: 'refund', amount: 1590, note: 'ขอคืนเงิน' });
check(complaint(esc.id).status === 'escalated', 'เคสที่ส่งต่อแล้ว: ข้อเสนอของร้านไม่ดึงเคสออกจากคิวเจ้าหน้าที่');
as('consumer', { consumerId: 'CS-006' });
W.consumerReplyOffer(esc.id, complaint(esc.id).offers.at(-1)!.id, 'accepted', '');
check(complaint(esc.id).status === 'escalated' && W.canConfirmResolved(complaint(esc.id)), 'ยอมรับข้อเสนอระหว่างส่งต่อ → ยังอยู่ในคิว แต่ยืนยันผลได้');
W.consumerConfirmResolved(esc.id);
check(complaint(esc.id).status === 'resolved', 'ผู้บริโภคยืนยันผล → resolved');
W.consumerConfirmResolved('CMP-2569-0008');
check(complaint('CMP-2569-0008').status === 'awaiting_merchant', 'ยืนยันผลโดยไม่มีข้อเสนอที่ยอมรับไม่ได้');
integrity('การทดสอบเงื่อนไข');

// ---------------------------------------------------------------- persistence
describe('Persistence (localStorage)');
const keys = ['operators', 'merchants', 'applications', 'certifications', 'complaints', 'warnings', 'risk', 'enrollments', 'notifications', 'audit'];
const stores = S.domainStores;
const seedFns: Record<string, () => unknown[]> = {
  operators: MOCK.seed.operators, merchants: MOCK.seed.merchants, applications: MOCK.seed.applications, certifications: MOCK.seed.certifications,
  complaints: MOCK.seed.complaints, warnings: MOCK.seed.warnings, risk: MOCK.seed.riskCases, enrollments: MOCK.seed.enrollments,
  notifications: MOCK.seed.notifications, audit: MOCK.seed.audit,
};
keys.forEach((k, i) => {
  const raw = storage[`smetrust:v2:${k}`];
  const current = JSON.stringify(stores[i].getState().items);
  if (!raw) {
    // persist เขียนเมื่อ Store เปลี่ยนครั้งแรก — ถ้ายังไม่เคยเขียน State ต้องเท่ากับ Seed (โหลดใหม่จะได้ Seed เหมือนเดิม)
    check(current === JSON.stringify(seedFns[k]()), `${k}: ยังไม่เปลี่ยนแปลง จึงยังไม่บันทึก — State เท่ากับ Seed`);
    return;
  }
  const saved = JSON.parse(raw);
  check(saved.version === 1 && JSON.stringify(saved.state.items) === current, `บันทึก ${k} ลง localStorage ตรงกับ State (${saved.state.items.length} รายการ)`);
});
// อ่านกลับ: ล้าง State ในหน่วยความจำแล้ว Rehydrate จาก localStorage
const snapshot = { ...storage };
for (const st of stores) st.setState({ items: [] });
Object.assign(storage, snapshot);
await Promise.all(stores.map((st) => (st as any).persist.rehydrate()));
check(merchant(shop.id)?.registrationStatus === 'approved' && complaint(cmp.id)?.status === 'resolved' && cert(shop.id)?.status === 'active', 'Rehydrate จาก localStorage ได้ข้อมูลล่าสุดครบ (ร้าน, เคส, ใบรับรอง)');
const sess = JSON.parse(storage['smetrust:v2:session']);
check(sess.state.demoPanelOpen === undefined && 'role' in sess.state, 'Session บันทึกบทบาท แต่ไม่บันทึกสถานะเปิด Demo Panel');
S.useSessionStore.getState().saveDraft(op.id, { step: 3, data: { shopName: 'ฉบับร่าง' }, savedAt: new Date().toISOString() });
check(JSON.parse(storage['smetrust:v2:session']).state.shopDrafts[op.id]?.step === 3, 'ฉบับร่างร้านค้าถูกบันทึก');
integrity(' Rehydrate');

// ---------------------------------------------------------------- dashboard
describe('Dashboard คำนวณจาก State จริง');
const k = stats().kpi;
const all = {
  m: S.useMerchantStore.getState().items,
  c: S.useComplaintStore.getState().items,
  w: S.useWarningStore.getState().items,
  certs: S.useCertificationStore.getState().items,
};
check(k.totalSme === S.useOperatorStore.getState().items.length, `จำนวน SME = ${k.totalSme}`);
check(k.verified === all.m.filter((m) => m.registrationStatus === 'approved').length, `ร้านค้าที่ตรวจสอบแล้ว = ${k.verified}`);
check(k.complaints === all.c.length && k.resolvedByMerchant === all.c.filter((c) => c.status === 'resolved').length, `ข้อร้องเรียน ${k.complaints} / แก้ไขสำเร็จ ${k.resolvedByMerchant}`);
check(k.warningsIssued === all.w.filter((w) => w.kind === 'warning').length, `คำเตือนที่ออก = ${k.warningsIssued}`);
const cur = all.m.map((m) => T.currentCert(all.certs, m.id)).filter(Boolean);
check(k.suspended === cur.filter((c) => c!.status === 'suspended').length, `ใบรับรองถูกระงับ = ${k.suspended}`);
const s = stats();
check(s.categories.reduce((a, b) => a + b.value, 0) === k.complaints, 'ผลรวมกราฟหมวดข้อร้องเรียน = จำนวนข้อร้องเรียน');
check(s.provinces.reduce((a, b) => a + b.value, 0) === k.registered, 'ผลรวมกราฟจังหวัด = ร้านที่ลงทะเบียน');
check(s.certStatus.reduce((a, b) => a + b.value, 0) === cur.length, 'ผลรวมกราฟสถานะใบรับรอง = ใบรับรองปัจจุบันทุกร้าน');
check(s.funnel.every((f, i) => i === 0 || f.value <= s.funnel[i - 1].value), 'Funnel ลดหลั่นตามลำดับขั้น');
const officerPage = view('/o', O);
const escalatedNow = all.c.filter((c) => c.status === 'escalated').length;
check(officerPage.includes(`Escalated Cases ${escalatedNow}`), `Officer Dashboard แสดง Escalated Cases = ${escalatedNow}`);

// ---------------------------------------------------------------- 10
describe('10. Reset Demo Data → ทุก Store กลับสู่ข้อมูลเริ่มต้น');
W.resetAllDemoData();
keys.forEach((key, i) => {
  const same = JSON.stringify(stores[i].getState().items) === JSON.stringify(seedFns[key]());
  const persisted = JSON.stringify(JSON.parse(storage[`smetrust:v2:${key}`]).state.items) === JSON.stringify(seedFns[key]());
  check(same && persisted, `${key}: State และ localStorage ตรงกับ Seed ทุกไบต์`);
});
const ss = S.useSessionStore.getState();
check(ss.role === 'consumer' && !ss.scenarioId && Object.keys(ss.shopDrafts).length === 0, 'Session กลับค่าเริ่มต้น (ล้างฉบับร่างและ Scenario)');
check(!S.useMerchantStore.getState().items.some((m) => m.id === shop.id) && operator(op.id) === undefined, 'ข้อมูลที่สร้างระหว่างทดสอบถูกลบ');
check(stats().kpi.complaints === kpi0.complaints && stats().kpi.resolvedByMerchant === kpi0.resolvedByMerchant, 'KPI กลับเป็นค่าเดิม');
integrity('Reset');

finish();
