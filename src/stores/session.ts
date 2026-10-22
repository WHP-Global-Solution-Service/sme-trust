import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/types';
import { STORAGE_PREFIX } from './createEntityStore';

export interface ShopDraft {
  step: number;
  data: Record<string, unknown>;
  savedAt: string;
}

interface SessionState {
  role: Role;
  operatorId: string;
  merchantLoggedIn: boolean;
  activeMerchantId?: string;
  consumerId: string;
  officerId: string;
  guideOpen: boolean;
  demoPanelOpen: boolean;
  shopDrafts: Record<string, ShopDraft>;
  set: (patch: Partial<SessionState>) => void;
  switchRole: (role: Role) => void;
  saveDraft: (operatorId: string, draft: ShopDraft | undefined) => void;
  reset: () => void;
}

const initial = {
  role: 'consumer' as Role,
  operatorId: 'OP-001',
  merchantLoggedIn: false,
  activeMerchantId: undefined,
  consumerId: 'CS-001',
  officerId: 'OF-001',
  guideOpen: true,
  demoPanelOpen: false,
  shopDrafts: {} as Record<string, ShopDraft>,
};

/** Demo Session — การสลับบทบาทนี้ใช้เพื่อการสาธิตเท่านั้น ไม่ใช่ระบบกำหนดสิทธิ์จริง */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      switchRole: (role) => set({ role, officerId: role === 'admin' ? 'AD-001' : role === 'officer' ? 'OF-001' : initial.officerId }),
      saveDraft: (operatorId, draft) =>
        set((s) => {
          const drafts = { ...s.shopDrafts };
          if (draft) drafts[operatorId] = draft;
          else delete drafts[operatorId];
          return { shopDrafts: drafts };
        }),
      reset: () => set({ ...initial }),
    }),
    { name: `${STORAGE_PREFIX}session`, version: 1, partialize: ({ demoPanelOpen: _d, ...rest }) => rest },
  ),
);
