import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { appPath } from '@/utils/appUrl';
import { STORAGE_PREFIX } from '@/stores/createEntityStore';
import { isPageLoadError } from '@/routes/lazyPage';

/**
 * กันจอขาวเมื่อเกิด Error ระหว่าง Render — แสดงข้อความและทางเลือกรีเซ็ตข้อมูลสาธิต
 * (เช่น กรณีข้อมูลใน localStorage จากเวอร์ชันเก่าไม่เข้ากับโค้ดปัจจุบัน)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SME Trust] Render error:', error, info.componentStack);
  }

  private resetData = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ไม่มีสิทธิ์เข้าถึง storage */
    }
    window.location.href = appPath('/');
  };

  render() {
    if (!this.state.error) return this.props.children;
    // โหลดไฟล์ของหน้าไม่สำเร็จหลังลองซ้ำครบ — ไม่ Reload อัตโนมัติ (กัน Reload วน) ให้ผู้ใช้กดเอง ข้อมูลไม่หาย
    const loadFailed = isPageLoadError(this.state.error);
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-4">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-6 text-center shadow-card">
          <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
          <h1 className="mt-3 text-lg font-bold text-ink" data-testid={loadFailed ? 'page-load-error' : 'render-error'}>
            {loadFailed ? 'โหลดหน้านี้ไม่สำเร็จ' : 'เกิดข้อผิดพลาดในการแสดงผล'}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {loadFailed
              ? 'ระบบลองโหลดไฟล์ของหน้านี้ซ้ำแล้วแต่ไม่สำเร็จ (การเชื่อมต่อสะดุด) — กด "โหลดหน้าใหม่" ข้อมูลสาธิต ฉบับร่าง และขั้นตอนการสาธิตยังอยู่ครบ'
              : 'ระบบสาธิต (Prototype) พบปัญหาที่ไม่คาดคิด ลองโหลดหน้าใหม่ หากยังไม่หาย ให้รีเซ็ตข้อมูลสาธิต'}
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-bg p-2 text-left text-xs text-error">{this.state.error.message}</pre>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => window.location.reload()} className="h-11 rounded-xl border border-line px-4 text-sm font-medium text-ink hover:bg-bg">
              โหลดหน้าใหม่
            </button>
            <button onClick={this.resetData} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
              <RotateCcw className="h-4 w-4" />
              Reset Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
