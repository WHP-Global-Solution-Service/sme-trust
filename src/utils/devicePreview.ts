import type { LucideIcon } from 'lucide-react';
import { Laptop, Smartphone, Tablet } from 'lucide-react';

/** อุปกรณ์สำหรับโหมดจำลองหน้าจอ (ขนาด CSS pixel แนวตั้ง) */
export type DeviceId = 'phone' | 'tablet' | 'laptop';

export interface Device {
  id: DeviceId;
  label: string;
  hint: string;
  width: number;
  height: number;
  rotatable: boolean;
  icon: LucideIcon;
}

export const DEVICES: Record<DeviceId, Device> = {
  phone: { id: 'phone', label: 'โทรศัพท์', hint: '390 × 844', width: 390, height: 844, rotatable: true, icon: Smartphone },
  tablet: { id: 'tablet', label: 'iPad', hint: '820 × 1180', width: 820, height: 1180, rotatable: true, icon: Tablet },
  laptop: { id: 'laptop', label: 'โน้ตบุ๊ก', hint: '1366 × 768', width: 1366, height: 768, rotatable: false, icon: Laptop },
};

export const PREVIEW_PATH = '/preview';

/** แอปกำลังแสดงอยู่ภายในกรอบจำลองอุปกรณ์หรือไม่ */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** ข้อความระหว่างแอปใน iframe กับหน้าจำลองอุปกรณ์ (same-origin เท่านั้น) */
export type PreviewMessage =
  | { type: 'smetrust:route'; path: string }
  | { type: 'smetrust:device'; device: DeviceId }
  | { type: 'smetrust:exit'; path: string };

export function postToParent(msg: PreviewMessage) {
  if (isEmbedded()) window.parent.postMessage(msg, window.location.origin);
}

const LAST_DEVICE_KEY = 'smetrust:preview-device';

/** อุปกรณ์ที่เลือกล่าสุด (ค่าความสะดวกต่อผู้ชม — อ่าน/เขียนไม่ได้ก็ไม่เป็นไร) */
export function getLastDevice(): DeviceId | undefined {
  try {
    const v = localStorage.getItem(LAST_DEVICE_KEY);
    return v && v in DEVICES ? (v as DeviceId) : undefined;
  } catch {
    return undefined;
  }
}

export function setLastDevice(d: DeviceId) {
  try {
    localStorage.setItem(LAST_DEVICE_KEY, d);
  } catch {
    /* storage ใช้ไม่ได้ */
  }
}

export function previewUrl(device: DeviceId, path: string) {
  return `${PREVIEW_PATH}?device=${device}&path=${encodeURIComponent(path)}`;
}
