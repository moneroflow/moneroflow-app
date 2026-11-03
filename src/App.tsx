import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardLayout from "./components/DashboardLayout";
import OverviewPage from "./pages/dashboard/OverviewPage";
import InvoicesPage from "./pages/dashboard/InvoicesPage";
import SubscriptionsPage from "./pages/dashboard/SubscriptionsPage";
import PaymentsPage from "./pages/dashboard/PaymentsPage";
import PosPage from "./pages/dashboard/PosPage";
import PaymentLinksPage from "./pages/dashboard/PaymentLinksPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import IntegrationsPage from "./pages/dashboard/IntegrationsPage";
import LocalizationPage from "./pages/dashboard/LocalizationPage";
import WhiteLabelPage from "./pages/dashboard/WhiteLabelPage";
import PayoutsPage from "./pages/dashboard/PayoutsPage";
import ReferralsPage from "./pages/dashboard/ReferralsPage";
import BackupsPage from "./pages/dashboard/BackupsPage";
import UsersPage from "./pages/dashboard/UsersPage";
import InvoicePage from "./pages/InvoicePage";
import PayPage from "./pages/PayPage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();



const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="pos" element={<PosPage />} />
            <Route path="links" element={<PaymentLinksPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="payouts" element={<PayoutsPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="localization" element={<LocalizationPage />} />
            <Route path="white-label" element={<WhiteLabelPage />} />
            <Route path="backups" element={<BackupsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/invoice/:id" element={<InvoicePage />} />
          <Route path="/pay/:uniqueId/:amount/:label" element={<PayPage />} />
          <Route path="/pay/:amount" element={<PayPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
