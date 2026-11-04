// ตรวจเว็บไซต์ GitHub Pages ในเครื่อง: SME Trust v2 แทน v1 ที่ URL เดิม /sme-trust/ (ไม่ Deploy และไม่แก้ Branch main)
//   node scripts/e2e-pages.mjs [--skip-build] [อาร์กิวเมนต์ของ Playwright เช่น --project=webkit]
// 1) Build เหมือน Workflow: `npm run build` ด้วย VITE_BASE=/sme-trust/ (postbuild คัดลอก index.html → 404.html)
// 2) คัดลอก dist → .pages/site แล้วรัน E2E กับเซิร์ฟเวอร์จำลอง GitHub Pages (ไม่พบไฟล์ → /sme-trust/404.html สถานะ 404)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const work = resolve('.pages');
const site = resolve(work, 'site');
const args = process.argv.slice(2);
const skip = args.includes('--skip-build');
const pw = args.filter((a) => a !== '--skip-build');

const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) {
    console.error(`ล้มเหลว: ${cmd} ${a.join(' ')}`);
    process.exit(r.status ?? 1);
  }
};

if (!skip) {
  rmSync(work, { recursive: true, force: true });
  run('npm', ['run', 'build'], { env: { ...process.env, VITE_BASE: '/sme-trust/' } });
  cpSync(resolve('dist'), site, { recursive: true });
}
if (!existsSync(resolve(site, 'index.html')) || !existsSync(resolve(site, '404.html'))) {
  console.error('ไม่พบ .pages/site/index.html หรือ 404.html — รันโดยไม่ใช้ --skip-build ก่อน');
  process.exit(1);
}
run('npx', ['playwright', 'test', '-c', 'playwright.pages.config.ts', ...pw]);
