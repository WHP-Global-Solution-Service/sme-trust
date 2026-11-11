# Demo Scenario Architecture

เอกสารนี้อธิบายโครงสร้างระบบสาธิต (Demo Presentation Mode) — Demo หลักเส้นเดียว กรณีพิเศษ ฟังก์ชันอื่นของระบบ และ Demo Controller · ไม่มี Full Journey และไม่แสดงเลข Scenario แก่ผู้ใช้ (รหัส `s1`, `s9a` ฯลฯ ใช้ภายในโค้ดเท่านั้น)

## หลักการ

1. **Scenario State แยกจาก Business State** — ขั้นตอนการสาธิตอยู่ใน `useDemoStore` ส่วนข้อมูลธุรกิจ (ร้านค้า ใบรับรอง ข้อร้องเรียน ฯลฯ) อยู่ใน Domain Store เดิม และเปลี่ยนผ่าน `stores/workflows.ts` เท่านั้น
2. **ระบบไม่ทำ Action แทนผู้ใช้** — ปุ่ม "ถัดไป" ไม่อนุมัติ ไม่ส่งข้อความ ไม่ระงับร้าน ผู้นำเสนอต้องกดในหน้าจอจริง (ข้อยกเว้นเดียว: การเตรียม Fixture ตอนเริ่มเรื่อง)
3. **ไม่มี Timer เปลี่ยนหน้าอัตโนมัติ** — ทุกการเปลี่ยนขั้นเกิดจากการกดของผู้ใช้
4. **ทุกการเปลี่ยนบทบาทผ่าน Role Transition** ที่อธิบายเหตุผลและให้ผู้ใช้ยืนยัน
5. **Restart ได้โดยไม่สร้างข้อมูลซ้ำ** — Snapshot ข้อมูลตอนเริ่มเรื่อง

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/demo/types.ts` | `ScenarioDef`, `DemoStep`, `GateInput`, `GateBlock` |
| `src/demo/main.ts` | Demo หลัก (`MAIN_JOURNEY_ID = 's9a'`, `MAIN_CTA_LABEL`) · ลำดับกรณีพิเศษ (`SPECIAL_CASE_IDS`) · ฟังก์ชันอื่น (`OTHER_DEMO_IDS`) · `DEMO_GROUPS` — ใช้ร่วมกันระหว่างหน้าแรก หน้า Demo และเมนู Demo Mode |
| `src/mock/scenarios/index.ts` · `v2.ts` · `automation.ts` | นิยามการสาธิต 10 เรื่อง (ข้อมูลล้วน ไม่มี UI): ฟังก์ชันอื่น `s1`, `s2`, `s4`, `s5`, `s7`, `s8` · กรณีพิเศษ `s6`, `s9b`, `s15` · Demo หลัก `s9a` |
| `src/mock/scenarios/fixtures.ts` | เตรียมจุดเริ่มต้นของเรื่อง (คืนข้อมูลบางส่วนจาก Seed) |
| `src/stores/demo.ts` | `useDemoStore` (persist `smetrust:v2:demo`) + `reportDemo()` |
| `src/demo/controller.ts` | Logic ของการเดินขั้น: start / next / back / restart / complete / pause / resume |
| `src/components/layout/DemoController.tsx` | UI: แผงด้านขวา (Desktop) แถบล่าง + Sheet (Mobile/Tablet) · Role Transition · กล่องเหตุผลเมื่อขั้นไปต่อไม่ได้ (`GateBlock`) |
| `src/features/demo/DemoScenariosPage.tsx` | `/demo` — Primary Action เดียว · ขั้นตอน Demo หลัก · กรณีพิเศษ · ผลลัพธ์โดยตรง · ฟังก์ชันอื่น (พับไว้) |
| `src/features/demo/DemoCompletePage.tsx` | `/demo/complete/:id` — สรุปเมื่อจบแต่ละเรื่อง พร้อม "จบการสาธิต" / "เริ่ม Demo ใหม่" |
| `src/features/merchants/DemoRegistrationGuard.tsx` | ครอบหน้าลงทะเบียนร้าน — ระหว่าง Demo ถ้าบัญชีลงทะเบียนร้านไปแล้วในการสาธิตครั้งนี้ แสดงสรุปแทนแบบฟอร์ม (กันสร้างร้านซ้ำ) |

URL ที่ยกเลิก: `/demo/overview`, `/demo/v2/summary` → Redirect `/demo` · `/m/marketplace-app` → Redirect `/m/marketplace` (ช่องทางขายออนไลน์ของร้านที่ลงทะเบียนแล้ว)

## โมเดลข้อมูล

```ts
interface DemoStep {
  id: string;
  title: string;
  role: Role;                         // บทบาทที่ต้องใช้ในขั้นนี้
  route: (ctx: DemoCtx) => string;    // หน้าจอ — คำนวณจาก Context IDs
  instruction: string | ((ctx) => string);
  tip?: string;                       // ประเด็นนำเสนอ
  transition?: string;                // คำอธิบายใน Role Transition (บังคับเมื่อบทบาทเปลี่ยน)
  nextLabel?: string;                 // ข้อความปุ่ม เช่น "ดูการตรวจสอบในมุมเจ้าหน้าที่"
  gate?: { check: (g: GateInput) => boolean; hint: string; blocked?: (g: GateInput) => GateBlock | undefined };  // เงื่อนไขก่อนกด "ถัดไป" + เหตุผล/ทางเลือกเมื่อไปต่อตามเส้นทางปกติไม่ได้
  capture?: (g: GateInput) => Partial<DemoCtx>;               // บันทึก ID ที่เกิดในขั้นนี้
}

interface ScenarioDef {
  id; no; title; objective; keyMessage; audience; duration; benefits; caseNote?; nextCta?;
  prepare(journey: DemoCtx, carry: boolean): DemoCtx;  // เตรียมข้อมูล + คืน Context เริ่มต้น (เริ่มแบบเดี่ยวเสมอ: prepare({}, false))
  replayNote?(): string | undefined;                   // แจ้งก่อนเริ่มซ้ำว่าร้านจากการเล่นครั้งก่อนจะถูกล้าง
  steps: DemoStep[];
  summary(ctx): {...};                                 // ข้อมูลหน้าสรุป
}
```

### Demo State (`useDemoStore`)

| Field | ความหมาย |
|---|---|
| `activeScenario`, `stepIndex`, `status` | ตำแหน่งปัจจุบัน · `idle` / `running` / `paused` / `completed` |
| `completed` | Scenario ที่จบแล้ว |
| `current` | Context IDs ของเรื่องที่กำลังเล่น (`operatorId`, `merchantId`, `applicationId`, `certId`, `complaintId`, `warningId`, `riskCaseId`, `consumerId`, `officerId`) |
| `results` | Context ของแต่ละเรื่องที่จบ — ใช้แสดงหน้าสรุปย้อนหลังด้วยข้อมูลของเรื่องนั้น |
| `passed` | Step ID ที่ผ่าน Gate แล้ว (ย้อนกลับมาไม่ต้องทำซ้ำ) |
| `startedAt` | เวลาเริ่มเรื่อง — Gate ใช้แยกข้อมูลที่เกิดระหว่างสาธิตจากข้อมูลเดิม |
| `signals` | สัญญาณ UI จาก `reportDemo(key, value)` เช่น `register.step`, `ekyc.phase`, `shop.step`, `report.step`, `verify.viewed`, `channel.preview` — บันทึกเฉพาะเมื่อกำลังสาธิต |

## Gate — เปิดปุ่ม "ถัดไป" เมื่อทำขั้นนั้นเสร็จจริง

Gate อ่านได้ 2 แหล่ง:

- **Business State** — เช่น `application.status === 'approved'`, มีข้อความจากร้านที่ `at >= startedAt`, `useAiWorkspaceStore.ad.before` มีค่า
- **UI Signal** — สำหรับขั้นที่ยังไม่เปลี่ยนข้อมูลธุรกิจ เช่น ขั้นของ Wizard (`shop.step >= 3`) หรือเปิดหน้าตัวอย่างช่องทางขาย

UI แสดง "ทำขั้นนี้ให้เสร็จก่อนไปต่อ: {hint}" และปิดปุ่มจนกว่า `gateState(step).ok`

ถ้าขั้นไปต่อตามเส้นทางปกติไม่ได้ (เช่น ชื่อร้านไม่ตรงกับร้านบน Marketplace → MANUAL_REVIEW) `gate.blocked(g)` คืน `GateBlock { reason, restart?, altScenario? }` — ตัวควบคุมแสดงเหตุผลพร้อมปุ่ม "เริ่มใหม่ (กลับไปแก้ไข)" และ/หรือ "เปิดกรณีพิเศษ" โดย **ไม่ข้ามเงื่อนไขหรือบังคับผลให้ผ่าน**

## การเดินขั้น

```
next(nav, currentPath, confirmed?) → 'blocked' | 'transition' | 'moved' | 'completed'
```

1. Gate ไม่ผ่าน → `blocked`
2. ขั้นปัจจุบันมี `capture` → บันทึก ID ลง `current`
3. ขั้นสุดท้าย → `completeScenario()` บันทึก `results`, เพิ่ม `completed` แล้วเปิด `/demo/complete/:id` → `completed`
4. ขั้นถัดไปเปลี่ยนบทบาทและยังไม่ยืนยัน → `transition` (UI เปิด Role Transition)
5. `enterStep()` — สลับบัญชีตาม Context เมื่อบทบาทเปลี่ยน (เช่น ร้านเดิมของ `operatorId`) และ **navigate เฉพาะเมื่อ Route ต่างจากหน้าปัจจุบัน** (ข้อมูลในฟอร์มจึงไม่หาย) → `moved`

`back()` ทำงานแบบเดียวกันแต่ไม่ตรวจ Gate · `returnToStep()` พากลับหน้าจอของขั้นเมื่อผู้ใช้เปิดหน้าอื่น

### Gate แบบ "ทำแล้ว"

เมื่อกด "ถัดไป" ผ่านขั้นที่มี Gate ระบบบันทึก Step ID ใน `passed` — ย้อนกลับมาขั้นนั้นภายหลัง (ซึ่งแบบฟอร์มอาจเริ่มใหม่) `gateState()` คืน `{ ok: true, done: true }` และตัวควบคุมแสดง "ขั้นนี้ทำเสร็จแล้ว" จึงไม่ต้องทำ Business Action ซ้ำ · `startScenario` / `restartScenario` ล้าง `passed`

## ไม่สร้างร้านหรือคำขอซ้ำ

- ทุกการเริ่มการสาธิตเป็นแบบเดี่ยว: `resetAllDemoData()` → `prepare({}, false)` → Snapshot — ไม่มีการส่งต่อข้อมูลข้ามเรื่อง
- หน้าลงทะเบียนร้าน (`/m/register-shop`, `/m/register-shop/marketplace`) ครอบด้วย `withDemoRegistrationGuard` — ระหว่าง Demo ถ้าบัญชีปัจจุบันมีร้านที่สร้างหลัง `startedAt` จะแสดง "ส่งคำขอลงทะเบียนแล้วในการสาธิตนี้" แทนแบบฟอร์ม (ตรวจครั้งเดียวตอนเปิดหน้า — หน้าผลการตรวจหลังกดส่งยังแสดงตามปกติ)
- ขั้นที่ผ่าน Gate แล้วอยู่ใน `passed` — ย้อนกลับ/ถัดไปไม่ทำ Business Action ซ้ำ
- หน้าแรก / หน้าหลักผู้ประกอบการ: บัญชีที่มีร้านลงทะเบียนแล้วถูกพาไป "ช่องทางขายออนไลน์" (`/m/marketplace`) หรือ "ข้อมูลร้านค้า" แทนการเริ่มลงทะเบียนร้านใหม่
- เริ่มเรื่องเดิมซ้ำขณะยังมีร้านจากครั้งก่อน → หน้ายืนยันแจ้ง `replayNote()` ก่อนล้าง

## เริ่ม / Restart / หยุดชั่วคราว

| การกระทำ | ผลต่อข้อมูล |
|---|---|
| **เริ่มการสาธิต** (หน้าแรก · หน้า Demo · Demo Mode) | `resetAllDemoData()` → `prepare({}, false)` ใช้ Fixture ของเรื่อง → Snapshot · ถ้ามีการสาธิตค้างอยู่ต้องยืนยันก่อน |
| **เริ่มเรื่องนี้ใหม่** (ตัวควบคุม) / **เริ่ม Demo ใหม่** (หน้าสรุป) | คืน Snapshot ตอนเริ่มเรื่อง (`smetrust:v2:demo-snapshot`) → ขั้นแรก · ไม่มีข้อมูลซ้ำ |
| **ดูผลลัพธ์โดยตรง** (หน้า Demo) | ไม่เปลี่ยนข้อมูล · สลับบทบาท/บัญชีสาธิตแล้วเปิดหน้าปลายทาง · การสาธิตที่ค้างอยู่ → `paused` |
| **ออกจากการสาธิต** | `paused` — ซ่อนแผงควบคุม ข้อมูลยังอยู่ · "สาธิตต่อ" (หน้า Demo) กลับขั้นเดิมด้วยบทบาทและบัญชีเดิม |
| **จบการสาธิต** (หน้าสรุป) | `exitDemo()` → กลับหน้า Demo · ข้อมูลที่สร้างยังอยู่จนกว่าจะเริ่มเรื่องใหม่ |
| **Refresh Browser** | `useDemoStore` และ Domain Store persist ใน localStorage — กลับมาขั้นเดิมพร้อม Context |

## Layout — ไม่บังปุ่มของแอป

- **Desktop (≥ lg):** แผงกว้าง 360px ด้านขวา เนื้อหาแอปเพิ่ม `lg:mr-[360px]` (`DEMO_INSET`)
- **Mobile/Tablet:** แถบล่างแบบย่อ (ย้อนกลับ · ชื่อขั้น · ถัดไป) อยู่เหนือ Bottom Navigation และเนื้อหาเพิ่ม Padding ล่าง · แตะที่ชื่อขั้นเพื่อเปิด Sheet รายละเอียด (Restart / Demo Menu / Exit)
- ตรวจด้วย Playwright ที่ 390×844 และ 820×1180: ปุ่มสุดท้ายของหน้าเลื่อนขึ้นมาเหนือแถบควบคุมได้ และไม่มี Horizontal Scroll

## การเพิ่ม Scenario ใหม่

1. เพิ่ม `ScenarioDef` ใน `src/mock/scenarios/` (ID ไม่ซ้ำ, ชื่อเป็นภาษาที่ผู้ใช้เข้าใจได้โดยไม่มีเลข Scenario, ทุกการเปลี่ยนบทบาทมี `transition`) แล้วเพิ่ม ID ในกลุ่มที่เหมาะสมของ `src/demo/main.ts`
2. ถ้าต้องการจุดเริ่มต้นเฉพาะ เพิ่ม Fixture ใน `fixtures.ts` และเรียกใน `prepare`
3. ขั้นที่ต้องรอ Action ให้มี `gate` อ่านจาก Store หรือเพิ่ม `reportDemo()` ในหน้าจอ
4. เพิ่มการทดสอบใน `tests/` (Unit ขับ Controller + E2E คลิกจริง) แล้วอัปเดต `docs/demo-guide.md`
