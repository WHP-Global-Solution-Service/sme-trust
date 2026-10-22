/** ดาวน์โหลดไฟล์ที่สร้างฝั่ง Client — ไม่มีการส่งข้อมูลออกนอกเบราว์เซอร์ */
export function downloadText(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM เพื่อให้ Excel อ่านภาษาไทยได้
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
}
