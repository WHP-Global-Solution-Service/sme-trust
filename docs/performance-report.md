# Performance Report — SME Trust v2 (P7-H)

วัดจาก Production build ในเครื่อง (Vite 5, `npm run build`) · ขนาด "บนดิสก์" = ไบต์จริงของไฟล์ (ข้อความภาษาไทยเป็น UTF-8 3 ไบต์ต่ออักษร) · gzip = `zlib.gzipSync` ระดับเริ่มต้น · Vite รายงานเป็น kB ของตัวเอง (นับต่างจากไบต์บนดิสก์) จึงแสดงทั้งสองแบบ

## ก่อน / หลัง

| รายการ | P6 (`73a4153`) | P7 ก่อน Optimize | P7 หลัง Optimize |
|---|---|---|---|
| Vite รายงาน (ไฟล์ JS หลัก) | 1,383.93 kB · gzip 416.17 kB | 1,405.98 kB · gzip 423.15 kB | **548.06 kB · gzip 181.37 kB** |
| JS ที่โหลดตอนเปิดแอป (บนดิสก์) | — (ไฟล์เดียว) | 1,661,170 B · gzip 423,351 B | **691,361 B · gzip 181,371 B** (−58% / −57%) |
| จำนวนไฟล์ JS | 1 | 1 | 116 (หน้าละไฟล์ + ไฟล์ที่ใช้ร่วม) |
| JS ทั้งหมด (โหลดครบทุกหน้า) | — | 1,661,170 B | 1,700,056 B · gzip 511,609 B (+2% จากการแยกไฟล์) |
| Recharts | อยู่ในไฟล์หลัก | อยู่ในไฟล์หลัก | แยกเป็น `Charts-*.js` 375,375 B — โหลดเฉพาะหน้าที่มีกราฟ |
| CSS | 44 kB | 44.19 kB | 44.30 kB |

Build `/sme-trust/v2/` (P7) ได้ขนาดเท่ากัน (initial 691,400 B · gzip 181,413 B) — ภายหลังเปลี่ยนเป็นเผยแพร่ที่ `/sme-trust/` (Release) และลบ `build:v2` แล้ว · Build `/sme-trust/` สำหรับ Release: ไฟล์หลัก 547.71 kB · gzip 181.23 kB (Vite)

## สิ่งที่ทำ

1. **Route-based Code Splitting** — `src/routes/lazyPage.tsx` ห่อทุกหน้า (ยกเว้นหน้าแรกและหน้าไม่พบ) ด้วย `React.lazy` + `Suspense` (`PageLoading`) ทั้งระดับแอปและภายใน `AppShell` (เมนู/แถบด้านข้างไม่หายระหว่างโหลด)
2. **Dynamic import ของ Chart Library** — Recharts ไปอยู่ใน Chunk ของหน้าที่ใช้กราฟเท่านั้น (Admin/Officer Dashboard, Reports, Marketplace Analysis)
3. **โหลดล่วงหน้าเมื่อเครื่องว่าง** — `preloadWhenIdle()` (หลัง 1.5 วินาที ผ่าน `requestIdleCallback`) เพื่อให้การสาธิตเปลี่ยนหน้าได้ทันทีและยังใช้งานต่อได้หากเครือข่ายหลุดภายหลัง โดยไม่เพิ่มขนาดตอนเปิดแอป
4. **SSR Test** — `preloadAllPages()` ทำให้หน้าแบบ lazy Render แบบ Synchronous ใน `tests/harness.mts` (Render test 115 เส้นทางยังตรวจเนื้อหาจริง)
5. React Router `v7_startTransition` (เปิดอยู่แล้ว) ทำให้ระหว่างโหลดหน้าใหม่ยังแสดงหน้าเดิม ไม่กระพริบเป็นหน้าว่าง

ไม่ได้ตัดฟังก์ชันที่ใช้งานจริงเพื่อลดขนาด

## ผลต่อการทดสอบ

- Direct Route / Refresh / Demo Scenario: E2E Chromium 61/61 ที่ `/` และ 61/61 ที่ `/sme-trust/`, Pages แบบรวม (`/sme-trust/v2/`) ผ่านทั้ง 3 เบราว์เซอร์
- E2E 3 จุดที่อ่านหน้าทันทีหลังเปลี่ยน URL (ก่อนหน้าแยกไฟล์แสดงผล) ปรับให้รอเนื้อหาของหน้าก่อนตรวจ — เงื่อนไขการตรวจเดิมไม่เปลี่ยน

## ข้อจำกัด

- ไฟล์หลักยังรวม Store, Mock Data และ Demo Scenario ทั้ง 13 เรื่อง (จำเป็นสำหรับ Demo Controller ที่อยู่ทุกหน้า) — แยกเพิ่มได้ภายหลังโดยโหลด Scenario ตามชุด v1/v2
- ฟอนต์ Noto Sans Thai 4 น้ำหนัก (woff2 ~9–10 kB ต่อไฟล์ย่อย) โหลดตาม `unicode-range` ของเบราว์เซอร์ ไม่ได้ปรับเพิ่ม
- ไม่ได้วัด Core Web Vitals บนเครือข่าย/อุปกรณ์จริง
