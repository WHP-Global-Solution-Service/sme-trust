import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '@/stores';
import { markNotificationsRead } from '@/stores/workflows';
import { useMyNotifications } from '@/hooks/useCurrent';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, Card, EmptyState, PageHeader } from '@/components/common/ui';

const toneDot = { info: 'bg-info', success: 'bg-success', warning: 'bg-warning', error: 'bg-error' };

/** หน้าการแจ้งเตือน ใช้ร่วมกันทุกบทบาท */
export default function NotificationsPage() {
  const { list, unread } = useMyNotifications();
  const update = useNotificationStore((s) => s.update);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="การแจ้งเตือน"
        subtitle={`ยังไม่อ่าน ${unread} รายการ`}
        icon={Bell}
        action={
          <Button variant="outline" icon={CheckCheck} disabled={!unread} onClick={() => markNotificationsRead(list.filter((n) => !n.read).map((n) => n.id))}>
            อ่านทั้งหมด
          </Button>
        }
      />
      <Card>
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id} className={cn(!n.read && 'bg-primary-50/40')}>
                <Link to={n.link ?? '#'} onClick={() => update(n.id, { read: true })} className="flex gap-3 px-4 py-3.5 hover:bg-bg sm:px-5">
                  <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', toneDot[n.tone])} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm text-ink', !n.read && 'font-semibold')}>{n.title}</p>
                    <p className="text-sm text-ink-soft">{n.body}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{fmtDate(n.createdAt, true)}</p>
                  </div>
                  {!n.read && <span className="shrink-0 self-center text-xs font-medium text-secondary">ใหม่</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" />
        )}
      </Card>
    </div>
  );
}
