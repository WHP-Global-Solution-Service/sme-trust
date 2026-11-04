// ตรวจโครงสร้าง GitHub Pages แบบรวม v1 + v2 ในเครื่อง (ไม่ Deploy และไม่แก้ Branch main)
//   node scripts/e2e-pages.mjs [--skip-build] [อาร์กิวเมนต์ของ Playwright เช่น --project=webkit]
// 1) v1: ดึงซอร์สของ main ด้วย git archive (อ่านอย่างเดียว) → build ด้วย base /sme-trust/
// 2) v2: build Branch ปัจจุบันด้วย base /sme-trust/v2/
// 3) รวมเป็น .pages/site (v1 ที่ราก, v2 ที่ /v2, 404.html ส่ง Deep link ของ v2) แล้วรัน E2E กับเซิร์ฟเวอร์จำลอง GitHub Pages
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const work = resolve('.pages');
const v1src = resolve(work, 'v1-src');
const site = resolve(work, 'site');
const args = process.argv.slice(2);
const skip = args.includes('--skip-build');
const pw = args.filter((a) => a !== '--skip-build');
const V1_REF = process.env.PAGES_V1_REF ?? 'main';

const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) {
    console.error(`ล้มเหลว: ${cmd} ${a.join(' ')}`);
    process.exit(r.status ?? 1);
  }
};

if (!skip) {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(v1src, { recursive: true });
  // แตกไฟล์ใน cwd (GNU tar บน Windows ตีความ "D:" เป็นเครื่องปลายทาง)
  run(`git -C "${root}" archive --format=tar ${V1_REF} | tar -x`, [], { cwd: v1src });
  symlinkSync(resolve(root, 'node_modules'), resolve(v1src, 'node_modules'), 'junction');
  run('npx', ['vite', 'build', '--outDir', 'dist', '--emptyOutDir'], { cwd: v1src, env: { ...process.env, VITE_BASE: '/sme-trust/' } });
  run('npx', ['vite', 'build', '--base', '/sme-trust/v2/', '--outDir', resolve(work, 'v2-dist'), '--emptyOutDir'], { cwd: root, env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'VITE_BASE')) });
  cpSync(resolve(v1src, 'dist'), site, { recursive: true });
  run('node', ['scripts/pages-combine.mjs', site, resolve(work, 'v2-dist'), '/sme-trust/', 'v2']);
}
if (!existsSync(resolve(site, 'v2', 'index.html'))) {
  console.error('ไม่พบ .pages/site — รันโดยไม่ใช้ --skip-build ก่อน');
  process.exit(1);
}
run('npx', ['playwright', 'test', '-c', 'playwright.pages.config.ts', ...pw]);
