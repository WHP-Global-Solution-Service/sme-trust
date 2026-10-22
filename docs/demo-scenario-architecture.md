# Demo Scenario Architecture

เอกสารนี้อธิบายโครงสร้างระบบสาธิต (Demo Presentation Mode) — Scenario 1–8, Demo Controller และ Full Journey

## หลักการ

1. **Scenario State แยกจาก Business State** — ขั้นตอนการสาธิตอยู่ใน `useDemoStore` ส่วนข้อมูลธุรกิจ (ร้านค้า ใบรับรอง ข้อร้องเรียน ฯลฯ) อยู่ใน Domain Store เดิม และเปลี่ยนผ่าน `stores/workflows.ts` เท่านั้น
2. **ระบบไม่ทำ Action แทนผู้ใช้** — ปุ่ม "ถัดไป" ไม่อนุมัติ ไม่ส่งข้อความ ไม่ระงับร้าน ผู้นำเสนอต้องกดในหน้าจอจริง (ข้อยกเว้นเดียว: การเตรียม Fixture ตอนเริ่มเรื่อง)
3. **ไม่มี Timer เปลี่ยนหน้าอัตโนมัติ** — ทุกการเปลี่ยนขั้นเกิดจากการกดของผู้ใช้
4. **ทุกการเปลี่ยนบทบาทผ่าน Role Transition** ที่อธิบายเหตุผลและให้ผู้ใช้ยืนยัน
5. **Restart ได้โดยไม่สร้างข้อมูลซ้ำ** — Snapshot ข้อมูลตอนเริ่มเรื่อง

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/demo/types.ts` | `ScenarioDef`, `DemoStep`, `GateInput` |
| `src/mock/scenarios/index.ts` | นิยาม Scenario 1–8 (ข้อมูลล้วน ไม่มี UI) · `findScenario`, `stepInstruction` |
| `src/mock/scenarios/fixtures.ts` | เตรียมจุดเริ่มต้นของเรื่อง (คืนข้อมูลบางส่วนจาก Seed) |
| `src/stores/demo.ts` | `useDemoStore` (persist `smetrust:v1:demo`) + `reportDemo()` |
| `src/demo/controller.ts` | Logic ทั้งหมดของการเดินขั้น: start / next / back / restart / journey / pause |
| `src/components/layout/DemoController.tsx` | UI: แผงด้านขวา (Desktop) แถบล่าง + Sheet (Mobile/Tablet) และ Role Transition Modal |
| `src/features/demo/DemoScenariosPage.tsx` | `/demo` — Full Journey + การ์ด 8 เรื่อง |
| `src/features/demo/DemoCompletePage.tsx` | `/demo/complete/:id` — สรุปเมื่อจบแต่ละเรื่อง |
| `src/features/demo/DemoOverviewPage.tsx` | `/demo/overview` — สรุปภาพรวมหลังจบ Scenario 8 |

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
  gate?: { check: (g: GateInput) => boolean; hint: string };  // เงื่อนไขก่อนกด "ถัดไป"
  capture?: (g: GateInput) => Partial<DemoCtx>;               // บันทึก ID ที่เกิดในขั้นนี้
}

interface ScenarioDef {
  id; no; title; objective; keyMessage; audience; duration; benefits; caseNote?; nextCta?;
  prepare(journey: DemoCtx, carry: boolean): DemoCtx;  // เตรียมข้อมูล + คืน Context เริ่มต้น
  exports?(ctx): Partial<DemoCtx>;                     // ID ที่ส่งต่อให้เรื่องถัดไปใน Journey
  steps: DemoStep[];
  summary(ctx): {...};                                 // ข้อมูลหน้าสรุป
}
```

### Demo State (`useDemoStore`)

| Field | ความหมาย |
|---|---|
| `journeyMode` | กำลังเล่น Full Journey หรือไม่ |
| `activeScenario`, `stepIndex`, `status` | ตำแหน่งปัจจุบัน · `idle` / `running` / `paused` / `completed` |
| `completed` | Scenario ที่จบแล้ว |
| `current` | Context IDs ของเรื่องที่กำลังเล่น (`operatorId`, `merchantId`, `applicationId`, `certId`, `complaintId`, `warningId`, `riskCaseId`, `consumerId`, `officerId`) |
| `journey` | Context ที่ส่งต่อระหว่างเรื่องใน Full Journey |
| `results` | Context ของแต่ละเรื่องที่จบ — ใช้แสดงหน้าสรุปย้อนหลังด้วยข้อมูลของเรื่องนั้น |
| `passed` | Step ID ที่ผ่าน Gate แล้ว (ย้อนกลับมาไม่ต้องทำซ้ำ) |
| `startedAt` | เวลาเริ่มเรื่อง — Gate ใช้แยกข้อมูลที่เกิดระหว่างสาธิตจากข้อมูลเดิม |
| `signals` | สัญญาณ UI จาก `reportDemo(key, value)` เช่น `register.step`, `ekyc.phase`, `shop.step`, `report.step`, `verify.viewed`, `channel.preview` — บันทึกเฉพาะเมื่อกำลังสาธิต |

## Gate — เปิดปุ่ม "ถัดไป" เมื่อทำขั้นนั้นเสร็จจริง

Gate อ่านได้ 2 แหล่ง:

- **Business State** — เช่น `application.status === 'approved'`, มีข้อความจากร้านที่ `at >= startedAt`, `useAiWorkspaceStore.ad.before` มีค่า
- **UI Signal** — สำหรับขั้นที่ยังไม่เปลี่ยนข้อมูลธุรกิจ เช่น ขั้นของ Wizard (`shop.step >= 3`) หรือเปิดหน้าตัวอย่างช่องทางขาย

UI แสดง "ทำขั้นนี้ให้เสร็จก่อนไปต่อ: {hint}" และปิดปุ่มจนกว่า `gateState(step).ok`

## การเดินขั้น

```
next(nav, currentPath, confirmed?) → 'blocked' | 'transition' | 'moved' | 'completed'
```

1. Gate ไม่ผ่าน → `blocked`
2. ขั้นปัจจุบันมี `capture` → บันทึก ID ลง `current`
3. ขั้นสุดท้าย → `completeScenario()` บันทึก `results`, เพิ่ม `completed`, ส่งต่อ `journey` แล้วเปิด `/demo/complete/:id` → `completed`
4. ขั้นถัดไปเปลี่ยนบทบาทและยังไม่ยืนยัน → `transition` (UI เปิด Role Transition)
5. `enterStep()` — สลับบัญชีตาม Context เมื่อบทบาทเปลี่ยน (เช่น ร้านเดิมของ `operatorId`) และ **navigate เฉพาะเมื่อ Route ต่างจากหน้าปัจจุบัน** (ข้อมูลในฟอร์มจึงไม่หาย) → `moved`

`back()` ทำงานแบบเดียวกันแต่ไม่ตรวจ Gate · `returnToStep()` พากลับหน้าจอของขั้นเมื่อผู้ใช้เปิดหน้าอื่น

### Gate แบบ "ทำแล้ว"

เมื่อกด "ถัดไป" ผ่านขั้นที่มี Gate ระบบบันทึก Step ID ใน `passed` — ย้อนกลับมาขั้นนั้นภายหลัง (ซึ่งแบบฟอร์มอาจเริ่มใหม่) `gateState()` คืน `{ ok: true, done: true }` และตัวควบคุมแสดง "ขั้นนี้ทำเสร็จแล้ว" จึงไม่ต้องทำ Business Action ซ้ำ · `startScenario` / `restartScenario` ล้าง `passed`

## ความต่อเนื่อง (Continuity) — ไม่สลับข้อมูลแบบเงียบ

- `ScenarioDef.continuity(journey)` คืน `ContinuityIssue { message, fixScenario, fallbackLabel }` เมื่อข้อมูลที่ส่งต่อมาใช้ไม่ได้: S2 (บัญชีจาก S1 ยังไม่ยืนยันตัวตน/มีร้านแล้ว), S3–S4 (ร้านจาก S2 ยังไม่ได้รับการรับรอง), S7 (ไม่มีบัญชีจาก S1)
- `effectiveJourney()` รวม `exports` ของ Scenario ที่กำลังเล่นแต่ยังไม่จบ เพื่อให้การข้ามเรื่องระหว่างทางเห็นร้าน/บัญชีล่าสุด
- UI (`features/demo/ScenarioLauncher.tsx`) ใช้ก่อน "ดำเนินการต่อ" (หน้าสรุป) และ "ข้ามไป" (หน้ารวม): มีปัญหา → กล่องเลือก **กลับไปทำ Scenario X ให้ครบ** (`goFixScenario` — สาธิตต่อจากขั้นเดิมถ้ายังค้างอยู่) / **ใช้ข้อมูลตัวอย่าง** / ยกเลิก · เรื่องถัดไปเป็นกรณีศึกษาแยก (caseNote) → กล่องแจ้งก่อนเริ่ม
- ใช้ข้อมูลตัวอย่าง → `prepareWithNotice()` ใส่ `current.notice` ซึ่งแสดงในตัวควบคุมและหน้าสรุป (persist — Refresh/Restart แล้วยังอยู่)

## เริ่ม / Restart / Full Journey

| การกระทำ | ผลต่อข้อมูล |
|---|---|
| **Start Demo** (แบบเดี่ยว) | `resetAllDemoData()` → `prepare(…, carry=false)` ใช้ Fixture ของเรื่อง → Snapshot |
| **Continue** (Full Journey) | ไม่ Reset — `prepare(journey, carry=true)` ใช้ ID จากเรื่องก่อน หรือกรณีศึกษาแยก (S5, S6, S8) → Snapshot |
| **Restart Scenario** | คืน Snapshot ตอนเริ่มเรื่อง (`smetrust:v1:demo-snapshot`) → ขั้นแรก · ไม่มีข้อมูลซ้ำ และไม่ลบผลของเรื่องก่อนหน้าใน Journey |
| **Reset Scenario** (หน้ารวม) | เหมือน Start แบบเดี่ยว แต่สถานะเป็น `idle` (ยังไม่เปิดแผงควบคุม) |
| **Start / Restart Full Journey** | `resetAllDemoData()` → เริ่ม Scenario 1 ในโหมด Journey |
| **Exit Demo** | `paused` — ซ่อนแผงควบคุม ข้อมูลยังอยู่ · "สาธิตต่อ" กลับขั้นเดิม |
| **Jump** (หน้ารวม Journey) | Completed → ดูสรุป · Current → สาธิตต่อ · Not Started → ขอยืนยันก่อนข้าม |
| **Refresh Browser** | `useDemoStore` และ Domain Store persist ใน localStorage — กลับมาขั้นเดิมพร้อม Context |

### Context ที่ส่งต่อใน Full Journey

```
S1 สมัคร  ──operatorId──▶ S2 ร้านค้า ──merchantId, applicationId, certId──▶ S3 ผู้บริโภคตรวจสอบ
   ──merchantId──▶ S4 ร้องเรียน (complaintId)
S5 คำเตือน (กรณีศึกษา M-003/OP-003 · warningId)      — caseNote อธิบายว่าเป็นคนละเหตุการณ์
S6 ระงับ/อุทธรณ์ (กรณีศึกษา M-004 · RSK-2569-0001)
S7 AI โฆษณา (ใช้บัญชีจาก S1 เมื่ออยู่ใน Journey)
S8 AI ข้อร้องเรียน (CMP-2569-0005 ของ OP-003 · ผู้บริโภค CS-007)
```

## Layout — ไม่บังปุ่มของแอป

- **Desktop (≥ lg):** แผงกว้าง 360px ด้านขวา เนื้อหาแอปเพิ่ม `lg:mr-[360px]` (`DEMO_INSET`)
- **Mobile/Tablet:** แถบล่างแบบย่อ (ย้อนกลับ · ชื่อขั้น · ถัดไป) อยู่เหนือ Bottom Navigation และเนื้อหาเพิ่ม Padding ล่าง · แตะที่ชื่อขั้นเพื่อเปิด Sheet รายละเอียด (Restart / Demo Menu / Exit)
- ตรวจด้วย Playwright ที่ 390×844 และ 820×1180: ปุ่มสุดท้ายของหน้าเลื่อนขึ้นมาเหนือแถบควบคุมได้ และไม่มี Horizontal Scroll

## การเพิ่ม Scenario ใหม่

1. เพิ่ม `ScenarioDef` ใน `src/mock/scenarios/index.ts` (ID ไม่ซ้ำ, ทุกการเปลี่ยนบทบาทมี `transition`)
2. ถ้าต้องการจุดเริ่มต้นเฉพาะ เพิ่ม Fixture ใน `fixtures.ts` และเรียกใน `prepare`
3. ขั้นที่ต้องรอ Action ให้มี `gate` อ่านจาก Store หรือเพิ่ม `reportDemo()` ในหน้าจอ
4. เพิ่มการทดสอบใน `tests/scenarios.test.mts` แล้วสร้าง `docs/demo-guide.md` ใหม่
