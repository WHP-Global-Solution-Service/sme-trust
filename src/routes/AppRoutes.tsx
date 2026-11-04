import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, RoleGate } from '@/components/layout/AppShell';
import type { Role } from '@/types';

import WelcomePage from '@/features/onboarding/WelcomePage';
import RegisterPage from '@/features/onboarding/RegisterPage';
import LoginPage from '@/features/auth/LoginPage';
import KycPage from '@/features/onboarding/KycPage';

import MerchantHome from '@/features/merchants/MerchantHome';
import ShopPage from '@/features/merchants/ShopPage';
import RegisterShopWizard from '@/features/merchants/RegisterShopWizard';
import ToolkitPage from '@/features/merchants/ToolkitPage';
import NotificationsPage from '@/features/merchants/NotificationsPage';
import MerchantCertPage from '@/features/certification/MerchantCertPage';
import PassportPage from '@/features/passport/PassportPage';
import MerchantComplaints from '@/features/resolution/MerchantComplaints';
import MerchantComplaintDetail from '@/features/resolution/MerchantComplaintDetail';
import MerchantWarnings from '@/features/warnings/MerchantWarnings';
import MerchantWarningDetail from '@/features/warnings/MerchantWarningDetail';
import MerchantReview from '@/features/risk/MerchantReview';
import TrainingCenter from '@/features/training/TrainingCenter';
import CoursePage from '@/features/training/CoursePage';

import CheckPage from '@/features/consumers/CheckPage';
import DirectoryPage from '@/features/consumers/DirectoryPage';
import ShopPublicPage from '@/features/consumers/ShopPublicPage';
import VerifyPage from '@/features/consumers/VerifyPage';
import CertVerifyPage from '@/features/consumers/CertVerifyPage';
import ReportWizard from '@/features/complaints/ReportWizard';
import ConsumerCases from '@/features/complaints/ConsumerCases';
import ConsumerCaseDetail from '@/features/complaints/ConsumerCaseDetail';

import OfficerDashboard from '@/features/officer/OfficerDashboard';
import OfficerApplications from '@/features/verification/OfficerApplications';
import ApplicationDetail from '@/features/verification/ApplicationDetail';
import ChannelVerification from '@/features/verification/ChannelVerification';
import OfficerCertification from '@/features/certification/OfficerCertification';
import OfficerComplaints from '@/features/complaints/OfficerComplaints';
import OfficerComplaintDetail from '@/features/complaints/OfficerComplaintDetail';
import OfficerWarnings from '@/features/warnings/OfficerWarnings';
import OfficerWarningDetail from '@/features/warnings/OfficerWarningDetail';
import NewWarningPage from '@/features/warnings/NewWarningPage';
import OfficerRiskList from '@/features/risk/OfficerRiskList';
import OfficerRiskDetail from '@/features/risk/OfficerRiskDetail';
import TrainingRecords from '@/features/officer/TrainingRecords';
import ReportsPage from '@/features/officer/ReportsPage';

import AdminDashboard from '@/features/admin/AdminDashboard';
import AccountsPage from '@/features/admin/AccountsPage';
import AuditPage from '@/features/admin/AuditPage';
import DemoDataPage from '@/features/admin/DemoDataPage';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import DevicePreview from '@/features/preview/DevicePreview';
import DemoScenariosPage from '@/features/demo/DemoScenariosPage';
import DemoCompletePage from '@/features/demo/DemoCompletePage';
import DemoOverviewPage from '@/features/demo/DemoOverviewPage';
import DemoV2SummaryPage from '@/features/demo/DemoV2SummaryPage';
import AIAssistantHome from '@/features/ai-assistant/pages/AIAssistantHome';
import AdvertisingChecker from '@/features/ai-assistant/pages/AdvertisingChecker';
import ComplaintAssistant from '@/features/ai-assistant/pages/ComplaintAssistant';
import AIHistory from '@/features/ai-assistant/pages/AIHistory';
import MarketplacePage from '@/features/marketplace/pages/MarketplacePage';
import MarketplaceDataPage from '@/features/marketplace/pages/MarketplaceDataPage';
import MarketplaceAnalysisPage from '@/features/marketplace/pages/MarketplaceAnalysisPage';
import MerchantAssessmentPage from '@/features/trust-assessment/pages/MerchantAssessmentPage';
import OfficerAssessmentList from '@/features/trust-assessment/pages/OfficerAssessmentList';
import OfficerAssessmentDetail from '@/features/trust-assessment/pages/OfficerAssessmentDetail';
import AdminAssessmentModel from '@/features/trust-assessment/pages/AdminAssessmentModel';

const gate = (allow: Role[], el: JSX.Element) => <RoleGate allow={allow}>{el}</RoleGate>;
const M: Role[] = ['merchant'];
const C: Role[] = ['consumer'];
const O: Role[] = ['officer', 'admin'];
const A: Role[] = ['admin'];

export function AppRoutes() {
  return (
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
  );
}
