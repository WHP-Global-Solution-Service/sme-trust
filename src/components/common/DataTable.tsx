import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  /** ซ่อนบนจอเล็ก */
  hideOnMobile?: boolean;
}

/** Data Table พร้อม Sort / Pagination — บนมือถือแสดงเป็นการ์ด */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  rowLink,
  pageSize = 10,
  empty,
  mobileTitle,
}: {
  rows: T[];
  columns: Column<T>[];
  rowLink?: (row: T) => string;
  pageSize?: number;
  empty?: ReactNode;
  mobileTitle?: (row: T) => ReactNode;
}) {
  const nav = useNavigate();
  const [sortKey, setSortKey] = useState<string>();
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sort!(a);
      const vb = col.sort!(b);
      return (va > vb ? 1 : va < vb ? -1 : 0) * (asc ? 1 : -1);
    });
  }, [rows, columns, sortKey, asc]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const view = sorted.slice(p * pageSize, p * pageSize + pageSize);

  if (!rows.length) return <>{empty ?? <EmptyState title="ไม่พบรายการ" desc="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />}</>;

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-bg/60 text-left text-ink-soft">
              {columns.map((c) => (
                <th key={c.key} className={cn('whitespace-nowrap px-4 py-2.5 font-medium', c.className)}>
                  {c.sort ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-ink"
                      onClick={() => {
                        setAsc(sortKey === c.key ? !asc : true);
                        setSortKey(c.key);
                      }}
                    >
                      {c.header}
                      <ArrowDownUp className={cn('h-3.5 w-3.5', sortKey === c.key ? 'text-primary' : 'opacity-40')} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr
                key={r.id}
                onClick={rowLink ? () => nav(rowLink(r)) : undefined}
                className={cn('border-b border-line last:border-0', rowLink && 'cursor-pointer hover:bg-primary-50/50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-top', c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="divide-y divide-line md:hidden">
        {view.map((r) => (
          <li key={r.id}>
            <button className="w-full px-4 py-3 text-left" onClick={rowLink ? () => nav(rowLink(r)) : undefined}>
              {mobileTitle && <div className="mb-1.5 font-medium text-ink">{mobileTitle(r)}</div>}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-xs text-ink-soft">{c.header}</dt>
                      <dd className="min-w-0 break-words">{c.render(r)}</dd>
                    </div>
                  ))}
              </dl>
            </button>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-ink-soft">
          <span>
            {p * pageSize + 1}–{Math.min((p + 1) * pageSize, sorted.length)} จาก {sorted.length}
          </span>
          <div className="flex gap-1">
            <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bg disabled:opacity-40" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="หน้าก่อนหน้า">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bg disabled:opacity-40" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="หน้าถัดไป">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
