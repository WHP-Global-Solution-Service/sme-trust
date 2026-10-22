/** Unit tests — AI Simulation Rule Engine (Pure Functions) */
import { describe, check, finish } from './harness.mts';

const { analyzeAd, buildSegments, validateAdInput } = await import('@/features/ai-assistant/services/advertisingAnalyzer');
const { analyzeComplaint, validateComplaintInput, extractFacts } = await import('@/features/ai-assistant/services/complaintAnalyzer');
const { generateDraft } = await import('@/features/ai-assistant/services/responseDraftGenerator');
const { AD_EXAMPLES, COMPLAINT_EXAMPLES } = await import('@/features/ai-assistant/data/aiExamples');

const ids = (t: string) => analyzeAd(t).findings.map((f) => f.ruleId);

describe('Advertising Analyzer');
check(ids('อาหารเสริมรักษาได้ทุกโรค หายขาดแน่นอน ราคา 500 บาท').includes('health-cure'), 'Health Claims: "รักษาได้ทุกโรค / หายขาด"');
check(ids('ครีมนี้เห็นผลทันที ลดน้ำหนัก 5 กิโล ราคา 300 บาท').includes('health-instant'), 'Health Claims: "เห็นผลทันที / ลดน้ำหนัก 5 กิโล"');
check(ids('ไม่ต้องพบแพทย์ ใช้แทนยาได้ ราคา 300 บาท').includes('health-no-doctor'), 'Health Claims: "ไม่ต้องพบแพทย์"');
let a = analyzeAd('การันตีผล ได้ผลแน่นอน 100% ไม่มีผลข้างเคียง ราคา 590 บาท');
check(['absolute-guarantee', 'absolute-100', 'absolute-safe'].every((r) => a.findings.some((f) => f.ruleId === r)) && a.level === 'high', 'Absolute Claims: การันตี / 100% / ไม่มีผลข้างเคียง → High');
a = analyzeAd('ลดราคา 50% ทั้งร้าน ซื้อ 1 แถม 1 ทักแชตได้เลย');
const promo = a.findings.find((f) => f.ruleId === 'missing-promotion-terms');
check(a.findings.some((f) => f.ruleId === 'promotion') && !!promo && promo.matched.includes('ระยะเวลาโปรโมชัน') && a.level === 'medium', 'Promotion Conditions: ขาดระยะเวลา/เงื่อนไข → Medium');
const good = analyzeAd(AD_EXAMPLES.find((e) => e.id === 'ad-good')!.text);
check(!good.findings.some((f) => f.ruleId === 'missing-promotion-terms') && !good.findings.some((f) => f.ruleId === 'missing-price'), 'โฆษณาที่ระบุเงื่อนไขครบ ไม่ถูกแจ้งว่าขาดข้อมูล');
a = analyzeAd('รักษาได้ทุกโรค การันตี 100% อันดับ 1 โอกาสสุดท้าย ลดราคา 50%');
check(new Set(a.findings.map((f) => f.category)).size >= 5, `Multiple Findings: พบ ${a.findings.length} ประเด็นจาก ${new Set(a.findings.map((f) => f.category)).size} กลุ่ม`);
a = analyzeAd('หายขาด หายขาด หายขาด ราคา 100 บาท');
check(a.findings.find((f) => f.ruleId === 'health-cure')!.occurrences === 3 && a.findings.find((f) => f.ruleId === 'health-cure')!.matched.length === 1, 'คำซ้ำ: นับ 3 ครั้ง แสดงข้อความที่พบไม่ซ้ำ');
a = analyzeAd('ผ้าพันคอทอมือ ขนาด 30x180 ซม. ราคา 450 บาท');
check(a.findings.length === 0 && a.level === 'low' && a.revision === null, 'No Match: ไม่พบความเสี่ยง → Low และไม่สร้างข้อความแก้ไข');
const xss = '<img src=x onerror=alert(1)> <script>alert("x")</script> รักษาได้ทุกโรค & "quote" ราคา 99 บาท';
a = analyzeAd(xss);
const segs = buildSegments(xss, a.findings);
check(segs.map((s) => s.text).join('') === xss && segs.some((s) => s.findingIds.includes('health-cure')), 'Special Characters/HTML: ข้อความต้นฉบับคงเดิมทุกตัวอักษร (Render เป็น Text) และ Highlight ถูกตำแหน่ง');
check(a.revision!.includes('<script>'), '  ฉบับแก้ไขเก็บอักขระพิเศษเป็นข้อความธรรมดา (ไม่ตีความเป็น HTML)');
const th = analyzeAd('เซรั่มขาวใน 7 วัน ปลอดภัยที่สุด ราคา 590 บาท');
check(th.findings.some((f) => f.ruleId === 'health-instant') && th.findings.some((f) => f.ruleId === 'absolute-safe'), 'Thai Text: จับวลีไทยที่ไม่มีช่องว่างคั่นได้');
const en = analyzeAd('Instant results! Cures all diseases, guaranteed, no side effects. #1 best in the country. Buy now, 50% off!');
check(['health-instant', 'health-cure', 'absolute-guarantee', 'absolute-safe', 'superiority', 'urgency', 'promotion'].every((r) => en.findings.some((f) => f.ruleId === r)), 'English Text: ครบทุกกลุ่มกฎ');
const mixed = analyzeAd('Serum สูตรใหม่ guaranteed เห็นผลทันที ลดราคา 30% ถึง 31 ต.ค.');
check(mixed.findings.some((f) => f.ruleId === 'absolute-guarantee') && mixed.findings.some((f) => f.ruleId === 'health-instant'), 'ไทย/อังกฤษผสม');
check(validateAdInput('') !== null && validateAdInput('     ') !== null && validateAdInput('สั้นไป') !== null && validateAdInput('ก'.repeat(2001)) !== null && validateAdInput('ข้อความโฆษณาปกติทั่วไป') === null, 'Input: ว่าง / ช่องว่างล้วน / สั้นเกิน / ยาวเกิน ถูกปฏิเสธ');
const rev = analyzeAd(AD_EXAMPLES[1].text);
check(!!rev.revision && !/การันตี|100%|ไม่มีผลข้างเคียง|ปลอดภัยที่สุด|ได้ผลแน่นอน/.test(rev.revision) && rev.revision.includes('['), 'Suggested Revision: ตัดคำรับประกันเกินจริง และใช้ [Placeholder] แทนข้อมูลที่ร้านต้องตรวจเอง');
check(!/\d+\s*(?:คน|ราย)|ผลการทดสอบ|ผ่านการรับรองจาก/.test(rev.revision!), '  ไม่แต่งผลทดสอบหรือหลักฐานขึ้นมาเอง');
const reAnalyzed = analyzeAd(rev.revision!);
check(reAnalyzed.score < rev.score, `Re-analyze ฉบับแก้ไข: คะแนนความเสี่ยงลดลง (${rev.score} → ${reAnalyzed.score})`);
const allClaims = analyzeAd('รักษาได้ทุกโรค หายขาด การันตี 100%');
check(allClaims.revision === null && !!allClaims.revisionNote, 'ข้อความเกือบทั้งหมดเป็นข้อกล่าวอ้าง → ไม่สร้างฉบับแก้ไข แสดงคำแนะนำแทน');
for (const ex of AD_EXAMPLES) check(analyzeAd(ex.text).level === ex.expected, `ตัวอย่าง "${ex.title}" → ${ex.expected}`);
check(!JSON.stringify(analyzeAd(AD_EXAMPLES[0].text)).match(/ผิดกฎหมาย(?!หรือ)/), 'ผลวิเคราะห์ไม่สรุปว่า "ผิดกฎหมาย"');

describe('Complaint Analyzer');
const kinds = (t: string) => analyzeComplaint(t).kinds;
let c = analyzeComplaint('โอนเงินแล้ว 1,190 บาท ยังไม่ได้รับสินค้าเลย');
check(c.primary === 'non_delivery' && c.keyIssues[0] === 'ลูกค้าแจ้งว่าชำระเงินแล้ว แต่ยังไม่ได้รับสินค้า', 'Non-delivery + การชำระเงิน → สรุปประเด็นถูกต้อง');
check(c.missing.includes('เลขคำสั่งซื้อ') && c.missing.includes('ข้อมูลการติดตามพัสดุ (เลขพัสดุ)') && !c.missing.includes('ภาพสินค้าที่ได้รับ'), '  Missing Information เฉพาะที่เกี่ยวกับเคสไม่ได้รับสินค้า');
c = analyzeComplaint('ร้านไม่ยอมคืนเงินให้ ผ่านมา 2 สัปดาห์แล้ว ยังไม่ได้รับเงินคืน');
check(c.primary === 'refund' && !c.kinds.includes('non_delivery'), 'Refund Issue: "ยังไม่ได้รับเงินคืน" ไม่ถูกจัดเป็นไม่ได้รับสินค้า');
check(kinds('สินค้าที่ได้รับแตกและใช้งานไม่ได้')[0] === 'damaged', 'Damaged Goods');
check(kinds('ได้สินค้าคนละสีกับที่สั่ง ไม่ตรงกับรูป')[0] === 'mismatch', 'Product Mismatch');
c = analyzeComplaint('ได้รับสินค้าล่าช้าและสินค้าชำรุด อยากได้เงินคืน');
check(c.kinds.length >= 3 && c.level === 'attention' && c.levelReasons.some((r) => r.includes('หลายประเด็น')), `Multiple Issues: ${c.kinds.join(', ')} → Attention`);
c = analyzeComplaint('อยากสอบถามเรื่องสีของผ้าม่านที่ขายอยู่');
check(c.primary === 'other' && c.keyIssues.some((k) => k.includes('ยังจัดประเภทไม่ได้')), 'Unknown Category → Other');
c = analyzeComplaint('ใช้ครีมแล้วแพ้รุนแรงต้องเข้าโรงพยาบาล');
check(c.level === 'urgent' && c.officerReviewSuggested && c.recommendations[0].includes('เจ้าหน้าที่'), 'กรณีอันตรายต่อสุขภาพ → Urgent Review และแนะนำให้เจ้าหน้าที่ตรวจสอบ');
check(analyzeComplaint('ร้านหลอกลวง โอนเงินแล้วร้านบล็อกแชต').level === 'urgent', 'บ่งชี้การหลอกลวง → Urgent Review');
c = analyzeComplaint('ไม่ได้รับของ');
check(!c.keyIssues.some((k) => /\d/.test(k)) && c.facts.orderRef === undefined && c.facts.amount === undefined, 'ข้อมูลไม่ครบ: ไม่สร้างเลขคำสั่งซื้อ/มูลค่าที่ไม่มีในข้อความ');
const f = extractFacts('เลขคำสั่งซื้อ FB-2210-045 ราคา 2,500 บาท สั่งเมื่อ 12 ต.ค. 2569');
check(f.orderRef === 'FB-2210-045' && f.amount === '2,500 บาท' && f.date?.startsWith('12 ต.ค.'), 'ดึงเลขคำสั่งซื้อ มูลค่า และวันที่จากข้อความ');
check(analyzeComplaint('Paid 900 baht but never received the item, seller not responding').primary === 'non_delivery', 'ข้อความภาษาอังกฤษ');
check(validateComplaintInput('   ') !== null && validateComplaintInput('สั้น') !== null, 'Input ว่าง/สั้นเกินถูกปฏิเสธ');
check(!JSON.stringify(analyzeComplaint(COMPLAINT_EXAMPLES[0].text)).includes('ร้านผิด'), 'ไม่ตัดสินว่าร้านค้าเป็นฝ่ายผิด');

describe('Response Draft Generator');
const an = analyzeComplaint(COMPLAINT_EXAMPLES[0].text);
const formal = generateDraft(an, { tone: 'formal' });
const friendly = generateDraft(an, { tone: 'friendly' });
const concise = generateDraft(an, { tone: 'concise' });
check(formal.startsWith('เรียน') && formal.includes('ขออภัย') && formal.includes('ตรวจสอบ') && formal.includes('ขอบคุณ'), 'Formal Tone: ทักทาย → รับทราบ → ขออภัย → ตรวจสอบ → ปิดท้าย');
check(friendly.startsWith('สวัสดี') && friendly !== formal, 'Friendly Tone');
check(concise.length < formal.length && concise.length < friendly.length, `Concise Tone สั้นที่สุด (${concise.length} < ${formal.length})`);
check(formal.includes('เลขคำสั่งซื้อ') && formal.includes('รบกวน'), 'Missing Data: ขอข้อมูลที่ขาดในร่างคำตอบ');
check(generateDraft(an, { tone: 'formal', variant: 1 }) !== formal, 'Regenerate ได้สำนวนต่างจากเดิม');
let grammarOk = true;
for (const ex of COMPLAINT_EXAMPLES)
  for (const tone of ['formal', 'friendly', 'concise'] as const)
    for (const variant of [0, 1])
      for (const particle of ['ค่ะ', 'ครับ', 'ค่ะ/ครับ'] as const) {
        const d = generateDraft(analyzeComplaint(ex.text), { tone, variant, particle, context: { caseId: 'CMP-2569-0005' } });
        // ย่อหน้า (\n\n) ถูกต้อง — ตรวจเฉพาะช่องว่างซ้อนภายในประโยค
        if (/เรื่องเรื่อง|นะค่ะ|\)แล้ว|[^\S\n]{2,}/.test(d)) grammarOk = false;
      }
check(grammarOk, 'ภาษา: ไม่มี "เรื่องเรื่อง", "นะค่ะ" หรือวงเล็บติดคำ ในทุก Tone/สำนวน/คำลงท้าย');
check(generateDraft(an, { tone: 'formal', particle: 'ครับ' }).includes('ครับ') && !generateDraft(an, { tone: 'formal', particle: 'ครับ' }).includes('ค่ะ'), 'เลือกคำลงท้าย ครับ/ค่ะ ได้');
const noFab = (draft: string, input: string, extra = '') => (draft.match(/\d(?:[\d,]*\d)?/g) ?? []).every((n) => (input + extra).includes(n));
let allOk = true;
for (const ex of COMPLAINT_EXAMPLES)
  for (const tone of ['formal', 'friendly', 'concise'] as const)
    for (const variant of [0, 1]) {
      const d = generateDraft(analyzeComplaint(ex.text), { tone, variant, context: { caseId: 'CMP-2569-0005' } });
      if (!noFab(d, ex.text, 'CMP-2569-0005') || /คืนเงิน(?:ให้)?แล้ว|ส่งสินค้า(?:ให้)?แล้ว|ได้ดำเนินการแล้ว|จัดส่งเรียบร้อย/.test(d)) allOk = false;
    }
check(allOk, 'No Fabricated Facts: ทุกตัวอย่าง × 3 Tone × 2 สำนวน — ไม่มีตัวเลขที่ไม่อยู่ในข้อความ และไม่อ้างว่าคืนเงิน/ส่งสินค้าแล้ว');
const withOffer = generateDraft(an, { tone: 'formal', context: { confirmedOffers: ['ข้อเสนอคืนเงินที่ร้านแจ้งไว้'] } });
check(withOffer.includes('ข้อเสนอคืนเงินที่ร้านแจ้งไว้') && withOffer.includes('พิจารณา'), 'อ้างถึงข้อเสนอเฉพาะที่มีอยู่ใน Mock Workflow');
const urgentDraft = generateDraft(analyzeComplaint('ใช้แล้วแพ้รุนแรงต้องเข้าโรงพยาบาล'), { tone: 'friendly' });
check(urgentDraft.includes('เจ้าหน้าที่ได้ตามสิทธิ์'), 'กรณีเร่งด่วน: ร่างคำตอบไม่ตัดสิทธิ์ผู้บริโภคในการแจ้งเจ้าหน้าที่');
const noReply = analyzeComplaint('สั่งลิปเฉด 03 แต่ได้รับเฉด 05 แจ้งร้านทางแชตแล้วยังไม่ได้รับคำตอบ');
check(noReply.primary === 'mismatch' && !noReply.kinds.includes('non_delivery') && noReply.kinds.includes('service'), '"ยังไม่ได้รับคำตอบ" ไม่ถูกจัดเป็นไม่ได้รับสินค้า (นับเป็นการบริการ)');


describe('Regression — UAT Prompt 4');
const EN_ALL = 'Cures all diseases, instant results guaranteed, 100% safe, no side effects. Best in Thailand! Only today, buy now. Sale 50% off';
const enIds = new Set([...ids(EN_ALL), ...ids('No need to see a doctor, replaces your medicine. 590 baht')]);
const ALL_RULES = ['health-cure', 'health-instant', 'health-no-doctor', 'absolute-100', 'absolute-guarantee', 'absolute-safe', 'superiority', 'promotion', 'urgency', 'missing-promotion-terms', 'missing-price'];
check(ALL_RULES.every((r) => enIds.has(r)), `ภาษาอังกฤษตรวจพบครบ 11 กฎ${ALL_RULES.filter((r) => !enIds.has(r)).length ? ' — ขาด: ' + ALL_RULES.filter((r) => !enIds.has(r)).join(', ') : ''}`);
const enRev = analyzeAd(EN_ALL).revision ?? '';
check(!/\bdiseases\b|\bsafe\b/i.test(enRev.split('\n')[0]), 'Revision ภาษาอังกฤษไม่เหลือคำค้าง ("diseases", "safe") หลังแทนที่');
const docRev = analyzeAd('No need to see a doctor, replaces your medicine. 590 baht').revision ?? '';
check(docRev.startsWith('590 baht') && !/[,.]{2}|^[,.]/m.test(docRev), 'ลบข้อความทั้งประโยค → ไม่เหลือเครื่องหมาย ",." หรือจุลภาคต้นบรรทัด');
const thDoc = analyzeAd('ไม่ต้องพบแพทย์ ใช้แทนยาได้ ราคา 300 บาท').revision ?? '';
check(!/^ได้\b|\sได้\s+ราคา/.test(thDoc) && thDoc.includes('ราคา 300 บาท'), 'ภาษาไทย: ลบ "ใช้แทนยาได้" ทั้งวลี ไม่เหลือ "ได้" ค้าง');
const allRevOk = [...AD_EXAMPLES.map((e) => e.text), EN_ALL].every((t) => {
  const r = analyzeAd(t).revision ?? '';
  const digits = (r.replace(/\[[^\]]*\]/g, '').match(/\d+/g) ?? []).filter((n) => !t.includes(n));
  return digits.length === 0 && !/[,.]{2}/.test(r);
});
check(allRevOk, 'Suggested Revision ไม่สร้างตัวเลข/ข้อเท็จจริงใหม่ (ข้อมูลที่ต้องเติมอยู่ใน [ ] เท่านั้น) ทุกตัวอย่าง');
const multi = analyzeAd(EN_ALL);
const segText = buildSegments(EN_ALL, multi.findings);
check(segText.map((x) => x.text).join('') === EN_ALL && multi.findings.filter((f) => f.ruleId !== 'missing-price' && f.ruleId !== 'missing-promotion-terms').every((f) => f.matches.every((m) => EN_ALL.slice(m.start, m.end) === m.text)), 'Highlight: ตำแหน่งที่ตรวจพบตรงกับข้อความจริง และรวมกลับได้ข้อความเดิม (หลายเงื่อนไขพร้อมกัน)');

const KIND_CASES: [string, string, string[]?][] = [
  ['ยังไม่ได้รับคำตอบจากร้าน', 'service', ['non_delivery']],
  ['ไม่ได้รับความสะดวกในการติดต่อ', 'service', ['non_delivery']],
  ['ร้านไม่ได้รับผิดชอบอะไรเลย', 'service', ['non_delivery']],
  ['ไม่ได้รับการติดต่อกลับ', 'service', ['non_delivery']],
  ['ไม่ได้รับเงินคืนตามที่ตกลง', 'refund', ['non_delivery']],
  ['ได้รับสินค้าแล้วแต่แตกเสียหาย', 'damaged', ['non_delivery']],
  ['ไม่ได้รับสินค้าที่ถูกต้อง ได้คนละรุ่น', 'mismatch', ['non_delivery']],
  ['โอนเงินแล้วไม่ได้รับของ', 'non_delivery'],
  ['สั่งไปสองสัปดาห์ยังไม่ได้รับ', 'non_delivery'],
  ['พัสดุมาช้ากว่ากำหนด 5 วัน', 'delay'],
  ['อยากสอบถามเรื่องใบกำกับภาษี', 'other'],
  ['Package arrived late, delayed 10 days', 'delay'],
  ['Item arrived broken', 'damaged'],
  ['I want a refund, still not refunded', 'refund'],
  ['Received wrong colour, not as described', 'mismatch'],
  ['The shop was rude and gave no response', 'service'],
  ['Paid 900 baht but never received the item', 'non_delivery'],
];
const kindFails = KIND_CASES.filter(([t, k, not = []]) => {
  const r = analyzeComplaint(t);
  return r.primary !== k || not.some((n) => r.kinds.includes(n as never));
});
check(kindFails.length === 0, `จัดประเภทครบ 7 ประเภท และไม่เข้าใจคำปฏิเสธผิด (${KIND_CASES.length} กรณี)${kindFails.length ? ' — ผิด: ' + kindFails.map((f) => f[0]).join(' | ') : ''}`);
check(new Set(KIND_CASES.map((k) => k[1])).size === 7, '  กรณีทดสอบครอบคลุมทั้ง 7 ประเภท');
const askMore = analyzeComplaint('โอนเงินแล้วไม่ได้รับของ');
const askDone = analyzeComplaint('โอนเงินแล้วไม่ได้รับของ เลขคำสั่งซื้อ A-1001 วันที่ 3 ต.ค. แนบสลิปการโอน เลขพัสดุ TH123');
check(askMore.missing.length > askDone.missing.length, 'ข้อมูลที่ควรขอเพิ่มลดลงเมื่อข้อความมีข้อมูลครบขึ้น');

finish();
