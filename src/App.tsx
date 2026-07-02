import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/hooks/use-theme";
import { RequireAuth, RequireRole } from "@/components/auth/guards";

import Landing from "@/pages/Landing";
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import Lawyers from "@/pages/Lawyers";
import About from "@/pages/About";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/not-found";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import VerifyEmail from "@/pages/auth/VerifyEmail";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

import Dashboard from "@/pages/dashboard/Dashboard";
import DashboardProperties from "@/pages/dashboard/DashboardProperties";
import CreateProperty from "@/pages/dashboard/CreateProperty";
import Favorites from "@/pages/dashboard/Favorites";
import Escrows from "@/pages/dashboard/Escrows";
import EscrowDetail from "@/pages/dashboard/EscrowDetail";
import Payments from "@/pages/dashboard/Payments";
import Messages from "@/pages/dashboard/Messages";
import Disputes from "@/pages/dashboard/Disputes";
import KYC from "@/pages/dashboard/KYC";
import Notifications from "@/pages/dashboard/Notifications";
import Profile from "@/pages/dashboard/Profile";
import LawyerProfile from "@/pages/dashboard/LawyerProfile";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminProperties from "@/pages/admin/AdminProperties";
import AdminLawyers from "@/pages/admin/AdminLawyers";
import AdminTransactions from "@/pages/admin/AdminTransactions";
import AdminDisputes from "@/pages/admin/AdminDisputes";
import AdminKYC from "@/pages/admin/AdminKYC";

// Configure QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Helper function to wrap routes with auth guards
const AuthRoute = ({ component: Component, ...rest }: any) => {
  return <RequireAuth><Component {...rest} /></RequireAuth>;
};

const RoleRoute = ({ component: Component, allowed, ...rest }: any) => {
  return <RequireRole allowed={allowed}><Component {...rest} /></RequireRole>;
};

function Router() {
  return (
    <Switch>
      {/* ========== PUBLIC ROUTES ========== */}
      <Route path="/" component={Landing} />
      <Route path="/properties" component={Properties} />
      <Route path="/property/:id" component={PropertyDetail} />
      <Route path="/lawyers" component={Lawyers} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={Terms} />

      {/* ========== AUTH ROUTES ========== */}
      <Route path="/auth/login" component={Login} />
      <Route path="/auth/register" component={Register} />
      <Route path="/auth/verify-email" component={VerifyEmail} />
      <Route path="/auth/forgot-password" component={ForgotPassword} />
      <Route path="/auth/reset-password" component={ResetPassword} />

      {/* ========== DASHBOARD ROUTES ========== */}
      {/* Any authenticated user */}
      <Route path="/dashboard">
        {() => <RequireAuth><Dashboard /></RequireAuth>}
      </Route>
      <Route path="/dashboard/messages">
        {() => <RequireAuth><Messages /></RequireAuth>}
      </Route>
      <Route path="/dashboard/notifications">
        {() => <RequireAuth><Notifications /></RequireAuth>}
      </Route>
      <Route path="/dashboard/profile">
        {() => <RequireAuth><Profile /></RequireAuth>}
      </Route>
      <Route path="/dashboard/kyc">
        {() => <RequireAuth><KYC /></RequireAuth>}
      </Route>
      <Route path="/dashboard/escrow/:id">
        {() => <RequireAuth><EscrowDetail /></RequireAuth>}
      </Route>
      <Route path="/dashboard/escrows">
        {() => <RequireAuth><Escrows /></RequireAuth>}
      </Route>

      {/* Buyer only */}
      <Route path="/dashboard/favorites">
        {() => <RequireRole allowed={["buyer"]}><Favorites /></RequireRole>}
      </Route>

      {/* Buyer, Seller, Lawyer */}
      <Route path="/dashboard/payments">
        {() => <RequireRole allowed={["buyer", "seller"]}><Payments /></RequireRole>}
      </Route>
      <Route path="/dashboard/disputes">
        {() => <RequireRole allowed={["buyer", "seller", "lawyer"]}><Disputes /></RequireRole>}
      </Route>

      {/* Seller only */}
      <Route path="/dashboard/properties/create">
        {() => <RequireRole allowed={["seller"]}><CreateProperty /></RequireRole>}
      </Route>
      <Route path="/dashboard/properties">
        {() => <RequireRole allowed={["seller"]}><DashboardProperties /></RequireRole>}
      </Route>

      {/* Lawyer only */}
      <Route path="/dashboard/lawyer-profile">
        {() => <RequireRole allowed={["lawyer"]}><LawyerProfile /></RequireRole>}
      </Route>

      {/* ========== ADMIN ROUTES ========== */}
      <Route path="/admin">
        {() => <RequireRole allowed={["admin"]}><AdminDashboard /></RequireRole>}
      </Route>
      <Route path="/admin/users">
        {() => <RequireRole allowed={["admin"]}><AdminUsers /></RequireRole>}
      </Route>
      <Route path="/admin/properties">
        {() => <RequireRole allowed={["admin"]}><AdminProperties /></RequireRole>}
      </Route>
      <Route path="/admin/lawyers">
        {() => <RequireRole allowed={["admin"]}><AdminLawyers /></RequireRole>}
      </Route>
      <Route path="/admin/transactions">
        {() => <RequireRole allowed={["admin"]}><AdminTransactions /></RequireRole>}
      </Route>
      <Route path="/admin/disputes">
        {() => <RequireRole allowed={["admin"]}><AdminDisputes /></RequireRole>}
      </Route>
      <Route path="/admin/kyc">
        {() => <RequireRole allowed={["admin"]}><AdminKYC /></RequireRole>}
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              fontSize: "14px",
              padding: "16px",
            },
            success: {
              icon: "✅",
              style: {
                border: "1px solid hsl(142, 76%, 36%)",
              },
            },
            error: {
              icon: "❌",
              style: {
                border: "1px solid hsl(0, 84%, 60%)",
              },
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}