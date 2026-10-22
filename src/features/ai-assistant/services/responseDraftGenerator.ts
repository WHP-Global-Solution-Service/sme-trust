import type { ComplaintAnalysis, ComplaintKind, DraftContext, DraftTone, Particle } from '../types/ai.types';

/**
 * ตัวสร้างร่างคำตอบ (Template-based) — โครงสร้าง 6 ส่วน: ทักทาย → รับทราบปัญหา → แสดงความใส่ใจ
 * → ขั้นตอนตรวจสอบ → ทางเลือก/ข้อมูลที่ต้องการ → ปิดท้าย
 * ข้อห้าม: ไม่ยืนยันว่าร้าน "คืนเงิน/ส่งสินค้า/ดำเนินการแล้ว" (ยกเว้นข้อเสนอที่บันทึกใน Mock Workflow)
 * และไม่ใส่ตัวเลขหรือข้อเท็จจริงที่ไม่มีในข้อร้องเรียน
 */

const ISSUE: Record<ComplaintKind, string> = {
  non_delivery: 'เรื่องยังไม่ได้รับสินค้า',
  mismatch: 'เรื่องสินค้าไม่ตรงตามรายละเอียด',
  damaged: 'เรื่องสินค้าชำรุด',
  refund: 'เรื่องการคืนเงิน',
  delay: 'เรื่องการจัดส่งล่าช้า',
  service: 'เรื่องการให้บริการของร้าน',
  other: 'ปัญหาที่พบ',
};
const CHECK: Record<ComplaintKind, string> = {
  non_delivery: 'ตรวจสอบสถานะคำสั่งซื้อและข้อมูลการจัดส่ง',
  mismatch: 'ตรวจสอบรายละเอียดสินค้าที่จัดส่งเทียบกับข้อมูลที่แจ้งไว้',
  damaged: 'ตรวจสอบรายละเอียดสินค้าและเงื่อนไขการรับประกัน',
  refund: 'ตรวจสอบสถานะคำขอคืนเงินในระบบของร้าน',
  delay: 'ตรวจสอบสถานะพัสดุกับบริษัทขนส่ง',
  service: 'ตรวจสอบรายละเอียดการให้บริการที่เกิดขึ้น',
  other: 'ตรวจสอบข้อมูลที่เกี่ยวข้อง',
};
const OPTIONS: Record<ComplaintKind, string> = {
  non_delivery: 'กำหนดการจัดส่งที่ตรวจสอบได้ หรือทางเลือกการคืนเงินหากไม่สามารถจัดส่งได้',
  mismatch: 'ทางเลือกการเปลี่ยนหรือคืนสินค้าตามนโยบายของร้าน',
  damaged: 'ทางเลือกการเปลี่ยนสินค้า คืนเงิน หรือซ่อมตามความเหมาะสม',
  refund: 'ขั้นตอนและระยะเวลาการคืนเงินที่ดำเนินการได้จริง',
  delay: 'วันที่คาดว่าจะได้รับสินค้า และทางเลือกหากต้องการยกเลิก',
  service: 'ผลการตรวจสอบและแนวทางปรับปรุงการให้บริการ',
  other: 'ผลการตรวจสอบและแนวทางที่เหมาะสม',
};

/** คำลงท้ายหลัง "นะ" — นะคะ (ไม่ใช่ นะค่ะ) */
const afterNa = (p: Particle) => (p === 'ค่ะ' ? 'คะ' : p === 'ค่ะ/ครับ' ? 'คะ/ครับ' : 'ครับ');

const joinThai = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(' ')} และ${xs[xs.length - 1]}`);

interface Parts {
  greeting: string[];
  acknowledge: string[];
  care: string[];
  process: string[];
  info: string[];
  options: string[];
  closing: string[];
}

function phrases(tone: DraftTone, p: Particle, n: string, issue: string, check: string, missing: string, options: string, ref: string): Parts {
  switch (tone) {
    case 'formal':
      return {
        greeting: ['เรียน คุณลูกค้า', 'เรียน คุณลูกค้าที่เคารพ'],
        acknowledge: [`ทางร้านได้รับแจ้ง${issue}${ref}แล้ว`, `ทางร้านได้รับแจ้ง${issue}${ref}เรียบร้อยแล้ว`],
        care: ['และขออภัยในความไม่สะดวกที่เกิดขึ้น', 'ทางร้านขออภัยเป็นอย่างยิ่งในความไม่สะดวกดังกล่าว'],
        process: [`ทางร้านจะ${check}โดยเร็ว`, `ขณะนี้ทางร้านกำลังดำเนินการ${check}`],
        info: missing ? [`เพื่อให้การตรวจสอบเป็นไปอย่างรวดเร็ว รบกวนคุณลูกค้าแจ้งหรือส่ง${missing}`, `หากสะดวก รบกวนแจ้งหรือส่ง${missing}เพื่อใช้ประกอบการตรวจสอบ`] : [''],
        options: [`เมื่อตรวจสอบแล้ว ทางร้านจะแจ้ง${options}ให้ทราบ`, `ทางร้านจะแจ้ง${options}หลังการตรวจสอบ`],
        closing: [`ขอบคุณที่แจ้งข้อมูลให้ทางร้านทราบ${p}`, `ขอขอบพระคุณที่ให้โอกาสทางร้านได้แก้ไข${p}`],
      };
    case 'friendly':
      return {
        greeting: [`สวัสดี${p} คุณลูกค้า`, `สวัสดี${p}`],
        acknowledge: [`ร้านได้รับแจ้ง${issue}${ref}แล้วนะ${n}`, `ร้านรับทราบ${issue}${ref}แล้ว${p}`],
        care: ['ต้องขอโทษจริง ๆ ที่ทำให้ไม่สะดวกใจ', 'เข้าใจเลยว่าคงรู้สึกไม่สบายใจ ต้องขอโทษด้วยจริง ๆ'],
        process: [`ตอนนี้ร้านกำลัง${check}ให้อยู่`, `ร้านจะรีบ${check}ให้เร็วที่สุด`],
        info: missing ? [`ถ้าสะดวก ช่วยส่ง${missing}มาให้ร้านด้วยนะ${n} จะได้ตรวจสอบได้เร็วขึ้น`, `รบกวนช่วยแจ้ง${missing}เพิ่มเติมหน่อยนะ${n}`] : [''],
        options: [`พอตรวจสอบเสร็จ ร้านจะแจ้ง${options}ให้ทราบทันที`, `ร้านจะแจ้ง${options}ให้ทราบหลังตรวจสอบนะ${n}`],
        closing: [`ขอบคุณมากที่บอกให้ร้านทราบ${p}`, `ขอบคุณที่ให้โอกาสร้านได้ดูแลนะ${n}`],
      };
    case 'concise':
      return {
        greeting: ['เรียนคุณลูกค้า', 'เรียนคุณลูกค้า'],
        acknowledge: [`รับทราบ${issue}${ref}แล้ว${p}`, `ร้านรับทราบ${issue}${ref}แล้ว${p}`],
        care: ['ขออภัยในความไม่สะดวก', 'ขออภัยที่ทำให้ไม่สะดวก'],
        process: [`ร้านกำลัง${check}`, `ร้านจะ${check}`],
        info: missing ? [`รบกวนส่ง${missing}`, `ขอ${missing}เพื่อประกอบการตรวจสอบ`] : [''],
        options: [`จะแจ้ง${options}โดยเร็ว`, `จะแจ้งผลและ${options}`],
        closing: [`ขอบคุณ${p}`, `ขอบคุณที่แจ้ง${p}`],
      };
  }
}

export interface DraftOptions {
  tone: DraftTone;
  particle?: Particle;
  /** ใช้เลือกสำนวนต่างกันเมื่อกด Regenerate */
  variant?: number;
  context?: DraftContext;
}

export function generateDraft(analysis: ComplaintAnalysis, opts: DraftOptions): string {
  const p = opts.particle ?? 'ค่ะ/ครับ';
  const v = Math.abs(opts.variant ?? 0);
  const kinds = analysis.kinds.filter((k) => k !== 'other').slice(0, 2);
  const main: ComplaintKind[] = kinds.length ? kinds : ['other'];
  const issue = joinThai(main.map((k) => ISSUE[k].replace(/^เรื่อง/, ''))).replace(/^/, 'เรื่อง');
  const check = joinThai(main.map((k) => CHECK[k]));
  const options = OPTIONS[main[0]];
  const missing = joinThai(analysis.missing.slice(0, 3));
  const refs = [opts.context?.caseId ? `เลขที่เรื่อง ${opts.context.caseId}` : '', analysis.facts.orderRef ? `คำสั่งซื้อ ${analysis.facts.orderRef}` : ''].filter(Boolean);
  const ref = refs.length ? ` (${refs.join(', ')}) ` : '';
  const parts = phrases(opts.tone, p, afterNa(p), issue, check, missing, options, ref);
  const pick = (xs: string[]) => xs[v % xs.length];

  const body = [pick(parts.acknowledge), pick(parts.care), pick(parts.process)];
  const offers = opts.context?.confirmedOffers ?? [];
  if (offers.length) body.push(`ทั้งนี้ ${offers.join(' และ ')} ยังคงอยู่ในระบบเพื่อให้คุณลูกค้าพิจารณา`);
  if (pick(parts.info)) body.push(pick(parts.info));
  body.push(pick(parts.options));
  if (analysis.officerReviewSuggested) {
    body.push(
      opts.tone === 'concise'
        ? 'หากเกี่ยวข้องกับความปลอดภัย โปรดหยุดใช้สินค้า และสามารถแจ้งเจ้าหน้าที่ได้ตามสิทธิ์'
        : 'หากเรื่องนี้เกี่ยวข้องกับสุขภาพหรือความปลอดภัย แนะนำให้หยุดใช้สินค้าและปรึกษาผู้เชี่ยวชาญ ทั้งนี้คุณลูกค้าสามารถแจ้งเรื่องต่อเจ้าหน้าที่ได้ตามสิทธิ์',
    );
  }

  return [pick(parts.greeting), body.join(' '), pick(parts.closing)].join('\n\n');
}

export const TONE_LABEL: Record<DraftTone, string> = {
  formal: 'สุภาพและเป็นทางการ',
  friendly: 'เป็นมิตรและเข้าใจลูกค้า',
  concise: 'สั้น กระชับ และชัดเจน',
};
