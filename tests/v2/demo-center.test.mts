/** หน้า Demo — เส้นทางหลักเส้นเดียว (9A) · Demo เฉพาะกรณี · ผลลัพธ์โดยตรงและฟังก์ชันเพิ่มเติมพับไว้ · ไม่กระทบ Scenario และโมเดลเดิม */
import { check, describe, finish, viewHtml } from '../harness.mts';

const P = await import('@/features/demo/DemoScenariosPage');
const SC = await import('@/mock/scenarios');
const S = await import('@/stores');
const W = await import('@/stores/workflows');
const { MODEL_V2 } = await import('@/features/trust-assessment/model');

const consumer = { role: 'consumer' as const, consumerId: 'CS-001' };
const html = viewHtml('/demo', consumer).replace(/<!-- -->/g, '');
/** ข้อความที่ผู้ใช้เห็น (ตัด Tag/Attribute ออก) */
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const before = (a: string, b: string) => html.indexOf(a) >= 0 && html.indexOf(b) > html.indexOf(a);

describe('Hero — ข้อความตามข้อกำหนด และ CTA หลักเพียงปุ่มเดียว');
check(visible.includes('ทดลองใช้งาน SME Trust') && visible.includes('สาธิตการลงทะเบียนร้านค้า ประเมินความน่าเชื่อถือ และตรวจสอบผลผ่านระบบอัตโนมัติ') && visible.includes('เส้นทางหลักเส้นเดียว'), 'Title · Subtitle · Highlight "เส้นทางหลักเส้นเดียว"');
check((html.match(/data-testid="main-cta"/g) ?? []).length === 1 && P.MAIN_CTA_LABEL === 'ทดลองกระบวนการ SME Trust ตั้งแต่ต้น' && visible.includes(P.MAIN_CTA_LABEL) && !visible.includes('เริ่มสาธิตตั้งแต่ต้น'), 'มี CTA หลัก "ทดลองกระบวนการ SME Trust ตั้งแต่ต้น" ปุ่มเดียว (ไม่มีปุ่มเริ่มเส้นทางหลักซ้ำ)');
const main = SC.findScenario(P.MAIN_JOURNEY_ID)!;
check(!!main && main.id === 's9a', `CTA หลักเชื่อมกับ Scenario ที่มีอยู่จริง (${P.MAIN_JOURNEY_ID}: ${main?.title})`);
// เส้นทางหลักต้องแสดง Automation First ครบ: ลงทะเบียน → ตรวจข้อมูลอัตโนมัติ → AUTO_PASS → ประเมิน → ผู้บริโภค และไม่มีขั้นตอนเจ้าหน้าที่
const mainIds = main.steps.map((s) => s.id);
check(['s9a-submit', 's9a-auto', 's9a-assess', 's9a-consumer'].every((id, k, arr) => mainIds.indexOf(id) >= 0 && (k === 0 || mainIds.indexOf(id) > mainIds.indexOf(arr[k - 1]))) && !main.steps.some((s) => s.role === 'officer'), 'เส้นทางหลักครอบคลุม ส่งคำขอ → ผ่านอัตโนมัติ → ประเมิน → ผู้บริโภค โดยไม่มีขั้นตอนเจ้าหน้าที่');
check(main.steps.find((s) => s.id === 's9a-auto')?.title.includes('ผ่านการลงทะเบียน') === true, 'มีขั้นแสดงผลการตรวจอัตโนมัติ (ผ่านการลงทะเบียน) ก่อนประเมิน');

describe('เส้นทางหลัก — 6 ขั้นตรงกับขั้นจริงของ Scenario 9A');
const flowSteps = [...new Set(P.RECOMMENDED_FLOW.flatMap((s) => s.steps))];
check(JSON.stringify(flowSteps) === JSON.stringify(main.steps.map((s) => s.id)), `6 ขั้นครอบคลุมทุกขั้นของ Scenario 9A ตามลำดับ (${flowSteps.length} ขั้นในตัวควบคุม)`);
check(JSON.stringify(P.RECOMMENDED_FLOW.map((s) => s.title)) === JSON.stringify(['ลงทะเบียนร้านค้า', 'ตรวจสอบอัตโนมัติ', 'AUTO_PASS', 'ประเมินความน่าเชื่อถือ', 'แสดงผล Badge ตามเงื่อนไข', 'ผู้บริโภคตรวจสอบ']), 'ลำดับ: ลงทะเบียน → ตรวจสอบอัตโนมัติ → AUTO_PASS → ประเมิน → Badge ตามเงื่อนไข → ผู้บริโภคตรวจสอบ');
check(P.RECOMMENDED_FLOW.every((s) => s.steps.every((id) => main.steps.find((x) => x.id === id)?.role !== 'officer')), 'เส้นทางหลักไม่มีขั้นตอนเจ้าหน้าที่');
check(visible.includes('ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่') && visible.includes('ถ้าข้อมูลร้านยังไม่พอหรือยังไม่ผ่านเงื่อนไข ระบบแสดงสถานะจริงแทน Badge'), 'ร้านปกติไม่ต้องรอเจ้าหน้าที่ · ไม่สร้าง Badge หลอก');

describe('A. Demo หลัก — เป็นส่วนของเส้นทางหลัก ไม่มีปุ่มเริ่ม Journey ซ้ำ');
check(JSON.stringify(P.MAIN_HIGHLIGHTS.map((h) => h.title)) === JSON.stringify(['ลงทะเบียนและเชื่อม Marketplace', 'ประเมินอัตโนมัติ', 'ผู้บริโภคตรวจสอบ']), 'Demo หลัก 3 รายการ: ลงทะเบียนและเชื่อม Marketplace · ประเมินอัตโนมัติ · ผู้บริโภคตรวจสอบ');
check(JSON.stringify(P.MAIN_HIGHLIGHTS.flatMap((h) => h.flow)) === JSON.stringify([1, 2, 3, 4, 5, 6]), 'ทั้ง 3 รายการชี้ไปที่ขั้นของเส้นทางหลักครบ 6 ขั้น ไม่ซ้ำ');
const mainSection = html.slice(html.indexOf('data-testid="main-journey"'), html.indexOf('data-testid="case-section"'));
check((html.match(/data-testid="mvp-card"/g) ?? []).length === 3 && !/<button/.test(mainSection), 'การ์ด Demo หลัก 3 ใบ และไม่มีปุ่มเริ่ม Scenario แยกในส่วนเส้นทางหลัก');
check(before('data-testid="demo-hero"', 'data-testid="main-journey"') && before('data-testid="main-journey"', 'data-testid="case-section"') && before('data-testid="case-section"', 'data-testid="secondary-section"') && before('data-testid="secondary-section"', 'data-testid="all-scenarios"'), 'ลำดับหน้า: CTA → เส้นทางหลัก → Demo เฉพาะกรณี → ผลลัพธ์และฟังก์ชันเพิ่มเติม → Scenario ทั้งหมด');
const firstScreen = html.slice(html.indexOf('data-testid="demo-hero"'), html.indexOf('data-testid="secondary-section"'));
check((firstScreen.match(/<button/g) ?? []).length === 5, 'หน้าจอแรก (ก่อนส่วนพับ) มีปุ่มไม่เกิน 5 ปุ่ม: CTA หลัก 1 + Demo เฉพาะกรณี 2 × 2');

describe('B. Demo เฉพาะกรณี — AUTO_REQUEST_INFO และ MANUAL_REVIEW ใช้ Scenario เดิม');
check(JSON.stringify(P.SPECIAL_CASES.map((c) => [c.route, c.scenario, c.view])) === JSON.stringify([['AUTO_REQUEST_INFO', 's9b', 'request_info'], ['MANUAL_REVIEW', 's15', 'exceptions']]), 'AUTO_REQUEST_INFO → ตัวอย่าง Scenario 9B + ร้านตัวอย่าง · MANUAL_REVIEW → Scenario 15 + Exception Queue');
check(P.SPECIAL_CASES.every((c) => !!SC.findScenario(c.scenario)) && (html.match(/data-testid="case-card"/g) ?? []).length === 2, 'การ์ดกรณีพิเศษ 2 ใบ เริ่ม Scenario ที่มีอยู่จริง');
check(visible.includes('ตัวอย่างจาก Scenario 9B') && visible.includes('เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ — ไม่ใช่ขั้นตอนของร้านค้าปกติ'), 'อธิบายชัดว่าใช้ Scenario ตัวอย่าง และเจ้าหน้าที่ตรวจเฉพาะกรณีผิดปกติ');
const s9b = SC.findScenario('s9b')!;
check(!s9b.steps.some((s) => s.role === 'officer') && SC.findScenario('s15')!.steps.some((s) => s.role === 'officer'), 'Scenario 9B ไม่มีขั้นเจ้าหน้าที่ · Scenario 15 มีขั้นเจ้าหน้าที่ (กรณียกเว้น)');

describe('C. ผลลัพธ์โดยตรง — ใช้ข้อมูลจำลองที่มีอยู่ ไม่สร้าง Badge/ผลประเมินปลอม');
check(JSON.stringify(P.RESULT_VIEWS.map((r) => [r.title, r.view, r.scenario])) === JSON.stringify([['Trust Assessment', 'assessment', 's11'], ['Assessment Badge', 'badge', 's14'], ['Consumer Verification', 'consumer', 's13']]), 'Trust Assessment · Assessment Badge · Consumer Verification เปิดดูโดยตรงได้ (และดูทีละขั้นด้วย Scenario เดิม)');
W.resetAllDemoData();
const badgesNow = () => S.useAssessmentBadgeStore.getState().items;
const merchantsNow = () => S.useMerchantStore.getState().items;
const countsBefore = JSON.stringify([badgesNow().length, S.useAssessmentStore.getState().items.length]);
const act = P.exampleShop('active', badgesNow(), merchantsNow());
const info = P.exampleShop('request_info', badgesNow(), merchantsNow());
check(act?.id === 'M-001' && badgesNow().find((x) => x.merchantId === 'M-001')?.status === 'active', 'ร้านตัวอย่าง Badge = M-001 ซึ่งมี Badge active จากกฎเดิม (Seed)');
check(info?.id === 'M-002' && badgesNow().find((x) => x.merchantId === 'M-002')?.route === 'AUTO_REQUEST_INFO', 'ร้านตัวอย่าง AUTO_REQUEST_INFO = M-002 (ข้อมูลยังไม่เพียงพอจากกฎเดิม)');
check(JSON.stringify([badgesNow().length, S.useAssessmentStore.getState().items.length]) === countsBefore, 'การเลือกร้านตัวอย่างไม่สร้าง Badge หรือผลประเมินใหม่');
const noActive = badgesNow().map((x) => ({ ...x, status: x.status === 'active' ? ('withheld' as const) : x.status }));
check(P.exampleShop('active', noActive, merchantsNow()) === undefined, 'ไม่มีร้านที่ Badge active → ไม่มีร้านตัวอย่าง (ปุ่มถูกปิด ไม่สร้างข้อมูลแทน)');
const resultsTag = html.match(/<details[^>]*data-testid="results-section"[^>]*>/)?.[0] ?? '';
check(!!resultsTag && !/\sopen(=|\s|>)/.test(resultsTag) && (html.match(/data-testid="result-view"/g) ?? []).length === 3, 'ผลลัพธ์โดยตรง 3 รายการ อยู่ในส่วนพับไว้');

describe('ระบบเพิ่มเติม และ Scenario ทั้งหมด — พับไว้เป็นค่าเริ่มต้น');
const secIds = P.SECONDARY_GROUPS.flatMap((g) => g.ids);
check(secIds.every((id) => !!SC.findScenario(id)) && new Set(secIds).size === secIds.length, `ระบบเพิ่มเติมใช้ Scenario ที่มีอยู่จริง ไม่ซ้ำกัน (${secIds.length} เรื่อง)`);
const primaryIds = [P.MAIN_JOURNEY_ID, ...P.SPECIAL_CASES.map((c) => c.scenario)];
check(secIds.every((id) => !primaryIds.includes(id)), 'ระบบเพิ่มเติมไม่ซ้ำกับเส้นทางหลักและ Demo เฉพาะกรณี');
const allIds = SC.allScenarios.map((s) => s.id);
const reachable = new Set([...primaryIds, ...P.RESULT_VIEWS.map((r) => r.scenario), ...secIds]);
check(allIds.every((id) => reachable.has(id)), `ทุก Scenario (${allIds.length}) เริ่มได้จากหน้า Demo (เส้นทางหลัก · กรณีพิเศษ · ผลลัพธ์ · ระบบเพิ่มเติม)`);
check(JSON.stringify([...allIds].sort()) === JSON.stringify(['s1', 's10', 's11', 's12', 's13', 's14', 's15', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's9a', 's9b']), 'Scenario ID เดิมครบ 17 รายการ (ไม่เปลี่ยน ID)');
check(SC.journeyScenarios('v1').map((s) => s.id).join() === 's1,s2,s3,s4,s5,s6,s7,s8' && SC.journeyScenarios('v2').map((s) => s.id).join() === 's9,s10,s11,s12,s13', 'Full Journey 2 ชุดเดิม (1→8 และ 9→13)');
const detailsTags = html.match(/<details[^>]*data-testid="(results-section|secondary-group|all-scenarios)"[^>]*>/g) ?? [];
check(detailsTags.length === 8 && detailsTags.every((t) => !/\sopen(=|\s|>)/.test(t)), `ผลลัพธ์โดยตรง + ระบบเพิ่มเติม 6 กลุ่ม + Scenario ทั้งหมด พับไว้เป็นค่าเริ่มต้น (${detailsTags.length} ส่วน)`);
check(visible.includes('ผลลัพธ์และฟังก์ชันเพิ่มเติม') && visible.includes('เปิดดูผลลัพธ์จากข้อมูลจำลองได้ทันที โดยไม่ต้องเริ่ม Demo ใหม่') && visible.includes('ดู Scenario ทั้งหมด'), 'หัวข้อ "ผลลัพธ์และฟังก์ชันเพิ่มเติม" และ "ดู Scenario ทั้งหมด"');
check(SC.trackScenarios('v1').every((s) => html.includes(s.title)) && html.includes('สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)') && html.includes('Full Journey — Marketplace &amp; Trust Assessment'), 'ส่วน Scenario ทั้งหมดมี Full Journey 2 ชุด และ Scenario เดี่ยว');
const opened = viewHtml('/demo?track=v2', consumer);
check(/<details[^>]*data-testid="all-scenarios"[^>]*\sopen/.test(opened.replace(/open=""/g, ' open')) && SC.trackScenarios('v2').every((s) => opened.includes(s.title)), 'ลิงก์เดิม /demo?track=v2 เปิดส่วน Scenario ทั้งหมดที่ชุด Marketplace & Trust');

describe('ภาษาบนหน้าจอ — ไม่มี v1/v2 · ไม่อ้างว่าเชื่อมระบบจริง · มี Disclaimer');
check(!/\bv[12]\b/i.test(visible), 'ไม่มีป้าย v1 / v2 ที่ผู้ใช้เห็น');
check(visible.includes('MVP') && visible.includes('Prototype') && visible.includes('Future Integration') && visible.includes('เชื่อม Shopee/Lazada, e-KYC และฐานข้อมูลกลางจริง'), 'แยก MVP · Prototype · Future Integration');
check(visible.includes('ข้อจำกัดความรับผิดชอบ (Prototype Disclaimer)') && before('data-testid="all-scenarios"', 'aria-label="Prototype Disclaimer"'), 'Prototype Disclaimer อยู่ด้านล่างหน้า');
check(!/เชื่อม(ต่อ)? ?API ?จริงแล้ว|ได้รับการรับรองจาก สคบ|มีฐานข้อมูลกลางแล้ว/.test(visible), 'ไม่อ้างว่าเชื่อม API จริง · สคบ. รับรอง · มีฐานข้อมูลกลางแล้ว');

describe('ไม่กระทบโมเดลการประเมิน');
check(MODEL_V2.version === 'v2.1-sim' && JSON.stringify(MODEL_V2.weights) === JSON.stringify({ C1: 25, C2: 25, C3: 20, C4: 10, C5: 20 }) && JSON.stringify(MODEL_V2.bands) === JSON.stringify({ A: 80, B: 65, C: 50 }) && MODEL_V2.bandA.minCoverage === 70 && JSON.stringify(MODEL_V2.minimums) === JSON.stringify({ orders: 30, reviews: 10, months: 3 }), 'Model v2.1-sim · น้ำหนัก · Threshold · Band A · ข้อมูลขั้นต่ำ ไม่เปลี่ยน');

finish();
