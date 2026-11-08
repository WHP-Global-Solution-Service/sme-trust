import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, FlaskConical, ShieldCheck, Smartphone, Store } from 'lucide-react';
import { useMyMerchants } from '@/hooks/useCurrent';
import { reportDemo } from '@/stores/demo';
import { Button, PageHeader } from '@/components/common/ui';

/**
 * Marketplace App Simulation — หน้าจอแอปผู้ขายบน Marketplace (จำลอง ไม่ใช่แอปหรือโลโก้ของแพลตฟอร์มจริง)
 * จุดเริ่มต้นของเส้นทางปกติ: ผู้ขายกดเชื่อมกับ SME Trust → นำเข้าข้อมูล → ระบบประเมินและออก Assessment Badge อัตโนมัติ
 */
export default function MarketplaceAppSimulation() {
  const nav = useNavigate();
  const { active: m } = useMyMerchants();
  const go = () => {
    reportDemo('mktapp.connect', true);
    nav('/m/marketplace');
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Marketplace App Simulation" subtitle="จำลองหน้าจอผู้ขายบน Marketplace — ไม่ใช่แอปจริง และไม่เชื่อมต่อ Shopee/Lazada จริง" icon={Smartphone} back={{ to: '/m', label: 'หน้าหลัก' }} />
      <div className="mx-auto w-full max-w-sm rounded-[2rem] border-8 border-ink/80 bg-white shadow-xl" data-testid="marketplace-app">
        <div className="rounded-t-[1.4rem] bg-ink-soft px-4 py-3 text-white">
          <p className="flex items-center gap-1.5 text-xs opacity-80">
            <FlaskConical className="h-3.5 w-3.5" /> Seller Center (จำลอง)
          </p>
          <p className="mt-1 flex items-center gap-2 font-bold">
            <Store className="h-5 w-5" /> {m?.shopName ?? 'ร้านของคุณ'}
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['คำสั่งซื้อ', '128'],
              ['คะแนนร้าน', '4.8'],
              ['ตอบแชต', '96%'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-bg p-2">
                <p className="font-bold text-ink">{v}</p>
                <p className="text-ink-soft">{k}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary-50 p-3">
            <p className="flex items-center gap-1.5 font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" /> เพิ่มความน่าเชื่อถือด้วย SME Trust
            </p>
            <p className="mt-1 text-xs text-ink">ให้ความยินยอมส่งข้อมูลร้าน (จำลอง) ไปยัง SME Trust — ระบบประเมินและแสดง Trust Assessment Badge ให้อัตโนมัติ โดยส่งเฉพาะกรณีที่ต้องตรวจสอบเพิ่มเติมให้เจ้าหน้าที่</p>
            <Button block className="mt-3" icon={ArrowRight} onClick={go}>
              เชื่อมกับ SME Trust
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-ink-soft">
            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" /> ตัวเลขบนหน้าจอนี้เป็นภาพประกอบ — ข้อมูลที่นำเข้าจริงในระบบสาธิตสร้างจาก Generator จำลองตามร้านตัวอย่างที่เลือก
          </p>
        </div>
      </div>
    </div>
  );
}
