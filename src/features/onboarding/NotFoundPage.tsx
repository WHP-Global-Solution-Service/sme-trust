import { SearchX } from 'lucide-react';
import { Card, EmptyState, LinkButton } from '@/components/common/ui';

export default function NotFoundPage() {
  return (
    <Card className="mx-auto mt-6 max-w-lg">
      <EmptyState icon={SearchX} title="ไม่พบหน้าที่ต้องการ" desc="ลิงก์อาจไม่ถูกต้อง หรือข้อมูลถูกรีเซ็ตแล้ว" action={<LinkButton to="/">กลับหน้าแรก</LinkButton>} />
    </Card>
  );
}
