/** หน้า Demo — MVP-First Demo Center: ระบบหลักก่อน · เส้นทางแนะนำ · ระบบเพิ่มเติม/Scenario ทั้งหมดพับไว้ · ไม่กระทบ Scenario และโมเดลเดิม */
import { check, describe, finish, viewHtml } from '../harness.mts';

const P = await import('@/features/demo/DemoScenariosPage');
const SC = await import('@/mock/scenarios');
const { MODEL_V2 } = await import('@/features/trust-assessment/model');

const consumer = { role: 'consumer' as const, consumerId: 'CS-001' };
const html = viewHtml('/demo', consumer).replace(/<!-- -->/g, '');
/** ข้อความที่ผู้ใช้เห็น (ตัด Tag/Attribute ออก) */
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const before = (a: string, b: string) => html.indexOf(a) >= 0 && html.indexOf(b) > html.indexOf(a);

describe('Hero — ข้อความตามข้อกำหนด และ CTA หลักเพียงปุ่มเดียว');
check(visible.includes('ทดลองใช้งาน SME Trust') && visible.includes('สาธิตการลงทะเบียนร้านค้า ประเมินความน่าเชื่อถือ และตรวจสอบผลผ่านระบบอัตโนมัติ') && visible.includes('เริ่มจากระบบหลัก (MVP)'), 'Title · Subtitle · Highlight "เริ่มจากระบบหลัก (MVP)"');
check((html.match(/data-testid="main-cta"/g) ?? []).length === 1 && visible.includes('เริ่ม Demo เส้นทางหลัก'), 'มี CTA หลัก "เริ่ม Demo เส้นทางหลัก" ปุ่มเดียว');
const main = SC.findScenario(P.MAIN_JOURNEY_ID)!;
check(!!main && main.id === 's9a', `CTA หลักเชื่อมกับ Scenario ที่มีอยู่จริง (${P.MAIN_JOURNEY_ID}: ${main?.title})`);
// เส้นทางหลักต้องแสดง Automation First ครบ: ลงทะเบียน → ตรวจข้อมูลอัตโนมัติ → AUTO_PASS → ประเมิน → ผู้บริโภค และไม่มีขั้นตอนเจ้าหน้าที่
const mainIds = main.steps.map((s) => s.id);
check(['s9a-submit', 's9a-auto', 's9a-assess', 's9a-consumer'].every((id, k, arr) => mainIds.indexOf(id) >= 0 && (k === 0 || mainIds.indexOf(id) > mainIds.indexOf(arr[k - 1]))) && !main.steps.some((s) => s.role === 'officer'), 'เส้นทางหลักครอบคลุม ส่งคำขอ → ผ่านอัตโนมัติ → ประเมิน → ผู้บริโภค โดยไม่มีขั้นตอนเจ้าหน้าที่');
check(main.steps.find((s) => s.id === 's9a-auto')?.title.includes('ผ่านการลงทะเบียน') === true, 'มีขั้นแสดงผลการตรวจอัตโนมัติ (ผ่านการลงทะเบียน) ก่อนประเมิน');

describe('MVP — 5 ระบบหลักตามลำดับ ก่อนส่วนอื่น');
const titles = ['ลงทะเบียนร้านค้า', 'ประเมินความน่าเชื่อถือ', 'แสดงผล Assessment Badge', 'ตรวจสอบร้านค้า', 'ตรวจสอบเฉพาะกรณีจำเป็น'];
const descs = ['เชื่อมร้านค้าออนไลน์ หรือสมัครด้วยตนเอง', 'ระบบประเมินข้อมูลร้านค้าอัตโนมัติ', 'แสดงผลประเมินเมื่อข้อมูลผ่านเงื่อนไข', 'ผู้บริโภคค้นหาและตรวจสอบผลประเมิน', 'เจ้าหน้าที่พิจารณาเฉพาะข้อมูลที่ต้องตรวจเพิ่ม'];
check(JSON.stringify(P.MVP_FEATURES.map((f) => f.title)) === JSON.stringify(titles) && JSON.stringify(P.MVP_FEATURES.map((f) => f.desc)) === JSON.stringify(descs), 'ชื่อและคำอธิบาย 5 ระบบตรงตามข้อกำหนด เรียงตามลำดับ 1–5');
check((html.match(/data-testid="mvp-card"/g) ?? []).length === 5 && titles.every((t) => visible.includes(t)), 'หน้า Demo แสดงการ์ด MVP 5 ใบ ไม่ซ้ำ');
check(new Set(P.MVP_FEATURES.map((f) => f.title)).size === 5, 'ไม่มีการ์ดซ้ำ');
check(before('data-testid="mvp-section"', 'data-testid="recommended-flow"') && before('data-testid="recommended-flow"', 'data-testid="secondary-section"') && before('data-testid="secondary-section"', 'data-testid="all-scenarios"'), 'ลำดับหน้า: MVP → เส้นทางแนะนำ → ระบบเพิ่มเติม → Scenario ทั้งหมด');
const mvpIds = P.MVP_FEATURES.flatMap((f) => f.actions.map((a) => a.id));
check(mvpIds.every((id) => !!SC.findScenario(id)), `ทุกปุ่มใน MVP เริ่ม Scenario ที่มีอยู่จริง (${mvpIds.join(', ')})`);
check(JSON.stringify(P.MVP_FEATURES[0].actions.map((a) => a.id)) === JSON.stringify(['s9a', 's9b']), 'ลงทะเบียนร้านค้า: ทั้งเชื่อม Marketplace (9A) และสมัครเอง (9B)');
check(P.MVP_FEATURES[1].actions[0].id === 's11' && P.MVP_FEATURES[3].actions[0].id === 's13' && P.MVP_FEATURES[4].actions[0].id === 's15', 'ประเมิน = Scenario 11 · ตรวจสอบร้านค้า = Scenario 13 · กรณีจำเป็น = Scenario 15 (Exception Queue)');
check(visible.includes('ผลประเมิน ไม่ใช่ใบรับรองของ สคบ.') && visible.includes('Trust Band · Coverage · Confidence'), 'Badge แยกจากใบรับรอง และการประเมินระบุ Band · Coverage · Confidence');
// Regression: การ์ด Badge ต้องไม่เขียนเหมือน Demo เฉพาะ Badge ถ้าเปิดเส้นทางทั้งเส้น — ปัจจุบันเปิด Scenario 14 (ขั้น Automatic Assessment Badge) โดยตรง
const badge = P.MVP_FEATURES[2];
check(badge.actions.length === 1 && badge.actions[0].id === 's14' && badge.actions[0].label === 'เริ่ม Demo' && !badge.inMainStep && SC.findScenario('s14')!.steps.some((s) => s.id === 's14-badge'), 'การ์ด Badge เปิด Scenario 14 ซึ่งมีขั้น Automatic Assessment Badge (Scenario 14 ยังอยู่ครบ)');
check((html.match(/data-testid="mvp-in-main"/g) ?? []).length === 0, 'ไม่มีการ์ดที่อ้างขั้นของเส้นทางหลักผิด');
check(P.MVP_FEATURES.filter((f) => f.no !== 1 && f.actions.some((a) => a.id === P.MAIN_JOURNEY_ID)).every((f) => !!f.inMainStep), 'การ์ดอื่น (นอกจากการ์ดลงทะเบียนซึ่งคือเส้นทางหลักเอง) ที่เปิดเส้นทางหลักต้องระบุขั้นในเส้นทางหลักเสมอ');

describe('เส้นทาง Demo ที่แนะนำ — ตรงกับขั้นจริงของ Scenario 9A');
const flowSteps = P.RECOMMENDED_FLOW.flatMap((s) => s.steps);
check(JSON.stringify(flowSteps) === JSON.stringify(main.steps.map((s) => s.id)), `5 ขั้นครอบคลุมทุกขั้นของ Scenario 9A ตามลำดับ (${flowSteps.length} ขั้นในตัวควบคุม)`);
check(JSON.stringify(P.RECOMMENDED_FLOW.map((s) => s.title)) === JSON.stringify(['ลงทะเบียน / เชื่อมร้านค้า', 'ส่งคำขอ → ตรวจข้อมูลอัตโนมัติ', 'ผ่านการลงทะเบียน (AUTO_PASS)', 'ประเมินความน่าเชื่อถือ · แสดงผลตามเงื่อนไข', 'ผู้บริโภคตรวจสอบ']), 'ชื่อขั้นตามกระบวนการ Automation First');
check(visible.includes('เริ่มสาธิตตั้งแต่ต้น') && visible.includes('ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่') && visible.includes('ถ้าข้อมูลร้านยังไม่พอหรือยังไม่ผ่านเงื่อนไข ระบบแสดงสถานะจริงแทน Badge'), 'ปุ่ม "เริ่มสาธิตตั้งแต่ต้น" · ร้านปกติไม่ต้องรอเจ้าหน้าที่ · ไม่สร้าง Badge หลอก');

describe('ระบบเพิ่มเติม และ Scenario ทั้งหมด — พับไว้เป็นค่าเริ่มต้น');
const secIds = P.SECONDARY_GROUPS.flatMap((g) => g.ids);
check(secIds.every((id) => !!SC.findScenario(id)) && new Set(secIds).size === secIds.length, `ระบบเพิ่มเติมใช้ Scenario ที่มีอยู่จริง ไม่ซ้ำกัน (${secIds.length} เรื่อง)`);
check(secIds.every((id) => !mvpIds.includes(id)), 'ระบบเพิ่มเติมไม่ซ้ำกับระบบหลัก');
const allIds = SC.allScenarios.map((s) => s.id);
const reachable = new Set([...mvpIds, ...secIds]);
check(allIds.every((id) => reachable.has(id)), `ทุก Scenario (${allIds.length}) เริ่มได้จากระบบหลักหรือระบบเพิ่มเติม`);
check(JSON.stringify([...allIds].sort()) === JSON.stringify(['s1', 's10', 's11', 's12', 's13', 's14', 's15', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's9a', 's9b']), 'Scenario ID เดิมครบ 17 รายการ (ไม่เปลี่ยน ID)');
check(SC.journeyScenarios('v1').map((s) => s.id).join() === 's1,s2,s3,s4,s5,s6,s7,s8' && SC.journeyScenarios('v2').map((s) => s.id).join() === 's9,s10,s11,s12,s13', 'Full Journey 2 ชุดเดิม (1→8 และ 9→13)');
const detailsTags = html.match(/<details[^>]*data-testid="(secondary-group|all-scenarios)"[^>]*>/g) ?? [];
check(detailsTags.length === 7 && detailsTags.every((t) => !/\sopen(=|\s|>)/.test(t)), `ระบบเพิ่มเติม 6 กลุ่ม + Scenario ทั้งหมด พับไว้เป็นค่าเริ่มต้น (${detailsTags.length} ส่วน)`);
check(visible.includes('ระบบเพิ่มเติม') && visible.includes('ฟังก์ชันสนับสนุนและเส้นทางสาธิตอื่น ๆ') && visible.includes('ดู Scenario ทั้งหมด'), 'หัวข้อ "ระบบเพิ่มเติม" และ "ดู Scenario ทั้งหมด"');
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
