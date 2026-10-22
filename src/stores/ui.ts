import { create } from 'zustand';

export interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info' | 'warning';
  title: string;
  body?: string;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmText?: string;
  tone?: 'primary' | 'danger';
  /** หากกำหนด จะมีช่องให้กรอกเหตุผล (บังคับกรอก) */
  reasonLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (v: { ok: boolean; reason?: string }) => void;
}

interface UiState {
  toasts: Toast[];
  confirm?: ConfirmState;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setConfirm: (c?: ConfirmState) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (t) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setConfirm: (confirm) => set({ confirm }),
}));

export const toast = {
  success: (title: string, body?: string) => useUiStore.getState().pushToast({ tone: 'success', title, body }),
  error: (title: string, body?: string) => useUiStore.getState().pushToast({ tone: 'error', title, body }),
  info: (title: string, body?: string) => useUiStore.getState().pushToast({ tone: 'info', title, body }),
  warning: (title: string, body?: string) => useUiStore.getState().pushToast({ tone: 'warning', title, body }),
};

/** Confirmation Dialog แบบ Promise */
export function confirmDialog(opts: ConfirmOptions): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    useUiStore.getState().setConfirm({
      ...opts,
      resolve: (v) => {
        useUiStore.getState().setConfirm(undefined);
        resolve(v);
      },
    });
  });
}
