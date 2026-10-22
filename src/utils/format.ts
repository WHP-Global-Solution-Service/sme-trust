import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

/** วันที่แบบไทย พ.ศ. เช่น 20 ต.ค. 2569 */
export function fmtDate(d?: string | Date, withTime = false): string {
  if (!d) return '-';
  const date = toDate(d);
  if (!isValid(date)) return '-';
  const be = date.getFullYear() + 543;
  const base = format(date, withTime ? 'd MMM yyyy HH:mm' : 'd MMM yyyy', { locale: th });
  return base.replace(String(date.getFullYear()), String(be));
}

export function fmtRelative(d?: string): string {
  if (!d) return '-';
  const date = toDate(d);
  if (!isValid(date)) return '-';
  return formatDistanceToNowStrict(date, { locale: th, addSuffix: true });
}

export function fmtMoney(n?: number): string {
  if (n == null) return '-';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);
}

export function fmtPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

export function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  return d.length >= 10 ? `${d.slice(0, 3)}-xxx-${d.slice(6)}` : p;
}

export function maskName(name: string): string {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last.charAt(0)}.` : first;
}
