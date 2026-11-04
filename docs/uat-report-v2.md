# UAT Report — SME Trust v2 (P7 Final QA)

- Branch: `sme-trustv.2` · ฐาน: P6 `73a4153` · วันที่ทดสอบ: 4 พ.ย. 2569 (2026-11-04)
- ขอบเขต: Prototype แบบ Frontend Only (Mock Data, Rule-based) — **ไม่ใช่ระบบพร้อมใช้งานจริง**
- สถานะ: พร้อมสาธิต และพร้อมเข้าสู่ขั้นตอนเผยแพร่ v2 เมื่อได้รับอนุญาต (ยังไม่ Deploy)

## 1. ผลการทดสอบอัตโนมัติ

| ชุดทดสอบ | ผล |
|---|---|
| `thai` (4,139 ข้อความ · 33 กฎ) | 4 / 4 |
| `flows` · `ai` · `scenarios` (S1–8 + Full Journey v1) · `workflows` | 123 · 60 · 234 · ALL PASS |
| v2 `marketplace` · `assessment` · `workflows` · `ui` · `scenarios` (S9–13, 9B, Journey v2) | 27 · 30 · 41 · 18 · 175 |
| v2 `validation` (ใหม่ — P7-B) | 56 / 56 |
| v2 `p7` (ใหม่ — Regression ของ P7) | 95 / 95 |
| `render` — ทุกเส้นทาง × บทบาท | 115 เส้นทาง OK |
| TypeScript (`tsc -b`) | ผ่าน |
| Build: root `/` · `/sme-trust/` (v1 จาก main) · `/sme-trust/v2/` | ผ่านทั้ง 3 |

## 2. E2E ตามเบราว์เซอร์ (Playwright 1.48)

| เบราว์เซอร์ | ชุดที่รัน | ผล |
|---|---|---|
| Chromium (Desktop 1440) | ทั้งหมด 61 Test ที่ base `/` | 61 / 61 |
| Chromium | ทั้งหมด 61 Test ที่ base `/sme-trust/` | 61 / 61 |
| Firefox 131 | v2: `v2-journey`, `v2-assessment`, `v2-p7` (14 Test) | 14 / 14 |
| WebKit (Engine ของ Safari) | v2: `v2-journey`, `v2-assessment`, `v2-p7` (14 Test) | 14 / 14 |
| Chromium / Firefox / WebKit | GitHub Pages แบบรวม `pages.spec.ts` (3 Test ต่อเบราว์เซอร์) | 3 / 3 ทุกเบราว์เซอร์ |

Viewport: `v2-p7.spec.ts` เปิดหน้า v2 11 หน้า (Direct URL, Refresh, ไม่มี Horizontal overflow, ไม่ถูกส่งไปหน้าเข้าสู่ระบบ) ที่ **375 / 768 / 1440 px** ในทุกเบราว์เซอร์ข้างต้น · ทุก Test ตรวจ Console/Runtime error อัตโนมัติ

**Not Tested:** Safari บน macOS/iOS จริง, Firefox/Chrome บนอุปกรณ์จริง, Screen reader, ชุด E2E ของ v1 บน Firefox (รันเฉพาะชุด v2) และ v1 บน WebKit ในรอบนี้ (ผ่านใน UAT v1 ครั้งก่อน), GitHub Pages จริง (ตรวจด้วยเซิร์ฟเวอร์จำลองในเครื่อง)

## 3. Full Journey v2 — Happy Path และ Alternative Paths

| เส้นทาง | วิธีตรวจ | ผล |
|---|---|---|
| Happy Path: เชื่อม → นำเข้า → วิเคราะห์ → ประเมิน → ส่งคำขอ → อนุมัติ → Badge → ผู้บริโภคตรวจสอบ | E2E `v2-journey` (3 เบราว์เซอร์) | ✅ ID เดิมตลอด |
| Connection Failed / Import Failed / Sync Failed | Unit (`completeSync` แต่ละแบบ) + E2E (Import Failed → ลองใหม่) | ✅ |
| Insufficient Data | 9B + โปรไฟล์ 1–2 | ✅ ไม่ใช่ผลลบ |
| Request More Information | Unit S12→S13 + 9B E2E | ✅ ไม่มี Badge ใหม่ |
| Certification Rejected | Unit + E2E S12 → S13 | ✅ หน้าจบสีแดง, ผู้บริโภคเห็นระดับเดิม |
| Suspended / Revoked Merchant | Unit | ✅ ขอ Badge/ส่งพิจารณาไม่ได้, Band ไม่ถูกบังคับเป็น D |
| Self-Registration 9B (เดี่ยว / ใน Journey / Restart / Replay / Reset) | Unit 3 รอบ + E2E | ✅ ไม่สร้างร้านซ้ำ |
| Browser Refresh | Unit (rehydrate) + E2E (ระหว่าง 9B, Data Overview, Deep link) | ✅ |
| Restart Scenario / Restart Full Journey | Unit | ✅ ไม่สร้างคำขอซ้ำ |

## 4. Bug ที่พบและแก้ (ทุกข้อมี Regression Test)

| # | ระดับ | Bug | Root cause / การแก้ |
|---|---|---|---|
| B1 | P1 | Scenario 13 แนะนำ "นำ Badge ไปแสดง" แม้เจ้าหน้าที่ไม่อนุมัติ/ขอข้อมูลเพิ่ม และ Context ส่งต่อใบรับรองเดิมเหมือนเป็นใบใหม่ | ข้อความของ S13 ไม่อ่านผลการพิจารณา → เพิ่ม `decisionOutcome` หน้าจบแตกแขนง และส่งต่อ certId ใหม่เฉพาะเมื่ออนุมัติ |
| B2 | P1 | v1 และ v2 บน Origin เดียวกันใช้ localStorage Key ชุดเดียวกัน (ข้อมูลสาธิตปนกัน) | Namespace `smetrust:v2:` เมื่อ base เป็น `/…/v2/` · ปุ่มกู้คืนล้างเฉพาะ Namespace ของตัวเอง |
| B3 | P1 | Deep link ของ `/sme-trust/v2/...` บน GitHub Pages จะเปิดแอป v1 (404.html มีไฟล์เดียว) | 404 Redirect + `restoreDeepLink` (กัน Open Redirect) |
| B4 | P2 | ร้านข้อมูลน้อย/ข้อมูลขัดแย้ง/คืนสินค้าสูงได้ Band A | โมเดล v2.1 (ดู `assessment-validation.md`) |
| B5 | P2 | รีวิวน้อยกับมากได้ Confidence เท่ากัน | หัก Confidence เมื่อต่ำกว่าเป้าหมาย Coverage |
| B6 | P2 | น้ำหนักที่ผู้ใช้บันทึกด้วย Store รุ่นก่อนถูกทิ้งหลังอัปเกรด | เพิ่ม `migrate` + แปลงเป็นชุดน้ำหนัก #1 |
| B7 | P2 | 9B เล่นซ้ำแล้ว OP-012 มีร้านเดิม | `fixtureBranchClean` + `replayNote` |
| B8 | P2 | วันที่ซิงก์ของ Seed คงที่ — ข้อมูลตัวอย่างจะ "เก่า" เองเมื่อเวลาผ่านไป | วันที่สัมพัทธ์กับวันเริ่ม Demo (`demoAnchor`) |
| B9 | P3 | Executive Summary ล้นจอแนวนอน 80px ที่ 768px | Grid ของ Band เป็น 3 คอลัมน์ที่ md และ 5 ที่ lg |
| B10 | P3 | การเปรียบเทียบใน S10 ใช้หมวด "ความงามและสุขภาพ" กับทุกร้าน | ใช้หมวดของร้าน + คำเตือนข้ามหมวด |

ไม่มี P0/P1 ที่ยังเปิดอยู่ (รายการที่เหลือ: `docs/known-issues.md`)

## 5. Security & Privacy Review (P7-K)

| รายการ | ผล |
|---|---|
| API Key / Secrets / Token | ไม่พบใน `src/`, `scripts/`, `.github/` (มีเพียง permission `id-token: write` ของ GitHub Pages) |
| การเรียก Network (`fetch`, XHR, WebSocket, sendBeacon, EventSource) | ไม่พบ — ไม่มีการส่งข้อมูลไป External Server, ไม่มี External AI, ไม่มีการเชื่อม Marketplace จริง |
| URL ภายนอกในโค้ด | ไม่พบ |
| XSS (`dangerouslySetInnerHTML`, `eval`, `innerHTML`) | ไม่พบ — ข้อความจากผู้ใช้แสดงผ่าน React (Escape อัตโนมัติ) · `restoreDeepLink` รับเฉพาะ path ภายใน |
| ข้อมูลบุคคลจริง | ไม่มีเลขบัตรประชาชนจริง (ใช้รหัสตัวตนจำลอง `MID-…`) · เลขนิติบุคคล 13 หลักเป็นค่าสมมติ · ชื่อ/อีเมล `@demo.local` สมมติ |
| localStorage | เก็บเฉพาะ Mock State, Session สาธิต และร่างฟอร์ม · ข้อร้องเรียนที่พิมพ์เองใน AI ไม่ถูกบันทึก · PIN สาธิตเป็นข้อความ (KI-09) |
| มุมผู้บริโภค | ไม่มีคะแนน 0–100, สัญญาณที่ยังไม่มีข้อสรุป หรือข้อมูลส่วนตัวเจ้าของร้าน (Unit + Render test) |
| Dependencies | `npm audit --omit=dev`: react-router (moderate), zod (high) — ประเมินผลกระทบใน KI-V2-02 · แก้ต้องอัปเกรด Major |
| Static Hosting | ไม่มี Backend — ข้อมูลอยู่ในเบราว์เซอร์ของผู้ใช้แต่ละคน ไม่มีการแชร์ข้ามเครื่อง |

## 6. Thai Language & UX (P7-L)

- `tests/thai.test.mts` ผ่าน (4,139 ข้อความ รวมข้อความใหม่ของ P7)
- ข้อความใหม่: ผลลัพธ์แตกแขนง, คำเตือนเล่นซ้ำ 9B, ความใหม่ของข้อมูล, เหตุผลที่จำกัด Band, ชุดน้ำหนัก, KPI v2 — ใช้คำว่า "ควรตรวจสอบเพิ่มเติม" (ไม่ใช่ข้อกล่าวหา) และระบุว่าเป็นข้อมูลจำลองทุกส่วน
- ไม่มี Horizontal overflow ใน 11 หน้า v2 ที่ 375/768/1440 px · ใช้ Design token เดิม (น้ำเงิน–แดง–ขาว) ไม่ได้ Redesign
- ยังไม่ได้ตรวจโดยผู้เชี่ยวชาญด้านภาษา/กฎหมาย และยังไม่ได้วัด Color contrast ด้วยเครื่องมืออัตโนมัติ (ใช้สีเดิมที่ผ่าน UAT v1)

## 7. Acceptance Criteria

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | Scenario 1–13 ทำงาน | ✅ |
| 2 | Full Journey v1 และ v2 ผ่าน | ✅ |
| 3 | 9B เล่นซ้ำได้ | ✅ |
| 4 | ไม่เอื้อร้านข้อมูลน้อย | ✅ (v2.1) |
| 5 | Missing Data ≠ ความเสี่ยงสูง | ✅ |
| 6 | Officer Review ถูกต้อง | ✅ |
| 7 | Reject / Request More Information ไม่แสดง Badge ว่าอนุมัติ | ✅ |
| 8 | Data Confidence สมเหตุสมผล | ✅ |
| 9 | ไม่มีข้อมูลจาก External API | ✅ |
| 10 | Dashboard v2 ใช้ Mock State จริง | ✅ |
| 11 | Direct Routes พร้อมสำหรับ GitHub Pages | ✅ (ตรวจด้วยเซิร์ฟเวอร์จำลอง — ยังไม่ Deploy) |
| 12 | Browser Tests ที่รันจริงผ่าน | ✅ (ดูหัวข้อ 2 · Not Tested ระบุแล้ว) |
| 13 | ไม่มี P0/P1 Bugs | ✅ |
| 14–16 | TypeScript · Build · Regression | ✅ |
| 17 | เอกสารสอดคล้องกับโค้ด | ✅ |
| 18 | Branch main ไม่ถูกแก้ไข | ✅ (ใช้ `git archive main` อ่านอย่างเดียว) |
