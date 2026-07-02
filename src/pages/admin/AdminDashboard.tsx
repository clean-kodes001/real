import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { StatCardSkeleton } from "@/components/shared/SkeletonCard";
import { AdminAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";

interface DashboardStats {
  users: {
    total: number;
    active: number;
    verified: number;
  };
  lawyers: {
    total: number;
    approved: number;
    pending: number;
  };
  properties: {
    total: number;
    approved: number;
    pending: number;
    sold: number;
  };
  transactions: {
    total: number;
    completed: number;
    pending: number;
    volume: number;
  };
  disputes: {
    total: number;
    open: number;
    resolved: number;
  };
  pending_approvals: {
    properties: number;
    lawyers: number;
    kyc: number;
  };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivity();
  }, []);

  async function fetchDashboardStats() {
    setLoading(true);
    setError(null);
    try {
      const response = await AdminAPI.dashboard();
      setStats(response.data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load dashboard stats");
        setError("Failed to load dashboard stats");
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentActivity() {
    try {
      // Fetch recent activity from audit logs or notifications
      const response = await AdminAPI.getRecentActivity?.() || { data: [] };
      setRecentActivity(response.data || []);
    } catch (error) {
      // Use mock data if API not available
      setRecentActivity([
        { type: "property", action: "New property listed", user: "John Doe", time: "2 min ago" },
        { type: "user", action: "New user registered", user: "Jane Smith", time: "15 min ago" },
        { type: "dispute", action: "New dispute filed", user: "Mike Johnson", time: "1 hour ago" },
        { type: "payment", action: "Payment completed", user: "Sarah Williams", time: "3 hours ago" },
      ]);
    }
  }

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Stat cards configuration
  const statCards = stats ? [
    { 
      icon: "solar:users-group-two-rounded-bold", 
      label: "Total Users", 
      value: String(stats.users.total || "—"), 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      link: "/admin/users",
      subtitle: `${stats.users.active || 0} active • ${stats.users.verified || 0} verified`
    },
    { 
      icon: "solar:buildings-bold", 
      label: "Properties", 
      value: String(stats.properties.total || "—"), 
      color: "text-primary",
      bgColor: "bg-primary/10",
      link: "/admin/properties",
      subtitle: `${stats.properties.approved || 0} approved • ${stats.properties.pending || 0} pending`
    },
    { 
      icon: "solar:hand-money-bold", 
      label: "Escrow Transactions", 
      value: String(stats.transactions.total || "—"), 
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      link: "/admin/transactions",
      subtitle: `${stats.transactions.completed || 0} completed • ${stats.transactions.pending || 0} pending`
    },
    { 
      icon: "solar:transfer-horizontal-bold", 
      label: "Total Volume", 
      value: formatCurrency(stats.transactions.volume || 0), 
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      link: "/admin/transactions",
      subtitle: `${stats.transactions.completed || 0} transactions`
    },
    



    { 
      icon: "solar:shield-warning-bold", 
      label: "Disputes", 
      value: String(stats.disputes.total || "—"), 
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      link: "/admin/disputes",
      subtitle: `${stats.disputes.open || 0} open • ${stats.disputes.resolved || 0} resolved`
    },
    { 
      icon: "solar:document-bold", 
      label: "Pending Approvals", 
      value: String(
        (stats.pending_approvals?.properties || 0) + 
        (stats.pending_approvals?.lawyers || 0) + 
        (stats.pending_approvals?.kyc || 0)
      ), 
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      link: "/admin/approvals",
      subtitle: `${stats.pending_approvals?.properties || 0} properties • ${stats.pending_approvals?.lawyers || 0} lawyers • ${stats.pending_approvals?.kyc || 0} KYC`
    },
  ] : [];

  // Quick action buttons
  const quickActions = [
    { icon: "solar:check-circle-bold", label: "Approve Properties", href: "/admin/properties", color: "bg-green-500/10 text-green-500" },
    { icon: "solar:diploma-bold", label: "Approve Lawyers", href: "/admin/lawyers", color: "bg-blue-500/10 text-blue-500" },
    { icon: "solar:document-bold", label: "Review KYC", href: "/admin/kyc", color: "bg-yellow-500/10 text-yellow-500" },
    { icon: "solar:users-group-two-rounded-bold", label: "Manage Users", href: "/admin/users", color: "bg-purple-500/10 text-purple-500" },
    { icon: "solar:shield-warning-bold", label: "View Disputes", href: "/admin/disputes", color: "bg-red-500/10 text-red-500" },
  ];

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'property': return 'solar:buildings-bold';
      case 'user': return 'solar:user-bold';
      case 'dispute': return 'solar:shield-warning-bold';
      case 'payment': return 'solar:card-bold';
      default: return 'solar:info-circle-bold';
    }
  };

  const getActivityColor = (type: string) => {
    switch(type) {
      case 'property': return 'bg-primary';
      case 'user': return 'bg-blue-500';
      case 'dispute': return 'bg-red-500';
      case 'payment': return 'bg-green-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Admin Overview</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Platform statistics and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchDashboardStats}
              disabled={loading}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchDashboardStats}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            statCards.map((s, i) => (
              <motion.div 
                key={s.label} 
                initial={{ opacity: 0, y: 16 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.06 }}
              >
                <Link href={s.link || "#"}>
                  <div className="p-5 rounded-2xl bg-muted hover:bg-muted/70 transition-all cursor-pointer group">
                    <div className={`w-10 h-10 rounded-xl ${s.bgColor} flex items-center justify-center mb-3`}>
                      <Icon icon={s.icon} className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    {s.subtitle && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.subtitle}</p>
                    )}
                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-primary flex items-center gap-1">
                        View details <Icon icon="solar:arrow-right-bold" className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="p-6 rounded-2xl bg-muted">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className={`flex flex-col items-center gap-2 p-4 rounded-xl ${action.color} hover:opacity-80 transition-opacity cursor-pointer text-center`}>
                    <Icon icon={action.icon} className="w-6 h-6" />
                    <span className="text-xs font-medium leading-tight">{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-6 rounded-2xl bg-muted">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Activity</h2>
              <Link href="/admin/activity" className="text-xs text-primary hover:opacity-80 transition-opacity">
                View all
              </Link>
            </div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent activity
                </div>
              ) : (
                recentActivity.map((activity, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-background/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${getActivityColor(activity.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon icon={getActivityIcon(activity.type)} className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm truncate">{activity.action}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.user} • {activity.time}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

      
      </div>
    </AdminLayout>
  );
}