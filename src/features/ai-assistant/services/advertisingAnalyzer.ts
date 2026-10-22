import type { AdAnalysis, AdFinding, AdRiskLevel, AdRule, Segment, Severity, TextMatch } from '../types/ai.types';
import { AD_MAX_LENGTH, AD_MIN_LENGTH, AD_RULES, PRICE_PATTERN, PROMOTION_CONDITION_CHECKS } from '../rules/advertisingRules';

/**
 * AI-01 Advertising Compliance Checker — Rule-based Engine (Pure Functions)
 * ทำงานในเบราว์เซอร์ทั้งหมด ไม่เรียก API และไม่ใช่ AI Model จริง
 */

const WEIGHT: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

export function validateAdInput(text: string): string | null {
  const t = text.trim();
  if (!t) return 'กรุณากรอกข้อความโฆษณาก่อนวิเคราะห์';
  if (t.length < AD_MIN_LENGTH) return `ข้อความสั้นเกินไป (อย่างน้อย ${AD_MIN_LENGTH} ตัวอักษร)`;
  if (text.length > AD_MAX_LENGTH) return `ข้อความยาวเกิน ${AD_MAX_LENGTH.toLocaleString()} ตัวอักษร`;
  return null;
}

const globalize = (re: RegExp) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);

/** หาตำแหน่งที่ตรงกับกฎ — ตัดรายการที่ทับซ้อนกันภายในกฎเดียว (เก็บรายการที่ยาวกว่า) */
export function findMatches(text: string, rule: AdRule): TextMatch[] {
  const all: TextMatch[] = [];
  for (const p of rule.patterns) {
    const re = globalize(p);
    for (const m of text.matchAll(re)) {
      if (!m[0]) continue;
      all.push({ start: m.index!, end: m.index! + m[0].length, text: m[0] });
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: TextMatch[] = [];
  for (const m of all) {
    const last = out[out.length - 1];
    if (last && m.start < last.end) continue;
    out.push(m);
  }
  return out;
}

function toFinding(rule: AdRule, matches: TextMatch[]): AdFinding {
  return {
    ruleId: rule.id,
    category: rule.category,
    label: rule.label,
    severity: rule.severity,
    matched: [...new Set(matches.map((m) => m.text.trim()))],
    matches,
    occurrences: matches.length,
    explanation: rule.explanation,
    why: rule.why,
    suggestion: rule.suggestion,
  };
}

/** กลุ่ม F: ข้อมูลสำคัญที่อาจขาด ตามบริบทของข้อความ */
function missingInfoFindings(text: string, hasPromotion: boolean): AdFinding[] {
  const out: AdFinding[] = [];
  if (hasPromotion) {
    const missing = PROMOTION_CONDITION_CHECKS.filter((c) => !c.pattern.test(text)).map((c) => c.label);
    if (missing.length) {
      out.push({
        ruleId: 'missing-promotion-terms',
        category: 'missing',
        label: 'เงื่อนไขโปรโมชันอาจไม่ครบถ้วน',
        severity: missing.length >= 2 ? 'medium' : 'low',
        matched: missing,
        matches: [],
        occurrences: missing.length,
        explanation: `ไม่พบข้อมูล: ${missing.join(', ')}`,
        why: 'ผู้บริโภคควรทราบเงื่อนไขสำคัญของโปรโมชันก่อนตัดสินใจซื้อ',
        suggestion: 'เพิ่มข้อมูลที่ขาดตามเงื่อนไขจริงของร้าน (ระบบไม่เติมข้อมูลแทน)',
      });
    }
  }
  if (text.trim().length >= 30 && !PRICE_PATTERN.test(text)) {
    out.push({
      ruleId: 'missing-price',
      category: 'missing',
      label: 'ไม่พบราคาสินค้า',
      severity: 'low',
      matched: ['ราคาสินค้า'],
      matches: [],
      occurrences: 1,
      explanation: 'ข้อความไม่ระบุราคาสินค้าหรือบริการ',
      why: 'การแสดงราคาให้ชัดเจนช่วยลดความเข้าใจคลาดเคลื่อนและข้อพิพาทหลังการซื้อ',
      suggestion: 'ระบุราคาสินค้า (และค่าจัดส่ง ถ้ามี) ตามข้อมูลจริง',
    });
  }
  return out;
}

export function riskLevel(findings: AdFinding[]): { level: AdRiskLevel; score: number } {
  const score = findings.reduce((s, f) => s + WEIGHT[f.severity], 0);
  if (findings.some((f) => f.severity === 'high') || score >= 6) return { level: 'high', score };
  if (score >= 3 || findings.some((f) => f.severity === 'medium')) return { level: 'medium', score };
  return { level: 'low', score };
}

/**
 * สร้างข้อความฉบับเสนอแก้ไขด้วย Rule-based Replacement
 * - ไม่สร้างข้อมูลสินค้าใหม่ ข้อมูลที่ร้านต้องตรวจเองใช้ [Placeholder]
 * - ถ้าข้อความส่วนใหญ่ต้องถูกแทนที่ จะไม่สร้างฉบับแก้ไข และให้ใช้คำแนะนำรายข้อแทน
 */
export function buildRevision(text: string, findings: AdFinding[]): { revision: string | null; note?: string } {
  if (!findings.length) return { revision: null };
  const ruleById = new Map(AD_RULES.map((r) => [r.id, r]));
  const edits = findings
    .flatMap((f) => {
      const rep = ruleById.get(f.ruleId)?.replacement;
      return rep === undefined ? [] : f.matches.map((m) => ({ ...m, rep }));
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: typeof edits = [];
  for (const e of edits) {
    const last = kept[kept.length - 1];
    if (last && e.start < last.end) continue;
    kept.push(e);
  }

  const replacedChars = kept.reduce((s, e) => s + e.text.replace(/\s/g, '').length, 0);
  const totalChars = text.replace(/\s/g, '').length || 1;
  if (replacedChars / totalChars > 0.85) {
    return { revision: null, note: 'ข้อความส่วนใหญ่เป็นข้อกล่าวอ้างที่ควรตรวจสอบ จึงไม่สร้างฉบับแก้ไขอัตโนมัติ — กรุณาปรับตามคำแนะนำรายข้อ' };
  }

  let out = '';
  let pos = 0;
  const usedReps = new Set<string>();
  for (const e of kept) {
    out += text.slice(pos, e.start);
    // ไม่ใส่ Placeholder เดิมซ้ำหลายครั้งในข้อความเดียว และเว้นวรรคไม่ให้ติดกับคำข้างเคียง
    if (e.rep && !usedReps.has(e.rep)) {
      const before = out.length && !/\s$/.test(out) ? ' ' : '';
      const after = e.end < text.length && !/^[\s,.!?)]/.test(text.slice(e.end)) ? ' ' : '';
      out += before + e.rep + after;
    }
    if (e.rep) usedReps.add(e.rep);
    pos = e.end;
  }
  out += text.slice(pos);

  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?])/g, '$1')
    // ตัดเครื่องหมายที่ค้างหลังลบข้อความ เช่น ",." หรือ "," ที่ต้นบรรทัด
    .replace(/,+\s*([.!?])/g, '$1')
    .replace(/([.!?])[ \t]*[,.]+/g, '$1')
    .replace(/^[ \t]*[,.!?]+[ \t]*/gm, '')
    .replace(/!{2,}/g, '!')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const extras: string[] = [];
  const unchanged = out === text.trim();
  if (findings.some((f) => f.category === 'health') && !out.includes('แตกต่างกันในแต่ละบุคคล')) extras.push('ผลลัพธ์อาจแตกต่างกันในแต่ละบุคคล');
  const promo = findings.find((f) => f.ruleId === 'missing-promotion-terms');
  if (promo) extras.push(`เงื่อนไขโปรโมชัน: ${promo.matched.map((m) => `[ระบุ${m}]`).join(' ')}`);
  if (findings.some((f) => f.ruleId === 'missing-price')) extras.push('ราคา: [ระบุราคาสินค้า]');
  // ไม่มีถ้อยคำต้องปรับและไม่มีข้อมูลที่ต้องเพิ่ม → ไม่แสดง "ฉบับแก้ไข" ที่เหมือนต้นฉบับ
  if (unchanged && !extras.length) return { revision: null, note: 'ไม่มีถ้อยคำที่ต้องปรับตามกฎตรวจสอบ — ตรวจสอบประเด็นตามคำแนะนำรายข้อ' };
  if (extras.length) out = `${out}\n\n${extras.join('\n')}`;

  return { revision: out };
}

export function analyzeAd(text: string, now = new Date()): AdAnalysis {
  const findings: AdFinding[] = [];
  for (const rule of AD_RULES) {
    const matches = findMatches(text, rule);
    if (matches.length) findings.push(toFinding(rule, matches));
  }
  findings.push(...missingInfoFindings(text, findings.some((f) => f.category === 'promotion')));
  const order: Severity[] = ['high', 'medium', 'low'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const { level, score } = riskLevel(findings);
  const { revision, note } = buildRevision(text, findings);
  return { input: text, level, score, findings, revision, revisionNote: note, checkedAt: now.toISOString() };
}

/** แบ่งข้อความเป็นช่วงสำหรับ Highlight — Render เป็น Text node ของ React (ป้องกัน HTML Injection/XSS) */
export function buildSegments(text: string, findings: AdFinding[]): Segment[] {
  const marks: { start: number; end: number; id: string }[] = findings.flatMap((f) => f.matches.map((m) => ({ start: m.start, end: m.end, id: f.ruleId })));
  if (!marks.length) return [{ text, findingIds: [] }];
  const cuts = new Set<number>([0, text.length]);
  marks.forEach((m) => {
    cuts.add(m.start);
    cuts.add(m.end);
  });
  const points = [...cuts].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [s, e] = [points[i], points[i + 1]];
    if (s === e) continue;
    const ids = [...new Set(marks.filter((m) => m.start <= s && m.end >= e).map((m) => m.id))];
    const prev = segs[segs.length - 1];
    if (prev && prev.findingIds.join() === ids.join()) prev.text += text.slice(s, e);
    else segs.push({ text: text.slice(s, e), findingIds: ids });
  }
  return segs;
}

export const AD_LEVEL_LABEL: Record<AdRiskLevel, { label: string; desc: string; tone: 'success' | 'warning' | 'error' }> = {
  low: { label: 'Low — ความเสี่ยงเบื้องต้นต่ำ', desc: 'พบเพียงประเด็นเล็กน้อยหรือไม่พบตามกฎตรวจสอบ', tone: 'success' },
  medium: { label: 'Medium — ควรตรวจสอบเพิ่มเติม', desc: 'พบข้อความที่ควรปรับหรือเพิ่มข้อมูลก่อนเผยแพร่', tone: 'warning' },
  high: { label: 'High — พบข้อความที่ควรตรวจสอบอย่างละเอียด', desc: 'พบข้อกล่าวอ้างที่อาจทำให้ผู้บริโภคเข้าใจผิด', tone: 'error' },
};
