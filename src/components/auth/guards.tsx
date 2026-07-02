import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Icon } from "@iconify/react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isHydrated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Only redirect after hydration is complete and we know auth status
    if (isHydrated && !isLoading && !isAuthenticated) {
      navigate("/auth/login");
    }
  }, [isHydrated, isLoading, isAuthenticated, navigate]);

  // Show loading while checking auth
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export function RequireRole({ 
  children, 
  allowed 
}: { 
  children: ReactNode; 
  allowed: Array<'buyer' | 'seller' | 'lawyer' | 'admin'>;
}) {
  const { user, isAuthenticated, isLoading, isHydrated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Only redirect after hydration is complete
    if (isHydrated && !isLoading && !isAuthenticated) {
      navigate("/auth/login");
    }
  }, [isHydrated, isLoading, isAuthenticated, navigate]);

  // Show loading while checking auth
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check if user has required role
  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:shield-warning-bold" className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your account role (<span className="font-semibold capitalize">{user.role}</span>) doesn't have permission to view this page.
          </p>
          <a 
            href="/dashboard" 
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Combined guard for role-based auth
export function RequireAuthWithRole({ 
  children, 
  allowed 
}: { 
  children: ReactNode; 
  allowed: Array<'buyer' | 'seller' | 'lawyer' | 'admin'>;
}) {
  const { user, isAuthenticated, isLoading, isHydrated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isHydrated && !isLoading && !isAuthenticated) {
      navigate("/auth/login");
    }
  }, [isHydrated, isLoading, isAuthenticated, navigate]);

  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!user || !allowed.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:shield-warning-bold" className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your account role (<span className="font-semibold capitalize">{user?.role}</span>) doesn't have permission to view this page.
          </p>
          <a 
            href="/dashboard" 
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Admin only guard (shortcut)
export function RequireAdmin({ children }: { children: ReactNode }) {
  return <RequireRole allowed={['admin']}>{children}</RequireRole>;
}

// Lawyer only guard (shortcut)
export function RequireLawyer({ children }: { children: ReactNode }) {
  return <RequireRole allowed={['lawyer']}>{children}</RequireRole>;
}

// Seller only guard (shortcut)
export function RequireSeller({ children }: { children: ReactNode }) {
  return <RequireRole allowed={['seller']}>{children}</RequireRole>;
}

// Buyer only guard (shortcut)
export function RequireBuyer({ children }: { children: ReactNode }) {
  return <RequireRole allowed={['buyer']}>{children}</RequireRole>;
}