import { useNavigate } from 'react-router-dom';
import { Database, Download, RotateCcw, ShieldCheck } from 'lucide-react';
import { domainStores, confirmDialog, toast } from '@/stores';
import { STORAGE_PREFIX } from '@/stores/createEntityStore';
import { resetAllDemoData } from '@/stores/workflows';
import { downloadText } from '@/utils/download';
import { Alert, Button, Card, CardHeader, PageHeader } from '@/components/common/ui';

const NAMES = ['ผู้ประกอบการ', 'ร้านค้า', 'คำขอตรวจสอบ', 'ใบรับรอง', 'ข้อร้องเรียน', 'คำเตือน', 'เรื่องพิจารณาความเสี่ยง', 'การอบรม', 'การแจ้งเตือน', 'Audit Log', 'ประวัติ AI Simulation', 'การเชื่อมต่อ Marketplace (จำลอง)', 'ผลประเมินความน่าเชื่อถือ', 'บันทึกการนำเข้าข้อมูลร้าน (จำลอง)', 'คำขอเปลี่ยนข้อมูลร้าน'];

export default function DemoDataPage() {
  const nav = useNavigate();
  // ทุก Store มีโครงสร้าง { items } เหมือนกัน — จำนวน Hook คงที่ทุกครั้งที่ render
  type CountHook = (sel: (st: { items: unknown[] }) => number) => number;
  const counts = domainStores.map((s, i) => ({ name: NAMES[i], count: (s as unknown as CountHook)((st) => st.items.length) }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ข้อมูลสาธิต" subtitle="จัดการ Mock State ที่เก็บใน localStorage" icon={Database} />
      <Alert tone="success" icon={ShieldCheck} className="mb-4">
        ระบบนี้ไม่มี Backend ไม่เรียก API ภายนอก และไม่ส่งข้อมูลออกนอกเบราว์เซอร์ ข้อมูลเก็บที่ localStorage ภายใต้คีย์ <code className="font-mono">{STORAGE_PREFIX}*</code>
      </Alert>
      <Card className="mb-4">
        <CardHeader title="จำนวนรายการในแต่ละ Store" />
        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
          {counts.map((c) => (
            <li key={c.name} className="bg-white p-4">
              <p className="text-2xl font-bold text-ink">{c.count}</p>
              <p className="text-sm text-ink-soft">{c.name}</p>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          icon={Download}
          onClick={() => {
            const data = Object.fromEntries(domainStores.map((s, i) => [NAMES[i], s.getState().items]));
            downloadText('sme-trust-demo-state.json', JSON.stringify(data, null, 2), 'application/json');
            toast.success('ส่งออกข้อมูลสาธิตแล้ว');
          }}
        >
          Export Demo State (JSON)
        </Button>
        <Button
          variant="danger"
          icon={RotateCcw}
          onClick={async () => {
            const r = await confirmDialog({ title: 'Reset Demo Data', body: 'ล้างข้อมูลที่เปลี่ยนแปลงทั้งหมดและกลับเป็นข้อมูลตัวอย่างเริ่มต้น', tone: 'danger', confirmText: 'รีเซ็ต' });
            if (!r.ok) return;
            resetAllDemoData();
            toast.success('รีเซ็ตข้อมูลสาธิตแล้ว');
            nav('/');
          }}
        >
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
}
