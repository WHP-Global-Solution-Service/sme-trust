import { useState, type ReactNode, Suspense } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageLoading } from '@/routes/PageLoading';
import { Bell, FlaskConical, LogOut, Menu, Lock, MonitorSmartphone, X } from 'lucide-react';
import { getLastDevice, isEmbedded, previewUrl } from '@/utils/devicePreview';
import type { Role } from '@/types';
import { useSessionStore } from '@/stores';
import { NAV, type NavItem } from '@/routes/nav';
import { ROLE_LABEL } from '@/constants/labels';
import { useCurrentConsumer, useCurrentOfficer, useCurrentOperator, useMyNotifications } from '@/hooks/useCurrent';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/common/Trust';
import { Button, Card, EmptyState } from '@/components/common/ui';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { DemoPanel } from './DemoPanel';
import { DEMO_INSET, DemoController, useDemoActive } from './DemoController';
import { roleHome, switchRole } from './demo';

const notifPath: Record<Role, string> = { merchant: '/m/notifications', consumer: '/consumer/notifications', officer: '/o/notifications', admin: '/o/notifications' };

function SideLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn('flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors', isActive ? 'bg-primary text-white' : 'text-ink-soft hover:bg-primary-50 hover:text-primary')
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function useWho() {
  const role = useSessionStore((s) => s.role);
  const op = useCurrentOperator();
  const cs = useCurrentConsumer();
  const of = useCurrentOfficer();
  const name = role === 'merchant' ? op?.name ?? 'ผู้ใช้ใหม่' : role === 'consumer' ? cs.name : of.name;
  return { role, name };
}

export function AppShell() {
  const { role, name } = useWho();
  const set = useSessionStore((s) => s.set);
  const loggedIn = useSessionStore((s) => s.merchantLoggedIn);
  const { unread } = useMyNotifications();
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const embedded = isEmbedded();
  const demoActive = useDemoActive();
  const conf = NAV[role];
  const mobileItems = [...conf.items, ...(conf.extra?.items ?? [])].filter((i) => i.mobile).slice(0, 4);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30">
        <PrototypeBanner />
      </div>
      <div className="lg:flex">
        {/* Sidebar (Desktop) */}
        <aside className="sticky top-[28px] hidden h-[calc(100vh-28px)] w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
          <div className="px-5 py-4">
            <Link to={roleHome[role]}>
              <Logo />
            </Link>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{conf.title}</p>
            {conf.items.map((i) => (
              <SideLink key={i.to + i.label} item={i} />
            ))}
            {conf.extra && (
              <>
                <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">{conf.extra.title}</p>
                {conf.extra.items.map((i) => (
                  <SideLink key={i.to + i.label} item={i} />
                ))}
              </>
            )}
          </nav>
          <div className="border-t border-line p-3">
            <div className="rounded-xl bg-bg p-3">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-ink-soft">มุมมอง: {ROLE_LABEL[role]}</p>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0 flex-1', demoActive && DEMO_INSET)}>
          {/* Topbar */}
          <header className="sticky top-[28px] z-20 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
            <Link to={roleHome[role]} className="lg:hidden">
              <Logo compact />
            </Link>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm text-ink-soft">
                SME Trust Platform · <span className="font-medium text-ink">{ROLE_LABEL[role]}</span>
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Link to={notifPath[role]} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-bg" aria-label={`การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white">{unread}</span>}
              </Link>
              {!embedded && (
                <button
                  onClick={() => nav(previewUrl(getLastDevice() ?? 'phone', loc.pathname + loc.search))}
                  className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-soft hover:bg-bg md:flex"
                  title="จำลองหน้าจอ โทรศัพท์ / iPad / โน้ตบุ๊ก"
                >
                  <MonitorSmartphone className="h-4 w-4" />
                  <span className="hidden xl:inline">จำลองหน้าจอ</span>
                </button>
              )}
              <button onClick={() => set({ demoPanelOpen: true })} className="flex h-10 items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary-50 px-3 text-sm font-medium text-secondary hover:bg-secondary/10">
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">Demo Mode</span>
                <span className="sm:hidden">Demo</span>
              </button>
              {role === 'merchant' && loggedIn && (
                <button
                  onClick={() => {
                    set({ merchantLoggedIn: false });
                    nav('/login');
                  }}
                  className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-soft hover:bg-bg sm:flex"
                >
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </button>
              )}
              <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-xl text-ink hover:bg-bg lg:hidden" aria-label="เมนู">
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          <main className={cn('mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:pb-12', demoActive ? 'pb-48' : 'pb-28')}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {/* Bottom navigation (Mobile/Tablet) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden" aria-label="เมนูหลัก">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileItems.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-xs', isActive ? 'text-primary' : 'text-ink-soft')}>
              <i.icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{i.short ?? i.label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMenu(true)} className="flex h-16 flex-col items-center justify-center gap-1 text-xs text-ink-soft">
            <Menu className="h-5 w-5" />
            เมนู
          </button>
        </div>
      </nav>

      {/* Mobile full menu */}
      {menu && (
        <div className="fixed inset-0 z-50 bg-ink/30 lg:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-slideUp overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">{name}</p>
                <p className="text-xs text-ink-soft">มุมมอง: {ROLE_LABEL[role]}</p>
              </div>
              <button onClick={() => setMenu(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-bg" aria-label="ปิด">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {[...conf.items, ...(conf.extra?.items ?? [])].map((i) => (
                <SideLink key={i.to + i.label} item={i} onClick={() => setMenu(false)} />
              ))}
            </div>
            {role === 'merchant' && loggedIn && (
              <Button
                variant="outline"
                block
                icon={LogOut}
                className="mt-3"
                onClick={() => {
                  set({ merchantLoggedIn: false });
                  setMenu(false);
                  nav('/login');
                }}
              >
                ออกจากระบบ
              </Button>
            )}
          </div>
        </div>
      )}

      <DemoPanel />
      <DemoController aboveBottomNav />
    </div>
  );
}

/** แสดง Permission Denied ในบริบทของ UI จำลอง */
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const role = useSessionStore((s) => s.role);
  const operatorId = useSessionStore((s) => s.operatorId);
  const loggedIn = useSessionStore((s) => s.merchantLoggedIn);
  const loc = useLocation();
  const nav = useNavigate();

  if (allow.includes('merchant') && role === 'merchant') {
    if (!operatorId) return <Navigate to="/" replace />;
    if (!loggedIn) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (allow.includes(role)) return <>{children}</>;
  const target = allow[0];
  return (
    <Card className="mx-auto mt-6 max-w-lg">
      <EmptyState
        icon={Lock}
        title="ไม่มีสิทธิ์เข้าถึงหน้านี้ (Permission Denied)"
        desc={
          <>
            หน้านี้สำหรับ<b>{allow.map((r) => ROLE_LABEL[r]).join(' / ')}</b> คุณกำลังใช้มุมมอง<b>{ROLE_LABEL[role]}</b>
            <br />
            <span className="text-xs">นี่เป็นการจำลองสิทธิ์ในระดับ UI เท่านั้น</span>
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => nav(roleHome[role])}>
              กลับหน้าหลัก
            </Button>
            <Button
              onClick={() => {
                switchRole(target);
                if (target === 'merchant' && !useSessionStore.getState().operatorId) nav('/');
              }}
            >
              สลับเป็น{ROLE_LABEL[target]} (Demo)
            </Button>
          </div>
        }
      />
    </Card>
  );
}
