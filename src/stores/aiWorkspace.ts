import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OfferType } from '@/types';
import type { AdAnalysis, ComplaintAnalysis, DraftTone, Particle } from '@/features/ai-assistant/types/ai.types';
import { STORAGE_PREFIX } from './createEntityStore';

/**
 * สถานะหน้าจอ AI Simulation (คงอยู่เมื่อ Refresh) และร่างคำตอบที่รอร้านค้าตรวจสอบ
 * นโยบายข้อมูล: ไม่บันทึกข้อร้องเรียนที่ผู้ใช้พิมพ์เอง (บันทึกเฉพาะที่มาจากตัวอย่างหรือเคสในระบบสาธิต)
 */
export interface AdWorkspace {
  text: string;
  source: string; // example id | 'custom'
  before?: AdAnalysis;
  after?: AdAnalysis;
  revisionDraft?: string;
}

export interface ComplaintWorkspace {
  caseId?: string;
  source: string; // 'case' | example id | 'custom'
  text: string;
  analysis?: ComplaintAnalysis;
  tone: DraftTone;
  particle: Particle;
  variant: number;
  draft?: string;
  draftEdited: boolean;
}

export interface ReplyDraft {
  text: string;
  suggestedType: OfferType;
  createdAt: string;
}

interface AiWorkspaceState {
  ad: AdWorkspace;
  complaint: ComplaintWorkspace;
  /** ร่างคำตอบที่ "นำไปใส่ช่องตอบกลับ" แล้ว — ยังไม่ถือว่าส่ง จนกว่าร้านค้าจะกดส่งเอง */
  replyDrafts: Record<string, ReplyDraft>;
  setAd: (patch: Partial<AdWorkspace>) => void;
  setComplaint: (patch: Partial<ComplaintWorkspace>) => void;
  setReplyDraft: (caseId: string, draft?: ReplyDraft) => void;
  reset: () => void;
}

const initial = {
  ad: { text: '', source: 'custom' } as AdWorkspace,
  complaint: { source: 'custom', text: '', tone: 'formal', particle: 'ค่ะ/ครับ', variant: 0, draftEdited: false } as ComplaintWorkspace,
  replyDrafts: {} as Record<string, ReplyDraft>,
};

export const useAiWorkspaceStore = create<AiWorkspaceState>()(
  persist(
    (set) => ({
      ...initial,
      setAd: (patch) => set((s) => ({ ad: { ...s.ad, ...patch } })),
      setComplaint: (patch) => set((s) => ({ complaint: { ...s.complaint, ...patch } })),
      setReplyDraft: (caseId, draft) =>
        set((s) => {
          const replyDrafts = { ...s.replyDrafts };
          if (draft) replyDrafts[caseId] = draft;
          else delete replyDrafts[caseId];
          return { replyDrafts };
        }),
      reset: () => set({ ...initial }),
    }),
    {
      name: `${STORAGE_PREFIX}ai-workspace`,
      version: 1,
      // ข้อร้องเรียนที่พิมพ์เองไม่ถูกเขียนลง localStorage
      partialize: (s) => ({
        ad: s.ad,
        replyDrafts: s.replyDrafts,
        complaint: s.complaint.source === 'custom' ? { ...initial.complaint, tone: s.complaint.tone, particle: s.complaint.particle } : s.complaint,
      }),
    },
  ),
);
