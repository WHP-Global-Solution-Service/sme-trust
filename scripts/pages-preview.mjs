// เซิร์ฟเวอร์จำลองพฤติกรรม GitHub Pages (Project site) สำหรับตรวจ Deep link ในเครื่อง — ไม่ใช่การ Deploy
//   node scripts/pages-preview.mjs <site-dir> [base=/sme-trust/] [port=4320]
// ไฟล์ที่มีอยู่ → 200 · โฟลเดอร์ → index.html · ไม่พบ → <base>404.html พร้อมสถานะ 404 (เหมือน GitHub Pages)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [dir, base = '/sme-trust/', port = '4320'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (file, status = 200) => {
    res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  };
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('outside project site');
  }
  // ตัด ".." ออกทุกส่วน — ไม่ให้อ่านไฟล์นอกโฟลเดอร์เว็บไซต์
  const rel = normalize(decodeURIComponent(url.pathname.slice(base.length)))
    .split(/[\\/]+/)
    .filter((p) => p && p !== '..')
    .join('/');
  let file = join(dir, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (existsSync(file) && statSync(file).isFile()) return send(file);
  return send(join(dir, '404.html'), 404);
}).listen(Number(port), () => console.log(`GitHub Pages preview: http://localhost:${port}${base}`));
