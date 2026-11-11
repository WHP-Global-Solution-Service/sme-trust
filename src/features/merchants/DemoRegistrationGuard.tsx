import { useState, type ComponentType } from 'react';
import { CheckCircle2, Store } from 'lucide-react';
import type { Merchant } from '@/types';
import { useMerchantStore, useSessionStore } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { REGISTRATION_STATUS } from '@/constants/labels';
import { Card, LinkButton, PageHeader } from '@/components/common/ui';

/**
 * ร้านที่บัญชีปัจจุบันลงทะเบียนไปแล้วระหว่างการสาธิตครั้งนี้ (ตรวจครั้งเดียวตอนเปิดหน้า)
 * ใช้กันการลงทะเบียนร้านซ้ำเมื่อกดย้อนกลับ / Refresh / เปิดหน้าลงทะเบียนอีกครั้งระหว่าง Demo — นอก Demo ไม่มีผล
 */
export function useDemoRegisteredShop(): Merchant | undefined {
  const [shop] = useState(() => {
    const d = useDemoStore.getState();
    if (!d.activeScenario || (d.status !== 'running' && d.status !== 'paused') || !d.startedAt) return undefined;
    const op = useSessionStore.getState().operatorId;
    return useMerchantStore
      .getState()
      .items.filter((m) => m.operatorId === op && m.registrationStatus !== 'draft' && m.createdAt >= d.startedAt!)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  });
  return shop;
}

function AlreadyRegistered({ shop }: { shop: Merchant }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="ลงทะเบียนร้านค้า" back={{ to: '/m', label: 'หน้าหลัก' }} />
      <Card className="p-6 text-center" data-testid="demo-registration-done">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <p className="mt-3 text-lg font-bold text-ink">ส่งคำขอลงทะเบียนแล้วในการสาธิตนี้</p>
        <p className="mt-1 text-sm text-ink-soft">
          ร้าน <b className="text-ink">{shop.shopName}</b> ({shop.id}) · สถานะ {REGISTRATION_STATUS[shop.registrationStatus].label}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink">ไม่ต้องกรอกหรือส่งคำขอซ้ำ — กด "ถัดไป" ในตัวควบคุมการสาธิตเพื่อทำขั้นต่อไปด้วยร้านค้าเดิม</p>
        <LinkButton to="/m/shop" variant="outline" icon={Store} className="mt-4">
          ดูข้อมูลร้านค้า
        </LinkButton>
      </Card>
    </div>
  );
}

/** ครอบหน้าลงทะเบียน: ถ้าลงทะเบียนไปแล้วในการสาธิตครั้งนี้ แสดงสรุปแทนแบบฟอร์ม (ไม่สร้างร้านซ้ำ) */
export function withDemoRegistrationGuard<P extends object>(Page: ComponentType<P>) {
  return function Guarded(props: P) {
    const shop = useDemoRegisteredShop();
    return shop ? <AlreadyRegistered shop={shop} /> : <Page {...props} />;
  };
}
