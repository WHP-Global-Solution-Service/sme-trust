import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Heart, Link2, Megaphone, MessageCircle, Share2, ShieldOff } from 'lucide-react';
import { toast } from '@/stores';
import { useMerchantView, useMyMerchants } from '@/hooks/useCurrent';
import { DEMO_CERT_LABEL, TRUST_LEVELS } from '@/constants/labels';
import { Alert, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader } from '@/components/common/ui';
import { TrustSeal, shopUrl, verifyUrl } from '@/components/common/Trust';
import { ShopSwitcher } from './ShopSwitcher';

function download(name: string, content: string, type = 'image/svg+xml') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** สร้าง Badge SVG ฝั่ง Client (ไม่ส่งข้อมูลออกนอกเบราว์เซอร์) */
function badgeSvg(shop: string, levelName: string, certId: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="140" viewBox="0 0 360 140" font-family="Noto Sans Thai, sans-serif">
<rect x="1" y="1" width="358" height="138" rx="16" fill="#fff" stroke="#173F94" stroke-width="2"/>
<circle cx="64" cy="70" r="40" fill="#173F94"/>
<path d="M64 44l20 7v14c0 12-8.5 22-20 26-11.5-4-20-14-20-26V51z" fill="#fff"/>
<path d="M55 69l6 6 12-12" stroke="#173F94" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="120" y="48" font-size="20" font-weight="700" fill="#173F94">${esc(levelName)}</text>
<text x="120" y="74" font-size="15" fill="#152B49">${esc(shop)}</text>
<text x="120" y="96" font-size="12" fill="#536984">ตรวจสอบ: ${esc(certId)}</text>
<text x="120" y="120" font-size="11" fill="#C92131">${DEMO_CERT_LABEL}</text>
</svg>`;
}

export default function ToolkitPage() {
  const { active } = useMyMerchants();
  const view = useMerchantView(active?.id);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!active || !view)
    return (
      <div>
        <PageHeader title="เครื่องมือส่งเสริมร้านค้า" icon={Megaphone} />
        <Card>
          <EmptyState icon={Megaphone} title="ยังไม่มีร้านค้า" action={<LinkButton to="/m/register-shop">ลงทะเบียนร้านค้า</LinkButton>} />
        </Card>
      </div>
    );

  const { merchant: m, cert, verdict, level } = view;
  const usable = !!cert && verdict.usable;
  const link = cert ? verifyUrl(cert.id) : shopUrl(m.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('คัดลอกลิงก์ตรวจสอบแล้ว', link);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ', 'กรุณาคัดลอกลิงก์ด้วยตนเอง');
    }
  };

  return (
    <div>
      <PageHeader title="เครื่องมือส่งเสริมร้านค้า" subtitle="นำสถานะการตรวจสอบไปแสดงบนช่องทางขายเดิม — ไม่ใช่ Marketplace หรือระบบสั่งซื้อใหม่" icon={Megaphone} />
      <ShopSwitcher />

      {!usable && (
        <Alert tone="error" icon={ShieldOff} title="ยังไม่สามารถใช้ Badge รับรองได้" className="mb-4">
          สถานะปัจจุบัน: {verdict.label} — {verdict.desc} ห้ามแสดง Badge รับรองบนช่องทางขายจนกว่าสถานะจะใช้งานได้ (ยังคัดลอกลิงก์หน้าร้านเพื่อให้ลูกค้าตรวจสอบได้)
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Badge Preview" />
          <div className="flex flex-col items-center gap-4 p-5">
            <div className="flex flex-wrap justify-center gap-4">
              <TrustSeal level={level} shopName={m.shopName} usable={usable} />
              <TrustSeal level={level} shopName={m.shopName} usable={usable} small />
            </div>
            <Button
              variant="secondary"
              icon={Download}
              disabled={!usable}
              onClick={() => {
                download(`sme-trust-badge-${m.id}.svg`, badgeSvg(m.shopName, TRUST_LEVELS[level].name, cert!.id));
                toast.success('ดาวน์โหลด Badge แล้ว', 'ไฟล์ SVG สร้างในเบราว์เซอร์');
              }}
            >
              ดาวน์โหลด Badge (SVG)
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="QR Code & Verification Link" />
          <div className="flex flex-col items-center gap-4 p-5">
            <div ref={qrRef} className="rounded-2xl border border-line bg-white p-3">
              <QRCodeSVG value={link} size={168} fgColor="#112E70" />
            </div>
            <div className="flex w-full items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{link}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={Copy} onClick={copy}>
                Copy Verification Link
              </Button>
              <Button
                variant="outline"
                icon={Download}
                onClick={() => {
                  const svg = qrRef.current?.querySelector('svg')?.outerHTML;
                  if (svg) download(`sme-trust-qr-${m.id}.svg`, svg);
                  toast.success('ดาวน์โหลด QR แล้ว');
                }}
              >
                ดาวน์โหลด QR
              </Button>
            </div>
            <p className="text-center text-xs text-ink-soft">QR และลิงก์ชี้ไปยังหน้าตรวจสอบภายใน Prototype นี้เท่านั้น</p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Social Media Badge Mockup" subtitle="ตัวอย่างการแสดงสถานะบนโพสต์ขายในช่องทางเดิม" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex items-center gap-2 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-50 font-bold text-primary">{m.shopName.charAt(0)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.shopName}</p>
                <p className="text-xs text-ink-soft">โพสต์ตัวอย่าง · ภาพจำลอง</p>
              </div>
            </div>
            <div className="relative grid aspect-square place-items-center bg-gradient-to-br from-primary-50 to-bg">
              <p className="px-6 text-center text-lg font-semibold text-primary">สินค้าใหม่ประจำสัปดาห์</p>
              <div className="absolute bottom-3 right-3">
                <TrustSeal level={level} shopName={m.shopName} usable={usable} small />
              </div>
            </div>
            <div className="space-y-1 p-3 text-sm">
              <p>ตรวจสอบร้านเราได้ที่ 👉 <span className="text-primary">{link.replace(/^https?:\/\//, '')}</span></p>
              <div className="flex gap-4 pt-1 text-ink-soft">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
                <Share2 className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="space-y-3 text-sm text-ink-soft">
            <p className="font-semibold text-ink">แนวทางการใช้งาน</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>แนบลิงก์ตรวจสอบหรือ QR ทุกครั้งที่แสดง Badge เพื่อให้ลูกค้าตรวจสอบสถานะล่าสุดได้เอง</li>
              <li>ใช้ Badge เฉพาะช่องทางขายที่ผ่านการตรวจสอบแล้วเท่านั้น</li>
              <li>นำ Badge ออกทันทีเมื่อใบรับรองหมดอายุ ถูกระงับ หรือถูกเพิกถอน</li>
              <li>Badge ไม่ใช่การรับประกันคุณภาพสินค้าทุกรายการ</li>
            </ul>
            <p className="rounded-xl bg-secondary-50 p-3 text-xs text-secondary">{DEMO_CERT_LABEL} — ระบบสาธิตไม่สร้าง Marketplace หรือระบบสั่งซื้อ</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
