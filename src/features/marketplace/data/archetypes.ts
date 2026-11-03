import type { Archetype } from '../types';

/** พารามิเตอร์ของ Generator ต่อ Archetype (ช่วงค่า [ต่ำสุด, สูงสุด]) */
export interface ArchetypeParams {
  shopAgeMonths: [number, number];
  baseMonthlyOrders: [number, number];
  /** อัตราเติบโตต่อเดือน */
  growth: number;
  volatility: number;
  cancelRate: [number, number];
  returnRate: [number, number];
  onTimeShipRate: [number, number];
  chatResponseRate: [number, number];
  ratingMean: number;
  /** สัดส่วนคำสั่งซื้อที่มีรีวิว */
  reviewRate: number;
  /** ราคาเทียบ median ของสินค้า */
  priceFactor: [number, number];
  salesSpike?: boolean;
  reviewBurst?: boolean;
  lowPricedHighRiskItem?: boolean;
  fulfillmentComplaints?: boolean;
}

export const ARCHETYPES: Record<Archetype, ArchetypeParams> = {
  established_good: {
    shopAgeMonths: [26, 48], baseMonthlyOrders: [140, 220], growth: 0.01, volatility: 0.12,
    cancelRate: [0.008, 0.02], returnRate: [0.008, 0.02], onTimeShipRate: [0.96, 0.99], chatResponseRate: [0.93, 0.99],
    ratingMean: 4.8, reviewRate: 0.35, priceFactor: [0.9, 1.25],
  },
  growing_ok: {
    shopAgeMonths: [8, 12], baseMonthlyOrders: [25, 45], growth: 0.12, volatility: 0.15,
    cancelRate: [0.015, 0.03], returnRate: [0.01, 0.025], onTimeShipRate: [0.93, 0.97], chatResponseRate: [0.88, 0.95],
    ratingMean: 4.6, reviewRate: 0.3, priceFactor: [0.85, 1.15],
  },
  new_shop: {
    shopAgeMonths: [1, 2], baseMonthlyOrders: [3, 8], growth: 0.2, volatility: 0.3,
    cancelRate: [0.02, 0.04], returnRate: [0.01, 0.03], onTimeShipRate: [0.9, 0.96], chatResponseRate: [0.85, 0.95],
    ratingMean: 4.6, reviewRate: 0.3, priceFactor: [0.85, 1.1],
  },
  price_anomaly: {
    shopAgeMonths: [5, 9], baseMonthlyOrders: [30, 60], growth: 0.08, volatility: 0.2,
    cancelRate: [0.03, 0.06], returnRate: [0.03, 0.06], onTimeShipRate: [0.88, 0.94], chatResponseRate: [0.8, 0.9],
    ratingMean: 4.1, reviewRate: 0.2, priceFactor: [0.75, 1.0], lowPricedHighRiskItem: true,
  },
  review_burst: {
    shopAgeMonths: [10, 16], baseMonthlyOrders: [40, 70], growth: 0.04, volatility: 0.18,
    cancelRate: [0.015, 0.03], returnRate: [0.015, 0.03], onTimeShipRate: [0.92, 0.96], chatResponseRate: [0.88, 0.95],
    ratingMean: 4.4, reviewRate: 0.3, priceFactor: [0.9, 1.2], reviewBurst: true,
  },
  fulfillment_issue: {
    shopAgeMonths: [14, 24], baseMonthlyOrders: [60, 100], growth: 0.0, volatility: 0.2,
    cancelRate: [0.07, 0.11], returnRate: [0.06, 0.1], onTimeShipRate: [0.7, 0.8], chatResponseRate: [0.6, 0.75],
    ratingMean: 3.6, reviewRate: 0.25, priceFactor: [0.85, 1.05], fulfillmentComplaints: true,
  },
  sales_spike: {
    shopAgeMonths: [4, 7], baseMonthlyOrders: [20, 35], growth: 0.05, volatility: 0.15,
    cancelRate: [0.02, 0.04], returnRate: [0.02, 0.04], onTimeShipRate: [0.9, 0.95], chatResponseRate: [0.85, 0.93],
    ratingMean: 4.5, reviewRate: 0.25, priceFactor: [0.85, 1.1], salesSpike: true,
  },
};
