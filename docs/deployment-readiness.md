# Deployment Readiness — GitHub Pages

สถานะ: **Deploy แล้ว** — https://whp-global-solution-service.github.io/sme-trust/

- Repository: https://github.com/WHP-Global-Solution-Service/sme-trust (branch `main`)
- Deploy อัตโนมัติด้วย GitHub Actions ทุกครั้งที่ Push ไป `main` (รัน `npm test` และ Build ก่อน Deploy)
- ตรวจเว็บจริงด้วยเบราว์เซอร์ (22 ต.ค. 2569): หน้าแรก, ลิงก์ตรง `/verify/...` (ปลายทาง QR), หน้า Demo 8 Scenario, Start Demo, Refresh ระหว่างสาธิต และ AI ตรวจโฆษณา — ทำงานถูกต้อง ไม่มี JavaScript error

## ผลการตรวจ

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| Build ด้วย base `/sme-trust/` | `npm run test:e2e:subpath` (build + preview จริง) | ✅ Asset ทั้งหมดอยู่ใต้ `/sme-trust/assets/` |
| React Router รองรับ Sub-path | `BrowserRouter basename` = `BASE_URL` (คง `/` ท้าย) + E2E 41 รายการภายใต้ `/sme-trust/` | ✅ |
| Images / Fonts / Assets | ฟอนต์ Noto Sans Thai Bundle ผ่าน Vite, ไม่มี Request ล้มเหลว (E2E ตรวจ Console error ทุกหน้า) | ✅ |
| Direct Route และ Refresh | `postbuild` คัดลอก `index.html` → `404.html` · หน้าแรกเติม `/` ท้าย URL อัตโนมัติ (แก้ UAT-11) · E2E Reload ภายใต้ Sub-path | ✅ (HTTP status 404 ของ Deep link — KI-03) |
| QR Code ใช้ URL ที่รองรับ Sub-path | `appUrl()` = `origin + BASE_URL + path` · E2E ตรวจลิงก์ภายในขึ้นต้นด้วย `/sme-trust/` | ✅ |
| localStorage | ทุก Store persist ปกติภายใต้ Sub-path (E2E Reset/Reload) · ข้อมูลเสียหายใช้ Seed แทน | ✅ |
| ไม่มี API Keys / Secrets | สแกน `src/` และ `.github/` (คำว่า api key, secret, token, bearer) — ไม่พบ · ไม่มี `fetch`/XHR/WebSocket/sendBeacon | ✅ |
| GitHub Actions Workflow | `.github/workflows/deploy-pages.yml`: `npm ci` → `npm test` → `npm run build` (VITE_BASE=/<repo>/) → upload-pages-artifact → deploy-pages · permissions `pages: write`, `id-token: write` (จำเป็นสำหรับ deploy-pages ไม่ใช่ Secret) | ✅ รันบน GitHub สำเร็จ (ครั้งแรกล้มเหลวเพราะยังไม่เปิด Pages → เปิด Settings → Pages → Source: GitHub Actions แล้ว Re-run ผ่าน) |
| `package-lock.json` | มีและรวม `@playwright/test` (devDependency) | ✅ `npm ci` ใช้ได้ |

## ขั้นตอน Deploy (ทำแล้ว — เก็บไว้สำหรับ Repository ใหม่)

1. `git init` → Commit → สร้าง Repository บน GitHub (ชื่อ repo จะเป็น Base path เช่น `sme-trust`)
2. Settings → Pages → Source: **GitHub Actions**
3. Push ไปที่ `main` — Workflow จะทดสอบ Build และ Deploy อัตโนมัติ
4. ก่อน Push แนะนำให้รัน `npm test && npm run test:e2e && npm run test:e2e:subpath && npm run test:e2e:safari` ในเครื่อง (KI-05)

## คำสั่งที่เกี่ยวข้อง

```bash
npm run build                              # base "/"
MSYS_NO_PATHCONV=1 VITE_BASE=/sme-trust/ npm run build   # Git Bash บน Windows
npm run test:e2e:subpath                   # build + E2E ภายใต้ /sme-trust/ (Chromium)
npm run test:e2e:safari                    # E2E บน WebKit (Safari) Desktop + iPhone + iPad
```

---

# SME Trust v2 — ความพร้อมเผยแพร่ที่ `/sme-trust/v2/` (P7-I)

สถานะ: **พร้อมเผยแพร่หลังได้รับอนุญาต — ยังไม่ได้ Deploy** (ไม่มีการ Push/Merge/Deploy ในรอบนี้ และ Branch `main` ไม่ถูกแก้ไข)

Prototype นี้เป็น Frontend Only — **ไม่ใช่ระบบพร้อมใช้งานจริง (Not Production)**

## โครงสร้างที่ต้องการ

```
https://<owner>.github.io/sme-trust/      → v1 (Build จาก main, base /sme-trust/)
https://<owner>.github.io/sme-trust/v2/   → v2 (Build จาก sme-trustv.2, base /sme-trust/v2/)
```

GitHub Pages มี 1 Site ต่อ Repository และใช้ `404.html` **ไฟล์เดียวที่ราก** — v1 และ v2 จึงต้องอยู่ใน Pages Artifact เดียวกัน

## กลไกที่เตรียมไว้

| รายการ | ไฟล์ | การทำงาน |
|---|---|---|
| รวม Build | `scripts/pages-combine.mjs` | คัดลอก Build ของ v2 ไปที่ `<site>/v2/` และสร้าง `<site>/404.html` = หน้าแอป v1 + สคริปต์สั้นที่ส่ง Deep link ของ `/sme-trust/v2/...` ไปยัง `/sme-trust/v2/?__p=<path>` (Deep link ของ v1 ทำงานเหมือนเดิม) |
| คืนเส้นทางใน v2 | `src/utils/appUrl.ts` → `restoreDeepLink()` (เรียกใน `main.tsx` ก่อน Render) | อ่าน `__p` แล้ว `history.replaceState` กลับเป็นเส้นทางเดิม (รวม Query/Hash) · รับเฉพาะ path ภายใน (ปฏิเสธ `//`, `\` และ URL ภายนอก) |
| แยกข้อมูลในเบราว์เซอร์ | `src/stores/createEntityStore.ts` | v2 ที่ base `/…/v2/` ใช้ localStorage Namespace `smetrust:v2:` — v1 และ v2 อยู่ Origin เดียวกันแต่ข้อมูลสาธิตไม่ปนกัน · ปุ่มกู้คืนเมื่อเกิด Error ล้างเฉพาะ Namespace ของตัวเอง |
| Standalone | `npm run build:v2` | `dist-v2/` พร้อม `404.html` (สำเนา index) สำหรับเผยแพร่ v2 เป็น Site แยก |
| ตรวจในเครื่อง | `npm run test:e2e:pages` → `scripts/e2e-pages.mjs` + `playwright.pages.config.ts` | ดึงซอร์ส `main` ด้วย `git archive` (อ่านอย่างเดียว) → Build v1 → Build v2 → รวมเป็น `.pages/site` → เซิร์ฟเวอร์จำลอง GitHub Pages (`scripts/pages-preview.mjs`: ไม่พบไฟล์ → `/sme-trust/404.html` สถานะ 404) → E2E |

## ผลการตรวจ (ในเครื่อง — ไม่ใช่ GitHub Pages จริง)

| รายการ | Chromium | Firefox | WebKit |
|---|---|---|---|
| v1 ที่ `/sme-trust/`, v2 ที่ `/sme-trust/v2/` — Asset ของแต่ละเวอร์ชันโหลดจาก path ของตัวเองครบ | ✅ | ✅ | ✅ |
| Deep link + Refresh ของ v2: Merchant Dashboard, Marketplace Connection, Marketplace Analysis (มี Query), Trust Assessment, Officer Review, Consumer Verification, Demo Selector, Executive Summary | ✅ | ✅ | ✅ |
| Deep link ของ v1 (`/sme-trust/verify`) ยังเปิดแอป v1 | ✅ | ✅ | ✅ |
| localStorage ของ v1/v2 แยกกัน (v2 เขียนเฉพาะ `smetrust:v2:*`, v1 ไม่เห็น Journey v2) | ✅ | ✅ | ✅ |
| Build: root (`/`), `/sme-trust/` (v1 จาก main) และ `/sme-trust/v2/` | ✅ | | |

## ร่าง Workflow สำหรับเผยแพร่ v1 + v2 (ยังไม่เปิดใช้)

ไม่ได้เพิ่มเป็นไฟล์ใน `.github/workflows/` เพื่อไม่ให้เกิดการ Deploy โดยไม่ได้ตั้งใจ — ใช้แทน `deploy-pages.yml` เดิมเมื่อได้รับอนุญาตให้เผยแพร่ v2

```yaml
name: Deploy v1 + v2 to GitHub Pages
on:
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: main, path: v1 }
      - uses: actions/checkout@v4
        with: { ref: sme-trustv.2, path: v2 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm test && npm run build
        working-directory: v1
        env: { VITE_BASE: '/${{ github.event.repository.name }}/' }
      - run: npm ci && npm test && npx vite build --base "/${{ github.event.repository.name }}/v2/" --outDir dist-v2 --emptyOutDir
        working-directory: v2
      - run: node v2/scripts/pages-combine.mjs v1/dist v2/dist-v2 "/${{ github.event.repository.name }}/" v2
      - uses: actions/upload-pages-artifact@v3
        with: { path: v1/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Checklist ก่อนเผยแพร่ (เมื่อได้รับอนุญาต)

1. ยืนยันว่าเผยแพร่ v2 ร่วมกับ v1 ที่ `/sme-trust/v2/` (หรือแยก Repository/Site)
2. นำ Workflow ด้านบนไปใช้แทน `deploy-pages.yml` บน Branch ที่ GitHub Pages ใช้
3. รันในเครื่อง: `npm test && npm run test:e2e && npm run test:e2e:firefox && npm run test:e2e:safari && npm run test:e2e:pages`
4. หลัง Deploy: เปิด Deep link ของ v2 อย่างน้อย 3 หน้า, Refresh ระหว่าง Journey v2 และเปิด v1 เพื่อยืนยันว่าข้อมูลไม่ปนกัน
5. ข้อจำกัดที่ยังอยู่: KI-03 / KI-V2-03 (HTTP 404 ของ Deep link ครั้งแรก) — ดู `docs/known-issues.md`
