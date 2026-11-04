import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/routes/AppRoutes';
import { preloadWhenIdle } from '@/routes/lazyPage';
import { ConfirmHost, ToastHost } from '@/components/feedback/Feedback';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { postToParent } from '@/utils/devicePreview';
import { ROUTER_BASE, ROUTER_BASENAME } from '@/utils/appUrl';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  // ต้องใช้ { } — Chrome รุ่นใหม่ให้ scrollTo คืนค่า Promise ซึ่ง React จะเข้าใจผิดว่าเป็น cleanup function
  useEffect(() => {
    window.scrollTo(0, 0);
    // หน้าแรกภายใต้ Sub-path ให้มี "/" ท้าย (/sme-trust → /sme-trust/) เพื่อให้ Reload บน Static hosting ไม่เป็น 404
    if (ROUTER_BASENAME && window.location.pathname === ROUTER_BASENAME) {
      window.history.replaceState(window.history.state, '', `${ROUTER_BASENAME}/${window.location.search}${window.location.hash}`);
    }
  }, [pathname]);
  // เมื่อแสดงในโหมดจำลองหน้าจอ แจ้งเส้นทางปัจจุบันให้หน้าจำลอง (เพื่อสลับอุปกรณ์/ออกจากโหมดแล้วอยู่หน้าเดิม)
  useEffect(() => {
    postToParent({ type: 'smetrust:route', path: pathname + search });
  }, [pathname, search]);
  return null;
}

export function App() {
  // หน้าอื่นแยกไฟล์ไว้ — โหลดต่อเมื่อเบราว์เซอร์ว่าง เพื่อให้การสาธิตเปลี่ยนหน้าได้ทันทีและใช้งานออฟไลน์ต่อได้
  useEffect(() => preloadWhenIdle(), []);
  return (
    <ErrorBoundary>
      {/* เปิดพฤติกรรมของ React Router v7 ล่วงหน้า (ปิดคำเตือน Future Flag ใน Console) */}
      <BrowserRouter basename={ROUTER_BASE} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <AppRoutes />
        <ToastHost />
        <ConfirmHost />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
