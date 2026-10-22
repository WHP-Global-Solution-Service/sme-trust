import type { CaseMessage, ChannelType, Complaint, ComplaintCategory, ComplaintStatus, OfferType, ResolutionOffer, TimelineEvent } from '@/types';
import { screenComplaint } from '@/utils/screening';
import { d, doc } from './helpers';

interface Spec {
  n: number;
  m: string;
  c: string;
  cat: ComplaintCategory;
  title: string;
  desc: string;
  at: string; // yyyy-mm-ddTHH:MM
  amount: number;
  order: string;
  channel: ChannelType | 'other';
  status: ComplaintStatus;
  evidence?: number;
  respHours?: number;
  offer?: { type: OfferType; amount?: number; note: string };
  escalation?: string;
}

const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();

function build(s: Spec): Complaint {
  const id = `CMP-2569-${String(s.n).padStart(4, '0')}`;
  const created = d(s.at);
  let k = 0;
  const ev = (at: string, actor: TimelineEvent['actor'], title: string, note?: string): TimelineEvent => ({ id: `${id}-t${++k}`, at, actor, title, note });
  const msg = (at: string, from: CaseMessage['from'], text: string): CaseMessage => ({ id: `${id}-m${++k}`, at, from, text });

  const timeline: TimelineEvent[] = [ev(created, 'consumer', 'ผู้บริโภคยื่นเรื่อง'), ev(addHours(created, 0.1), 'system', 'คัดกรองเบื้องต้นและแจ้งร้านค้า', 'Merchant First Resolution')];
  const messages: CaseMessage[] = [msg(created, 'consumer', s.desc)];
  const offers: ResolutionOffer[] = [];
  let firstMerchantResponseAt: string | undefined;
  let resolvedAt: string | undefined;

  const responded = !['submitted', 'awaiting_merchant'].includes(s.status) && s.respHours !== undefined;
  if (responded) {
    const rAt = addHours(created, s.respHours!);
    firstMerchantResponseAt = rAt;
    const o = s.offer ?? { type: 'explain' as OfferType, note: 'ร้านค้าชี้แจงข้อเท็จจริง' };
    const status: ResolutionOffer['status'] =
      s.status === 'resolved' ? 'accepted' : s.status === 'escalated' || s.status === 'closed' ? 'rejected' : s.status === 'merchant_responded' ? 'negotiate' : 'pending';
    offers.push({ id: `${id}-o1`, type: o.type, amount: o.amount, note: o.note, status, createdAt: rAt });
    messages.push(msg(rAt, 'merchant', o.note));
    timeline.push(ev(rAt, 'merchant', 'ร้านค้าตอบกลับและเสนอแนวทางแก้ไข', o.note));
    if (s.status === 'merchant_responded') {
      messages.push(msg(addHours(rAt, 5), 'consumer', 'ขอเจรจาเพิ่มเติม ต้องการให้ร้านรับผิดชอบค่าส่งคืนด้วย'));
      timeline.push(ev(addHours(rAt, 5), 'consumer', 'ผู้บริโภคขอเจรจาเพิ่มเติม'));
    }
    if (s.status === 'resolved') {
      resolvedAt = addHours(rAt, 20);
      timeline.push(ev(resolvedAt, 'consumer', 'ผู้บริโภคยืนยันผลการแก้ไข'), ev(resolvedAt, 'system', 'ปิดเรื่อง: แก้ไขสำเร็จโดยร้านค้า'));
    }
  }
  if (s.status === 'escalated') {
    const at = addHours(created, (s.respHours ?? 72) + 24);
    timeline.push(ev(at, s.escalation?.includes('ระบบ') ? 'system' : 'consumer', 'ส่งต่อเจ้าหน้าที่', s.escalation));
  }
  if (s.status === 'closed') {
    const at = addHours(created, 240);
    timeline.push(ev(at, 'officer', 'เจ้าหน้าที่ปิดเรื่อง', 'ดำเนินการตามขั้นตอนครบถ้วน (ข้อมูลสาธิต)'));
    resolvedAt = at;
  }
  // ID คงที่ผูกกับเลขเรื่อง เพื่อให้ Reset ได้ข้อมูลเดิมทุกครั้ง
  const evidence = Array.from({ length: s.evidence ?? 2 }, (_, i) => ({
    ...doc(['ภาพแชตกับร้านค้า (จำลอง).png', 'สลิปโอนเงิน (จำลอง).jpg', 'ภาพสินค้าที่ได้รับ (จำลอง).jpg'][i % 3], 'หลักฐาน', s.at.slice(0, 10), 400 + i * 120),
    id: `${id}-doc${i + 1}`,
  }));
  const last = timeline[timeline.length - 1].at;
  return {
    id, merchantId: s.m, consumerId: s.c, category: s.cat, title: s.title, description: s.desc, incidentDate: d(s.at.slice(0, 10)),
    orderRef: s.order, orderAmount: s.amount, channel: s.channel, evidence, status: s.status, createdAt: created, updatedAt: last,
    firstMerchantResponseAt, resolvedAt, messages, offers, timeline, escalationReason: s.escalation,
    screening: { suggestedCategory: s.cat, missing: [], nextStep: '', priority: 'low', duplicateOf: [], severe: false, reasons: [], completeness: 100 },
  };
}

const specs: Spec[] = [
  { n: 1, m: 'M-001', c: 'CS-001', cat: 'not_as_described', title: 'สีผ้าพันคอไม่ตรงกับภาพ', desc: 'สั่งผ้าพันคอสีครามเข้ม แต่ได้รับสีครามอ่อนซึ่งไม่ตรงกับภาพในโพสต์ ต้องการเปลี่ยนสินค้า', at: '2026-06-02T10:00', amount: 890, order: 'FB-0602-118', channel: 'facebook', status: 'resolved', respHours: 4, offer: { type: 'replace', note: 'ขออภัยค่ะ จะส่งสีครามเข้มให้ใหม่ภายใน 2 วัน และส่งคืนสินค้าเดิมฟรี' } },
  { n: 2, m: 'M-001', c: 'CS-002', cat: 'defective', title: 'ตะเข็บเสื้อหลุดหลังซักครั้งแรก', desc: 'เสื้อผ้าครามตะเข็บแขนหลุดหลังซักมือครั้งแรก ทั้งที่ซักตามคำแนะนำของร้าน', at: '2026-10-15T14:00', amount: 1290, order: 'LINE-1015-042', channel: 'line', status: 'waiting_consumer', respHours: 6, offer: { type: 'refund', amount: 1290, note: 'ร้านยินดีคืนเงินเต็มจำนวน 1,290 บาท หรือเปลี่ยนตัวใหม่ตามที่ลูกค้าสะดวกค่ะ' } },
  { n: 3, m: 'M-003', c: 'CS-003', cat: 'misleading_ad', title: 'โฆษณาว่าขาวใน 3 วัน การันตีผล', desc: 'ไลฟ์ขายครีมบอกว่าขาวขึ้นใน 3 วัน การันตีได้ผล 100% ใช้ครบแล้วไม่เห็นผลตามโฆษณา', at: '2026-08-20T20:00', amount: 1590, order: 'TT-0820-771', channel: 'tiktok', status: 'closed', respHours: 30, offer: { type: 'explain', note: 'ผลลัพธ์ขึ้นอยู่กับสภาพผิวแต่ละบุคคล' } },
  { n: 4, m: 'M-003', c: 'CS-005', cat: 'misleading_ad', title: 'อ้างว่ารักษาฝ้าได้หายขาด', desc: 'โพสต์ขายเซรั่มเขียนว่ารักษาฝ้าหายขาดภายใน 7 วัน ซื้อมาใช้แล้วไม่ได้ผลและร้านไม่ยอมคืนเงิน', at: '2026-09-28T19:30', amount: 2490, order: 'FB-0928-305', channel: 'facebook', status: 'escalated', respHours: 50, offer: { type: 'explain', note: 'ร้านยืนยันว่าสินค้ามีคุณภาพ ไม่สามารถคืนเงินได้' }, escalation: 'ผู้บริโภคไม่ยอมรับข้อเสนอ และเป็นประเด็นการโฆษณา' },
  { n: 5, m: 'M-003', c: 'CS-007', cat: 'not_as_described', title: 'ได้รับลิปคนละเฉดสี', desc: 'สั่งลิปเฉด 03 แต่ได้รับเฉด 05 แจ้งร้านทางแชตแล้วยังไม่ได้รับคำตอบ', at: '2026-10-17T12:00', amount: 390, order: 'TT-1017-221', channel: 'tiktok', status: 'awaiting_merchant' },
  { n: 6, m: 'M-004', c: 'CS-004', cat: 'not_received', title: 'โอนเงินแล้วไม่ได้รับพาวเวอร์แบงก์', desc: 'โอนเงินซื้อพาวเวอร์แบงก์ 20,000 mAh ผ่านไป 15 วันยังไม่ได้รับสินค้า ร้านไม่ให้เลขพัสดุ', at: '2026-09-10T09:00', amount: 1190, order: 'FB-0910-009', channel: 'facebook', status: 'escalated', respHours: 96, offer: { type: 'reship', note: 'จะจัดส่งให้สัปดาห์หน้า' }, escalation: 'ร้านค้าไม่จัดส่งตามที่เสนอ' },
  { n: 7, m: 'M-004', c: 'CS-006', cat: 'not_received', title: 'ไม่ได้รับหูฟังและติดต่อร้านไม่ได้', desc: 'สั่งหูฟังไร้สายจาก TikTok Live โอนเงินแล้ว ร้านไม่ตอบแชตและไม่ได้รับของ', at: '2026-09-18T21:00', amount: 1590, order: 'TT-0918-640', channel: 'tiktok', status: 'escalated', escalation: 'ระบบส่งต่อเนื่องจากร้านค้าไม่ตอบกลับภายในกำหนด' },
  { n: 8, m: 'M-004', c: 'CS-001', cat: 'not_received', title: 'ยังไม่ได้รับสายชาร์จ', desc: 'สั่งสายชาร์จ 3 เส้น ผ่านมา 10 วันยังไม่ได้รับสินค้า เลขพัสดุที่ให้มาค้นหาไม่พบ', at: '2026-10-02T11:00', amount: 450, order: 'FB-1002-077', channel: 'facebook', status: 'awaiting_merchant' },
  { n: 9, m: 'M-004', c: 'CS-008', cat: 'not_received', title: 'ไม่ได้รับเคสโทรศัพท์', desc: 'สั่งเคสโทรศัพท์และฟิล์ม ไม่ได้รับสินค้า ภายหลังร้านจัดส่งให้แล้ว', at: '2026-07-05T15:00', amount: 350, order: 'FB-0705-310', channel: 'facebook', status: 'closed', respHours: 48, offer: { type: 'reship', note: 'จัดส่งใหม่พร้อมเลขพัสดุ' } },
  { n: 10, m: 'M-005', c: 'CS-002', cat: 'not_received', title: 'พัสดุกาแฟตกหล่น', desc: 'สั่งเมล็ดกาแฟ 2 ถุง สถานะขนส่งแจ้งว่าส่งแล้วแต่ไม่ได้รับ', at: '2026-07-12T08:00', amount: 760, order: 'WEB-0712-015', channel: 'website', status: 'resolved', respHours: 2, offer: { type: 'reship', note: 'ร้านส่งใหม่ให้ทันที 2 ถุงโดยไม่มีค่าใช้จ่าย และจะติดตามกับขนส่งเอง' } },
  { n: 11, m: 'M-005', c: 'CS-005', cat: 'not_as_described', title: 'ระดับการคั่วไม่ตรงที่สั่ง', desc: 'สั่งคั่วอ่อนแต่ได้คั่วกลาง ร้านยินดีเปลี่ยนให้', at: '2026-08-30T10:00', amount: 380, order: 'LINE-0830-210', channel: 'line', status: 'resolved', respHours: 3, offer: { type: 'replace', note: 'เปลี่ยนเป็นคั่วอ่อนให้ใหม่ ไม่ต้องส่งคืนของเดิมครับ' } },
  { n: 12, m: 'M-006', c: 'CS-003', cat: 'defective', title: 'ทุเรียนเนื้อเสียบางพู', desc: 'ทุเรียนหมอนทองที่ได้รับมีเนื้อเสีย 2 พู จากทั้งหมด 6 พู', at: '2026-06-15T13:00', amount: 1200, order: 'FB-0615-450', channel: 'facebook', status: 'resolved', respHours: 1, offer: { type: 'refund', amount: 400, note: 'ร้านคืนเงินตามสัดส่วนเนื้อที่เสีย 400 บาท ตามนโยบายเคลมภายใน 24 ชม.' } },
  { n: 13, m: 'M-006', c: 'CS-008', cat: 'defective', title: 'มังคุดช้ำทั้งกล่อง', desc: 'มังคุดที่ได้รับช้ำเกือบทั้งกล่อง น่าจะเกิดจากการขนส่ง', at: '2026-10-12T10:00', amount: 650, order: 'LINE-1012-099', channel: 'line', status: 'merchant_responded', respHours: 5, offer: { type: 'refund', amount: 325, note: 'ร้านเสนอคืนเงินครึ่งหนึ่ง 325 บาท' } },
  { n: 14, m: 'M-007', c: 'CS-004', cat: 'service_breach', title: 'ส่งสินค้าช้ากว่าที่ตกลง', desc: 'ตกลงว่าจะได้รับก่อนวันเกิดลูก แต่ได้รับช้าไป 5 วัน', at: '2026-05-20T09:00', amount: 990, order: 'FB-0520-031', channel: 'facebook', status: 'closed', respHours: 24, offer: { type: 'explain', note: 'ขออภัย ขนส่งล่าช้า มอบส่วนลดครั้งถัดไป' } },
  { n: 15, m: 'M-008', c: 'CS-006', cat: 'misleading_ad', title: 'อาหารเสริมอ้างลดน้ำหนัก ใช้แล้วมีผื่น', desc: 'โฆษณาว่าลดน้ำหนัก 10 กิโลใน 1 เดือน กินแล้วเกิดผื่นแพ้ต้องไปโรงพยาบาล', at: '2026-07-25T18:00', amount: 1890, order: 'FB-0725-512', channel: 'facebook', status: 'escalated', escalation: 'ระบบแนะนำส่งต่อทันที: กรณีเสี่ยงต่อสุขภาพ' },
  { n: 16, m: 'M-008', c: 'CS-007', cat: 'misleading_ad', title: 'อ้างรักษาเบาหวานได้', desc: 'โพสต์อ้างว่าผลิตภัณฑ์รักษาโรคเบาหวานได้หายขาด', at: '2026-08-02T20:00', amount: 2200, order: 'FB-0802-640', channel: 'facebook', status: 'closed', respHours: 72, offer: { type: 'explain', note: 'ร้านลบโพสต์แล้ว' } },
  { n: 17, m: 'M-009', c: 'CS-005', cat: 'not_as_described', title: 'ผ้าไหมไม่ใช่ไหมแท้ตามที่โฆษณา', desc: 'ซื้อผ้าไหมที่ระบุว่าไหมแท้ 100% แต่ตรวจสอบแล้วน่าจะผสมใยสังเคราะห์ ร้านไม่ยอมรับ', at: '2026-07-30T14:00', amount: 4500, order: 'LINE-0730-020', channel: 'line', status: 'escalated', respHours: 40, offer: { type: 'explain', note: 'ร้านยืนยันว่าเป็นไหมแท้' }, escalation: 'ผู้บริโภคไม่ยอมรับคำชี้แจง ขอให้เจ้าหน้าที่ตรวจสอบ' },
  { n: 18, m: 'M-009', c: 'CS-001', cat: 'not_as_described', title: 'ลายผ้าไม่ตรงกับภาพ', desc: 'ลายมัดหมี่ที่ได้รับไม่ตรงกับภาพตัวอย่างในโพสต์', at: '2026-10-18T09:30', amount: 3200, order: 'FB-1018-008', channel: 'facebook', status: 'awaiting_merchant' },
  { n: 19, m: 'M-002', c: 'CS-002', cat: 'other', title: 'ฉลากไม่ระบุวันหมดอายุ', desc: 'น้ำพริกที่ซื้อไม่มีวันหมดอายุบนฉลาก', at: '2026-10-19T17:00', amount: 180, order: '', channel: 'facebook', status: 'submitted', evidence: 0 },
  { n: 20, m: 'M-010', c: 'CS-008', cat: 'refund_refused', title: 'ร้านไม่คืนเงินสินค้าที่ยกเลิก', desc: 'ยกเลิกคำสั่งซื้อก่อนจัดส่ง ร้านรับปากว่าจะโอนคืนแต่ผ่านไป 2 สัปดาห์ยังไม่ได้รับเงินคืน', at: '2026-10-08T11:00', amount: 520, order: 'FB-1008-112', channel: 'facebook', status: 'awaiting_merchant' },
];

export function buildComplaints(): Complaint[] {
  const list = specs.map(build);
  return list.map((c) => {
    const screening = screenComplaint(
      { merchantId: c.merchantId, consumerId: c.consumerId, category: c.category, description: c.description, orderRef: c.orderRef, incidentDate: c.incidentDate, orderAmount: c.orderAmount, evidenceCount: c.evidence.length, excludeId: c.id },
      list.filter((o) => o.createdAt < c.createdAt),
    );
    return { ...c, screening };
  });
}
