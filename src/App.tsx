/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { IconContext, Warning } from '@phosphor-icons/react';
import { EmptyState } from './components/EmptyState';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import { Layout, navItems } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SubmitClaim } from './pages/SubmitClaim';
import { ProcessingQueue } from './pages/ProcessingQueue';
import { ReadyToClaim } from './pages/ReadyToClaim';
import { TransactionHistory } from './pages/TransactionHistory';
import { MyRequests } from './pages/MyRequests';
import { AuditLog } from './pages/AuditLog';
import { ClaimDetail } from './pages/ClaimDetail';
import { CashAdvanceDetail } from './pages/CashAdvanceDetail';
import { LiquidationDetail } from './pages/LiquidationDetail';
import { Calendar } from './pages/Calendar';
import { Settings } from './pages/Settings';
import { AdminReporting } from './pages/AdminReporting';
import { HistoricalImport } from './components/HistoricalImport';
import { SystemEmails } from './pages/SystemEmails';
import { Receipts as ReceiptArchive } from './pages/ReceiptArchive';
import { UserAccounts } from './pages/UserAccounts';
import { CompanyDirectory } from './pages/CompanyDirectory';
import { MasterDataAdmin } from './pages/MasterDataAdmin';
import { FieldDefinitionsAdmin } from './pages/FieldDefinitionsAdmin';
import { Moms } from './pages/Moms';
import { Support } from "./pages/Support";
import { SupportDetail } from "./pages/SupportDetail";
import { MomDetail } from './pages/MomDetail';
import { ScenarioGuide } from './pages/ScenarioGuide';
import { DebugRoleSwitcher } from './DebugRoleSwitcher';
import { UserRole } from './types';

const roleHomePages: Record<UserRole, string> = {
  [UserRole.REQUESTOR]: '/',
  [UserRole.APPROVER]: '/',
  [UserRole.CUSTODIAN]: '/processing',
  [UserRole.ADMIN]: '/audit',
};

// The standalone Approver Inbox page was merged into the Dashboard — this
// keeps any old /approvals?tab=X link (bookmarks, notification click-throughs)
// working by forwarding to the same tab on the Dashboard instead of 404ing.
const ApprovalsRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} replace />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const pathname = location.pathname;
  const path = pathname.replace(/\/$/, '') || '/';

  let allowed = true;

  // 1. Check for notifications - allowed for all roles to view their email inbox/system emails
  if (path === '/notifications') {
    allowed = true;
  }
  // 2. "/claims/new" itself isn't a sidebar item for every role that can
  // reach it — Approvers get there via the "My Requests" page's button
  // rather than a dedicated sidebar link — so it's checked explicitly
  // instead of falling through to the navItems lookup below.
  else if (path === '/claims/new') {
    allowed = [UserRole.REQUESTOR, UserRole.APPROVER].includes(user.role);
  }
  // 3. Check for claim details: "/claims/:id", "/cash-advances/:id", "/liquidations/:id"
  else if (
    path.startsWith('/claims/') ||
    path.startsWith('/cash-advances/') ||
    path.startsWith('/liquidations/')
  ) {
    if (path.endsWith('/resubmit')) {
      allowed = (user.role === UserRole.REQUESTOR);
    } else {
      allowed = [UserRole.REQUESTOR, UserRole.APPROVER, UserRole.CUSTODIAN, UserRole.ADMIN].includes(user.role);
    }
  }
  // 4. Match against exported navItems from Layout.tsx — a path can appear
  // as more than one entry (different roles reach it via different sidebar
  // groups, e.g. "Ready to Claim" for Requestor vs. Approver), so check
  // every matching entry rather than stopping at the first one.
  else {
    const matchingItems = navItems.filter(item => {
      const itemPath = item.path.replace(/\/$/, '') || '/';
      return itemPath === path;
    });

    if (matchingItems.length > 0) {
      allowed = matchingItems.some(item => item.roles.includes(user.role));
    }
  }

  if (!allowed) {
    const homePage = roleHomePages[user.role] || '/';
    return <Navigate to={homePage} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <IconContext.Provider value={{ size: 20, weight: 'regular' }}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="claims/new" element={<SubmitClaim />} />
                  <Route path="claims/:id/resubmit" element={<SubmitClaim />} />
                  <Route path="claims/:id" element={<ClaimDetail />} />
                  <Route path="cash-advances/:id" element={<CashAdvanceDetail />} />
                  <Route path="liquidations/:id" element={<LiquidationDetail />} />
                  <Route path="approvals" element={<ApprovalsRedirect />} />
                  <Route path="processing" element={<ProcessingQueue />} />
                  <Route path="ready-to-claim" element={<ReadyToClaim />} />
                  <Route path="history" element={<TransactionHistory />} />
                  <Route path="my-requests" element={<MyRequests />} />
                  <Route path="audit" element={<AuditLog />} />
                  <Route path="reporting" element={<AdminReporting />} />
                  <Route path="receipts" element={<ReceiptArchive />} />
                  <Route path="users" element={<UserAccounts />} />
                  <Route path="companies" element={<CompanyDirectory />} />
                  <Route path="master-data" element={<MasterDataAdmin />} />
                  <Route path="form-fields" element={<FieldDefinitionsAdmin />} />
                  {/* /notifications used to render its own copy of SystemEmails —
                      same page, second URL. Redirects to the one canonical
                      route instead of duplicating it. */}
                  <Route path="notifications" element={<Navigate to="/emails" replace />} />
                  <Route path="emails" element={<SystemEmails />} />
                  <Route path="moms" element={<Moms />} />
                  <Route path="moms/:id" element={<MomDetail />} />
                  <Route path="support" element={<Support />} />
                  <Route path="support/:id" element={<SupportDetail />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="settings/import" element={<HistoricalImport />} />
                  <Route path="scenarios" element={<ScenarioGuide />} />
                  <Route path="*" element={
                    <div className="p-8">
                      <EmptyState icon={Warning} title="Page not found" description="This page doesn't exist or you don't have access to it." />
                    </div>
                  } />
                </Route>
              </Routes>
              <DebugRoleSwitcher />
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </IconContext.Provider>
  );
}
