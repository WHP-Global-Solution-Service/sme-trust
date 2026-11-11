/** หน้า Demo — Demo หลักเส้นเดียว · กรณีพิเศษ · ผลลัพธ์โดยตรงและฟังก์ชันอื่นพับไว้ · ไม่มีเลข Scenario / Full Journey · ไม่กระทบโมเดลเดิม */
import { check, describe, finish, viewHtml } from '../harness.mts';

const P = await import('@/features/demo/DemoScenariosPage');
const M = await import('@/demo/main');
const SC = await import('@/mock/scenarios');
const S = await import('@/stores');
const W = await import('@/stores/workflows');
const { MODEL_V2 } = await import('@/features/trust-assessment/model');

const consumer = { role: 'consumer' as const, consumerId: 'CS-001' };
const html = viewHtml('/demo', consumer).replace(/<!-- -->/g, '');
/** ข้อความที่ผู้ใช้เห็น (ตัด Tag/Attribute ออก) */
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const before = (a: string, b: string) => html.indexOf(a) >= 0 && html.indexOf(b) > html.indexOf(a);
const main = SC.findScenario(M.MAIN_JOURNEY_ID)!;

describe('Primary Action เดียว — ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ');
check(visible.includes('ทดลองใช้งาน SME Trust') && visible.includes('สาธิตตั้งแต่เชื่อมข้อมูลร้านค้า ลงทะเบียน ตรวจสอบอัตโนมัติ ประเมินความน่าเชื่อถือ'), 'หัวข้อและคำอธิบายสั้น');
check((html.match(/data-testid="main-cta"/g) ?? []).length === 1 && M.MAIN_CTA_LABEL === 'ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ' && visible.includes(M.MAIN_CTA_LABEL), 'CTA หลักปุ่มเดียว "ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ"');
check(P.MAIN_JOURNEY_ID === M.MAIN_JOURNEY_ID && main.id === 's9a' && main.title === M.MAIN_CTA_LABEL, 'CTA เปิดการสาธิตที่มีอยู่จริง และชื่อการสาธิตตรงกับปุ่ม');
check(!/นาที/.test(visible.slice(0, visible.indexOf('สิ่งที่จะได้เห็นใน Demo หลัก'))), 'ไม่แสดงเวลาโดยประมาณที่ยังไม่ได้วัดกับผู้ใช้จริง');

describe('Demo หลัก — ขั้นตอนตรงกับการสาธิตจริง ใช้ร้านเดียวกัน ไม่มีเจ้าหน้าที่');
const flowSteps = [...new Set(P.RECOMMENDED_FLOW.flatMap((s) => s.steps))];
check(JSON.stringify(flowSteps) === JSON.stringify(main.steps.map((s) => s.id)), `ขั้นที่แสดงครอบคลุมทุกขั้นของการสาธิตตามลำดับ (${flowSteps.length} ขั้นในตัวควบคุม)`);
check(JSON.stringify(P.RECOMMENDED_FLOW.map((s) => s.title)) === JSON.stringify(['เชื่อมข้อมูลร้านค้า', 'ลงทะเบียน', 'ตรวจสอบอัตโนมัติ', 'ประเมินความน่าเชื่อถือ', 'แสดงผล Badge', 'ผู้บริโภคตรวจสอบ']), 'เชื่อมข้อมูลร้านค้า → ลงทะเบียน → ตรวจสอบอัตโนมัติ → ประเมิน → แสดงผล Badge → ผู้บริโภคตรวจสอบ');
check(!main.steps.some((s) => s.role === 'officer'), 'Demo หลักไม่มีขั้นตอนเจ้าหน้าที่');
const mainSection = html.slice(html.indexOf('data-testid="main-journey"'), html.indexOf('data-testid="case-section"'));
check(!/<button/.test(mainSection) && visible.includes('ใช้ร้านค้าเดียวกันตลอดทุกขั้น'), 'ส่วนอธิบาย Demo หลักไม่มีปุ่มเริ่มซ้ำ และระบุว่าใช้ร้านเดียวกันทุกขั้น');
check(visible.includes('ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่') && visible.includes('ไม่ออกใบรับรองให้อัตโนมัติ') && visible.includes('ระบบแสดงสถานะจริงแทน Badge'), 'ไม่ออกใบรับรองอัตโนมัติ · ไม่สร้าง Badge หลอก');

describe('กรณีพิเศษ — เฉพาะที่ยังจำเป็น ใช้กระบวนการจริง');
check(JSON.stringify(P.SPECIAL_CASES.map((c) => c.scenario)) === JSON.stringify([...M.SPECIAL_CASE_IDS]) && JSON.stringify([...M.SPECIAL_CASE_IDS]) === JSON.stringify(['s9b', 's15', 's6']), 'กรณีข้อมูลยังไม่พอ · ข้อมูลไม่ตรงกัน · ร้านถูกระงับ');
check((html.match(/data-testid="case-card"/g) ?? []).length === 3 && P.SPECIAL_CASES.every((c) => visible.includes(SC.findScenario(c.scenario)!.title)), 'การ์ดกรณีพิเศษ 3 ใบ แสดงชื่อที่เข้าใจง่าย');
check(!SC.findScenario('s9b')!.steps.some((s) => s.role === 'officer') && SC.findScenario('s15')!.steps.some((s) => s.role === 'officer'), 'กรณีข้อมูลไม่พอไม่มีเจ้าหน้าที่ · กรณีข้อมูลไม่ตรงกันมีเจ้าหน้าที่ (Human by Exception)');
check(visible.includes('เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ — ไม่ใช่ขั้นตอนของร้านค้าปกติ'), 'ระบุว่าเจ้าหน้าที่ตรวจเฉพาะกรณีผิดปกติ');
check(S.useVerificationStore.getState().items.filter((a) => a.merchantId === 'M-002' && a.type === 'registration').every((a) => a.autoDecision?.route !== 'AUTO_REQUEST_INFO') && visible.includes('ไม่ใช่ผลการตรวจคำขอลงทะเบียน'), 'ร้านตัวอย่าง M-002 ระบุว่าเป็นผลประเมิน ไม่ใช่ผลการตรวจคำขอลงทะเบียน (ไม่อ้างเกินข้อมูล)');

describe('ผลลัพธ์โดยตรง — ใช้ข้อมูลจำลองที่มีอยู่ ไม่สร้าง Badge/ผลประเมินปลอม');
check(JSON.stringify(P.RESULT_VIEWS.map((r) => r.view)) === JSON.stringify(['assessment', 'badge', 'consumer']), 'ผลประเมิน · Badge · การตรวจสอบของผู้บริโภค เปิดดูได้โดยไม่ต้องเริ่ม Demo ใหม่');
W.resetAllDemoData();
const badgesNow = () => S.useAssessmentBadgeStore.getState().items;
const merchantsNow = () => S.useMerchantStore.getState().items;
const counts = () => JSON.stringify([badgesNow().length, S.useAssessmentStore.getState().items.length]);
const countsBefore = counts();
check(P.exampleShop('active', badgesNow(), merchantsNow())?.id === 'M-001', 'ร้านตัวอย่าง Badge = M-001 (Badge active จากกฎเดิม)');
check(P.exampleShop('request_info', badgesNow(), merchantsNow())?.id === 'M-002', 'ร้านตัวอย่างข้อมูลไม่พอ = M-002');
check(counts() === countsBefore, 'การเลือกร้านตัวอย่างไม่สร้าง Badge หรือผลประเมินใหม่');
check(P.exampleShop('active', badgesNow().map((x) => ({ ...x, status: x.status === 'active' ? ('withheld' as const) : x.status })), merchantsNow()) === undefined, 'ไม่มีร้านที่ Badge active → ไม่มีร้านตัวอย่าง (ปุ่มถูกปิด ไม่สร้างข้อมูลแทน)');

describe('ส่วนเพิ่มเติมพับไว้ · ไม่มีรายการ Scenario จำนวนมาก');
const details = html.match(/<details[^>]*data-testid="(results-section|other-demos)"[^>]*>/g) ?? [];
check(details.length === 2 && details.every((t) => !/\sopen(=|\s|>)/.test(t)), 'ผลลัพธ์โดยตรง และฟังก์ชันอื่นของระบบ พับไว้เป็นค่าเริ่มต้น');
check(JSON.stringify([...P.OTHER_DEMOS]) === JSON.stringify(['s1', 's2', 's4', 's5', 's7', 's8']) && (html.match(/data-testid="other-demo"/g) ?? []).length === 6, 'ฟังก์ชันอื่นของระบบ 6 เรื่อง (ร้องเรียน คำเตือน การรับรอง AI สมัครสมาชิก)');
const firstScreen = html.slice(html.indexOf('data-testid="demo-hero"'), html.indexOf('data-testid="secondary-section"'));
check((firstScreen.match(/<button/g) ?? []).length === 6, 'หน้าจอแรก (ก่อนส่วนพับ) มีปุ่ม 6 ปุ่ม: CTA หลัก 1 + กรณีพิเศษ (2 + 2 + 1)');
check(before('data-testid="demo-hero"', 'data-testid="main-journey"') && before('data-testid="main-journey"', 'data-testid="case-section"') && before('data-testid="case-section"', 'data-testid="secondary-section"') && before('data-testid="secondary-section"', 'data-testid="scope-legend"'), 'ลำดับ: CTA หลัก → Demo หลัก → กรณีพิเศษ → ดูเพิ่มเติม → ขอบเขต');
const reachable = new Set([M.MAIN_JOURNEY_ID, ...M.SPECIAL_CASE_IDS, ...M.OTHER_DEMO_IDS]);
check(SC.allScenarios.length === 10 && SC.allScenarios.every((s) => reachable.has(s.id)), `ทุกการสาธิตที่คงไว้ (${SC.allScenarios.length}) เปิดได้จากหน้า Demo`);
check(JSON.stringify(M.DEMO_GROUPS.flatMap((g) => [...g.ids])) === JSON.stringify([...reachable]), 'เมนู Demo Mode เรียงตามความสำคัญเดียวกัน (Demo หลัก → กรณีพิเศษ → ฟังก์ชันอื่น)');

describe('ภาษาบนหน้าจอ — ไม่มีเลข Scenario / Full Journey / v1-v2 · ไม่อ้างว่าเชื่อมระบบจริง');
check(!/Scenario|Full Journey|\b9A\b|\b9B\b/.test(visible), 'ไม่มีเลข Scenario หรือ Full Journey ที่ผู้ใช้เห็น');
check(!/\bv[12]\b/i.test(visible), 'ไม่มีป้าย v1 / v2');
check(visible.includes('MVP') && visible.includes('Prototype') && visible.includes('Future Integration') && visible.includes('ข้อจำกัดความรับผิดชอบ (Prototype Disclaimer)'), 'แยก MVP · Prototype · Future Integration และมี Disclaimer');
check(!/เชื่อม(ต่อ)? ?API ?จริงแล้ว|ได้รับการรับรองจาก สคบ|มีฐานข้อมูลกลางแล้ว/.test(visible), 'ไม่อ้างว่าเชื่อม API จริง · สคบ. รับรอง · มีฐานข้อมูลกลางแล้ว');
const home = viewHtml('/', consumer).replace(/<[^>]+>/g, ' ');
check(home.includes(M.MAIN_CTA_LABEL) && !/Scenario \d|Full Journey/.test(home), 'หน้าแรกมี Primary Action เดียวกัน และไม่มีเลข Scenario / Full Journey');

describe('ไม่กระทบโมเดลการประเมิน');
check(MODEL_V2.version === 'v2.1-sim' && JSON.stringify(MODEL_V2.weights) === JSON.stringify({ C1: 25, C2: 25, C3: 20, C4: 10, C5: 20 }) && JSON.stringify(MODEL_V2.bands) === JSON.stringify({ A: 80, B: 65, C: 50 }) && MODEL_V2.bandA.minCoverage === 70 && JSON.stringify(MODEL_V2.minimums) === JSON.stringify({ orders: 30, reviews: 10, months: 3 }), 'Model v2.1-sim · น้ำหนัก · Threshold · ขั้นต่ำ ไม่เปลี่ยน');

finish();
