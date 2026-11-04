// รวม Build ของ v1 และ v2 เป็น GitHub Pages Artifact เดียว (ไม่ Deploy — ใช้ตรวจโครงสร้างและเตรียมเผยแพร่)
//   node scripts/pages-combine.mjs <v1-dist> <v2-dist> [base=/sme-trust/] [sub=v2]
// ผลลัพธ์: <v1-dist>/v2/ = Build ของ v2 และ <v1-dist>/404.html = หน้าแอป v1 + สคริปต์ส่ง Deep link ของ v2 ไปยัง /<base>/v2/?__p=...
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [v1, v2, base = '/sme-trust/', sub = 'v2'] = process.argv.slice(2);
if (!v1 || !v2 || !existsSync(join(v1, 'index.html')) || !existsSync(join(v2, 'index.html'))) {
  console.error('usage: node scripts/pages-combine.mjs <v1-dist> <v2-dist> [base] [sub]');
  process.exit(1);
}
const prefix = `${base.replace(/\/?$/, '/')}${sub}/`;
const v2Html = readFileSync(join(v2, 'index.html'), 'utf8');
if (!v2Html.includes(`${prefix}assets/`)) {
  console.error(`v2 build ต้องใช้ base ${prefix} (พบ asset path ไม่ตรง)`);
  process.exit(1);
}
const target = join(v1, sub);
rmSync(target, { recursive: true, force: true });
cpSync(v2, target, { recursive: true });

// สคริปต์รันก่อนแอป v1: ถ้าเป็นเส้นทางของ v2 ให้ส่งต่อไปหน้าแรกของ v2 (คง path/query/hash ไว้ใน __p)
const redirect = `<script>(function(){var p=location.pathname,b=${JSON.stringify(prefix)};if(p===b.slice(0,-1)||p.indexOf(b)===0){var rest=p.slice(b.length-1)||'/';location.replace(b+'?__p='+encodeURIComponent(rest+location.search)+location.hash);}})();</script>`;
const v1Html = readFileSync(join(v1, 'index.html'), 'utf8');
writeFileSync(join(v1, '404.html'), v1Html.replace('<head>', `<head>\n    ${redirect}`));
console.log(`รวมแล้ว: ${v1}/ (v1 ที่ ${base}) + ${target}/ (v2 ที่ ${prefix}) · 404.html ส่ง Deep link ของ v2 ไปยัง ${prefix}?__p=`);
