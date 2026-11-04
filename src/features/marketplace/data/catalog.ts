import type { ProductRisk } from '../types';

/**
 * ช่วงราคาอ้างอิงของประเภทสินค้า (ข้อมูลสมมติเพื่อการสาธิต — ไม่ใช่ราคาตลาดจริง)
 * productRisk = ความเสี่ยงของสินค้าต่อผู้บริโภคหากเป็นของปลอม/ด้อยคุณภาพ (สุขภาพ ความปลอดภัย ไฟฟ้า)
 */
export interface ProductRef {
  key: string;
  name: string;
  category: string;
  median: number;
  risk: ProductRisk;
}

export const PRODUCT_CATALOG: ProductRef[] = [
  { key: 'chili-paste', name: 'น้ำพริกหนุ่ม 200 กรัม', category: 'อาหารและเครื่องดื่ม', median: 120, risk: 'medium' },
  { key: 'pork-crackling', name: 'แคบหมู 150 กรัม', category: 'อาหารและเครื่องดื่ม', median: 90, risk: 'medium' },
  { key: 'thai-dessert', name: 'ขนมไทยกล่องรวม', category: 'อาหารและเครื่องดื่ม', median: 150, risk: 'medium' },
  { key: 'coffee-beans', name: 'เมล็ดกาแฟคั่ว 250 กรัม', category: 'อาหารและเครื่องดื่ม', median: 290, risk: 'low' },
  { key: 'indigo-shirt', name: 'เสื้อผ้าย้อมคราม', category: 'แฟชั่นและเครื่องแต่งกาย', median: 690, risk: 'low' },
  { key: 'scarf', name: 'ผ้าพันคอทอมือ', category: 'แฟชั่นและเครื่องแต่งกาย', median: 390, risk: 'low' },
  { key: 'tote-bag', name: 'กระเป๋าผ้า', category: 'แฟชั่นและเครื่องแต่งกาย', median: 450, risk: 'low' },
  { key: 'serum', name: 'เซรั่มบำรุงผิว 30 มล.', category: 'ความงามและสุขภาพ', median: 590, risk: 'high' },
  { key: 'lipstick', name: 'ลิปสติก', category: 'ความงามและสุขภาพ', median: 290, risk: 'high' },
  { key: 'sunscreen', name: 'ครีมกันแดด 50 มล.', category: 'ความงามและสุขภาพ', median: 390, risk: 'high' },
  { key: 'supplement', name: 'อาหารเสริมควบคุมน้ำหนัก 30 แคปซูล', category: 'ความงามและสุขภาพ', median: 790, risk: 'high' },
  { key: 'herbal-balm', name: 'ยาหม่องสมุนไพร', category: 'ความงามและสุขภาพ', median: 89, risk: 'medium' },
  { key: 'storage-box', name: 'กล่องเก็บของ', category: 'ของใช้ในบ้าน', median: 250, risk: 'low' },
  { key: 'cloth-bag', name: 'ถุงผ้าอเนกประสงค์', category: 'ของใช้ในบ้าน', median: 150, risk: 'low' },
  { key: 'power-bank', name: 'พาวเวอร์แบงก์ 20,000 mAh', category: 'อิเล็กทรอนิกส์และแกดเจ็ต', median: 690, risk: 'high' },
  { key: 'earbuds', name: 'หูฟังไร้สาย', category: 'อิเล็กทรอนิกส์และแกดเจ็ต', median: 890, risk: 'high' },
  { key: 'charging-cable', name: 'สายชาร์จ 1 เมตร', category: 'อิเล็กทรอนิกส์และแกดเจ็ต', median: 190, risk: 'high' },
  { key: 'power-strip', name: 'ปลั๊กพ่วง 4 ช่อง', category: 'อิเล็กทรอนิกส์และแกดเจ็ต', median: 450, risk: 'high' },
  { key: 'silk-mudmee', name: 'ผ้าไหมมัดหมี่', category: 'หัตถกรรมและของที่ระลึก', median: 2500, risk: 'low' },
  { key: 'sarong', name: 'ผ้าซิ่นทอมือ', category: 'หัตถกรรมและของที่ระลึก', median: 1800, risk: 'low' },
  { key: 'wood-toy', name: 'ของเล่นไม้เสริมพัฒนาการ', category: 'ของเล่นและสินค้าเด็ก', median: 450, risk: 'medium' },
  { key: 'wood-blocks', name: 'บล็อกไม้ 50 ชิ้น', category: 'ของเล่นและสินค้าเด็ก', median: 590, risk: 'medium' },
  { key: 'durian', name: 'ทุเรียนหมอนทอง (กก.)', category: 'เกษตรและผลไม้', median: 180, risk: 'medium' },
  { key: 'mangosteen', name: 'มังคุด 5 กก.', category: 'เกษตรและผลไม้', median: 650, risk: 'medium' },
  { key: 'flower-service', name: 'บริการจัดดอกไม้', category: 'บริการ', median: 990, risk: 'low' },
];

export const productsOfCategory = (category: string) => {
  const list = PRODUCT_CATALOG.filter((p) => p.category === category);
  return list.length ? list : PRODUCT_CATALOG.filter((p) => p.category === 'ของใช้ในบ้าน');
};

export const productRef = (key: string) => PRODUCT_CATALOG.find((p) => p.key === key);

export const PRODUCT_RISK_LABEL: Record<ProductRisk, string> = { low: 'ความเสี่ยงต่ำ', medium: 'ความเสี่ยงปานกลาง', high: 'ความเสี่ยงสูง' };
