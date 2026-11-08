import { AlertTriangle, BadgeCheck, Bell, BookOpen, Building2, ClipboardCheck, ClipboardList, Database, FileBarChart, FileWarning, GraduationCap, Home, IdCard, LayoutDashboard, ListChecks, Megaphone, MessageSquareWarning, QrCode, Scale, ScrollText, Search, Sparkles, ShieldAlert, Store, Users, Wrench, type LucideIcon, Link2, Gauge, SlidersHorizontal, FilePen, Bot, Smartphone } from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** ป้ายสั้นสำหรับ Bottom Navigation บนมือถือ/แท็บเล็ต */
  short?: string;
  mobile?: boolean; // แสดงใน Bottom Navigation
}

export const NAV: Record<Role, { title: string; items: NavItem[]; extra?: { title: string; items: NavItem[] } }> = {
  merchant: {
    title: 'ผู้ประกอบการ',
    items: [
      { to: '/m', label: 'หน้าแรก', icon: Home, end: true, mobile: true },
      { to: '/m/shop', label: 'ข้อมูลร้านค้า', short: 'ร้านค้า', icon: Store, mobile: true },
      { to: '/m/certification', label: 'ขอรับรองความน่าเชื่อถือ', icon: BadgeCheck },
      { to: '/m/passport', label: 'SME Trust Passport', icon: IdCard },
      { to: '/m/complaints', label: 'ข้อร้องเรียน', short: 'ร้องเรียน', icon: MessageSquareWarning, mobile: true },
      { to: '/m/warnings', label: 'คำเตือนและการแก้ไข', icon: FileWarning },
      { to: '/m/review', label: 'สถานะความเสี่ยง/อุทธรณ์', icon: Scale },
      { to: '/m/training', label: 'ศูนย์อบรม', short: 'อบรม', icon: GraduationCap, mobile: true },
      { to: '/m/marketplace-app', label: 'Marketplace App (จำลอง)', icon: Smartphone },
      { to: '/m/marketplace', label: 'เชื่อมต่อ Marketplace (จำลอง)', icon: Link2 },
      { to: '/m/trust', label: 'ผลประเมินความน่าเชื่อถือ', icon: Gauge },
      { to: '/m/profile-changes', label: 'คำขอเปลี่ยนข้อมูลร้าน', icon: FilePen },
      { to: '/m/ai', label: 'AI ผู้ช่วย SME', icon: Sparkles },
      { to: '/m/toolkit', label: 'เครื่องมือส่งเสริมร้านค้า', icon: Megaphone },
      { to: '/m/notifications', label: 'การแจ้งเตือน', icon: Bell },
    ],
  },
  consumer: {
    title: 'ผู้บริโภค',
    items: [
      { to: '/check', label: 'ตรวจสอบร้านค้า', short: 'ตรวจสอบ', icon: Search, mobile: true },
      { to: '/directory', label: 'ทำเนียบร้านค้า', short: 'ทำเนียบ', icon: Store, mobile: true },
      { to: '/verify', label: 'สแกน QR ตรวจสอบ', short: 'สแกน QR', icon: QrCode, mobile: true },
      { to: '/report', label: 'แจ้งปัญหา', icon: MessageSquareWarning },
      { to: '/consumer/cases', label: 'เรื่องของฉัน', short: 'เรื่องของฉัน', icon: ClipboardList, mobile: true },
      { to: '/consumer/notifications', label: 'การแจ้งเตือน', icon: Bell },
    ],
  },
  officer: {
    title: 'เจ้าหน้าที่',
    items: [
      { to: '/o', label: 'Dashboard', short: 'ภาพรวม', icon: LayoutDashboard, end: true, mobile: true },
      { to: '/o/exceptions', label: 'Exception Queue', icon: Bot },
      { to: '/o/automation', label: 'กฎอัตโนมัติและ KPI', icon: SlidersHorizontal },
      { to: '/o/applications', label: 'Merchant Applications', short: 'คำขอ', icon: ClipboardCheck, mobile: true },
      { to: '/o/verification', label: 'Verification (ช่องทางขาย)', icon: ListChecks },
      { to: '/o/certification', label: 'Certification', icon: BadgeCheck },
      { to: '/o/complaints', label: 'Complaint Cases', short: 'ร้องเรียน', icon: MessageSquareWarning, mobile: true },
      { to: '/o/warnings', label: 'Warnings', icon: AlertTriangle },
      { to: '/o/corrective', label: 'Corrective Actions', icon: Wrench },
      { to: '/o/assessments', label: 'Trust Assessment Review', icon: Gauge },
      { to: '/o/profile-changes', label: 'คำขอเปลี่ยนข้อมูลร้าน', icon: FilePen },
      { to: '/o/risk', label: 'Risk Reviews', short: 'ความเสี่ยง', icon: ShieldAlert, mobile: true },
      { to: '/o/training', label: 'Training Records', icon: BookOpen },
      { to: '/o/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  admin: {
    title: 'ผู้ดูแลระบบ',
    items: [
      { to: '/admin', label: 'Admin Dashboard', short: 'ภาพรวม', icon: LayoutDashboard, end: true, mobile: true },
      { to: '/admin/accounts', label: 'บัญชีและร้านค้า', short: 'บัญชี', icon: Users, mobile: true },
      { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, mobile: true },
      { to: '/admin/data', label: 'ข้อมูลสาธิต', icon: Database },
      { to: '/admin/assessment-model', label: 'โมเดลการประเมิน', icon: SlidersHorizontal },
    ],
    extra: {
      title: 'งานเจ้าหน้าที่',
      items: [
        { to: '/o', label: 'Officer Dashboard', short: 'งานเจ้าหน้าที่', icon: Building2, end: true, mobile: true },
        { to: '/o/exceptions', label: 'Exception Queue', icon: Bot },
        { to: '/o/automation', label: 'กฎอัตโนมัติและ KPI', icon: SlidersHorizontal },
        { to: '/o/applications', label: 'Merchant Applications', icon: ClipboardCheck },
        { to: '/o/complaints', label: 'Complaint Cases', icon: MessageSquareWarning },
        { to: '/o/warnings', label: 'Warnings', icon: AlertTriangle },
        { to: '/o/assessments', label: 'Trust Assessment Review', icon: Gauge },
        { to: '/o/profile-changes', label: 'คำขอเปลี่ยนข้อมูลร้าน', icon: FilePen },
        { to: '/o/risk', label: 'Risk Reviews', icon: ShieldAlert },
        { to: '/o/reports', label: 'Reports', icon: FileBarChart },
      ],
    },
  },
};
