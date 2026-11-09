/**
 * Demo v2 (P6) — ขับ Demo Controller จริงทีละขั้นแบบเดียวกับ UI: Full Journey v2 (Scenario 9–13), เส้นทางทางเลือก 9B,
 * Scenario แบบเดี่ยว และการแจ้งเมื่อข้อมูลจากขั้นก่อนหน้าไม่ครบ — Business Action ทำผ่าน Workflow เดิมเท่านั้น
 */
import { S, W, view, describe, check, finish, actAs } from '../harness.mts';
import { integrityProblems } from '../integrity.mts';

const { scenarios, v2Scenarios, journeyScenarios, findScenario, scenarioCode } = await import('@/mock/scenarios');
const C = await import('@/demo/controller');
const V = await import('@/stores/workflowsV2');
const { useDemoStore, reportDemo } = await import('@/stores/demo');
const { analyzeCase, COMPARISON_CASES } = await import('@/features/marketplace/analysis/comparison');

let cur = '';
const nav = ((to: string) => {
  cur = to;
}) as never;
const demo = () => useDemoStore.getState();
const sc = () => findScenario(demo().activeScenario)!;
const stepNow = () => sc().steps[demo().stepIndex];
const session = () => S.useSessionStore.getState();

function assertStep(label = '') {
  const s = stepNow();
  const page = view(cur);
  const ok = session().role === s.role && cur === C.stepRoute(s) && !page.includes('Permission Denied') && !page.includes('ไม่พบหน้าที่ต้องการ') && page.length > 50;
  check(ok, `${scenarioCode(sc())}.${demo().stepIndex + 1}/${sc().steps.length} ${s.title} — ${s.role} @ ${cur}${label ? ` · ${label}` : ''}`);
  return page;
}
function go(): string {
  const r = C.next(nav, cur);
  if (r === 'transition') {
    const to = sc().steps[demo().stepIndex + 1];
    if (!to.transition) check(false, `ขั้น "${to.title}" เปลี่ยนบทบาทแต่ไม่มีคำอธิบาย`);
    return C.next(nav, cur, true) === 'moved' ? 'transition→moved' : 'transition→?';
  }
  return r;
}
function assertBlocked() {
  const before = demo().stepIndex;
  check(C.next(nav, cur) === 'blocked' && demo().stepIndex === before, `  ⛔ ปุ่มถัดไปถูกปิดจนกว่าจะ: ${stepNow().gate?.hint}`);
}
const integrity = (label: string) => {
  const p = integrityProblems();
  check(p.length === 0, `ข้อมูลสอดคล้องกันหลัง ${label}${p.length ? ' — ' + p.slice(0, 3).join(' | ') : ''}`);
};
const asOfficer = () => session().set({ role: 'officer', officerId: 'OF-001' });

// ================================================================ static
describe('โครงสร้าง Demo v2');
check(scenarios.length === 8, 'Scenario v1 ยังมี 8 เรื่องเท่าเดิม (ไม่กระทบ Full Journey v1)');
check(journeyScenarios('v2').map((s) => s.no).join() === '9,10,11,12,13', 'Full Journey v2 = Scenario 9 → 13');
check(journeyScenarios('v1').map((s) => s.no).join() === '1,2,3,4,5,6,7,8', 'Full Journey v1 = Scenario 1 → 8 (ไม่มี v2 ปน)');
const branch = findScenario('s9b')!;
check(!!branch.branch && scenarioCode(branch) === '9B' && !journeyScenarios('v2').includes(branch), 'เส้นทางทางเลือก 9B เป็น Branch ไม่อยู่ในลำดับ Journey');
for (const s of v2Scenarios) {
  const missing = s.steps.filter((st, i) => i > 0 && st.role !== s.steps[i - 1].role && !st.transition).map((st) => st.id);
  check(missing.length === 0 && new Set(s.steps.map((x) => x.id)).size === s.steps.length && !!s.benefits.ocpb, `S${scenarioCode(s)}: Role Transition ครบ, Step ID ไม่ซ้ำ, มีประโยชน์ 3 กลุ่ม`);
}
check(C.nextScenarioId('s8') === undefined && C.nextScenarioId('s9') === 's10' && C.nextScenarioId('s13') === undefined && C.prevScenarioId('s9') === undefined, 'ลำดับถัดไป/ก่อนหน้าอยู่ในชุดเดียวกัน (S8 ไม่ต่อ S9)');

// ================================================================ Comparison (Scenario 10)
describe('กรณีเปรียบเทียบ 4 กรณี — ใช้ Analysis Engine เดิม');
const cases = Object.fromEntries(COMPARISON_CASES.map((c) => [c.id, analyzeCase(c.id)]));
check(COMPARISON_CASES.length === 4, 'มี 4 กรณีตามโจทย์');
check(cases.cheap_popular.price.findings.some((f) => f.kind === 'below_reference') && cases.cheap_popular.price.watchCount === 0, 'ราคาต่ำ ยอดขายสูง รีวิวมาก → เป็นข้อสังเกต ไม่ใช่สัญญาณความเสี่ยง (มีหลักฐานสนับสนุน)');
check(cases.premium_niche.price.findings.every((f) => f.kind === 'above_reference' && f.level === 'info') && cases.premium_niche.sales.totalOrders < 100, 'ราคาสูง ยอดขายน้อย → ข้อสังเกตเท่านั้น ไม่หักคะแนน');
check(cases.new_shop.sales.totalOrders < 30, 'ร้านใหม่ → คำสั่งซื้อต่ำกว่าขั้นต่ำ');
check(!!cases.review_burst.reviews.burst && Math.abs(cases.review_burst.reviews.avgRating - cases.cheap_popular.reviews.avgRating) < 0.3, `รีวิวผิดธรรมชาติ: ดาวใกล้เคียงกรณีที่ 1 (${cases.review_burst.reviews.avgRating.toFixed(2)} vs ${cases.cheap_popular.reviews.avgRating.toFixed(2)}) แต่ตรวจพบรีวิวกระจุกตัว`);

// ================================================================ Full Journey v2
describe('Full Journey v2 — Scenario 9: เชื่อมข้อมูลร้านค้าออนไลน์');
C.startJourney(nav, 'v2');
check(demo().journeyMode && demo().journeyTrack === 'v2' && demo().activeScenario === 's9', 'Start Journey v2 → Scenario 9 ในโหมด Journey v2');
check(demo().current.merchantId === 'M-005' && S.useMarketplaceStore.getState().items.every((c) => c.merchantId !== 'M-005') && S.useAssessmentStore.getState().items.every((a) => a.merchantId !== 'M-005'), '  ร้านตัวอย่าง M-005 เริ่มจากยังไม่เชื่อมต่อและไม่มีผลประเมิน');
assertStep();
go();
assertStep('เลือกแพลตฟอร์ม');
assertBlocked();
const conn = actAs('merchant', () => V.connectMarketplace('M-005', 'lazada'));
check(conn.status === 'pending_consent' && !conn.consentAt, '  กดเชื่อมต่อ → สร้างคำขอความยินยอม ยังไม่ดึงข้อมูล');
go();
assertStep('ยินยอม');
assertBlocked();
reportDemo('mkt.wizard', 1);
go();
assertStep('เลือกร้าน');
assertBlocked();
reportDemo('mkt.wizard', 2);
go();
assertStep('Preview');
assertBlocked();
check(S.useMarketplaceStore.getState().items.find((c) => c.id === conn.id)!.status === 'pending_consent', '  Preview และปุ่มถัดไปไม่เปลี่ยนสถานะการเชื่อมต่อแทนผู้ใช้');
actAs('merchant', () => V.grantConsent(conn.id, 'established_good'));
go();
assertStep('รอซิงก์');
assertBlocked();
V.completeSync(conn.id, false);
assertBlocked();
actAs('merchant', () => V.resyncMarketplace(conn.id));
V.completeSync(conn.id, true);
go();
check(demo().current.connectionId === conn.id, `  บันทึก Connection ID ${conn.id}`);
// ---- Auto-Fill โปรไฟล์ร้านเดิม → ตรวจ/แก้ไข → ยืนยันอัปเดต (ไม่ใช่การสมัครร้านใหม่)
let page = assertStep('Auto-Fill');
check(cur === `/m/marketplace/profile/${conn.id}` && page.includes('อัปเดตข้อมูลร้านเดิม — ไม่ใช่การสมัครร้านใหม่') && page.includes('นำเข้าสำเร็จ') && page.includes('อ่านอย่างเดียว') && page.includes('Level 3'), '  หน้าเติมโปรไฟล์ร้านเดิม: สรุปการนำเข้า ข้อมูลต้นฉบับ (อ่านอย่างเดียว) และระบุว่าใบรับรองเดิมไม่เปลี่ยน');
assertBlocked();
reportDemo('profile.loaded', 1);
go();
assertStep('แก้ไข');
assertBlocked();
const m5 = S.useMerchantStore.getState().items.find((m) => m.id === 'M-005')!;
const live = S.useMarketplaceStore.getState().items.find((c) => c.id === conn.id)!;
const src9 = V.sourceOfConnection(live, m5);
const reg9 = V.registeredValues(m5);
const edited9 = { ...reg9, shopName: src9.shopName, category: src9.category, description: `${src9.description} เปิดรับคำสั่งซื้อทุกวัน 08:00–20:00` };
reportDemo('profile.edited', 1);
go();
assertStep('ยืนยัน');
assertBlocked();
const before9 = { merchants: S.useMerchantStore.getState().items.length, apps: S.useVerificationStore.getState().items.length, certs: JSON.stringify(S.useCertificationStore.getState().items.filter((c) => c.merchantId === 'M-005')) };
const up = actAs('merchant', () => V.confirmProfileUpdate(conn.id, edited9, 'DRF-TEST-S9'));
check(up.ok && up.record?.mode === 'profile_update' && up.record.applied.join() === 'description' && up.record.pending.length === 0, '  ยืนยันอัปเดต: บันทึกเฉพาะคำอธิบายที่แก้ (ชื่อร้าน/หมวดตรงกับต้นฉบับ)');
check(
  S.useMerchantStore.getState().items.length === before9.merchants && S.useVerificationStore.getState().items.length === before9.apps && JSON.stringify(S.useCertificationStore.getState().items.filter((c) => c.merchantId === 'M-005')) === before9.certs,
  '  ไม่สร้างร้านหรือคำขอใหม่ และใบรับรอง Level 3 เดิมไม่เปลี่ยน',
);
check(actAs('merchant', () => V.confirmProfileUpdate(conn.id, edited9, 'DRF-TEST-S9')).duplicate === true && S.useImportRecordStore.getState().items.filter((r) => r.merchantId === 'M-005').length === 1, '  กดยืนยันซ้ำ → บันทึกเดิม ไม่สร้างซ้ำ');
const rawOf = (x: ReturnType<typeof V.sourceOfConnection>) => JSON.stringify({ ...x, importedAt: '' });
const src9After = V.sourceOfConnection(S.useMarketplaceStore.getState().items.find((c) => c.id === conn.id)!, S.useMerchantStore.getState().items.find((m) => m.id === 'M-005')!);
check(rawOf(src9After) === rawOf(src9) && src9After.rating === src9.rating && src9After.reviewCount === src9.reviewCount && src9After.salesVolume === src9.salesVolume, '  ข้อมูลต้นฉบับจาก Marketplace (คะแนน รีวิว ยอดขาย ราคา) ไม่เปลี่ยนหลังแก้โปรไฟล์');
go();
check(demo().current.importId === up.record?.id, `  บันทึก Import ID ${up.record?.id}`);
page = assertStep('Overview');
check(cur === `/m/marketplace/data/${conn.id}` && page.includes(live.mockShopId) && page.includes('Data Availability') && page.includes('ข้อมูลผู้ซื้อ') && page.includes('Lazada (จำลอง)'), '  Data Overview: Shop ID จำลอง, แหล่งข้อมูล, Data Availability');
check(go() === 'completed' && cur === '/demo/complete/s9', 'จบ Scenario 9 → หน้าสรุป');
page = view(cur);
check(page.includes('ดำเนินการต่อ: วิเคราะห์พฤติกรรมการขาย') && page.includes('ทางเลือก 9A') && page.includes('ทางเลือก 9B') && page.includes(conn.id) && page.includes('อัปเดตโปรไฟล์ร้านเดิม'), '  สรุปมี CTA ไป Scenario 10 ทางเลือก 9A/9B และสรุปการอัปเดตโปรไฟล์');
check(demo().journey.connectionId === conn.id && demo().journey.merchantId === 'M-005', '  ส่งต่อ Merchant ID และ Connection ID');

describe('Full Journey v2 — Scenario 10: วิเคราะห์พฤติกรรมการขาย');
check(!C.continuityIssue('s10'), 'ข้อมูลจาก Scenario 9 ใช้ต่อได้');
C.continueToNext('s9', nav);
check(demo().current.connectionId === conn.id && !demo().current.notice, 'ใช้การเชื่อมต่อเดิม (ไม่ใช้ข้อมูลตัวอย่าง)');
assertStep();
go();
check(assertStep('ราคา').includes('ราคากลางอ้างอิง') && view(cur).includes('ไม่ใช่หลักฐานว่าร้านทุจริต'), '  Price Analysis: เทียบราคากลาง และระบุว่าราคาไม่ใช่หลักฐานการทุจริต');
go();
check(assertStep('ยอดขาย').includes('จำนวนคำสั่งซื้อ'), '  Sales Volume Analysis');
go();
check(assertStep('รีวิว').includes('ความครอบคลุมของรีวิว'), '  Review Analysis: ความครอบคลุมของรีวิว');
go();
page = assertStep('สัญญาณ');
check(page.includes('ความเสี่ยงจากข้อมูลตัวอย่าง') && page.includes('ข้อมูลที่ยังไม่สามารถประเมินได้'), '  Risk Signals: ความเสี่ยงจากข้อมูลตัวอย่าง และข้อมูลที่ยังประเมินไม่ได้');
go();
page = assertStep('เปรียบเทียบ');
check(COMPARISON_CASES.every((c) => page.includes(c.title)) && page.includes('ทำไมคะแนนดาวใกล้เคียงกันจึงให้ผลต่างกัน'), '  Interactive Comparison 4 กรณี + คำอธิบายคะแนนดาว');
assertBlocked();
reportDemo('analysis.compare', true);
go();
check(assertStep('สรุป').includes('Analysis Summary'), '  Analysis Summary');
check(go() === 'completed', 'จบ Scenario 10');

describe('Full Journey v2 — Scenario 11: ประเมินความน่าเชื่อถือร้านค้า');
C.continueToNext('s10', nav);
assertStep();
assertBlocked();
const tas = actAs('merchant', () => V.runAssessment('M-005'))!;
go();
check(demo().current.assessmentId === tas.id, `  บันทึก Assessment ID ${tas.id}`);
page = assertStep('5 มิติ');
check(['Identity & Business', 'Sales Performance', 'Customer Experience', 'Price Transparency', 'Compliance'].every((x) => page.includes(x)) && page.includes('น้ำหนัก 25%'), '  แสดง 5 มิติพร้อมน้ำหนักจาก Configuration');
check(!page.includes('คะแนน (เฉพาะเจ้าหน้าที่)') && !page.includes(`คะแนน ${tas.result.components[0].score}/100`), '  มุมร้านค้าไม่แสดงคะแนนภายใน');
for (let k = 0; k < 4; k++) go();
check(assertStep('ข้อมูลที่ควรเพิ่มเติม').includes('ข้อมูลที่ควรเพิ่มเติม'), '  มีรายการข้อมูลที่ควรเพิ่มเติม');
go();
assertBlocked();
check(actAs('merchant', () => V.submitAssessment(tas.id)).ok, '  ร้านกดส่งให้เจ้าหน้าที่พิจารณา');
const linkedApp = S.useAssessmentStore.getState().items.find((a) => a.id === tas.id)!.applicationId!;
const appRec = S.useVerificationStore.getState().items.find((a) => a.id === linkedApp)!;
check(!!appRec && appRec.type === 'certification' && appRec.merchantId === 'M-005' && appRec.status === 'submitted', `  ผูกกับคำขอรับรอง ${linkedApp} ผ่าน กระบวนการรับรอง (ยังไม่อนุมัติ)`);
check(S.useCertificationStore.getState().items.filter((c) => c.merchantId === 'M-005' && c.status === 'active').every((c) => c.level === 3), '  ยังไม่มีการออก Badge อัตโนมัติ');
check(go() === 'transition→moved' && session().role === 'officer', 'Role Transition → มุมเจ้าหน้าที่');
check(demo().current.applicationId === linkedApp, '  บันทึก Application ID');
page = assertStep('Calculation');
check(page.includes('คะแนน (เฉพาะเจ้าหน้าที่)') && page.includes('วิธีคำนวณ') && page.includes(linkedApp), '  เจ้าหน้าที่เห็นคะแนน วิธีคำนวณ และคำขอที่ผูกไว้');
check(go() === 'transition→moved' && session().role === 'consumer', 'Role Transition → มุมผู้บริโภค');
page = assertStep('Consumer');
check(page.includes('Coverage') && !page.includes('คะแนน (เฉพาะเจ้าหน้าที่)') && page.includes('ไม่ใช่การรับประกัน'), '  ผู้บริโภคเห็น Band/Coverage ไม่เห็นคะแนน และมีข้อความว่าไม่ใช่การรับประกัน');
check(go() === 'completed', 'จบ Scenario 11');

describe('Full Journey v2 — Scenario 12: เจ้าหน้าที่พิจารณาการรับรอง');
C.continueToNext('s11', nav);
check(demo().current.assessmentId === tas.id && demo().current.applicationId === linkedApp && demo().current.connectionId === conn.id, 'ใช้ Assessment / Application / Connection ID เดิม');
check(assertStep('คิว').includes(tas.id), '  คิวรอพิจารณามีผลประเมินเดิม');
go();
page = assertStep('Application');
check(cur === `/o/applications/${linkedApp}` && page.includes('e-KYC ผ่าน') && page.includes('Marketplace Evidence') && page.includes(live.mockShopId), '  Application Detail: สถานะยืนยันตัวตน และหลักฐานจาก Marketplace');
go();
go();
go();
page = assertStep('Eligibility');
check(page.includes('เกณฑ์การรับรอง ของ Level 4'), '  Certification Eligibility: เกณฑ์การรับรอง');
go();
assertBlocked();
asOfficer();
check(!actAs(['officer', 'admin'], () => V.decideAssessment(tas.id, 'approved', 'ok', 4)).ok, '  ต้องระบุเหตุผล (≥ 5 ตัวอักษร)');
check(actAs(['officer', 'admin'], () => V.decideAssessment(tas.id, 'approved', 'ผลประเมินและเกณฑ์การรับรอง ผ่านครบ', 4)).ok, '  เจ้าหน้าที่อนุมัติ Level 4');
const approved = S.useVerificationStore.getState().items.find((a) => a.id === linkedApp)!;
const newCert = S.useCertificationStore.getState().items.find((c) => c.merchantId === 'M-005' && c.status === 'active')!;
check(approved.status === 'approved' && newCert.level === 4, `  คำขอเดิม ${linkedApp} อนุมัติ → ใบรับรอง ${newCert.id} Level 4 (Certification กระบวนการรับรอง)`);
check(S.useVerificationStore.getState().items.filter((a) => a.merchantId === 'M-005' && a.type === 'certification' && a.submittedAt >= tas.createdAt).length === 1, '  ไม่มีคำขอซ้ำ');
check(S.useAuditStore.getState().items.some((x) => x.target === tas.id && x.action.includes('พิจารณาผลประเมิน')) && S.useAuditStore.getState().items.some((x) => x.target === linkedApp && x.action === 'อนุมัติคำขอ'), '  บันทึก Audit Log ทั้งผลประเมินและคำขอ');
go();
check(demo().current.certId === newCert.id, '  บันทึก Certificate ID');
check(session().role === 'merchant' && assertStep('Notification').includes('ได้รับอนุมัติ'), 'Role Transition → ร้านค้าเห็นการแจ้งเตือน');
go();
check(assertStep('Result').includes(newCert.id), '  ร้านค้าเห็นใบรับรองที่อัปเดต');
check(go() === 'completed' && view(cur).includes('ดำเนินการต่อ: ผู้บริโภคตรวจสอบร้านก่อนซื้อ'), 'จบ Scenario 12 → CTA ไป Scenario 13');

describe('Full Journey v2 — Scenario 13: ผู้บริโภคตรวจสอบร้านค้าก่อนซื้อ');
C.continueToNext('s12', nav);
check(demo().current.merchantId === 'M-005' && demo().current.certId === newCert.id, 'ใช้ Merchant ID และใบรับรองเดียวกับ Scenario 12');
assertStep();
check(go() === 'transition→moved' && session().role === 'consumer', 'Role Transition → ผู้บริโภค');
assertStep('ค้นหา');
go();
assertStep('QR');
assertBlocked();
reportDemo('verify.viewed', newCert.id);
go();
page = assertStep('Profile');
check(page.includes('ร้านกาแฟดอยสูง') && !page.includes('0810000005') && !page.includes('arthit@demo.local'), '  โปรไฟล์ร้านไม่แสดงข้อมูลติดต่อส่วนตัวของเจ้าของ');
go();
go();
go();
check(assertStep('Channels').includes('ร้านบน Marketplace ที่เชื่อมต่อข้อมูลแล้ว'), '  Verified Sales Channels รวมร้านบน Marketplace (จำลอง)');
go();
check(assertStep('Cert').includes(newCert.id), '  Certification Status');
go();
assertBlocked();
reportDemo('marketplace.preview', true);
check(go() === 'completed' && cur === '/demo/complete/s13', 'จบ Scenario 13');
check(view(cur).includes('ดูสรุปผลกระทบ (Executive Impact Summary)'), '  CTA ไป Executive Impact Summary');
check(journeyScenarios('v2').every((s) => C.scenarioStatus(s.id) === 'completed'), 'Journey v2: ทั้ง 5 Scenario สถานะ Completed');
page = view('/demo/v2/summary');
check(page.includes('Executive Impact Summary') && page.includes('ร้านกาแฟดอยสูง') && page.includes('Level 4') && page.includes('5/5'), 'Executive Impact Summary แสดงผลของร้านใน Journey');
integrity('Full Journey v2');

// ================================================================ Branch 9B
describe('เส้นทางทางเลือก 9B — ร้านที่ไม่มีบัญชี Marketplace');
C.startScenario('s9b', nav);
check(demo().current.operatorId === 'OP-012' && !S.useMerchantStore.getState().items.some((m) => m.operatorId === 'OP-012'), 'เริ่มด้วยบัญชีที่ยืนยันตัวตนแล้วและยังไม่มีร้าน');
assertStep();
go();
check(assertStep('ไม่มี Marketplace').includes('ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง'), '  หน้า Marketplace มีทางเลือก "ไม่มีร้านบน Marketplace"');
assertBlocked();
reportDemo('mkt.none', true);
go();
assertBlocked();
reportDemo('shop.step', 4);
go();
assertBlocked();
reportDemo('shop.step', 5);
go();
assertBlocked();
const op12 = S.useOperatorStore.getState().items.find((o) => o.id === 'OP-012')!;
const { merchant: selfShop, app: selfApp } = actAs('merchant', () => W.submitShopRegistration('OP-012', {
  businessType: 'individual', ownerName: op12.name, shopName: 'ร้านผ้าทอริมทาง', category: 'แฟชั่นและเครื่องแต่งกาย', province: 'น่าน', district: 'เมือง', phone: op12.phone, email: op12.email,
  description: 'ขายผ่าน Facebook และหน้าร้านในตลาดชุมชน ไม่มีร้านบน Marketplace', channels: [{ type: 'facebook', handle: 'pha.tor.demo' }],
  documents: [{ id: 'd-b', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 1, addedAt: new Date().toISOString() }],
}));
go();
check(demo().current.merchantId === selfShop.id && demo().current.applicationId === selfApp.id, `  บันทึก Merchant ${selfShop.id} และคำขอ ${selfApp.id}`);
assertStep('Assessment');
assertBlocked();
const selfTas = actAs('merchant', () => V.runAssessment(selfShop.id))!;
const r = selfTas.result;
check(r.band === 'insufficient' && r.recommendation.kind === 'need_more_data', '  ผลประเมิน = Insufficient Data → ควรขอข้อมูลเพิ่ม');
check(r.components.filter((c) => ['C2', 'C3', 'C4'].includes(c.id)).every((c) => !c.available && c.contribution === 0) && r.components.find((c) => c.id === 'C1')!.available, '  มิติ Marketplace ไม่ถูกนับ (ไม่ใช่ศูนย์) — ไม่เสียคะแนนเพราะไม่มีบัญชี');
go();
check(assertStep('Evidence').includes('Insufficient Data'), '  ร้านเห็น Insufficient Data');
assertBlocked();
check(actAs('merchant', () => V.submitAssessment(selfTas.id)).ok, '  ร้านส่งให้เจ้าหน้าที่พิจารณาได้ (ขอหลักฐานเพิ่มเติม)');
check(S.useAssessmentStore.getState().items.find((a) => a.id === selfTas.id)!.applicationId === selfApp.id, '  ผูกกับคำขอลงทะเบียนเดิม (ไม่สร้างคำขอใหม่)');
check(go() === 'transition→moved' && session().role === 'officer', 'Role Transition → เจ้าหน้าที่');
check(assertStep('Officer').includes('Insufficient Data'), '  เจ้าหน้าที่เห็นผล Insufficient Data ในคำขอลงทะเบียน');
go();
assertBlocked();
asOfficer();
check(actAs(['officer', 'admin'], () => V.decideAssessment(selfTas.id, 'need_info', 'กรุณาส่งภาพหน้าร้านและหลักฐานการขายย้อนหลัง 3 เดือน')).ok, '  เจ้าหน้าที่ขอหลักฐานเพิ่มเติม');
check(S.useVerificationStore.getState().items.find((a) => a.id === selfApp.id)!.status === 'need_info' && S.useMerchantStore.getState().items.find((m) => m.id === selfShop.id)!.registrationStatus === 'need_info', '  คำขอลงทะเบียนเดิมเปลี่ยนเป็น "ขอข้อมูลเพิ่ม" ผ่าน กระบวนการรับรอง');
check(go() === 'transition→moved' && assertStep('Merchant').includes('ขอข้อมูลเพิ่มเติม'), 'ร้านค้าได้รับแจ้งให้ส่งหลักฐานเพิ่ม');
check(go() === 'completed' && view(cur).includes('ดูสรุปผลกระทบ'), 'จบเส้นทางทางเลือก → CTA สรุป v2');
integrity('เส้นทาง 9B');

describe('เส้นทาง 9B แทรกระหว่าง Journey v2');
C.startJourney(nav, 'v2');
C.completeScenario(nav);
C.startScenario('s9b', nav, { carry: true });
check(demo().journeyMode && demo().journeyTrack === 'v2' && demo().activeScenario === 's9b', 'เล่น 9B ระหว่าง Journey โดยไม่ออกจาก Journey v2');
C.completeScenario(nav);
check(C.nextUnfinished('v2') === 's10' && view(cur).includes('กลับสู่ Full Journey: Marketplace & Trust: Scenario 10'), 'หน้าสรุป 9B มีปุ่มกลับสู่ Journey ที่ Scenario 10');

// ================================================================ continuity
describe('ความต่อเนื่อง — ข้อมูลจากขั้นก่อนหน้าไม่ครบ');
C.startJourney(nav, 'v2');
const issue12 = C.continuityIssue('s12');
check(!!issue12 && issue12.fixScenario === 's11', `ข้ามไป Scenario 12 ก่อนส่งผลประเมิน → แจ้งเหตุผลและให้กลับไป Scenario 11 (${issue12?.message})`);
C.startScenario('s12', nav, { carry: true, journey: true });
check(!!demo().current.notice && !!demo().current.assessmentId && !!demo().current.applicationId, '  เลือกใช้ข้อมูลตัวอย่าง → แสดงหมายเหตุตลอดเรื่อง และมี Assessment/Application ID');
check(view(cur).length > 0 && session().role === 'officer', '  เปิดหน้าคิวเจ้าหน้าที่ได้ ไม่เกิด Error');
integrity('ใช้ข้อมูลตัวอย่างใน Scenario 12');

// ================================================================ Standalone
describe('Scenario v2 แบบเดี่ยว (Fixture)');
for (const s of v2Scenarios) {
  C.startScenario(s.id, nav);
  check(demo().activeScenario === s.id && !demo().journeyMode && demo().stepIndex === 0, `S${scenarioCode(s)} เริ่มแบบเดี่ยว → ${cur}`);
  assertStep();
  const p = integrityProblems();
  check(p.length === 0, `  จุดเริ่มต้นสอดคล้องกัน${p.length ? ' — ' + p.slice(0, 2).join(' | ') : ''}`);
  const startData = JSON.stringify(S.domainStores.map((x) => x.getState().items));
  C.restartScenario(nav);
  check(JSON.stringify(S.domainStores.map((x) => x.getState().items)) === startData, '  Restart Scenario ได้จุดเริ่มต้นเดิมทุกไบต์');
}
C.startScenario('s10', nav);
check(S.useMarketplaceStore.getState().items.find((c) => c.id === demo().current.connectionId)?.status === 'connected', 'S10 เดี่ยว: มีการเชื่อมต่อที่ซิงก์แล้ว');
C.startScenario('s12', nav);
check(S.useAssessmentStore.getState().items.find((a) => a.id === demo().current.assessmentId)?.status === 'pending_review' && !!demo().current.applicationId, 'S12 เดี่ยว: ผลประเมินรอพิจารณาพร้อมคำขอ');
C.startScenario('s13', nav);
check(S.useAssessmentStore.getState().items.find((a) => a.id === demo().current.assessmentId)?.status === 'decided' && !!demo().current.certId, 'S13 เดี่ยว: เจ้าหน้าที่พิจารณาแล้วและมีใบรับรอง');
check(session().role === 'merchant', '  Fixture คืนบทบาทเดิมหลังจำลองการพิจารณา');

// ================================================================ engine rule
describe('ข้อเสนอของระบบสอดคล้องกับ Level (D3)');
const pending = actAs('merchant', () => V.runAssessment('M-002'))!;
check(pending.result.recommendation.kind !== 'consider_l3' && pending.result.recommendation.kind !== 'consider_l4', 'ร้านที่ยังไม่ผ่านการลงทะเบียน (Level < 2) ไม่ได้รับข้อเสนอ "ประกอบการพิจารณา Level 3"');

finish();
