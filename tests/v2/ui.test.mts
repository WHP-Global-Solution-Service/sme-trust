/** v2 — สิ่งที่ผู้ใช้แต่ละบทบาทเห็นบนหน้าจอ (Server Render) ตามข้อสรุป D1, D2, D3, D6, D7, D8 */
import { S, check, describe, finish, view } from '../harness.mts';

const merchant = (operatorId: string) => ({ role: 'merchant' as const, operatorId, merchantLoggedIn: true });
const officer = { role: 'officer' as const, officerId: 'OF-001' };
const consumer = { role: 'consumer' as const, consumerId: 'CS-001' };
const latest = (m: string) => S.useAssessmentStore.getState().items.find((a) => a.merchantId === m)!;
const scoreText = (m: string) => latest(m).result.score.toFixed(1);

describe('D1 — Shopee (จำลอง) / Lazada (จำลอง) และไม่มีการเชื่อมต่อ API จริง');
const mkt = view('/m/marketplace', merchant('OP-001'));
check(mkt.includes('Shopee (จำลอง)') && mkt.includes('Lazada (จำลอง)') && mkt.includes('ยังไม่มีการเชื่อมต่อ API จริง'), 'หน้าเชื่อมต่อ Marketplace แสดงชื่อแพลตฟอร์มพร้อม "(จำลอง)" และข้อความไม่มี API จริง');
check(!/shopee\.co\.th|lazada\.co\.th|<img/i.test(mkt), 'ไม่มีโลโก้หรือลิงก์ไปยังแพลตฟอร์มจริง');
check(view('/m/marketplace', merchant('OP-006')).includes('ซิงก์ไม่สำเร็จ'), 'การเชื่อมต่อที่ซิงก์ล้มเหลวแสดงสถานะและทางแก้');

describe('D2 — ผู้บริโภคไม่เห็นคะแนนตัวเลข · เจ้าหน้าที่เห็นวิธีคำนวณ');
const shop1 = view('/shop/M-001', consumer);
check(shop1.includes('Band A') && shop1.includes('Data Coverage') && shop1.includes('Data Confidence'), 'หน้าร้านสาธารณะแสดง Band, Coverage และ Confidence');
check(!shop1.includes(scoreText('M-001')) && !shop1.includes('วิธีคำนวณ'), `หน้าร้านสาธารณะไม่แสดงคะแนน ${scoreText('M-001')} หรือวิธีคำนวณ`);
const cert1 = view(`/verify/${S.useCertificationStore.getState().items.find((c) => c.merchantId === 'M-001' && c.status === 'active')!.id}`, consumer);
check(!cert1.includes(scoreText('M-001')), 'หน้าตรวจใบรับรองไม่แสดงคะแนนตัวเลข');
const mine = view('/m/trust', merchant('OP-001'));
check(mine.includes('Band A') && mine.includes('↑ ส่งผลบวก') && !mine.includes(scoreText('M-001')) && !mine.includes('วิธีคำนวณ'), 'ร้านค้าเห็น Band และทิศทางปัจจัย (↑/↓) แต่ไม่เห็นคะแนนตัวเลข');
const off = view(`/o/assessments/${latest('M-001').id}`, officer);
check(off.includes(scoreText('M-001')) && off.includes('วิธีคำนวณ') && off.includes('น้ำหนักที่ใช้'), 'เจ้าหน้าที่เห็นคะแนนและตารางคำนวณทีละขั้น');
check(view('/o/assessments', officer).includes(scoreText('M-006')), 'คิวผลประเมินของเจ้าหน้าที่ (แท็บรอพิจารณา) แสดงคะแนน');

describe('D6 — Insufficient Data ไม่ใช่ผลลบ');
const shop2 = view('/shop/M-002', consumer);
check(shop2.includes('Insufficient Data') && shop2.includes('ไม่ได้หมายความว่าร้านมีปัญหา'), 'ร้านเปิดใหม่: แสดง Insufficient Data พร้อมคำอธิบายว่าไม่ใช่ผลลบ');
check(view('/shop/M-010', consumer).includes('ยังไม่ได้เชื่อมต่อข้อมูล Marketplace'), 'ร้านที่ไม่เชื่อมต่อ: แจ้งว่ายังไม่มีผลประเมิน (ไม่แสดงเป็นคะแนนต่ำ)');

describe('D7 — Coverage และ Confidence แสดงแยกกัน');
check(mine.includes('Data Coverage — ความครบถ้วนของข้อมูล') && mine.includes('Data Confidence — ความน่าเชื่อถือของข้อมูล'), 'แสดง Coverage และ Confidence เป็นคนละตัวชี้วัด พร้อมความหมาย');

describe('D8 — Revoked แยกจาก Band');
const shop8 = view('/shop/M-008', consumer);
check(shop8.includes('Revoked') && shop8.includes('ไม่สามารถใช้ Badge ที่มีผลได้') && /Band [A-C]/.test(shop8), 'ร้านถูกเพิกถอน: แสดง Revoked เด่น และแสดง Band แยก (ไม่ถูกบังคับเป็น D)');
check(view('/m/trust', merchant('OP-008')).includes('สถานะการรับรองไม่ปกติ จึงยังส่งไม่ได้'), 'ร้านถูกเพิกถอนส่งผลประเมินขอ Badge ไม่ได้');

describe('D3 — Officer Review เท่านั้น');
const off6 = view(`/o/assessments/${latest('M-006').id}`, officer);
check(off6.includes('บันทึกผลการพิจารณา') && off6.includes('เกณฑ์ v1 ของ Level 3') && off6.includes('ไม่ออก Badge อัตโนมัติ'), 'หน้าพิจารณามีเกณฑ์ v1 และการตัดสินของเจ้าหน้าที่ — ระบบไม่ออก Badge เอง');
check(view('/o/applications/APP-2569-0007', officer).includes('ข้อมูลประกอบ: Trust Assessment'), 'คำขอ Level 3 แสดงผลประเมินเป็นข้อมูลประกอบ');

describe('D5 — โมเดลปรับได้และโปร่งใส');
const model = view('/admin/assessment-model', { role: 'admin', officerId: 'AD-001' });
check(model.includes('ผลรวม 100%') && model.includes('ไม่ถูกนับเป็น 0') && model.includes('คืนค่าเริ่มต้น'), 'หน้าโมเดลแสดงน้ำหนัก ผลรวม วิธีคำนวณ และคืนค่าเริ่มต้นได้');

describe('ระบบเดิมยังทำงาน');
check(view('/m', merchant('OP-001')).includes('ยืนยันตัวตนแล้ว') && view('/demo', consumer).includes('Start Demo'), 'หน้าหลักผู้ประกอบการและหน้ารวม Demo ของ v1 ยังแสดงผลปกติ');

finish();
