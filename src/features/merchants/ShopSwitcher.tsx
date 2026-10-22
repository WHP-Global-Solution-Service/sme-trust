import { Store } from 'lucide-react';
import { useSessionStore } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { Select } from '@/components/forms/Field';

/** เลือกร้านค้า กรณีผู้ประกอบการมีมากกว่า 1 ร้าน */
export function ShopSwitcher() {
  const { mine, active } = useMyMerchants();
  const set = useSessionStore((s) => s.set);
  if (mine.length < 2 || !active) return null;
  return (
    <label className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
      <Store className="h-4 w-4 shrink-0 text-primary" />
      <span className="shrink-0 text-sm text-ink-soft">ร้านค้า:</span>
      <Select value={active.id} onChange={(e) => set({ activeMerchantId: e.target.value })} className="h-9 border-0 px-1 focus:ring-0">
        {mine.map((m) => (
          <option key={m.id} value={m.id}>
            {m.shopName} ({m.id})
          </option>
        ))}
      </Select>
    </label>
  );
}
