/** วิเคราะห์ยอดขายและการจัดส่ง — รวมทุกแพลตฟอร์ม ถ่วงน้ำหนักตามจำนวนคำสั่งซื้อ */
import type { MarketplaceSnapshot } from '../types';
import { PLATFORMS } from '../data/platforms';
import type { Finding, SalesAnalysis } from './types';

export const SALES_RULES = {
  /** เดือนล่าสุดสูงกว่าค่ามัธยฐานของเดือนก่อนหน้าเกินกี่เท่าจึงถือว่าพุ่งผิดปกติ */
  spikeFactor: 5,
  highCancel: 0.05,
  highReturn: 0.05,
  lowOnTime: 0.85,
  lowChat: 0.8,
  highVariability: 0.6,
};

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

export function analyzeSales(snapshots: MarketplaceSnapshot[]): SalesAnalysis {
  const monthlyOrders = Array.from({ length: 12 }, (_, i) => snapshots.reduce((s, x) => s + x.monthlyOrders[i], 0));
  const totalOrders = monthlyOrders.reduce((a, b) => a + b, 0);
  const active = monthlyOrders.filter((m) => m > 0);
  const monthsOfData = active.length;
  const mean = monthsOfData ? active.reduce((a, b) => a + b, 0) / monthsOfData : 0;
  const variability = monthsOfData > 1 && mean > 0 ? Math.sqrt(active.reduce((s, x) => s + (x - mean) ** 2, 0) / monthsOfData) / mean : 0;

  // อัตราต่าง ๆ ถ่วงน้ำหนักตามจำนวนคำสั่งซื้อของแต่ละแพลตฟอร์ม
  const weight = (s: MarketplaceSnapshot) => s.monthlyOrders.reduce((a, b) => a + b, 0);
  const wTotal = snapshots.reduce((s, x) => s + weight(x), 0) || 1;
  const wavg = (f: (s: MarketplaceSnapshot) => number) => snapshots.reduce((s, x) => s + f(x) * weight(x), 0) / wTotal;
  const cancelRate = wavg((s) => s.cancelRate);
  const returnRate = wavg((s) => s.returnRate);
  const onTimeShipRate = wavg((s) => s.onTimeShipRate);
  const chatResponseRate = wavg((s) => s.chatResponseRate);
  const transactionValue = snapshots.reduce((s, x) => s + x.listings.reduce((a, l) => a + l.unitsSold12m * l.price, 0), 0);
  const shopAgeMonths = snapshots.reduce((m, s) => Math.max(m, s.shopAgeMonths), 0);

  const findings: Finding[] = [];
  let spike: SalesAnalysis['spike'] = null;
  const prior = monthlyOrders.slice(0, 11).filter((m) => m > 0);
  const last = monthlyOrders[11];
  const priorMedian = median(prior);
  if (prior.length >= 2 && priorMedian > 0 && last / priorMedian >= SALES_RULES.spikeFactor) {
    spike = { monthIndex: 11, factor: Math.round((last / priorMedian) * 10) / 10 };
    findings.push({
      id: 'sales-spike',
      level: 'watch',
      title: 'ยอดขายเดือนล่าสุดสูงผิดปกติ — ควรตรวจสอบเพิ่มเติม',
      detail: `คำสั่งซื้อเดือนล่าสุด ${last.toLocaleString('th-TH')} รายการ สูงกว่าค่ากลางของเดือนก่อนหน้า ${spike.factor} เท่า (ร้านอายุ ${shopAgeMonths} เดือน) — อาจเกิดจากโปรโมชันหรือสินค้าขายดีได้`,
      evidence: [`คำสั่งซื้อรายเดือน: ${monthlyOrders.join(', ')}`],
    });
  }
  if (cancelRate > SALES_RULES.highCancel) findings.push({ id: 'sales-cancel', level: 'watch', title: 'อัตรายกเลิกคำสั่งซื้อสูง', detail: `อัตรายกเลิกเฉลี่ย ${pct(cancelRate)} (เกณฑ์ ${pct(SALES_RULES.highCancel)})`, evidence: snapshots.map((s) => `${PLATFORMS[s.platform].label}: ${pct(s.cancelRate)}`) });
  if (returnRate > SALES_RULES.highReturn) findings.push({ id: 'sales-return', level: 'watch', title: 'อัตราคืนสินค้าสูง', detail: `อัตราคืนสินค้าเฉลี่ย ${pct(returnRate)} (เกณฑ์ ${pct(SALES_RULES.highReturn)})`, evidence: snapshots.map((s) => `${PLATFORMS[s.platform].label}: ${pct(s.returnRate)}`) });
  if (snapshots.length && onTimeShipRate < SALES_RULES.lowOnTime) findings.push({ id: 'sales-ontime', level: 'watch', title: 'จัดส่งตรงเวลาต่ำกว่าเกณฑ์', detail: `จัดส่งตรงเวลา ${pct(onTimeShipRate)} (เกณฑ์ ${pct(SALES_RULES.lowOnTime)})`, evidence: snapshots.map((s) => `${PLATFORMS[s.platform].label}: ${pct(s.onTimeShipRate)}`) });
  if (snapshots.length && chatResponseRate < SALES_RULES.lowChat) findings.push({ id: 'sales-chat', level: 'info', title: 'อัตราตอบแชตต่ำ', detail: `ตอบแชต ${pct(chatResponseRate)} (เกณฑ์ ${pct(SALES_RULES.lowChat)})`, evidence: [] });
  if (variability > SALES_RULES.highVariability && !spike) findings.push({ id: 'sales-variability', level: 'info', title: 'ยอดขายแต่ละเดือนไม่สม่ำเสมอ', detail: `ค่าความผันผวน ${variability.toFixed(2)}`, evidence: [`คำสั่งซื้อรายเดือน: ${monthlyOrders.join(', ')}`] });

  return { totalOrders, monthsOfData, monthlyOrders, variability, spike, shopAgeMonths, cancelRate, returnRate, onTimeShipRate, chatResponseRate, transactionValue, findings };
}
