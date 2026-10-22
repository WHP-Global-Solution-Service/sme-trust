import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, QrCode, ScanLine } from 'lucide-react';
import { useCertificationStore, useMerchantStore } from '@/stores';
import { currentCert } from '@/utils/trust';
import { Alert, Button, Card, CardHeader, PageHeader } from '@/components/common/ui';
import { Input } from '@/components/forms/Field';
import { verifyUrl } from '@/components/common/Trust';

/** QR Verification — จำลองการสแกนโดยไม่เปิดกล้องจริง */
export default function VerifyPage() {
  const nav = useNavigate();
  const merchants = useMerchantStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState<string>();

  useEffect(() => {
    if (!scanning) return;
    const t = setTimeout(() => nav(`/verify/${scanning}`), 1300);
    return () => clearTimeout(t);
  }, [scanning, nav]);

  const samples = merchants
    .map((m) => ({ m, c: currentCert(certs, m.id) }))
    .filter((x) => x.c)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="สแกน QR ตรวจสอบใบรับรอง" subtitle="จำลองการสแกน — ระบบสาธิตไม่เปิดกล้องของอุปกรณ์" icon={QrCode} />
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <div className="relative mx-auto grid aspect-square w-full max-w-[280px] place-items-center overflow-hidden rounded-2xl bg-ink">
            <div className="absolute inset-8 rounded-2xl border-4 border-white/80" style={{ clipPath: 'polygon(0 0,30% 0,30% 6%,6% 6%,6% 30%,0 30%,0 70%,6% 70%,6% 94%,30% 94%,30% 100%,70% 100%,70% 94%,94% 94%,94% 70%,100% 70%,100% 30%,94% 30%,94% 6%,70% 6%,70% 0,100% 0,100% 100%,0 100%)' }} />
            {scanning ? (
              <>
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={verifyUrl(scanning)} size={120} />
                </div>
                <div className="absolute inset-x-8 h-0.5 animate-scan bg-sky-300 shadow-[0_0_12px_3px_rgba(125,211,252,.8)]" />
              </>
            ) : (
              <div className="text-center text-white/70">
                <Camera className="mx-auto h-10 w-10" />
                <p className="mt-2 text-sm">เลือก QR ตัวอย่างด้านขวา</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-sm font-medium text-primary">{scanning ? 'กำลังอ่าน QR Code...' : 'พร้อมสแกน (จำลอง)'}</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) nav(`/verify/${code.trim().toUpperCase()}`);
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="หรือกรอกเลขอ้างอิง เช่น SMT-2569-000101" />
            <Button type="submit">ตรวจสอบ</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="QR ตัวอย่างสำหรับสาธิต" subtitle="แต่ละใบมีสถานะต่างกัน" icon={ScanLine} />
          <ul className="grid gap-2 p-4 sm:grid-cols-2">
            {samples.map(({ m, c }) => (
              <li key={c!.id}>
                <button onClick={() => setScanning(c!.id)} disabled={!!scanning} className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left hover:border-primary/40 hover:bg-bg disabled:opacity-50">
                  <QRCodeSVG value={verifyUrl(c!.id)} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{m.shopName}</span>
                    <span className="block truncate font-mono text-xs text-ink-soft">{c!.id}</span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => setScanning('SMT-0000-999999')} disabled={!!scanning} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line p-2.5 text-left hover:bg-bg disabled:opacity-50">
                <QRCodeSVG value={verifyUrl('SMT-0000-999999')} size={44} fgColor="#94a3b8" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">QR ที่ไม่มีในระบบ</span>
                  <span className="block font-mono text-xs text-ink-soft">SMT-0000-999999</span>
                </span>
              </button>
            </li>
          </ul>
          <div className="px-4 pb-4">
            <Alert tone="info">QR ทั้งหมดชี้ไปยังหน้าตรวจสอบภายใน Prototype นี้เท่านั้น</Alert>
          </div>
        </Card>
      </div>
    </div>
  );
}
