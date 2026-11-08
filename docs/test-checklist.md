# Test Checklist

## การทดสอบอัตโนมัติ (รันด้วย `npm test`)

> ผลละเอียดของรอบ UAT ล่าสุด: [uat-report.md](uat-report.md)

| ชุดทดสอบ | สิ่งที่ตรวจ | ผลล่าสุด |
|---|---|---|
| `npm run build` | `tsc -b` (strict) + Vite production build | ผ่าน |
| `tests/thai.test.mts` | พิสูจน์อักษรภาษาไทยในข้อความบนหน้าจอ ~3,000 ข้อความ: 33 กฎ (คำสะกดผิดที่พบบ่อย, คำทับศัพท์ตามราชบัณฑิตยสภา เช่น โปรโมชัน/อัปเดต/แชต, เว้นวรรค ๆ, นะคะ/คะ?, สระอำ, Zero-width space, เว้นวรรคซ้ำ, &) + คำศัพท์ผลอุทธรณ์ตรงกันทุกมุมมอง | ผ่านทั้งหมด |
| `tests/flows.test.mts` (`npm run test:flows`) | 123 เงื่อนไข: 10 Flow ข้ามบทบาท (ลงทะเบียน→อนุมัติ→Badge→ตรวจสอบ→ร้องเรียน→ตอบกลับ→Resolved→คำเตือน→อบรม/Passport→ระงับ) ตรวจทั้ง State, การแจ้งเตือนถึงผู้รับที่ถูกต้อง และข้อความที่แต่ละบทบาทเห็นบนหน้าจอ (SSR); Referential Integrity ทุก Store หลังทุก Flow (`tests/integrity.mts`); Persistence เขียน/อ่านกลับจาก localStorage; KPI และผลรวมกราฟ Dashboard; Reset ตรงกับ Seed ทุกไบต์; Regression ของเงื่อนไขป้องกันสถานะขัดกัน | ผ่านทั้งหมด |
| `tests/ai.test.mts` | 60 เงื่อนไข (รวม Regression UAT: 11 กฎภาษาอังกฤษ, 17 กรณีจัดประเภท/คำปฏิเสธ, Revision ไม่เหลือคำค้าง/เครื่องหมายค้าง, ไม่สร้างตัวเลขใหม่): Input Validation (ว่าง/สั้น/ยาวเกิน), ตัวอย่างโฆษณา 6 ชุดได้ระดับตามที่คาด, ไทย/อังกฤษ, ข้อยกเว้นวัสดุ 100%, Highlight ไม่ทับซ้อนและปลอดภัยจาก HTML, Suggested Revision (ไม่มีคำซ้ำ/ช่อง [ ] ไม่ติดกัน/ไม่สร้างเมื่อเท่าต้นฉบับ), Before/After, ประเภทข้อร้องเรียน + ระดับการติดตาม, ไม่เติมข้อเท็จจริง, ร่างคำตอบ 3 Tone × 2 สำนวน ไม่มีตัวเลขที่ไม่อยู่ในข้อความ และไม่อ้างว่าคืนเงิน/ส่งแล้ว, "ยังไม่ได้รับคำตอบ" ไม่ถูกจัดเป็นไม่ได้รับสินค้า | ผ่านทั้งหมด |
| `tests/scenarios.test.mts` | 234 เงื่อนไข (รวม Continuity — ไม่สลับร้านแบบเงียบ, ย้อนกลับขั้นที่ทำแล้วไม่ต้องทำซ้ำ, localStorage เสีย/เวอร์ชันเก่า): ขับ Demo Controller เหมือนผู้ใช้ — Full Journey 1→8 (ทุกขั้น: บทบาท, หน้าจอ, ปุ่มถัดไปถูกปิดก่อนทำ Action, Role Transition, Context ID ส่งต่อ, Summary), Restart Scenario กลางทางไม่สร้างข้อมูลซ้ำ, Refresh (Rehydrate) อยู่ขั้นเดิม, แต่ละ Scenario แบบเดี่ยว + Restart ได้ข้อมูลเดิมทุกไบต์, Pause/Resume/Restart Journey, AI Integration (ร่างไม่ส่งอัตโนมัติ, เคสร้านอื่น/ไม่มีอยู่, ประวัติ 20 รายการ, Reset, ข้อความที่พิมพ์เองไม่ถูกบันทึก), Referential Integrity หลังแต่ละเรื่อง | ผ่านทั้งหมด |
| `tests/workflows.test.mts` | 61 เงื่อนไข: จำนวน Seed, Foreign key, ผลตรวจสอบของบัญชีสาธิต, Scenario 1–6 แบบ end-to-end ผ่าน Store จริง, Identity flag, Duplicate/Incomplete/Severe screening, Officer override/close, การอบรมติ๊กคำเตือน, Appeal/Dismiss คืนใบรับรอง, ต่ออายุ, KPI ตรงกับ State, Reset | ผ่านทั้งหมด |
| `tests/render.test.mts` | Server-render 78 เส้นทาง (รวม `/m/ai*`, `/demo/complete/:id`, `/demo/overview`) × บทบาท/บัญชี — ไม่มี Exception/React error, Role Gate อนุญาต/ปฏิเสธถูกต้อง | ผ่านทั้งหมด |
| สแกนโค้ด | ไม่มี `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`/`axios` ใน `src/`; URL ใน bundle มีเพียงข้อความ error ของไลบรารี; ฟอนต์ Bundle ในเครื่อง | ผ่าน |
| Dev server | `/`, `/verify/:id`, `/o/applications/:id`, `/m`, `/admin` ตอบ 200 (SPA fallback) | ผ่าน |

## Browser E2E (Playwright — `npm run test:e2e`, `npm run test:e2e:subpath`, `npm run test:e2e:safari`)

Build + `vite preview` อัตโนมัติ แล้วคลิกผ่าน UI จริง · ทุก Test ตรวจว่าไม่มี JavaScript/Console error

ผลล่าสุด: **Chromium `/` 47/47 · Chromium `/sme-trust/` 47/47 · Safari (WebKit 18) Desktop 47/47 + iPhone 10/10 + iPad 4/4** (`lifecycle.spec.ts` 6 รายการรันแยกในรอบล่าสุดบนทั้ง 3 แบบ ส่วนที่เหลือจากรอบก่อนหน้า)

| Spec | ครอบคลุม | ผล `/` | ผล `/sme-trust/` |
|---|---|---|---|
| `scenarios.spec.ts` (8) | Scenario 1–8 แบบเดี่ยว: Registration, Merchant Verification, Consumer Verification, Complaint Resolution, Warning & Training, Suspension & Appeal, AI-01, AI-02 | ✅ | ✅ |
| `journey.spec.ts` (1) | Full Journey 1→8 ต่อเนื่อง, Context ID, กรณีศึกษาแยก, ไม่มีร้านซ้ำ, หน้าสรุปภาพรวม | ✅ | ✅ |
| `continuity.spec.ts` (2) | ร้าน S2 ยังไม่อนุมัติ → กล่องเลือก + หมายเหตุ; Restart/Refresh/Back-Next | ✅ | ✅ |
| `ai.spec.ts` (5) | AI-01 อังกฤษหลายเงื่อนไข, Highlight, Copy (Clipboard จริง), Edit, Re-analyze, วัสดุ 100%; AI-02 คำปฏิเสธ, 3 Tone, เคสไม่มี/ของร้านอื่น, ประวัติ/Clear/Reset | ✅ | ✅ |
| `roles.spec.ts` (3) | Role Switcher + Permission Denied + ข้อมูลข้ามบทบาท, Reset Demo Data, ลิงก์/QR อยู่ใต้ Base path | ✅ | ✅ |
| `responsive.spec.ts` (6) | 375/768/1440 × 16 หน้า ไม่ล้นแนวนอน (+ ภาพหน้าจอ), Demo Controller ไม่บังปุ่ม, Modal อยู่ในจอ | ✅ | ✅ |
| `secondary.spec.ts` (16) | ปุ่มรอง: ดาวน์โหลด Badge/QR (SVG), Badge ปิดเมื่อใบรับรองใช้ไม่ได้, พิมพ์ Passport/ใบรับรองอบรม, Export CSV (BOM ภาษาไทย), Export JSON, จัดการใบรับรอง (ระงับ/คืนสถานะ/หมดอายุ/ต่ออายุ), ตรวจช่องทางขาย, ขอเอกสารเพิ่ม, ตัวกรอง Admin + ดูเป็นตาราง, ค้นหา Audit, เจรจา/ส่งต่อ, อ่านแจ้งเตือนทั้งหมด, Shop Switcher, ตัวกรองทำเนียบ, PIN ผิด 5 ครั้ง→ลืม PIN, ชีวมิติ, จำลองหน้าจอ | ✅ | ✅ |
| `lifecycle.spec.ts` (6) | วงจรใบรับรองข้ามบทบาท: ไม่อนุมัติคำขอขอรับรอง → ปิดคำเตือน → ร้านยื่น Trusted SME → อนุมัติ → ผู้บริโภคเห็นสถานะ; ต่ออายุ (จำลองหมดอายุ → ร้านยื่น → อนุมัติ → ใบเดิมถูกแทนที่); เพิกถอน (ต้องมีเหตุผล) → ผู้บริโภค/ร้านเห็นผล + Badge ถูกปิด; ไม่อนุมัติคำขอลงทะเบียน → ยื่นใหม่; เพิ่มช่องทางขาย → เจ้าหน้าที่ยืนยัน; Pagination + เรียงลำดับ | ✅ | ✅ |
| `mobile.spec.ts` (4 × iPhone/iPad) | WebKit + Touch: S1 ลงทะเบียน (แป้น PIN), S3, S7, S8 ผ่านแถบควบคุมด้านล่าง + Sheet, ไม่ล้นจอ | — (เฉพาะ Safari) | — |

## Acceptance Criteria

| # | เกณฑ์ | วิธีตรวจ | สถานะ |
|---|---|---|---|
| 1 | `npm install` / `npm run dev` | รันจริง | ✅ |
| 2 | `npm run build` ผ่าน | รันจริง | ✅ |
| 3 | TypeScript ไม่มี Error | `tsc -b` strict | ✅ |
| 4 | ทุกหน้าสำคัญเปิดได้ | render test 78 เส้นทาง | ✅ |
| 5 | Mobile Responsive | UX audit ด้วย Headless Chromium: 44 หน้า × 3 ขนาดจอ (360 / 800 / 1440px) = 132 ภาพ — ไม่มี Horizontal scroll และไม่มี Console error | ✅ (ตรวจภาพหน้าจอแล้ว; ยังไม่ได้ทดสอบบนอุปกรณ์จริง) |
| 6 | ลงทะเบียนจำลองครบ | workflow test (registerOperator/KYC) + render `/register` | ✅ (ขั้น UI ควรคลิกผ่านด้วยตนเอง) |
| 7 | Login จำลอง | render `/login`; ตรรกะ PIN/ลืม PIN อยู่ใน LoginPage | ⚠️ คลิกทดสอบด้วยตนเอง |
| 8 | สมัครร้านค้าและส่งคำขอ | workflow test | ✅ |
| 9 | Officer อนุมัติคำขอ | workflow test | ✅ |
| 10 | Merchant เห็นสถานะหลังอนุมัติ | workflow test (Store เดียวกัน) | ✅ |
| 11 | Consumer เห็นสถานะถูกต้อง | workflow test (`verdictFor`) | ✅ |
| 12 | QR เปิดหน้า Verification | URL `/verify/:id` + dev server 200 | ✅ |
| 13 | Consumer แจ้งปัญหา | workflow test | ✅ |
| 14 | Merchant ตอบข้อร้องเรียน | workflow test | ✅ |
| 15 | Consumer ยืนยันผล | workflow test | ✅ |
| 16 | Officer ออกคำเตือน | workflow test | ✅ |
| 17 | Merchant ส่งหลักฐานแก้ไข | workflow test | ✅ |
| 18 | เรียนและทำแบบทดสอบ | workflow test (`submitQuiz`) | ✅ |
| 19 | Admin Dashboard คำนวณจาก Mock State | workflow test (KPI = นับจาก Store) | ✅ |
| 20 | เปลี่ยน Role ข้อมูลไม่ขัดแย้ง | ทุกหน้าอ่านจาก Store ชุดเดียว | ✅ |
| 21 | Reset Demo Data | workflow test | ✅ |
| 22 | ไม่เรียก Backend/External API | สแกนโค้ด | ✅ |
| 23 | ไม่ส่งข้อมูลออกนอกเบราว์เซอร์ | สแกนโค้ด (download ทั้งหมดสร้างฝั่ง Client) | ✅ |
| 24 | ไม่มีปุ่มหลักที่กดแล้วไม่เกิดผล | Review โค้ด: ทุกปุ่มผูก handler/ลิงก์ | ⚠️ ควรคลิกตรวจด้วยตนเอง |
| 25 | ทุกหน้ามีข้อความ Prototype | Banner อยู่ใน AppShell และ AuthFrame/Welcome | ✅ |
| 26 | ทุกหน้า AI ระบุว่าเป็น AI Simulation ไม่ใช่ AI Model จริง | render + scenarios test | ✅ |
| 27 | AI ไม่ส่งคำตอบถึงผู้บริโภคเอง | scenarios test + Playwright (จำนวนข้อความไม่เปลี่ยนจนกว่าร้านกดส่ง) | ✅ |
| 28 | ไม่เรียก AI API / External API | สแกนโค้ด (ไม่มี fetch/XHR/API Key) | ✅ |
| 29 | Demo: ไม่ข้ามขั้นจำเป็น, ไม่มี Timer เปลี่ยนหน้า | scenarios test (`blocked`) + Playwright | ✅ |
| 30 | Restart Scenario ไม่สร้างข้อมูลซ้ำ / Refresh แล้วทำต่อได้ | scenarios test | ✅ |
| 31 | Deploy บน GitHub Pages (Sub-path) | Build `VITE_BASE=/sme-trust/` + Playwright | ✅ (ยังไม่ได้ Deploy ขึ้น GitHub จริง) |

## Manual Test Checklist (ให้คลิกตรวจก่อนนำเสนอ)

### Onboarding / Auth
- [ ] เบอร์ผิดรูปแบบ / ไม่ติ๊กเงื่อนไข → แสดง Error
- [ ] OTP ผิด → "OTP Invalid"; ขอรหัสใหม่หลังนับถอยหลัง
- [ ] e-KYC: ล้มเหลวที่บัตร / ที่ใบหน้า → Retry → สำเร็จ
- [ ] PIN `111111` ถูกปฏิเสธ; PIN ยืนยันไม่ตรง → Error
- [ ] Login PIN ผิด 5 ครั้ง → ล็อก → ลืม PIN → ตั้งใหม่ → Login ด้วย PIN ใหม่
- [ ] ปุ่มลายนิ้วมือ → Biometric จำลอง → เข้าสู่ระบบ

### Merchant
- [ ] ลงทะเบียนร้าน: Validation ทุกขั้น, นิติบุคคลต้องมีหนังสือรับรอง, Save/Resume Draft, แก้ไขจากหน้า Review
- [ ] OP-010: ส่งข้อมูลเพิ่มเติม → สถานะกลับเป็น "ส่งคำขอแล้ว"
- [ ] OP-008: Shop Switcher สลับ 2 ร้าน, ธงตัวตนซ้ำ
- [ ] Toolkit: คัดลอกลิงก์, ดาวน์โหลด Badge/QR (ปุ่ม Badge ปิดเมื่อใบรับรองใช้ไม่ได้)
- [ ] Passport: พิมพ์/บันทึก PDF

### Consumer
- [ ] ค้นหา + ตัวกรอง + Skeleton loading; ไม่พบข้อมูล
- [ ] เปิดช่องทางขาย → Modal ลิงก์จำลอง
- [ ] ผู้บริโภคอื่นเปิดเรื่องที่ไม่ใช่ของตน → ไม่มีสิทธิ์

### Officer / Admin
- [ ] ตาราง: Sort, Pagination (Audit Log > 15 รายการ), Search, Tabs
- [ ] ยืนยัน/ปฏิเสธช่องทางขาย; ระงับ/คืนสถานะ/เพิกถอน/ต่ออายุ/จำลองหมดอายุใบรับรอง
- [ ] Admin: ตัวกรองจังหวัด/ช่วงเวลาเปลี่ยน KPI และกราฟ; "ดูเป็นตาราง"; Export JSON; Reports Export CSV เปิดใน Excel ภาษาไทยถูกต้อง

### AI Simulation / Demo Controller
- [ ] ลองพิมพ์ข้อความโฆษณาเองหลายแบบ — ตรวจว่าผลและข้อความเสนอแก้ไขอ่านเข้าใจได้
- [ ] คัดลอกข้อความ/ร่างคำตอบ (Clipboard) บนเบราว์เซอร์ที่ใช้นำเสนอ
- [ ] Full Journey 1→8 คลิกผ่านทั้งหมดบนจอที่ใช้นำเสนอจริง (Projector / iPad)
- [ ] Jump ไป Scenario ที่ยังไม่เริ่ม → มีกล่องยืนยัน

### Responsive
- [ ] 320px, 375px, 768px, 1024px, 1440px — ไม่มี Horizontal scroll, Bottom nav แสดงบน < 1024px, Modal เป็น Bottom sheet บนมือถือ

## Unified Platform Enhancement (Branch `sme-trustv.2`)

| ชุด | สิ่งที่ตรวจ |
|---|---|
| `tests/v2/onboarding.test.mts` | KYC/Mock DBD/Mock Reference · Dynamic Documents (บุคคล/นิติบุคคล/หนังสือมอบอำนาจ/หมวดสินค้า/ข้อมูลที่มีแล้ว) · Verification Summary · Self-Registration → ประเมินอัตโนมัติ ไม่ถูกหักคะแนน ไม่ซ้ำ · เพิ่ม Marketplace ภายหลัง (ร้านเดิม, Coverage ↑, Badge อัปเดต) · หลายแพลตฟอร์ม · Shop ID ถูกอ้างโดยร้านอื่น → งานเดียว → Reject · Raw Data · Engine v2.1 ไม่เปลี่ยน · KYC → C1 → Badge · Badge/หน้าร้าน/หน้าการเชื่อมต่อ |
| `tests/e2e/onboarding.spec.ts` | นิติบุคคลผ่าน UI (Mock DBD, หนังสือมอบอำนาจ, Verification Summary, เจ้าหน้าที่เห็นสรุปเดียวกัน) · สมัครเอง → เพิ่ม Shopee จากหน้าร้าน → Badge active + ลิงก์ตรวจสอบ · ร้านในบัญชีที่เชื่อมแล้วเลือกซ้ำไม่ได้ |
| `tests/e2e/home.spec.ts` | หน้าแรก Executive: ข้อความตามข้อกำหนด · 5 ขั้นตอน · 2 ช่องทาง · 4 CTA + เข้าสู่ระบบที่ Header · Demo ตาม Journey (ยืนยันก่อนรีเซ็ต) · ไม่มี v1/v2 · 375/768/1440px |

Manual (ก่อนนำเสนอ): เปิดหน้าแรกบนจอ 375px / 768px / 1440px · เล่น Scenario 14 → 15 → 9B (+ เพิ่ม Shopee) ตาม `executive-demo-guide.md`

ผลรอบล่าสุด (9 พ.ย. 2569, ในเครื่อง @ `/sme-trust/`): TypeScript ✅ · `npm test` 18 ชุด ✅ · Build + ตรวจของ Workflow ✅ · E2E Chromium ครบทุกชุด 76/77 (1 ไม่ผ่านครั้งคราว KI-V2-32 → รันซ้ำ 8/8) · Firefox 44/44 · WebKit 15/15 · GitHub Pages จำลอง 9/9 · Safari / มือถือจริง: Not Tested

