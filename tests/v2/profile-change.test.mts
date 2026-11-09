/**
 * Profile Change Approval (KI-V2-15) และหน้าแรก Concept v2
 * ครอบคลุม: Approve, Reject, Request More Information + ส่งใหม่, No Duplicate Requests, Draft / Refresh,
 * Officer/Merchant State Consistency, Audit Log, Notification, Marketplace Raw Data Protection,
 * ใบรับรองไม่เปลี่ยน, Reset Demo Data, Auto-Fill หลังอนุมัติไม่ตรวจซ้ำ และข้อความหน้าแรก
 */
import { S, W, storage, view, describe, check, finish, actAs, asOwner } from '../harness.mts';

const V = await import('@/stores/workflowsV2');
const V2S = await import('@/mock/scenarios/v2');
const G = await import('@/features/marketplace/services/generator');
const A = await import('@/features/marketplace/autofill');
const { allScenarios } = await import('@/mock/scenarios');

const MID = 'M-005';
const OPID = 'OP-005';
const M = { role: 'merchant' as const, operatorId: OPID, merchantLoggedIn: true };
const O = { role: 'officer' as const, officerId: 'OF-001' };
const merchant = () => S.useMerchantStore.getState().items.find((m) => m.id === MID)!;
const reqs = () => S.useProfileChangeStore.getState().items;
const req = (id: string) => reqs().find((r) => r.id === id)!;
const certs = () => JSON.stringify(S.useCertificationStore.getState().items.filter((c) => c.merchantId === MID));
const audits = (id: string) => S.useAuditStore.getState().items.filter((a) => a.target === id);
const notes = (role: string, recipientId?: string) => S.useNotificationStore.getState().items.filter((n) => n.recipientRole === role && (!recipientId || n.recipientId === recipientId));
const asOfficer = () => S.useSessionStore.setState({ role: 'officer', officerId: 'OF-001' });
const asMerchant = () => S.useSessionStore.setState({ role: 'merchant', operatorId: OPID, merchantLoggedIn: true });

/** ร้านเดิม M-005 เชื่อม Shopee (จำลอง) แล้วยื่นเปลี่ยนชื่อร้าน + หมวด ผ่านหน้าอัปเดตโปรไฟล์ (Scenario 9) */
function fileRename(draftId: string, shopName = 'ดอยสูงคาเฟ่', category = 'ของใช้ในบ้าน') {
  V2S.fixtureV2Clean();
  const [c] = V.attachImportedMarketplaces(MID, [{ platform: 'shopee', archetype: 'established_good' }]);
  const m = merchant();
  const reg = V.registeredValues(m);
  asMerchant();
  const r = asOwner(c.id, () => V.confirmProfileUpdate(c.id, { ...reg, shopName, category, description: `${reg.description} (อัปเดต)` }, draftId));
  return { c, before: m, reg, r };
}

// ------------------------------------------------------------------ 1. Change Request
describe('Merchant Edit → Change Request (ข้อมูลเดิมยังใช้อยู่)');
const certStart = certs();
let f = fileRename('DRF-PC-1');
const id1 = f.r.record!.changeRequestId!;
check(f.r.ok && !!id1 && id1.startsWith('PCR-'), 'แก้ชื่อร้าน/หมวดของร้านที่ได้รับการรับรอง → สร้างคำขอเปลี่ยนข้อมูล');
check(req(id1).status === 'pending' && req(id1).changes.map((x) => x.field).join() === 'shopName,category', 'คำขออยู่ในสถานะ "รอเจ้าหน้าที่พิจารณา" พร้อมช่องชื่อร้านและหมวด');
check(merchant().shopName === f.before.shopName && merchant().category === f.before.category, 'ข้อมูลเดิมในโปรไฟล์ยังไม่เปลี่ยนจนกว่าเจ้าหน้าที่อนุมัติ');
check(merchant().description.endsWith('(อัปเดต)'), 'ช่องที่ไม่ผูกกับใบรับรอง (คำอธิบาย) บันทึกทันทีตามเดิม');
const ch = req(id1).changes.find((x) => x.field === 'shopName')!;
check(ch.from === f.before.shopName && ch.to === 'ดอยสูงคาเฟ่' && ch.source === V.sourceOfConnection(f.c, merchant()).shopName, 'คำขอเก็บข้อมูลเดิม ข้อมูลใหม่ และข้อมูลต้นฉบับจาก Marketplace');
check(req(id1).importId === f.r.record!.id && req(id1).connectionId === f.c.id && req(id1).source?.platform === 'shopee', 'ผูกกับบันทึกการนำเข้าและการเชื่อมต่อต้นทาง');
check(notes('officer').some((n) => n.link === `/o/profile-changes/${id1}`), 'แจ้งเจ้าหน้าที่ พร้อมลิงก์ไปหน้าพิจารณาคำขอ');
check(audits(id1).some((a) => a.action === 'ร้านยื่นคำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง'), 'Audit Log: ร้านยื่นคำขอ');
check(certs() === certStart, 'ใบรับรองไม่เปลี่ยนเมื่อยื่นคำขอ');

describe('No Duplicate Requests');
const again = asOwner(f.c.id, () => V.confirmProfileUpdate(f.c.id, { ...f.reg, shopName: 'ดอยสูงคาเฟ่', category: 'ของใช้ในบ้าน' }, 'DRF-PC-1'));
check(again.ok && again.duplicate && reqs().filter((r) => r.merchantId === MID).length === 1, 'ส่งซ้ำ / Refresh หลังยืนยัน (ฉบับร่างเดิม) → ไม่สร้างคำขอซ้ำ');
const second = asOwner(f.c.id, () => V.confirmProfileUpdate(f.c.id, { ...V.registeredValues(merchant()), shopName: 'ดอยสูงโรสเตอร์' }, 'DRF-PC-1b'));
check(second.ok && second.record!.changeRequestId === id1 && reqs().filter((r) => r.merchantId === MID).length === 1, 'อัปเดตโปรไฟล์อีกครั้งระหว่างที่คำขอยังเปิดอยู่ → ปรับคำขอเดิม (ไม่สร้างรายการใหม่)');
check(req(id1).revision === 2 && req(id1).changes.length === 1 && req(id1).changes[0].to === 'ดอยสูงโรสเตอร์' && req(id1).history.at(-1)!.action === 'updated', 'คำขอเดิมเป็นฉบับที่ 2 และมีประวัติการปรับ');

// ------------------------------------------------------------------ 2. Approve
describe('Officer Review → Approve → Profile Update (ใบรับรองไม่เปลี่ยน · ข้อมูลต้นฉบับคงเดิม)');
f = fileRename('DRF-PC-3');
const id3 = f.r.record!.changeRequestId!;
check(req(id3).status === 'pending' && merchant().shopName === f.before.shopName, 'ก่อนเจ้าหน้าที่กดอนุมัติ คำขอยังรออยู่และโปรไฟล์ยังเป็นข้อมูลเดิม');
const src3 = V.sourceOfConnection(f.c, merchant());
const snap3 = JSON.stringify(G.generateSnapshot(S.useMarketplaceStore.getState().items.find((c) => c.id === f.c.id)!, merchant().category));
asOwner(MID, () => V.runAssessment(MID));
const assess3 = S.useAssessmentStore.getState().items.find((a) => a.merchantId === MID)!.result;
check(req(id3).status === 'pending' && merchant().shopName === f.before.shopName, 'ไม่มีการอนุมัติอัตโนมัติ: หลังประเมินใหม่ คำขอยังรอเจ้าหน้าที่ และโปรไฟล์ยังเป็นข้อมูลเดิม');
asOfficer();
const ok3 = actAs(['officer', 'admin'], () => V.approveProfileChange(id3));
const m3 = merchant();
check(ok3.ok && req(id3).status === 'approved' && m3.shopName === 'ดอยสูงคาเฟ่' && m3.category === 'ของใช้ในบ้าน', 'อนุมัติ → โปรไฟล์ร้านใช้ชื่อร้านและหมวดใหม่');
check(req(id3).decidedBy === 'สมชาย ตรวจสอบ' || (!!req(id3).decidedBy && req(id3).decidedBy !== 'ผู้ประกอบการ'), 'บันทึกชื่อเจ้าหน้าที่ผู้พิจารณาและเวลา');
check(certs() === certStart, 'Certification Level และสถานะใบรับรองไม่เปลี่ยนโดยอัตโนมัติ');
const conn3 = S.useMarketplaceStore.getState().items.find((c) => c.id === f.c.id)!;
const src3b = V.sourceOfConnection(conn3, m3);
check(src3b.shopName === src3.shopName && src3b.category === src3.category && src3b.rating === src3.rating && src3b.reviewCount === src3.reviewCount && src3b.salesVolume === src3.salesVolume && JSON.stringify(src3b.products) === JSON.stringify(src3.products), 'Marketplace Raw Data Protection: ชื่อร้าน หมวด คะแนน รีวิว ยอดขาย และสินค้าต้นฉบับไม่เปลี่ยน');
check(conn3.sourceShopName === f.before.shopName && conn3.sourceCategory === f.before.category, 'บันทึกชื่อร้าน/หมวดต้นฉบับลงการเชื่อมต่อก่อนเปลี่ยนโปรไฟล์');
check(JSON.stringify(G.generateSnapshot(conn3, m3.category)) === snap3, 'Snapshot ที่ใช้ประเมินเหมือนเดิมทุกค่าแม้หมวดในโปรไฟล์เปลี่ยน');
const assess3b = asOwner(MID, () => V.runAssessment(MID))!.result;
check(assess3b.band === assess3.band && assess3b.score === assess3.score && assess3b.coverage.percent === assess3.coverage.percent, 'ผลประเมิน (Band / คะแนน / Coverage) ไม่เปลี่ยนจากการอนุมัติชื่อร้าน/หมวด');
check(notes('merchant', OPID).some((n) => n.title === 'อนุมัติการเปลี่ยนข้อมูลร้านแล้ว' && n.link === `/m/profile-changes/${id3}`), 'แจ้งร้านค้าเมื่ออนุมัติ');
check(audits(id3).some((a) => a.action === 'อนุมัติการเปลี่ยนข้อมูลร้าน' && a.actorRole === 'officer'), 'Audit Log: เจ้าหน้าที่อนุมัติ');
check(!actAs(['officer', 'admin'], () => V.approveProfileChange(id3)).ok && !actAs(['officer', 'admin'], () => V.rejectProfileChange(id3, 'x')).ok && !actAs(['officer', 'admin'], () => V.requestProfileChangeInfo(id3, 'x')).ok, 'คำขอที่พิจารณาแล้วพิจารณาซ้ำไม่ได้ (กดซ้ำ / Refresh ไม่ทำซ้ำ)');
check(audits(id3).filter((a) => a.action === 'อนุมัติการเปลี่ยนข้อมูลร้าน').length === 1, 'Audit การอนุมัติมีรายการเดียว');
// Auto-Fill หลังอนุมัติ: ชื่อใหม่ที่อนุมัติแล้วไม่ถูกตรวจซ้ำ และไม่เสนอให้กลับไปชื่อเดิม
const rows = A.fieldRows(V.registeredValues(m3), A.profileUpdateRules(src3b, V.registeredValues(m3)));
check(rows.find((x) => x.key === 'shopName')!.status === 'manual' && rows.find((x) => x.key === 'category')!.status === 'manual' && !rows.some((x) => x.status === 'verification_required'), 'อัปเดตโปรไฟล์ครั้งถัดไป: ชื่อร้าน/หมวดที่อนุมัติแล้วเป็น "ข้อมูลเดิมในระบบ" ไม่ต้องตรวจซ้ำ');
let page = view(`/m/marketplace/profile/${f.c.id}`, M);
check(page.includes('ดอยสูงคาเฟ่') && page.includes(`คำขอเปลี่ยนข้อมูลร้าน ${id3}`) && page.includes('อนุมัติแล้ว'), 'หน้าอัปเดตโปรไฟล์แสดงชื่อร้านที่อนุมัติแล้วและสถานะคำขอ');
page = view(`/o/profile-changes/${id3}`, { role: 'merchant', operatorId: OPID, merchantLoggedIn: true });
check(page.includes('ไม่มีสิทธิ์เข้าถึงหน้านี้'), 'ร้านค้าเปิดหน้าพิจารณาของเจ้าหน้าที่ไม่ได้ (Permission Denied)');

// ------------------------------------------------------------------ 3. Reject
describe('Officer Review → Reject (ข้อมูลเดิมไม่เปลี่ยน)');
f = fileRename('DRF-PC-4');
const id4 = f.r.record!.changeRequestId!;
asOfficer();
check(!actAs(['officer', 'admin'], () => V.rejectProfileChange(id4, '  ')).ok && req(id4).status === 'pending', 'ไม่อนุมัติโดยไม่ระบุเหตุผลไม่ได้');
check(actAs(['officer', 'admin'], () => V.rejectProfileChange(id4, 'ชื่อร้านใหม่ไม่ตรงกับเอกสารทะเบียนพาณิชย์')).ok && req(id4).status === 'rejected', 'ไม่อนุมัติพร้อมเหตุผล');
check(merchant().shopName === f.before.shopName && merchant().category === f.before.category && certs() === certStart, 'ไม่อนุมัติ → ชื่อร้าน หมวด และใบรับรองเป็นข้อมูลเดิม');
check(S.useMarketplaceStore.getState().items.find((c) => c.id === f.c.id)!.sourceShopName === undefined, 'ไม่อนุมัติ → ไม่แตะข้อมูลต้นฉบับของการเชื่อมต่อ');
check(notes('merchant', OPID).some((n) => n.title === 'ไม่อนุมัติการเปลี่ยนข้อมูลร้าน' && n.body.includes('ไม่ตรงกับเอกสาร')), 'ร้านค้าได้รับแจ้งพร้อมเหตุผล');
check(audits(id4).some((a) => a.action === 'ไม่อนุมัติการเปลี่ยนข้อมูลร้าน'), 'Audit Log: ไม่อนุมัติ');
page = view(`/m/profile-changes/${id4}`, M);
check(page.includes('ไม่อนุมัติ — ข้อมูลร้านยังเป็นข้อมูลเดิม') && page.includes('ไม่ตรงกับเอกสารทะเบียนพาณิชย์'), 'มุมร้านค้าเห็นสถานะและเหตุผลเดียวกับเจ้าหน้าที่');
const next4 = asOwner(f.c.id, () => V.confirmProfileUpdate(f.c.id, { ...V.registeredValues(merchant()), shopName: 'ดอยสูงคาเฟ่ใหม่' }, 'DRF-PC-4b'));
check(next4.record!.changeRequestId !== id4 && req(next4.record!.changeRequestId!).status === 'pending', 'หลังไม่อนุมัติ ร้านยื่นคำขอใหม่ได้ (เป็นคำขอใหม่ คำขอเดิมยังเก็บประวัติ)');

// ------------------------------------------------------------------ 4. Request More Information → Resubmit
describe('Request More Information → ร้านแก้ไขและส่งใหม่ → อนุมัติ');
f = fileRename('DRF-PC-5');
const id5 = f.r.record!.changeRequestId!;
asOfficer();
check(!actAs(['officer', 'admin'], () => V.requestProfileChangeInfo(id5, '')).ok, 'ขอข้อมูลเพิ่มต้องระบุสิ่งที่ต้องการ');
check(actAs(['officer', 'admin'], () => V.requestProfileChangeInfo(id5, 'กรุณาแนบหนังสือรับรองการเปลี่ยนชื่อร้าน')).ok && req(id5).status === 'info_requested', 'สถานะ "ขอข้อมูลเพิ่มเติม"');
check(!actAs(['officer', 'admin'], () => V.approveProfileChange(id5)).ok && merchant().shopName === f.before.shopName, 'ระหว่างรอข้อมูล อนุมัติไม่ได้ และข้อมูลเดิมยังใช้อยู่');
check(notes('merchant', OPID).some((n) => n.title.startsWith('เจ้าหน้าที่ขอข้อมูลเพิ่มเติม') && n.link === `/m/profile-changes/${id5}`), 'ร้านค้าได้รับแจ้งพร้อมลิงก์ไปแก้ไข');
page = view(`/o/profile-changes/${id5}`, O);
check(page.includes('รอร้านค้าส่งข้อมูลเพิ่มเติม') && page.includes('หนังสือรับรองการเปลี่ยนชื่อร้าน'), 'เจ้าหน้าที่เห็นสถานะรอร้าน');
// Draft / Refresh ของการแก้ไขส่งใหม่
asMerchant();
const rev5 = req(id5).revision;
S.useSessionStore.getState().saveDraft(V.changeRequestDraftKey(id5), { step: 0, data: { values: { shopName: 'ดอยสูง คอฟฟี่ โรสเตอร์', category: 'ของใช้ในบ้าน' }, note: 'แนบหนังสือรับรอง (จำลอง)', revision: rev5 }, savedAt: new Date().toISOString() });
check((storage['smetrust:v2:session'] ?? '').includes('ดอยสูง คอฟฟี่ โรสเตอร์'), 'ฉบับร่างการแก้ไขเก็บใน localStorage ของ v2');
page = view(`/m/profile-changes/${id5}`, M);
check(page.includes('เจ้าหน้าที่ขอข้อมูลเพิ่มเติม') && page.includes('แก้ไขและส่งข้อมูลเพิ่มเติม') && page.includes('แนบหนังสือรับรอง (จำลอง)'), 'Refresh หน้าแก้ไข → ฉบับร่าง (คำอธิบายถึงเจ้าหน้าที่) ยังอยู่ — ค่าในช่อง Input ตรวจใน E2E');
check(!asOwner(id5, () => V.resubmitProfileChange(id5, { shopName: 'ดอยสูง คอฟฟี่ โรสเตอร์' }, '', rev5)).ok, 'ส่งใหม่ต้องมีคำอธิบายถึงเจ้าหน้าที่');
check(!asOwner(id5, () => V.resubmitProfileChange(id5, { shopName: f.before.shopName, category: f.before.category }, 'x', rev5)).ok, 'ส่งข้อมูลที่เหมือนข้อมูลเดิมไม่ได้');
const re = asOwner(id5, () => V.resubmitProfileChange(id5, { shopName: 'ดอยสูง คอฟฟี่ โรสเตอร์' }, 'แนบหนังสือรับรอง (จำลอง)', rev5));
check(re.ok && !re.duplicate && req(id5).status === 'pending' && req(id5).revision === rev5 + 1 && req(id5).changes.find((x) => x.field === 'shopName')!.to === 'ดอยสูง คอฟฟี่ โรสเตอร์', 'ส่งใหม่ → กลับเป็น "รอพิจารณา" ด้วยข้อมูลที่แก้');
check(!S.useSessionStore.getState().shopDrafts[V.changeRequestDraftKey(id5)], 'ส่งแล้วล้างฉบับร่าง');
const dup = asOwner(id5, () => V.resubmitProfileChange(id5, { shopName: 'ดอยสูง คอฟฟี่ โรสเตอร์' }, 'แนบหนังสือรับรอง (จำลอง)', rev5));
check(dup.ok && dup.duplicate && req(id5).revision === rev5 + 1 && req(id5).history.filter((h) => h.action === 'resubmitted').length === 1, 'กดส่งซ้ำ / Refresh หลังส่ง → ไม่บันทึกซ้ำ');
check(notes('officer').some((n) => n.title === 'ร้านค้าส่งข้อมูลเพิ่มเติม (คำขอเปลี่ยนข้อมูลร้าน)'), 'แจ้งเจ้าหน้าที่เมื่อร้านส่งข้อมูลเพิ่ม');
asOfficer();
check(actAs(['officer', 'admin'], () => V.approveProfileChange(id5)).ok && merchant().shopName === 'ดอยสูง คอฟฟี่ โรสเตอร์', 'อนุมัติหลังส่งใหม่ → ใช้ข้อมูลฉบับล่าสุด');
check(req(id5).history.map((h) => h.action).join() === 'submitted,info_requested,resubmitted,approved', 'ประวัติการพิจารณาครบ: ยื่น → ขอข้อมูล → ส่งใหม่ → อนุมัติ');
check(['ร้านยื่นคำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง', 'ขอข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', 'ร้านส่งข้อมูลเพิ่มเติมสำหรับการเปลี่ยนข้อมูลร้าน', 'อนุมัติการเปลี่ยนข้อมูลร้าน'].every((a) => audits(id5).some((x) => x.action === a)), 'Audit Log ครบทุกขั้น');

// ------------------------------------------------------------------ 5. State consistency (SSR)
describe('Officer / Merchant State Consistency');
page = view('/o/profile-changes', O);
check(page.includes('คำขอเปลี่ยนข้อมูลร้าน') && page.includes('รอพิจารณา'), 'คิวเจ้าหน้าที่แสดงหมวดสถานะ');
page = view(`/o/profile-changes/${id5}`, O);
check(page.includes('อนุมัติแล้ว') && page.includes('ข้อมูลเดิม (โปรไฟล์/ใบรับรอง)') && page.includes('ข้อมูลใหม่ที่ขอ') && page.includes('ต้นฉบับจาก Shopee (จำลอง)') && page.includes('Level 3'), 'หน้าเจ้าหน้าที่: ตารางข้อมูลเดิม / ใหม่ / ต้นฉบับ และใบรับรองปัจจุบัน');
const mPage = view(`/m/profile-changes/${id5}`, M);
check(mPage.includes('อนุมัติแล้ว') && mPage.includes('ดอยสูง คอฟฟี่ โรสเตอร์'), 'หน้าร้านค้าแสดงสถานะเดียวกัน');
page = view('/m/profile-changes', M);
check(page.includes(id5) && page.includes(id4), 'รายการคำขอของร้านค้าแสดงทุกคำขอ');
page = view('/m/profile-changes', { role: 'merchant', operatorId: 'OP-001', merchantLoggedIn: true });
check(!page.includes(id5) && page.includes('ยังไม่มีคำขอเปลี่ยนข้อมูลร้าน'), 'บัญชีอื่นไม่เห็นคำขอของร้านนี้');

// ------------------------------------------------------------------ 6. Reset / Replay
describe('Reset Demo Data / เล่น Scenario 9 ซ้ำ');
V2S.fixtureV2Clean();
check(!reqs().some((r) => r.merchantId === MID) && merchant().shopName === f.before.shopName, 'เล่น Scenario 9 ซ้ำ → ล้างคำขอของ M-005 และคืนชื่อร้านตั้งต้น');
fileRename('DRF-PC-6');
W.resetAllDemoData();
check(reqs().length === 0 && S.domainStores.includes(S.useProfileChangeStore as never), 'Reset Demo Data → ไม่มีคำขอเปลี่ยนข้อมูลค้าง');

// ------------------------------------------------------------------ 7. Homepage (Concept v2)
describe('หน้าแรก — Executive Ready (Unified Platform)');
page = view('/');
check(page.includes('เชื่อมข้อมูลร้านค้า ประเมินความน่าเชื่อถือ สร้างความมั่นใจในการซื้อขายออนไลน์'), 'Hero Heading ตามข้อกำหนด');
check(page.includes('SME Trust เป็นแพลตฟอร์มกลางที่ช่วยผู้ประกอบการเชื่อมข้อมูลจากช่องทางขายออนไลน์ หรือสมัครด้วยตนเอง เพื่อประเมินความน่าเชื่อถือจากหลายปัจจัย และให้ผู้บริโภคตรวจสอบข้อมูลร้านค้าได้อย่างโปร่งใส'), 'Hero Subheading ตามข้อกำหนด');
check(page.includes('ไม่ใช่ Marketplace ไม่ขายสินค้า และไม่รับชำระเงิน'), 'ข้อความสั้น: ไม่ใช่ Marketplace ไม่ขายสินค้า และไม่รับชำระเงิน');
check(['เชื่อมร้านค้าออนไลน์', 'ลงทะเบียนด้วยตนเอง', 'ตรวจสอบร้านค้า', 'ทดลอง Demo'].every((t) => page.includes(t)), 'CTA หลัก 4 ปุ่ม');
check(['เชื่อมร้านค้า / สมัครเอง', 'นำเข้าหรือกรอกข้อมูล พร้อมยืนยันตัวตน', 'ระบบตรวจสอบและประเมินอัตโนมัติ', 'สร้าง Assessment Badge หรือแจ้งข้อมูลที่ต้องเพิ่มเติม', 'ผู้บริโภคตรวจสอบผ่าน QR หรือค้นหาร้านค้า', 'เจ้าหน้าที่ตรวจสอบเฉพาะกรณีจำเป็น'].every((t) => page.includes(t)), 'How SME Trust Works: 5 ขั้นตอน + เจ้าหน้าที่ตรวจเฉพาะกรณีจำเป็น');
check(['A. มีร้านบน Marketplace', 'เชื่อมบัญชี (จำลอง)', 'Auto-Fill', 'B. ไม่มี Marketplace', 'เลือกประเภทผู้ประกอบการ', 'เพิ่มหลักฐาน', 'มาตรฐานเดียวกัน', 'ไม่ถูกหักคะแนน'].every((t) => page.includes(t)), 'สองช่องทางสมัคร ภายใต้มาตรฐานเดียวกัน');
check(['ตัวตนผู้ประกอบการ', 'พฤติกรรมการขาย', 'คะแนนและรีวิว', 'ราคาและหมวดสินค้า', 'การปฏิบัติตามข้อกำหนด', 'ความครบถ้วนของข้อมูล', 'ความเชื่อมั่นในข้อมูล'].every((t) => page.includes(t)) && ['Identity & Business', 'Sales Performance', 'Customer Experience', 'Price Transparency', 'Compliance'].every((t) => page.includes(t)), 'Trust Assessment: 7 ปัจจัยตรงกับ Engine v2.1');
check(page.includes('ไม่ใช่คะแนนดาวอย่างเดียว') && page.includes('v2.1-sim') && page.includes('ระบบไม่สามารถตรวจจับการทุจริตได้ทั้งหมด') && page.includes('ตัวอย่างผลประเมิน (Mock UI)'), 'Trust Assessment: ไม่อ้างว่าตรวจจับทุจริตได้แน่นอน + Mock UI');
check(['ระบบสร้างผลประเมินและ Assessment Badge อัตโนมัติ เมื่อข้อมูลผ่านเกณฑ์', 'หากข้อมูลขาดหรือขัดแย้ง ระบบจะแจ้งให้เพิ่มเติม หรือส่งตรวจเฉพาะกรณีที่จำเป็น', 'การรับรองระดับที่ต้องใช้อำนาจอนุมัติยังแยกจากผลประเมินอัตโนมัติ'].every((t) => page.includes(t)), 'Assessment Badge: ข้อความ 3 ข้อตามข้อกำหนด');
check(['Insufficient Data', 'Outdated', 'Under Review', 'Withheld', 'Suspended / Revoked', 'Certification Level'].every((t) => page.includes(t)), 'แสดงสถานะ Badge และแยกจาก Certification Level');
check(['ลดการกรอกข้อมูลซ้ำ', 'ประเมินได้ตามข้อมูลที่มี', 'ตรวจสอบร้านค้า', 'ดูแหล่งข้อมูล', 'ดูสถานะ Badge', 'ลดงานตรวจซ้ำ', 'คัดกรองเฉพาะ Exception', 'มีหลักฐานประกอบการพิจารณา'].every((t) => page.includes(t)), 'Benefits 3 กลุ่ม');
check(!/\d+\s?%\s*(ของงาน|ภาระ)|ลดภาระ(งาน)?ได้\s*\d/.test(page), 'ไม่กล่าวอ้างตัวเลขการลดภาระงาน');
check([`สาธิตระบบ ${allScenarios.length} เส้นทาง`, 'เส้นทางอัตโนมัติ — จากเชื่อมร้านค้าจนถึงได้รับผลประเมิน', 'Marketplace App Entry', 'Marketplace Registration', 'Self-Registration', 'Exception Review', 'Consumer Verification', 'Consumer Protection', 'เริ่ม Full Journey: Marketplace & Trust', 'เริ่ม Full Journey: Consumer Protection'].every((t) => page.includes(t)), 'Interactive Demo แยกตาม User Journey + เน้นเส้นทางอัตโนมัติ');
check(page.includes('ระบบนี้เป็นต้นแบบเพื่อสาธิตแนวคิด ใช้ข้อมูลจำลอง และยังไม่เชื่อมต่อกับ Shopee, Lazada, DBD หรือ สคบ. จริง'), 'Prototype Notice ตามข้อกำหนด');
check(!/\bv1\b|\bv2\b(?!\.1)/.test(page.replace(/v2\.1-sim/g, '')) && !page.includes('Prevention First') && !/8 Scenario/.test(page), 'หน้าแรกไม่แสดง v1/v2 หรือ Concept เก่า');
check(allScenarios.length === 17, 'Demo มี 17 เส้นทาง (1–8, 9–13, 9A, 9B, 14, 15)');

finish();
