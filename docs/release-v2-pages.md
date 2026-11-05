# Release — SME Trust v2 แทน v1 บน GitHub Pages (URL เดิม)

URL: https://whp-global-solution-service.github.io/sme-trust/
Source: `sme-trustv.2` → Merge เข้า `main` → GitHub Actions (`deploy-pages.yml`) Deploy จาก `main` เท่านั้น

> สถานะ: **เผยแพร่แล้ว 3 รอบ** — รอบที่ 1 (v2 แทน v1) Merge `7e6df10` · Run #3 · ข้อ 9 · รอบที่ 2 (Marketplace Auto-Fill) Merge `4eed1d9` · Run #4 · ข้อ 10 · รอบที่ 3 (หน้าแรก Concept v2 + คำขอเปลี่ยนข้อมูลร้าน) Merge `304d247` · Run #5 · ข้อ 11–12
> Prototype นี้เป็น Frontend Only ด้วยข้อมูลจำลอง — **ไม่ใช่ระบบพร้อมใช้งานจริง (Not Production)**

## 1. ผล Preflight

| # | รายการ | ผล |
|---|---|---|
| 1 | Git Status / Branch | `sme-trustv.2` · Working tree สะอาดก่อนเริ่ม |
| 2 | v2 Commit ล่าสุดก่อน Release | `a0e3f81` (P7) |
| 3 | `main` กับ `sme-trustv.2` | `main` = `4027c04` = `origin/main` (ตรวจด้วย `git fetch` / `ls-remote`) · `main` เป็นบรรพบุรุษของ `sme-trustv.2` (ตามหลัง 0, นำหน้า 7 รวม Release Commit) → **Merge ได้โดยไม่มี Conflict** · `sme-trustv.2` ยังไม่เคย Push |
| 4 | Workflow เดิม | `deploy-pages.yml` ไฟล์เดียว: Push `main` → `npm ci` → `npm test` → `npm run build` (VITE_BASE=/<repo>/) → Deploy · ไม่มี Workflow อื่นที่ Deploy |
| 5 | Vite Base | `VITE_BASE` → `/sme-trust/` (ไม่ใช่ `/sme-trust/v2/`) |
| 6 | Router | `BrowserRouter` + `basename` = `BASE_URL` (ไม่ใช้ HashRouter) |
| 7 | Deep link / 404 | `postbuild` คัดลอก `index.html` → `404.html` (แบบเดียวกับ v1) — ลบกลไก `__p` / `restoreDeepLink` ของโครงสร้าง `/v2/` เดิมออก (ไม่มี Redirect แล้ว) |
| 8 | Static Assets | JS/CSS/ฟอนต์อยู่ใต้ `/sme-trust/assets/` · favicon `/sme-trust/favicon.svg` (Vite เติม Base ให้) |
| 9 | **localStorage** | **พบปัญหาและแก้แล้ว:** เดิม v2 ที่ Base `/sme-trust/` จะใช้ Namespace `smetrust:v1:` เดียวกับ v1 → ผู้ที่เคยเปิด v1 จะได้ข้อมูลรูปแบบเก่า (ไม่มีข้อมูลตัวอย่าง Marketplace/Scenario 9–13) โหลดเข้า v2 · แก้เป็น `smetrust:v2:` ทุก Base · ไม่ลบคีย์ v1 (Rollback แล้วข้อมูลเดิมยังอยู่) |
| 10 | Security / Secrets | ไม่มี Secret ใน `src/` และ Workflow · ไม่มี `fetch`/XHR/WebSocket/sendBeacon · Workflow ใช้เฉพาะ `GITHUB_TOKEN` แบบ OIDC ของ deploy-pages (`pages: write`, `id-token: write`) |

## 2. การเปลี่ยนแปลงใน Release Commit

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `.github/workflows/deploy-pages.yml` | เพิ่ม TypeScript Check, ตรวจ Build Output (`404.html` = `index.html`, Asset ใต้ `/<repo>/`, ไม่มี `/v2/`), `if: github.ref == 'refs/heads/main'` ทั้ง Build และ Deploy (สั่งด้วยมือจาก Branch อื่นจะไม่ Deploy), `cancel-in-progress: false` (ไม่ตัด Deploy ที่กำลังทำ), `timeout-minutes` |
| `src/stores/createEntityStore.ts` | `STORAGE_PREFIX = 'smetrust:v2:'` ทุก Base |
| `src/main.tsx`, `src/utils/appUrl.ts` | ลบ `restoreDeepLink` (ใช้เฉพาะโครงสร้างรวม `/v2/`) |
| `src/routes/lazyPage.tsx` | โหลดไฟล์หน้าแบบลองซ้ำ + ใช้การโหลดร่วมกัน (แก้ Render error บน Firefox) |
| `scripts/run-tests.mjs` | Test runner ข้ามแพลตฟอร์ม — `npm test` เรียกไฟล์นี้ (ชุดและลำดับเดิม) |
| `package.json` | ลบ `build:v2` · `test` → `node scripts/run-tests.mjs` |
| `scripts/pages-combine.mjs` | ลบ (ไม่สร้าง Combined Artifact) |
| `scripts/e2e-pages.mjs`, `playwright.pages.config.ts`, `tests/e2e/pages.spec.ts` | ตรวจเว็บไซต์เดียวที่ `/sme-trust/`: Build แบบเดียวกับ Workflow → เซิร์ฟเวอร์จำลอง GitHub Pages → E2E |
| `tests/**` | คีย์ localStorage ในการทดสอบ `smetrust:v1:` → `smetrust:v2:` (เงื่อนไขเดิม) · แทนการทดสอบ `restoreDeepLink` ด้วยการตรวจ Namespace และการไม่เขียน URL ใหม่ |
| Docs | ไฟล์นี้, `deployment-readiness.md`, `known-issues.md`, `README.md`, `demo-guide.md` |

## 3. ผลการตรวจในเครื่อง

ทดสอบกับ Build ที่ Base `/sme-trust/` (คำสั่งเดียวกับ Workflow) · วันที่ 4 พ.ย. 2569 · **ไม่ใช่ GitHub Pages จริง**

| รายการ | ผล |
|---|---|
| TypeScript (`npm run typecheck`) | ✅ ผ่าน |
| `npm test` (13 ชุด) | ✅ ผ่านทั้งหมด — thai 4 · flows 123 · ai 60 · scenarios 234 · workflows ALL PASS · v2 marketplace 27 · assessment 30 · workflows 41 · ui 18 · scenarios 175 · validation 56 · p7 98 · render 115 เส้นทาง |
| `npm run build` (`VITE_BASE=/sme-trust/`) | ✅ `404.html` = `index.html` · Asset ใต้ `/sme-trust/assets/` · favicon `/sme-trust/favicon.svg` · ไม่มี `/v2/` · ไฟล์หลัก 547.71 kB (gzip 181.23 kB) |
| ขั้นตอน "Verify build output" ของ Workflow (รันด้วย bash กับ Build จริง) | ✅ ผ่าน · กรณี Base ผิด → ล้มเหลวตามที่ควร |
| E2E Chromium ครบทุกชุด @ `/sme-trust/` | ✅ 61/61 |
| E2E Firefox ครบทุกชุด @ `/sme-trust/` | ✅ 61/61 (ครั้งแรกที่รัน Firefox ครบทุกชุด รวม v1) |
| E2E WebKit — v2 ทุกชุด + Full Journey + Scenario 1–8 @ `/sme-trust/` | ✅ 23/23 |
| E2E GitHub Pages จำลอง (`npm run test:e2e:pages`) | ✅ Chromium 3/3 · Firefox 3/3 · WebKit 3/3 (รอบสุดท้าย WebKit "Page crashed" 1 ครั้งที่ Process ของเบราว์เซอร์ → รันซ้ำ 2 รอบบน Build เดียวกันผ่าน 6/6) |
| ครอบคลุม | Registration, Marketplace Connection, Price & Review Analysis, Trust Assessment, Officer Approval, Badge/Certificate Verification (QR), Complaint, AI ตรวจโฆษณา/ร้องเรียน, Scenario 1–13, 9B, Full Journey v1/v2, Deep link + Refresh 13 เส้นทาง, ผู้ใช้ที่มีข้อมูล v1 ค้างในเบราว์เซอร์, ไม่มี Request ไปโดเมนอื่นหรือ `/sme-trust/v2/`, ตรวจ Console/Runtime error ทุก Test |
| Security | ✅ ไม่พบ Secret / `.env` / `fetch`/XHR/WebSocket · URL ภายนอกใน Bundle มีเพียงข้อความเตือนของไลบรารี (zustand, date-fns, React) ไม่มีการเรียกใช้ |

**ปัญหาที่พบและแก้ในรอบนี้**

1. **localStorage ชนกับข้อมูล v1** (Preflight ข้อ 9) — แก้เป็น `smetrust:v2:*` + E2E จำลองผู้ใช้เดิม
2. **`npm test` ค้างบน Windows** — `cmd.exe` ของ npm ไม่เริ่มคำสั่งแรกเมื่อเป็น `&&` 13 คำสั่ง (คำสั่งเดี่ยวทำงานปกติ) → เปลี่ยนเป็น `scripts/run-tests.mjs` (ชุดทดสอบและลำดับเดิม หยุดเมื่อล้มเหลวเหมือนเดิม) — 116 วินาที
3. **Firefox: Render error ของหน้าแบบ Lazy** (`roles.spec` Reset Demo Data) — Firefox ยกเลิก Dynamic import ที่ค้างอยู่เมื่อเปลี่ยน/Reload หน้า → `React.lazy` รายงาน Error · แก้ `src/routes/lazyPage.tsx` ให้ลองโหลดซ้ำ (500ms, 1500ms) และใช้การโหลดร่วมกันระหว่าง preload/Render · ลองครบแล้วยังล้มเหลวจะส่ง Error เดิมให้ ErrorBoundary · Unit test 3 ข้อ + Firefox `roles.spec` ×5 = 15/15 + Firefox ครบทุกชุด 61/61


## 4. จุดย้อนกลับ (Rollback Point)

| รายการ | ค่า |
|---|---|
| v1 Commit | `4027c04934ce22d05b812ae88ee5960ce2b30990` |
| Tag (สร้างในเครื่องแล้ว ยังไม่ Push) | `v1-before-sme-trust-v2` (annotated) → `4027c04` |
| Workflow run ของ v1 ที่ Deploy สำเร็จล่าสุด | ดูใน Actions ก่อน Merge และจดเลข Run ไว้ |

## 5. ขั้นตอนเผยแพร่ (ทำหลังได้รับอนุมัติเท่านั้น)

```bash
# 0) ตรวจสถานะ
git fetch origin
git rev-parse origin/main            # ต้องเป็น 4027c04… — ถ้าไม่ใช่ ให้หยุดและรายงาน
git status                           # ต้องสะอาด

# 1) Push Tag และ Branch ต้นทาง (ไม่ Force)
git push origin v1-before-sme-trust-v2
git push -u origin sme-trustv.2      # Push Branch นี้ไม่ Deploy (Workflow ทำงานเฉพาะ main)

# 2) Merge เข้า main โดยไม่ Rewrite History
git switch main
git merge --ff-only origin/main      # main ในเครื่องตรงกับ Remote
git merge --no-ff sme-trustv.2 -m "Release SME Trust v2 to GitHub Pages (replaces v1 at /sme-trust/)"
#    --no-ff สร้าง Merge Commit เดียว → Rollback ได้ด้วย revert ครั้งเดียว

# 3) ตรวจหลัง Merge (หยุดถ้า Fail)
npm ci && npm run typecheck && npm test
MSYS_NO_PATHCONV=1 npm run test:e2e:pages

# 4) Push main → GitHub Actions Deploy
git push origin main
```

หลัง Push: ดู Actions จนทั้ง `build` และ `deploy` สำเร็จ แล้วตรวจเว็บจริงตามข้อ 6

## 6. ตรวจเว็บไซต์จริงหลัง Deploy

- [ ] `https://whp-global-solution-service.github.io/sme-trust/` เปิด v2 (หน้า Demo มีแท็บ "v2 — Marketplace Intelligence" และ Full Journey v2)
- [ ] Deep link + Refresh: `/sme-trust/verify/SMT-2569-000101`, `/sme-trust/m/marketplace`, `/sme-trust/o/assessments`, `/sme-trust/demo/v2/summary`
- [ ] Full Journey v2 ครบ 13 → หน้าสรุป · Scenario 9B · Scenario 1–8 อย่างน้อย 1 เรื่อง
- [ ] AI ตรวจโฆษณา / ผู้ช่วยร้องเรียน
- [ ] DevTools: ไม่มี Console error (ยกเว้นสถานะ 404 ของคำขอแรกของ Deep link — KI-03), ไม่มี Request ไปโดเมนอื่น, ไม่มี Request ไป `/sme-trust/v2/`
- [ ] เบราว์เซอร์ที่เคยเปิด v1: เปิดได้ปกติ ข้อมูลตัวอย่าง v2 ครบ
- [ ] มือถือจริงอย่างน้อย 1 เครื่อง

## 7. Rollback Plan (ไม่ Force Push / ไม่ Rewrite History)

**ทางเลือก A — เร็วที่สุด (ไม่แก้ Git):** Actions → Workflow run ล่าสุดของ v1 ที่สำเร็จ (Commit `4027c04`) → **Re-run all jobs** — GitHub รันซ้ำด้วย Commit เดิม จึง Deploy v1 กลับ (Re-run ได้ภายใน 30 วันหลังรันครั้งแรก) · การ Push `main` ครั้งถัดไปจะ Deploy v2 อีกครั้ง จึงใช้เป็นการแก้ฉุกเฉินระหว่างเตรียมทางเลือก B

**ทางเลือก B — ถาวร (Revert Commit ใหม่):**

```bash
git switch main && git pull --ff-only
git revert -m 1 <merge-commit> -m "Rollback: restore SME Trust v1 on GitHub Pages"
git diff v1-before-sme-trust-v2 HEAD --stat   # ต้องว่าง = ต้นไม้ไฟล์เท่ากับ v1
git push origin main                          # Workflow (ของ v1) Deploy v1
```

ถ้า Merge แบบ Fast-forward (ไม่มี Merge Commit): `git revert --no-commit 4027c04..HEAD && git commit -m "Rollback: restore SME Trust v1"`

หลัง Rollback: ข้อมูลสาธิตของผู้ใช้ v1 (`smetrust:v1:*`) ยังอยู่ เพราะ v2 ไม่ลบ · ข้อมูลของ v2 (`smetrust:v2:*`) ค้างในเบราว์เซอร์โดยไม่มีผล · การนำ v2 กลับมาภายหลัง: `git revert <revert-commit>`

## 8. เกณฑ์ยอมรับ (Release Acceptance)

| เกณฑ์ | ตรวจในเครื่อง | ตรวจบนเว็บจริง |
|---|---|---|
| URL เดิมเปิด v2 / v1 ถูกแทนที่ | ✅ (เซิร์ฟเวอร์จำลอง) | ✅ `index--Nc6Dx8l.js` (v1 เดิม `index-BPJSzHoq.js`) |
| Scenario 1–13, Full Journey v1/v2, 9B | ✅ | ✅ E2E บนเว็บจริง 37/37 |
| Marketplace เป็นข้อมูลจำลอง / ไม่มี External API | ✅ (ตรวจ Request ทุกหน้า) | ✅ ไม่มี Request นอก `/sme-trust/` |
| Trust Model v2.1 | ✅ | ✅ (Full Journey v2, P7 flows) |
| ไม่มีข้อมูลส่วนบุคคลจริง | ✅ (Mock Data) | — |
| ไม่มี Console Errors / Broken Routes | ✅ | ✅ ยกเว้นข้อความ 404 ของ Document จาก Deep link (KI-03) — จับคู่ได้ครบ 113/113 ไม่มี Asset ล้มเหลว |
| Automated Tests | ✅ | ✅ GitHub Actions (TypeScript + `npm test`) |
| GitHub Actions สำเร็จ | — | ✅ Run #3 (build + deploy) |
| Rollback Plan / Git History v1 | ✅ Tag + แผนข้อ 7 · ไม่มีการ Rewrite | — |

## 9. บันทึกการเผยแพร่

| รายการ | ค่า |
|---|---|
| Rollback Tag (Push แล้ว) | `v1-before-sme-trust-v2` → `4027c04` |
| Source Branch (Push แล้ว) | `sme-trustv.2` @ `c7d5fa0` |
| Merge Commit (`--no-ff`) | `7e6df10` "Release SME Trust v2 to GitHub Pages (replaces v1 at /sme-trust/)" — ไม่มี Conflict · ต้นไม้ไฟล์ตรงกับ `c7d5fa0` · ไม่มี Force Push |
| ตรวจหลัง Merge (ในเครื่อง) | `npm ci` · TypeScript ✅ · `npm test` 13 ชุด ✅ · Build `/sme-trust/` + Verify ✅ · E2E Pages จำลอง 9/9 (3 เบราว์เซอร์) |
| GitHub Actions | Run #3 `41873095495` — build ✅ (checkout, setup-node, npm ci, TypeScript check, Automated tests, Build, Verify build output, upload) · deploy ✅ · 16:59:47–17:01:54 UTC 4 พ.ย. 2569 · https://github.com/WHP-Global-Solution-Service/sme-trust/actions/runs/41873095495 |
| Run ของ v1 สำหรับ Rollback ทางเลือก A | Run #2 `39731774899` (`4027c04`) — Re-run ได้ถึงราว 21 พ.ย. 2569 |
| เว็บไซต์จริง | https://whp-global-solution-service.github.io/sme-trust/ — HTTP 200, `index--Nc6Dx8l.js` (ตรงกับ Build ในเครื่องหลัง Merge) · Asset ทั้งหมด 200 |

### Smoke Test บนเว็บไซต์จริง (Playwright กับ URL จริง)

| ชุด | ผล |
|---|---|
| หน้าแรก/Asset/Network, Deep link + Refresh 13 เส้นทาง, ข้อมูล v1 ค้างในเบราว์เซอร์ | ✅ Chromium 3/3 · Firefox 3/3 · WebKit 3/3 |
| E2E เชิงฟังก์ชัน (Full Journey v1 1→8, Scenario 1–8, Full Journey v2 + 9B, P7: S12 ไม่อนุมัติ/S13, 9B เล่นซ้ำ, ความใหม่ข้อมูล, หมวดเปรียบเทียบ, Admin, จอ 375/768/1440, Role/Lifecycle, AI, Trust Assessment) | ✅ 37/37 (Chromium) |

หมายเหตุ: รอบแรกของ E2E เชิงฟังก์ชัน 10 Test ไม่ผ่านที่ตัวตรวจ Console เท่านั้น — ข้อความ "Failed to load resource: 404" เกิดจาก GitHub Pages ตอบ Deep link ด้วย `404.html` (HTTP 404, KI-03) ซึ่ง `vite preview` ในเครื่องตอบ 200 จึงไม่เคยพบ · รันซ้ำด้วยตัวตรวจที่ยอมเฉพาะข้อความ 404 ที่จับคู่กับ Document 404 และนับ Request อื่นที่ ≥ 400 เป็น Error → 37/37 ผ่าน, Console 404 = Document 404 = 113, ไม่มี Asset ล้มเหลว · ไม่ใช่ปัญหาร้ายแรง จึง**ไม่ Rollback**

Not Tested: Safari/อุปกรณ์มือถือจริง, Screen reader, ผู้ใช้จริงที่เคยเปิด v1 (จำลองด้วย localStorage แทน)

## 10. Release 2 — Marketplace Auto-Fill Registration (เผยแพร่แล้ว)

| รายการ | ค่า |
|---|---|
| ขอบเขต | Marketplace-Assisted Registration & Auto-Fill (`1051045`): ทางเข้า A/B, หน้าอนุญาตจำลอง, Auto-Fill พร้อมป้ายที่มา, ฉบับร่าง, ตารางเทียบสำหรับเจ้าหน้าที่, Scenario 9 (อัปเดตร้านเดิม M-005) และ 9A (ร้านใหม่) |
| ตรวจก่อน Merge | `origin/main` = `7e6df10` ตามที่คาด · `sme-trustv.2` = `1051045` ไม่มีงานค้าง · Commit บน `main` ที่ Branch ไม่มีคือ Merge Commit `7e6df10` เท่านั้น (ต้นไม้ไฟล์ตรงกับ `c7d5fa0` ซึ่งอยู่ใน Branch แล้ว) → ไม่มีฟังก์ชันบน `main` สูญหาย |
| Rollback Tag (Push แล้ว) | `sme-trust-v2.0-before-autofill` → `7e6df10` (annotated) · Tag เดิม `v1-before-sme-trust-v2` ยังอยู่ |
| Source Branch (Push แล้ว) | `sme-trustv.2` `35f416d..1051045` |
| Merge Commit (`--no-ff`) | `4eed1d9` "Release SME Trust v2 Marketplace Auto-Fill registration to GitHub Pages" — ไม่มี Conflict · ต้นไม้ไฟล์ตรงกับ `1051045` · ไม่มี Force Push / Rewrite History |
| ตรวจหลัง Merge (ในเครื่อง) | TypeScript ✅ · `npm test` 14 ชุด ✅ (render 117 เส้นทาง) · Production Build ✅ — หมายเหตุ: คำสั่งในเครื่องรันผ่าน Git Bash ซึ่งแปลง `VITE_BASE=/sme-trust/` เป็น Path ของ Windows จึงไม่ใช่ Build ด้วย Base `/sme-trust/` (Build ที่ Deploy จริงทำโดย GitHub Actions ด้วย Base ที่ถูกต้อง และตรวจบนเว็บจริงแล้ว) · ครั้งถัดไปใช้ `MSYS_NO_PATHCONV=1` |
| GitHub Actions | Run #4 `41930692056` — build ✅ deploy ✅ · 23:04:16–23:05:23 UTC 4 พ.ย. 2569 (06:04 น. 5 พ.ย. ตามเวลาไทย) · https://github.com/WHP-Global-Solution-Service/sme-trust/actions/runs/41930692056 |
| เว็บไซต์จริง | https://whp-global-solution-service.github.io/sme-trust/ — Bundle `index-DMiRSbhj.js` มี Chunk ของหน้าใหม่ (`MarketplaceRegistrationPage`, `MarketplaceProfilePage`) · Static Asset ที่อ้างอิงทั้งหมด 119 ไฟล์ตอบ 200 · Deep link ตอบ App Shell (HTTP 404 ตาม KI-03) |
| หมายเหตุ Hash | ชื่อไฟล์ Bundle บนเว็บจริงไม่ตรงกับ Build ในเครื่อง (`index-iMM7KFdW.js`) เพราะ Base ของ Build ในเครื่องถูก Git Bash แปลง (ดูแถวด้านบน) — จึงตรวจแทนด้วยการพบ Chunk ของหน้าใหม่และ Smoke Test บนเว็บจริง |
| Rollback (ถ้าจำเป็น) | `git revert -m 1 4eed1d9` แล้ว Push `main` → กลับเป็นเว็บไซต์ `7e6df10` (ไม่ Force Push) |

### Live Smoke Test รอบที่ 2 (Playwright กับ URL จริง)

| ชุด | Chromium | Firefox | WebKit |
|---|---|---|---|
| E2E ทุกชุด (Scenario 1–8, Full Journey v1/v2, 9B, Auto-Fill, Trust Assessment, Officer, Consumer, Admin, Lifecycle, จอ 375/768/1440) | ✅ 65/65 | — | — |
| v2-autofill, v2-journey, v2-assessment, v2-p7, Scenario 1–8 เดี่ยว, Pages (Direct links/Assets/v1 storage) | ✅ (รวมอยู่ข้างบน) | ✅ 27/27 | — |
| Scenario 9A เริ่มจากการ์ด Demo จนถึงหน้าเจ้าหน้าที่ (Test เฉพาะเว็บจริง) | ✅ | ✅ | ✅ |
| v2-autofill + Pages | ✅ | ✅ | ✅ 6/6 (รวม 9A) |

หมายเหตุ: รอบแรกของ Chromium มี 12 Test ไม่ผ่านโดยไม่ใช่ปัญหาของเว็บไซต์ — 8 Test จากการรัน Test 9A พร้อมกันในโฟลเดอร์ผลลัพธ์เดียวกัน (ไฟล์ Trace ถูกลบ), 3 Test จาก `ERR_SSL_PROTOCOL_ERROR` ของเครือข่ายเครื่องทดสอบ และ 2 Spec ที่กำหนดให้ Request ต้องอยู่บน `localhost` (ปรับเป็นโดเมน Pages ในสำเนาสำหรับเว็บจริงเท่านั้น) · รันซ้ำทีละไฟล์แล้วผ่านทั้งหมด 39/39 · ตัวตรวจ Console ยอมเฉพาะข้อความ 404 ที่จับคู่กับ Document 404 ของ Deep link (KI-V2-14) · ไม่พบปัญหาร้ายแรง จึง**ไม่ Rollback**

Not Tested (รอบที่ 2): Safari / อุปกรณ์มือถือจริง · ชุด v1 (Lifecycle, Scenario 1–8 แบบ Journey) บน Firefox/WebKit ของเว็บจริง

## 11. งานในรอบที่ 3 (เผยแพร่แล้ว — ดูข้อ 12)

งานด้านล่างพัฒนาใน `sme-trustv.2` (`447a9fa`) และเผยแพร่ด้วย Merge `304d247`

| งาน | สรุป |
|---|---|
| หน้าแรก Concept v2 | Hero ใหม่ ("เชื่อมข้อมูลร้านค้าออนไลน์ ประเมินความน่าเชื่อถืออย่างโปร่งใส") · CTA 4 ปุ่มไปยัง Flow จริง · Section การเชื่อม Marketplace / Trust Assessment 7 ปัจจัย / Trust Badge (แยก Band, Level, สถานะ) / ผู้บริโภค / Demo 15 เส้นทาง (เน้น Full Journey v2) · `/demo?track=v1|v2` เลือกแท็บ · หลังสมัครจากปุ่ม "เชื่อมร้านค้าออนไลน์"/"ลงทะเบียนด้วยตนเอง" ไปต่อที่ขั้นตอนนั้น |
| คำขอเปลี่ยนข้อมูลร้าน (ปิด KI-V2-15) | Merchant Edit → Change Request → Officer Review → อนุมัติ / ไม่อนุมัติ / ขอข้อมูลเพิ่ม → แจ้งร้าน → อัปเดตโปรไฟล์ → Audit Log · หน้า `/o/profile-changes`, `/o/profile-changes/:id`, `/m/profile-changes`, `/m/profile-changes/:id` |

## 12. Release 3 — หน้าแรก Concept v2 + คำขอเปลี่ยนข้อมูลร้าน (เผยแพร่แล้ว)

| รายการ | ค่า |
|---|---|
| Rollback Tag | `sme-trust-v2.1-before-homepage-refresh` (annotated) → `4eed1d9` · Push แล้ว |
| Source | `sme-trustv.2` @ `447a9fa` (Push แล้ว) |
| Merge Commit | `304d247` (`--no-ff`, ไม่ Force Push / ไม่ Rewrite History) · ต้นไม้ไฟล์เท่ากับ `447a9fa` |
| ตรวจหลัง Merge | `npm ci` ✅ · TypeScript ✅ · `npm test` 15 ชุด ✅ (render 123 เส้นทาง) · Build `/sme-trust/` ✅ (`index-_gZqWRBa.js`, `404.html`) · E2E Pages จำลอง 9/9 ✅ · Chromium ครบทุกชุด 70/70 ✅ |
| GitHub Actions | Run #5 `42108759719` · build ✅ 21:01:25–21:02:45 · deploy ✅ 21:02:49–21:03:39 (UTC, 5 พ.ย. 2569) |
| เว็บจริง | Bundle `index-_gZqWRBa.js` (ตรงกับ Build ในเครื่อง) · Asset 122 ไฟล์ตอบ 200 |
| Live smoke | Chromium ครบทุกชุด + Live 3 = 73/73 ✅ · Firefox 39/39 ✅ (home, profile-change, autofill, v2-journey, scenarios 1–8, secondary, live) · WebKit 13/13 ✅ (home, profile-change, autofill, live) |
| Rollback (ถ้าจำเป็น) | `git revert -m 1 304d247` → Push `main` (ไม่ Force) · ตรวจ `git diff sme-trust-v2.1-before-homepage-refresh HEAD --stat` ว่าง |

หมายเหตุการตรวจในเครื่อง: รอบแรกหลัง Merge มี 1 Test (`continuity` Restart Scenario) ไม่ผ่านขณะรัน 4 Worker และ Build ของ Pages จำลองล้มเหลวจาก `ENOTEMPTY` ที่ `distssets` (ไฟล์ถูกล็อกบน Windows) · รัน `continuity` ซ้ำ 3 รอบผ่าน 6/6 · ล้าง `dist` แล้วรันครบทุกชุดผ่าน 70/70 · Pages จำลองรันซ้ำผ่าน 9/9

หมายเหตุ Live smoke: Test เฉพาะเว็บจริงข้อ Deep link รอบแรกไม่ผ่านเพราะ Test เปิด `/m/marketplace` ในมุมมองผู้บริโภค (เว็บแสดงหน้า "ไม่มีสิทธิ์เข้าถึง" ถูกต้อง) · แก้ Test ให้ตั้งบทบาทตามเส้นทางแล้วผ่าน · ตรวจบัญชีสาธิตล่าสุด: บทบาทเจ้าหน้าที่/ผู้ดูแล/ผู้บริโภคกดปุ่มร้านค้าบนหน้าแรก → หน้าเข้าสู่ระบบที่ระบุชื่อบัญชีและมีปุ่ม "ใช้บัญชีอื่น" (ไม่เข้า Workflow ร้านค้าโดยเงียบ) · ไม่พบปัญหาร้ายแรง จึง**ไม่ Rollback**

Not Tested (รอบที่ 3): Safari / อุปกรณ์มือถือจริง · ชุด v1 Lifecycle/Journey บน Firefox/WebKit ของเว็บจริง
