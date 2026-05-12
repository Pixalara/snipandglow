// PingFlow — Main Application Entry
// Handles auth-gated routing: Login → Onboarding → Dashboard + CRUD pages

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Entry-point pages — loaded eagerly (no lazy)
import LandingPage from '@/pages/Landing';
import LoginPage from '@/pages/Login';
import SignupPage from '@/pages/Signup';
import VerifyOTPPage from '@/pages/VerifyOTP';

// Lazy-loaded pages — code-split for smaller initial bundle
const OnboardingPage = lazy(() => import('@/pages/Onboarding'));
const CompleteProfilePage = lazy(() => import('@/pages/CompleteProfile'));
const VerifyWhatsAppPage = lazy(() => import('@/pages/VerifyWhatsApp'));
const PayPage = lazy(() => import('@/pages/Pay'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PlansPage = lazy(() => import('@/pages/Plans'));
const MembersPage = lazy(() => import('@/pages/Members'));
const MemberDetailPage = lazy(() => import('@/pages/MemberDetail'));
const BillingPage = lazy(() => import('@/pages/Billing'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const AutomationLogsPage = lazy(() => import('@/pages/AutomationLogs'));
const BroadcastPage = lazy(() => import('@/pages/Broadcast'));
const EmployeesPage = lazy(() => import('@/pages/Employees'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLog'));
const BranchesPage = lazy(() => import('@/pages/Branches'));
const ExpensesPage = lazy(() => import('@/pages/Expenses'));
const AnalyticsPage = lazy(() => import('@/pages/Analytics'));
const LeadsPage = lazy(() => import('@/pages/Leads'));
const PrivacyPage = lazy(() => import('@/pages/Privacy'));
const TermsPage = lazy(() => import('@/pages/Terms'));
const RefundPage = lazy(() => import('@/pages/Refund'));
const BookDemoPage = lazy(() => import('@/pages/BookDemo'));
const BlogListingPage = lazy(() => import('@/pages/Blog/BlogListing'));
const BlogDetailPage = lazy(() => import('@/pages/Blog/BlogDetail'));

import LoadingScreen from '@/components/layout/LoadingScreen';
import PageSkeleton from '@/components/layout/PageSkeleton';
import AppShell from '@/components/layout/AppShell';
import PageGuard from '@/components/layout/PageGuard';
import { ToastContainer } from '@/components/ui/Toast';

function AppRoutes() {
  const { user, isLoading, isOnboarded, gym, role, isWhatsAppVerified } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Not authenticated
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Authenticated but WhatsApp not verified — BYPASSED (Meta API not integrated yet)
  // When WhatsApp Cloud API is connected, uncomment this block:
  // if (gym && !isWhatsAppVerified && role === 'admin') {
  //   return (
  //     <Suspense fallback={<LoadingScreen />}>
  //       <Routes>
  //         <Route path="/complete-profile" element={<CompleteProfilePage />} />
  //         <Route path="/verify-whatsapp" element={<VerifyWhatsAppPage />} />
  //         <Route path="*" element={<Navigate to="/complete-profile" replace />} />
  //       </Routes>
  //     </Suspense>
  //   );
  // }

  // Authenticated but not onboarded
  if (!isOnboarded) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Fully set up → App Shell with routes
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<PageGuard resource="dashboard"><Dashboard /></PageGuard>} />
          <Route path="/plans" element={<PageGuard resource="plans"><PlansPage /></PageGuard>} />
          <Route path="/members" element={<PageGuard resource="members"><MembersPage /></PageGuard>} />
          <Route path="/leads" element={<PageGuard resource="leads"><LeadsPage /></PageGuard>} />
          <Route path="/members/:memberId" element={<PageGuard resource="members"><MemberDetailPage /></PageGuard>} />
          <Route path="/billing" element={<PageGuard resource="billing"><BillingPage /></PageGuard>} />
          <Route path="/automations" element={<PageGuard resource="automations"><AutomationLogsPage /></PageGuard>} />
          <Route path="/broadcast" element={<PageGuard resource="broadcast"><BroadcastPage /></PageGuard>} />
          <Route path="/employees" element={<PageGuard resource="employees"><EmployeesPage /></PageGuard>} />
          <Route path="/branches" element={<PageGuard resource="branches"><BranchesPage /></PageGuard>} />
          <Route path="/expenses" element={<PageGuard resource="expenses"><ExpensesPage /></PageGuard>} />
          <Route path="/analytics" element={<PageGuard resource="analytics"><AnalyticsPage /></PageGuard>} />
          <Route path="/activity" element={<PageGuard resource="activity"><ActivityLogPage /></PageGuard>} />
          <Route path="/settings" element={<PageGuard resource="settings"><SettingsPage /></PageGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — no auth, no shell */}
        <Route path="/pay" element={<Suspense fallback={<LoadingScreen />}><PayPage /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<LoadingScreen />}><PrivacyPage /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<LoadingScreen />}><TermsPage /></Suspense>} />
        <Route path="/refund" element={<Suspense fallback={<LoadingScreen />}><RefundPage /></Suspense>} />
        <Route path="/book-demo" element={<Suspense fallback={<LoadingScreen />}><BookDemoPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<LoadingScreen />}><BlogListingPage /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={<LoadingScreen />}><BlogDetailPage /></Suspense>} />
        <Route path="*" element={<AppRoutes />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
