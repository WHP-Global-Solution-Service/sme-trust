/**
 * Demo (Marketplace & Trust) — ขับ Demo Controller จริงทีละขั้นแบบเดียวกับ UI: Demo หลัก (s9a) · กรณีร้านไม่มี Marketplace (s9b) 9B,
 * Scenario แบบเดี่ยว และการแจ้งเมื่อข้อมูลจากขั้นก่อนหน้าไม่ครบ — Business Action ทำผ่าน Workflow เดิมเท่านั้น
 */
import { S, W, view, describe, check, finish, actAs, asOwner } from '../harness.mts';
import { integrityProblems } from '../integrity.mts';

const { scenarios, v2Scenarios, findScenario } = await import('@/mock/scenarios');
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
  check(ok, `${sc().id}.${demo().stepIndex + 1}/${sc().steps.length} ${s.title} — ${s.role} @ ${cur}${label ? ` · ${label}` : ''}`);
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
describe('โครงสร้าง Demo (ไม่มี Full Journey · ไม่แสดงเลข Scenario)');
check(scenarios.length === 7, 'ฟังก์ชันอื่นของระบบ 7 เรื่อง');
check(JSON.stringify(v2Scenarios.map((s) => s.id)) === JSON.stringify(['s9a', 's9b']), 'Marketplace & Trust: Demo หลัก (s9a) และกรณีร้านไม่มี Marketplace (s9b) — เรื่องที่ซ้ำกับ Demo หลักถูกยกเลิก');
check(findScenario('s9a')!.title === 'ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ' && !/Scenario|\b9A\b|\b9B\b/.test(v2Scenarios.map((s) => s.title).join(' ')), 'ชื่อการสาธิตเป็นภาษาที่เข้าใจได้ ไม่มีเลข Scenario');
check(['s3', 's9', 's10', 's11', 's12', 's13', 's14'].every((id) => !findScenario(id)), 'เรื่องที่ซ้ำหรือล้าสมัยถูกยกเลิก (ไม่มีลิงก์ค้าง)');
for (const s of v2Scenarios) {
  const missing = s.steps.filter((st, i) => i > 0 && st.role !== s.steps[i - 1].role && !st.transition).map((st) => st.id);
  check(missing.length === 0 && new Set(s.steps.map((x) => x.id)).size === s.steps.length && !!s.benefits.ocpb, `${s.id}: Role Transition ครบ, Step ID ไม่ซ้ำ, มีประโยชน์ต่อ สคบ.`);
}

// ================================================================ Comparison (Analysis Engine)
describe('กรณีเปรียบเทียบ 4 กรณี — ใช้ Analysis Engine เดิม');
const cases = Object.fromEntries(COMPARISON_CASES.map((c) => [c.id, analyzeCase(c.id)]));
check(COMPARISON_CASES.length === 4, 'มี 4 กรณีตามโจทย์');
check(cases.cheap_popular.price.findings.some((f) => f.kind === 'below_reference') && cases.cheap_popular.price.watchCount === 0, 'ราคาต่ำ ยอดขายสูง รีวิวมาก → เป็นข้อสังเกต ไม่ใช่สัญญาณความเสี่ยง (มีหลักฐานสนับสนุน)');
check(cases.premium_niche.price.findings.every((f) => f.kind === 'above_reference' && f.level === 'info') && cases.premium_niche.sales.totalOrders < 100, 'ราคาสูง ยอดขายน้อย → ข้อสังเกตเท่านั้น ไม่หักคะแนน');
check(cases.new_shop.sales.totalOrders < 30, 'ร้านใหม่ → คำสั่งซื้อต่ำกว่าขั้นต่ำ');
check(!!cases.review_burst.reviews.burst && Math.abs(cases.review_burst.reviews.avgRating - cases.cheap_popular.reviews.avgRating) < 0.3, `รีวิวผิดธรรมชาติ: ดาวใกล้เคียงกรณีที่ 1 (${cases.review_burst.reviews.avgRating.toFixed(2)} vs ${cases.cheap_popular.reviews.avgRating.toFixed(2)}) แต่ตรวจพบรีวิวกระจุกตัว`);

describe('กรณีร้านค้าไม่มี Marketplace และข้อมูลยังไม่พอ (s9b)');
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
const { merchant: selfShop, app: selfApp } = asOwner('OP-012', () => W.submitShopRegistration('OP-012', {
  businessType: 'individual', ownerName: op12.name, shopName: 'ร้านผ้าทอริมทาง', category: 'แฟชั่นและเครื่องแต่งกาย', province: 'น่าน', district: 'เมือง', phone: op12.phone, email: op12.email,
  description: 'ขายผ่าน Facebook และหน้าร้านในตลาดชุมชน ไม่มีร้านบน Marketplace', channels: [{ type: 'facebook', handle: 'pha.tor.demo' }],
  documents: [{ id: 'd-b', name: 'ทะเบียนพาณิชย์.pdf', kind: 'ทะเบียนพาณิชย์', sizeKb: 1, addedAt: new Date().toISOString() }],
}));
go();
check(demo().current.merchantId === selfShop.id && demo().current.applicationId === selfApp.id, `  บันทึก Merchant ${selfShop.id} และคำขอ ${selfApp.id}`);
// Automation First: ไม่มีบัญชี Marketplace ไม่ใช่เหตุให้รอเจ้าหน้าที่ — ระบบตรวจคำขออัตโนมัติ
check(selfApp.autoDecision?.route === 'AUTO_PASS' && selfApp.status === 'approved' && S.useMerchantStore.getState().items.find((m) => m.id === selfShop.id)!.registrationStatus === 'approved', '  ระบบตรวจคำขออัตโนมัติ → ผ่านการลงทะเบียน (AUTO_PASS)');
check(!S.useCertificationStore.getState().items.some((c) => c.merchantId === selfShop.id), '  การลงทะเบียนไม่ออกใบรับรอง');
check(assertStep('Auto').includes('ผ่านการตรวจสอบอัตโนมัติ'), '  ร้านเห็นว่าผ่านการตรวจสอบอัตโนมัติ');
check(go() === 'moved' && session().role === 'merchant', 'ไปขั้นผลประเมิน (ไม่มีขั้นเจ้าหน้าที่)');
const selfTas = V.latestAssessment(selfShop.id)!;
const r = selfTas.result;
check(selfTas.origin === 'automation' && r.band === 'insufficient' && r.recommendation.kind === 'need_more_data', '  ระบบประเมินอัตโนมัติหลังลงทะเบียน = Insufficient Data → ควรขอข้อมูลเพิ่ม');
check(r.components.filter((c) => ['C2', 'C3', 'C4'].includes(c.id)).every((c) => !c.available && c.contribution === 0) && r.components.find((c) => c.id === 'C1')!.available, '  มิติ Marketplace ไม่ถูกนับ (ไม่ใช่ศูนย์คะแนน) — C1 ตัวตนและธุรกิจยังนับ');
check(assertStep('Assessment').includes('Insufficient Data'), '  ร้านเห็น Insufficient Data');
const selfBadge = S.useAssessmentBadgeStore.getState().items.find((x) => x.merchantId === selfShop.id);
check(selfBadge?.status === 'insufficient' && selfBadge.route === 'AUTO_REQUEST_INFO', '  ไม่แสดง Badge — ระบบแจ้งร้านเพิ่มข้อมูลเอง (AUTO_REQUEST_INFO)');
check(!S.useOfficerTaskStore.getState().items.some((t) => t.merchantId === selfShop.id) && !S.useVerificationStore.getState().items.some((a) => a.merchantId === selfShop.id && !['approved', 'rejected'].includes(a.status)), '  ไม่สร้างงานหรือคำขอค้างให้เจ้าหน้าที่');
check(go() === 'transition→moved' && session().role === 'consumer', 'Role Transition → ผู้บริโภค');
check(assertStep('Consumer').includes('ข้อมูลยังไม่เพียงพอ'), '  ผู้บริโภคเห็นสถานะแทน Badge (ไม่ได้หมายความว่าร้านมีปัญหา)');
check(go() === 'completed' && view(cur).includes('จบการสาธิต') && view(cur).includes('เริ่ม Demo ใหม่'), 'จบการสาธิต → หน้าสรุปมี "จบการสาธิต" / "เริ่ม Demo ใหม่"');
check(!sc().steps.some((s) => s.role === 'officer'), '  เส้นทาง 9B ไม่มีขั้นตอนเจ้าหน้าที่');
integrity('เส้นทาง 9B');

// ================================================================ Standalone
describe('เริ่มแบบเดี่ยว (Fixture) · Restart ได้จุดเริ่มต้นเดิม');
for (const s of v2Scenarios) {
  C.startScenario(s.id, nav);
  check(demo().activeScenario === s.id && demo().stepIndex === 0, `${s.id} เริ่มแบบเดี่ยว → ${cur}`);
  assertStep();
  const p = integrityProblems();
  check(p.length === 0, `  จุดเริ่มต้นสอดคล้องกัน${p.length ? ' — ' + p.slice(0, 2).join(' | ') : ''}`);
  const startData = JSON.stringify(S.domainStores.map((x) => x.getState().items));
  C.restartScenario(nav);
  check(JSON.stringify(S.domainStores.map((x) => x.getState().items)) === startData, '  Restart Scenario ได้จุดเริ่มต้นเดิมทุกไบต์');
}
// ================================================================ engine rule
describe('ข้อเสนอของระบบสอดคล้องกับ Level (D3)');
const pending = asOwner('M-002', () => V.runAssessment('M-002'))!;
check(pending.result.recommendation.kind !== 'consider_l3' && pending.result.recommendation.kind !== 'consider_l4', 'ร้านที่ยังไม่ผ่านการลงทะเบียน (Level < 2) ไม่ได้รับข้อเสนอ "ประกอบการพิจารณา Level 3"');

finish();
