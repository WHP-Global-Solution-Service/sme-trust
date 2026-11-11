/** Demo หลักเส้นเดียว — ใช้ร่วมกันระหว่างหน้าแรกและหน้า Demo (ภายในใช้ Scenario s9a — ไม่แสดงรหัสแก่ผู้ใช้) */
export const MAIN_JOURNEY_ID = 's9a';
export const MAIN_CTA_LABEL = 'ทดลองใช้งาน SME Trust ตั้งแต่ต้นจนจบ';

/** กรณีพิเศษที่ยังจำเป็น (เรียงตามความสำคัญ) */
export const SPECIAL_CASE_IDS = ['s9b', 's15', 's6'] as const;
/** ฟังก์ชันอื่นของระบบที่ไม่อยู่ใน Demo หลัก (เรียงตามลำดับการใช้งาน) */
export const OTHER_DEMO_IDS = ['s1', 's2', 's4', 's5', 's7', 's8'] as const;
/** ลำดับการแสดงทั้งหมด: Demo หลัก → กรณีพิเศษ → ฟังก์ชันอื่น */
export const DEMO_GROUPS: { title: string; ids: readonly string[] }[] = [
  { title: 'Demo หลัก', ids: [MAIN_JOURNEY_ID] },
  { title: 'กรณีพิเศษ', ids: SPECIAL_CASE_IDS },
  { title: 'ฟังก์ชันอื่นของระบบ', ids: OTHER_DEMO_IDS },
];
