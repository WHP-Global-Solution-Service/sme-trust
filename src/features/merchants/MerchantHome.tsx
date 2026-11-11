import { Link } from 'react-router-dom';
import { Link2,
  AlertTriangle,
  BadgeCheck,
  Bell,
  ChevronRight,
  ClipboardEdit,
  FileWarning,
  GraduationCap,
  IdCard,
  Lightbulb,
  Megaphone,
  MessageSquareHeart,
  MessageSquareWarning,
  ScanText,
  ShieldCheck,
  Store,
  UserCheck,
} from 'lucide-react';
import { useComplaintStore, useWarningStore, useVerificationStore } from '@/stores';
import { useCurrentOperator, useMerchantView, useMyMerchants, useMyNotifications } from '@/hooks/useCurrent';
import { REGISTRATION_STATUS, RISK_STATUS, TRUST_LEVELS } from '@/constants/labels';
import { fmtRelative } from '@/utils/format';
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, SectionTitle, StatusBadge } from '@/components/common/ui';
import { VerdictBadge } from '@/components/common/Trust';
import { cn } from '@/utils/cn';
import { ShopSwitcher } from './ShopSwitcher';
import { AiServiceCard, AiSimulationBadge } from '@/features/ai-assistant/components/AiCommon';

const tips = [
  'แสดงราคา ค่าจัดส่ง และเงื่อนไขการคืนสินค้าให้ชัดเจนก่อนลูกค้าชำระเงิน ช่วยลดข้อพิพาทได้มาก',
  'ตอบข้อร้องเรียนภายใน 24 ชั่วโมง แม้ยังไม่มีข้อสรุป เพื่อแสดงความรับผิดชอบต่อลูกค้า',
  'หลีกเลี่ยงคำโฆษณา เช่น "หายขาด" "การันตี 100%" ที่อาจทำให้ผู้บริโภคเข้าใจผิด',
];

export default function MerchantHome() {
  const op = useCurrentOperator();
  const { mine, active } = useMyMerchants();
  const view = useMerchantView(active?.id);
  const { list: notifs, unread } = useMyNotifications();
  const complaints = useComplaintStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const apps = useVerificationStore((s) => s.items);
  if (!op) return null;

  const myIds = mine.map((m) => m.id);
  const openComplaints = complaints.filter((c) => myIds.includes(c.merchantId) && ['submitted', 'awaiting_merchant', 'merchant_responded', 'waiting_consumer'].includes(c.status)).length;
  const openWarnings = warnings.filter((w) => myIds.includes(w.merchantId) && w.status !== 'completed').length;
  const pendingCertApp = active && apps.find((a) => a.merchantId === active.id && a.type === 'certification' && !['approved', 'rejected'].includes(a.status));
  const hasShop = mine.length > 0;

  const services = [
    { to: '/m/shop', label: 'ข้อมูลร้านค้า', icon: Store },
    // ร้านที่ลงทะเบียนแล้ว: จัดการช่องทางขายออนไลน์ (ไม่พากลับไปลงทะเบียนร้านใหม่) · ลงทะเบียนร้านเพิ่มได้จากหน้าข้อมูลร้านค้า
    hasShop ? { to: '/m/marketplace', label: 'ช่องทางขายออนไลน์', icon: Link2 } : { to: '/m/register-shop', label: 'ลงทะเบียนร้านค้า', icon: ClipboardEdit },
    { to: '/m/certification', label: 'ขอรับรอง', icon: BadgeCheck },
    { to: '/m/passport', label: 'Trust Passport', icon: IdCard },
    { to: '/m/complaints', label: 'ข้อร้องเรียน', icon: MessageSquareWarning, count: openComplaints },
    { to: '/m/warnings', label: 'คำเตือน/แก้ไข', icon: FileWarning, count: openWarnings },
    { to: '/m/training', label: 'ศูนย์อบรม', icon: GraduationCap },
    { to: '/m/toolkit', label: 'ส่งเสริมร้านค้า', icon: Megaphone },
  ];

  return (
    <div>
      <ShopSwitcher />
      {/* Welcome */}
      <div className="mb-5 rounded-2xl bg-primary p-5 text-white">
        <p className="text-sm text-white/80">สวัสดี</p>
        <h1 className="text-2xl font-bold">คุณ{op.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">
            <UserCheck className="h-3.5 w-3.5" />
            {op.kycStatus === 'verified' ? 'ยืนยันตัวตนแล้ว (Level 1)' : 'ยังไม่ยืนยันตัวตน'}
          </span>
          {active && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">
              <Store className="h-3.5 w-3.5" />
              {active.shopName}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">Mock ID: {op.mockIdentityId}</span>
        </div>
      </div>

      {op.kycStatus !== 'verified' && (
        <Alert
          tone="warning"
          icon={ShieldCheck}
          title={op.kycStatus === 'failed' ? 'การยืนยันตัวตนครั้งก่อนไม่สำเร็จ' : 'ยังไม่ได้ยืนยันตัวตน'}
          className="mb-4"
          action={<LinkButton to="/m/kyc" size="sm">ยืนยันตัวตน (จำลอง)</LinkButton>}
        >
          ต้องยืนยันตัวตนก่อนจึงจะได้รับการตรวจสอบธุรกิจและการรับรอง
        </Alert>
      )}

      {/* Status cards */}
      {hasShop && active && view ? (
        // มือถือ: แถวกระทัดรัด (ป้ายซ้าย สถานะขวา) · แท็บเล็ตขึ้นไป: 3 คอลัมน์
        <Card className="divide-y divide-line sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              to: '/m/shop',
              label: 'สถานะลงทะเบียนร้านค้า',
              badge: <StatusBadge map={REGISTRATION_STATUS} value={active.registrationStatus} />,
              note: 'ดูรายละเอียดร้านค้า',
            },
            {
              to: '/m/certification',
              label: 'สถานะการรับรอง',
              badge: <VerdictBadge verdict={view.verdict} size="sm" />,
              note: pendingCertApp ? 'มีคำขอรับรองรอพิจารณา' : `Level ${view.level} — ${TRUST_LEVELS[view.level].name}`,
              warn: !!pendingCertApp,
            },
            {
              to: active.riskStatus === 'warning' ? '/m/warnings' : '/m/review',
              label: 'สถานะความเสี่ยง',
              badge: <StatusBadge map={RISK_STATUS} value={active.riskStatus} />,
              note: active.riskStatus === 'none' ? 'ไม่มีประเด็นที่ต้องดำเนินการ' : 'ดูรายละเอียดและสิ่งที่ต้องทำ',
              warn: active.riskStatus !== 'none',
            },
          ].map((s) => (
            <Link key={s.label} to={s.to} className="flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors hover:bg-bg sm:flex-col sm:items-start sm:gap-2 sm:p-4">
              <div className="min-w-0 flex-1 sm:flex-none">
                <p className="text-sm font-medium text-ink">{s.label}</p>
                <p className={cn('text-xs', s.warn ? 'font-medium text-warning' : 'text-ink-soft')}>{s.note}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:order-first">
                {s.badge}
                <ChevronRight className="h-4 w-4 text-ink-soft sm:hidden" />
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Store}
            title="ยังไม่ได้ลงทะเบียนร้านค้า"
            desc="ลงทะเบียนร้านค้าเพื่อรับการตรวจสอบ และนำสถานะไปแสดงบนช่องทางขายเดิมของคุณ (ไม่จำเป็นต้องทำทันที)"
            action={<LinkButton to="/m/register-shop" icon={ClipboardEdit}>ลงทะเบียนร้านค้า</LinkButton>}
          />
        </Card>
      )}

      <SectionTitle>บริการ</SectionTitle>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
        {services.map((s) => (
          <Link key={s.to} to={s.to} className="relative flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-1 py-3 text-center transition-colors hover:border-primary/40">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <span className="text-[12px] leading-tight text-ink">{s.label}</span>
            {!!s.count && <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[11px] font-bold text-white">{s.count}</span>}
          </Link>
        ))}
      </div>

      <SectionTitle
        action={
          <Link to="/m/ai" className="text-sm text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        }
      >
        <span className="inline-flex items-center gap-2">
          AI ผู้ช่วย SME <AiSimulationBadge />
        </span>
      </SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <AiServiceCard compact to="/m/ai/ad-checker" icon={ScanText} title="ตรวจสอบข้อความโฆษณา" desc="" cta="ตรวจก่อนเผยแพร่" />
        <AiServiceCard compact to="/m/ai/complaint" icon={MessageSquareHeart} title="ช่วยจัดการข้อร้องเรียน" desc="" cta="สรุปประเด็นและร่างคำตอบ" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="การแจ้งเตือนล่าสุด"
            icon={Bell}
            action={
              <Link to="/m/notifications" className="text-sm text-primary">
                ทั้งหมด {unread > 0 && <Badge tone="error">{unread}</Badge>}
              </Link>
            }
          />
          {notifs.length ? (
            <ul className="divide-y divide-line">
              {notifs.slice(0, 4).map((n) => (
                <li key={n.id}>
                  <Link to={n.link ?? '/m/notifications'} className="flex gap-3 px-4 py-3 hover:bg-bg sm:px-5">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line' : 'bg-secondary')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      <p className="truncate text-sm text-ink-soft">{n.body}</p>
                      <p className="text-xs text-ink-soft">{fmtRelative(n.createdAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
          )}
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Lightbulb className="h-5 w-5 text-warning" />
            คำแนะนำด้านการคุ้มครองผู้บริโภค
          </p>
          <ul className="mt-3 space-y-3">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-semibold text-primary">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          {openWarnings > 0 && (
            <Alert tone="warning" icon={AlertTriangle} className="mt-4" action={<LinkButton to="/m/warnings" size="sm" variant="outline">ดูคำเตือน</LinkButton>}>
              คุณมีคำเตือน/คำแนะนำที่ยังไม่เสร็จสิ้น {openWarnings} รายการ
            </Alert>
          )}
          <p className="mt-4 text-xs text-ink-soft">เนื้อหาตัวอย่างเพื่อการสาธิต ไม่ใช่คำปรึกษาทางกฎหมาย</p>
        </Card>
      </div>
    </div>
  );
}
