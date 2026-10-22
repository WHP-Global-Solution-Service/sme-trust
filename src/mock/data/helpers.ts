import type { MockDocument, TimelineEvent } from '@/types';

/** แปลงวันที่เวลาไทย (UTC+7) เป็น ISO string */
export const d = (s: string) => new Date(`${s.length === 10 ? `${s}T09:00` : s}:00+07:00`).toISOString();

let seq = 0;
export const tl = (at: string, actor: TimelineEvent['actor'], title: string, note?: string, actorName?: string): TimelineEvent => ({
  id: `tl-seed-${++seq}`,
  at: d(at),
  actor,
  title,
  note,
  actorName,
});

export const doc = (name: string, kind: string, at: string, sizeKb = 320): MockDocument => ({
  id: `doc-seed-${++seq}`,
  name,
  kind,
  sizeKb,
  addedAt: d(at),
});
