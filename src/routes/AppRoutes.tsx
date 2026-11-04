import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lazyPage } from './lazyPage';
import { PageLoading } from './PageLoading';
import { AppShell, RoleGate } from '@/components/layout/AppShell';
import type { Role } from '@/types';

import WelcomePage from '@/features/onboarding/WelcomePage';
const RegisterPage = lazyPage(() => import('@/features/onboarding/RegisterPage'));
const LoginPage = lazyPage(() => import('@/features/auth/LoginPage'));
const KycPage = lazyPage(() => import('@/features/onboarding/KycPage'));

const MerchantHome = lazyPage(() => import('@/features/merchants/MerchantHome'));
const ShopPage = lazyPage(() => import('@/features/merchants/ShopPage'));
const RegisterShopWizard = lazyPage(() => import('@/features/merchants/RegisterShopWizard'));
const ToolkitPage = lazyPage(() => import('@/features/merchants/ToolkitPage'));
const NotificationsPage = lazyPage(() => import('@/features/merchants/NotificationsPage'));
const MerchantCertPage = lazyPage(() => import('@/features/certification/MerchantCertPage'));
const PassportPage = lazyPage(() => import('@/features/passport/PassportPage'));
const MerchantComplaints = lazyPage(() => import('@/features/resolution/MerchantComplaints'));
const MerchantComplaintDetail = lazyPage(() => import('@/features/resolution/MerchantComplaintDetail'));
const MerchantWarnings = lazyPage(() => import('@/features/warnings/MerchantWarnings'));
const MerchantWarningDetail = lazyPage(() => import('@/features/warnings/MerchantWarningDetail'));
const MerchantReview = lazyPage(() => import('@/features/risk/MerchantReview'));
const TrainingCenter = lazyPage(() => import('@/features/training/TrainingCenter'));
const CoursePage = lazyPage(() => import('@/features/training/CoursePage'));

const CheckPage = lazyPage(() => import('@/features/consumers/CheckPage'));
const DirectoryPage = lazyPage(() => import('@/features/consumers/DirectoryPage'));
const ShopPublicPage = lazyPage(() => import('@/features/consumers/ShopPublicPage'));
const VerifyPage = lazyPage(() => import('@/features/consumers/VerifyPage'));
const CertVerifyPage = lazyPage(() => import('@/features/consumers/CertVerifyPage'));
const ReportWizard = lazyPage(() => import('@/features/complaints/ReportWizard'));
const ConsumerCases = lazyPage(() => import('@/features/complaints/ConsumerCases'));
const ConsumerCaseDetail = lazyPage(() => import('@/features/complaints/ConsumerCaseDetail'));

const OfficerDashboard = lazyPage(() => import('@/features/officer/OfficerDashboard'));
const OfficerApplications = lazyPage(() => import('@/features/verification/OfficerApplications'));
const ApplicationDetail = lazyPage(() => import('@/features/verification/ApplicationDetail'));
const ChannelVerification = lazyPage(() => import('@/features/verification/ChannelVerification'));
const OfficerCertification = lazyPage(() => import('@/features/certification/OfficerCertification'));
const OfficerComplaints = lazyPage(() => import('@/features/complaints/OfficerComplaints'));
const OfficerComplaintDetail = lazyPage(() => import('@/features/complaints/OfficerComplaintDetail'));
const OfficerWarnings = lazyPage(() => import('@/features/warnings/OfficerWarnings'));
const OfficerWarningDetail = lazyPage(() => import('@/features/warnings/OfficerWarningDetail'));
const NewWarningPage = lazyPage(() => import('@/features/warnings/NewWarningPage'));
const OfficerRiskList = lazyPage(() => import('@/features/risk/OfficerRiskList'));
const OfficerRiskDetail = lazyPage(() => import('@/features/risk/OfficerRiskDetail'));
const TrainingRecords = lazyPage(() => import('@/features/officer/TrainingRecords'));
const ReportsPage = lazyPage(() => import('@/features/officer/ReportsPage'));

const AdminDashboard = lazyPage(() => import('@/features/admin/AdminDashboard'));
const AccountsPage = lazyPage(() => import('@/features/admin/AccountsPage'));
const AuditPage = lazyPage(() => import('@/features/admin/AuditPage'));
const DemoDataPage = lazyPage(() => import('@/features/admin/DemoDataPage'));
import NotFoundPage from '@/features/onboarding/NotFoundPage';
const DevicePreview = lazyPage(() => import('@/features/preview/DevicePreview'));
const DemoScenariosPage = lazyPage(() => import('@/features/demo/DemoScenariosPage'));
const DemoCompletePage = lazyPage(() => import('@/features/demo/DemoCompletePage'));
const DemoOverviewPage = lazyPage(() => import('@/features/demo/DemoOverviewPage'));
const DemoV2SummaryPage = lazyPage(() => import('@/features/demo/DemoV2SummaryPage'));
const AIAssistantHome = lazyPage(() => import('@/features/ai-assistant/pages/AIAssistantHome'));
const AdvertisingChecker = lazyPage(() => import('@/features/ai-assistant/pages/AdvertisingChecker'));
const ComplaintAssistant = lazyPage(() => import('@/features/ai-assistant/pages/ComplaintAssistant'));
const AIHistory = lazyPage(() => import('@/features/ai-assistant/pages/AIHistory'));
const MarketplacePage = lazyPage(() => import('@/features/marketplace/pages/MarketplacePage'));
const MarketplaceDataPage = lazyPage(() => import('@/features/marketplace/pages/MarketplaceDataPage'));
const MarketplaceAnalysisPage = lazyPage(() => import('@/features/marketplace/pages/MarketplaceAnalysisPage'));
const MerchantAssessmentPage = lazyPage(() => import('@/features/trust-assessment/pages/MerchantAssessmentPage'));
const OfficerAssessmentList = lazyPage(() => import('@/features/trust-assessment/pages/OfficerAssessmentList'));
const OfficerAssessmentDetail = lazyPage(() => import('@/features/trust-assessment/pages/OfficerAssessmentDetail'));
const AdminAssessmentModel = lazyPage(() => import('@/features/trust-assessment/pages/AdminAssessmentModel'));

const gate = (allow: Role[], el: JSX.Element) => <RoleGate allow={allow}>{el}</RoleGate>;
const M: Role[] = ['merchant'];
const C: Role[] = ['consumer'];
const O: Role[] = ['officer', 'admin'];
const A: Role[] = ['admin'];

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/preview" element={<DevicePreview />} />
      <Route path="/demo" element={<DemoScenariosPage />} />
      <Route path="/demo/complete/:id" element={<DemoCompletePage />} />
      <Route path="/demo/overview" element={<DemoOverviewPage />} />
      <Route path="/demo/v2/summary" element={<DemoV2SummaryPage />} />

      <Route element={<AppShell />}>
        {/* Merchant */}
        <Route path="/m" element={gate(M, <MerchantHome />)} />
        <Route path="/m/kyc" element={gate(M, <KycPage />)} />
        <Route path="/m/shop" element={gate(M, <ShopPage />)} />
        <Route path="/m/register-shop" element={gate(M, <RegisterShopWizard />)} />
        <Route path="/m/certification" element={gate(M, <MerchantCertPage />)} />
        <Route path="/m/passport" element={gate(M, <PassportPage />)} />
        <Route path="/m/complaints" element={gate(M, <MerchantComplaints />)} />
        <Route path="/m/complaints/:id" element={gate(M, <MerchantComplaintDetail />)} />
        <Route path="/m/warnings" element={gate(M, <MerchantWarnings />)} />
        <Route path="/m/warnings/:id" element={gate(M, <MerchantWarningDetail />)} />
        <Route path="/m/review" element={gate(M, <MerchantReview />)} />
        <Route path="/m/training" element={gate(M, <TrainingCenter />)} />
        <Route path="/m/training/:courseId" element={gate(M, <CoursePage />)} />
        <Route path="/m/toolkit" element={gate(M, <ToolkitPage />)} />
        <Route path="/m/notifications" element={gate(M, <NotificationsPage />)} />
        <Route path="/m/ai" element={gate(M, <AIAssistantHome />)} />
        <Route path="/m/marketplace" element={gate(M, <MarketplacePage />)} />
        <Route path="/m/marketplace/data/:id" element={gate(M, <MarketplaceDataPage />)} />
        <Route path="/m/marketplace/analysis" element={gate(M, <MarketplaceAnalysisPage />)} />
        <Route path="/m/trust" element={gate(M, <MerchantAssessmentPage />)} />
        <Route path="/m/ai/ad-checker" element={gate(M, <AdvertisingChecker />)} />
        <Route path="/m/ai/complaint" element={gate(M, <ComplaintAssistant />)} />
        <Route path="/m/ai/history" element={gate(M, <AIHistory />)} />

        {/* Consumer / Public (ไม่ต้องเข้าสู่ระบบ) */}
        <Route path="/check" element={<CheckPage />} />
        <Route path="/directory" element={<DirectoryPage />} />
        <Route path="/shop/:id" element={<ShopPublicPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/verify/:certId" element={<CertVerifyPage />} />
        <Route path="/report" element={gate(C, <ReportWizard />)} />
        <Route path="/consumer/cases" element={gate(C, <ConsumerCases />)} />
        <Route path="/consumer/cases/:id" element={gate(C, <ConsumerCaseDetail />)} />
        <Route path="/consumer/notifications" element={gate(C, <NotificationsPage />)} />

        {/* Officer */}
        <Route path="/o" element={gate(O, <OfficerDashboard />)} />
        <Route path="/o/applications" element={gate(O, <OfficerApplications />)} />
        <Route path="/o/applications/:id" element={gate(O, <ApplicationDetail />)} />
        <Route path="/o/verification" element={gate(O, <ChannelVerification />)} />
        <Route path="/o/certification" element={gate(O, <OfficerCertification />)} />
        <Route path="/o/complaints" element={gate(O, <OfficerComplaints />)} />
        <Route path="/o/complaints/:id" element={gate(O, <OfficerComplaintDetail />)} />
        <Route path="/o/warnings" element={gate(O, <OfficerWarnings />)} />
        <Route path="/o/warnings/new" element={gate(O, <NewWarningPage />)} />
        <Route path="/o/warnings/:id" element={gate(O, <OfficerWarningDetail />)} />
        <Route path="/o/corrective" element={gate(O, <OfficerWarnings corrective />)} />
        <Route path="/o/assessments" element={gate(O, <OfficerAssessmentList />)} />
        <Route path="/o/assessments/:id" element={gate(O, <OfficerAssessmentDetail />)} />
        <Route path="/o/risk" element={gate(O, <OfficerRiskList />)} />
        <Route path="/o/risk/:id" element={gate(O, <OfficerRiskDetail />)} />
        <Route path="/o/training" element={gate(O, <TrainingRecords />)} />
        <Route path="/o/reports" element={gate(O, <ReportsPage />)} />
        <Route path="/o/notifications" element={gate(O, <NotificationsPage />)} />

        {/* Admin */}
        <Route path="/admin" element={gate(A, <AdminDashboard />)} />
        <Route path="/admin/accounts" element={gate(A, <AccountsPage />)} />
        <Route path="/admin/audit" element={gate(A, <AuditPage />)} />
        <Route path="/admin/data" element={gate(A, <DemoDataPage />)} />
        <Route path="/admin/assessment-model" element={gate(A, <AdminAssessmentModel />)} />

        <Route path="/404" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
    </Suspense>
  );
}
