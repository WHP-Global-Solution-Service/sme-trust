import { History, MessageSquareHeart, ScanText, Sparkles } from 'lucide-react';
import { useAiHistoryStore } from '@/stores';
import { LinkButton } from '@/components/common/ui';
import { AiDisclaimer, AiHeader, AiServiceCard, SectionCard } from '../components/AiCommon';
import { HistoryList } from './AIHistory';

/** AI ผู้ช่วย SME — หน้ารวมบริการ AI Simulation */
export default function AIAssistantHome() {
  const history = useAiHistoryStore((s) => s.items);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <AiHeader icon={Sparkles} title="AI ผู้ช่วย SME" desc="เครื่องมือช่วยป้องกันปัญหาก่อนเกิดเหตุ และช่วยร้านค้าแก้ไขข้อร้องเรียนเบื้องต้น" back={{ to: '/m', label: 'หน้าหลัก' }} />
      <AiDisclaimer />
      <div className="grid gap-3 md:grid-cols-2">
        <AiServiceCard
          to="/m/ai/ad-checker"
          icon={ScanText}
          title="ตรวจสอบข้อความโฆษณา"
          desc="ตรวจหาข้อความเกินจริง ข้อกล่าวอ้างที่ขาดหลักฐาน และข้อมูลสำคัญที่ขาด ก่อนเผยแพร่บนช่องทางขาย"
          cta="เริ่มตรวจสอบ"
        />
        <AiServiceCard
          to="/m/ai/complaint"
          icon={MessageSquareHeart}
          title="ช่วยจัดการข้อร้องเรียน"
          desc="สรุปประเด็น ข้อมูลที่ควรขอเพิ่ม แนวทางแก้ไข และร่างคำตอบที่ร้านตรวจสอบก่อนส่งเอง"
          cta="เริ่มวิเคราะห์"
        />
      </div>
      <SectionCard title="การวิเคราะห์ล่าสุด" icon={History} action={<LinkButton to="/m/ai/history" size="sm" variant="ghost">ดูทั้งหมด</LinkButton>}>
        <HistoryList items={history.slice(0, 5)} />
      </SectionCard>
    </div>
  );
}
