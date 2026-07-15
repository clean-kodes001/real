import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatCardSkeleton } from "@/components/shared/SkeletonCard";
import { useAuth } from "@/hooks/use-auth";
import { 
  PropertyAPI, 
  EscrowAPI, 
  NotificationAPI, 
  UserAPI,
  ApiError,
  Property,
  EscrowTransaction,
  Notification
} from "@/services/api";
import { formatCurrency, timeAgo } from "@/lib/utils";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [escrows, setEscrows] = useState<EscrowTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [, navigate] = useLocation();
  const [stats, setStats] = useState({
    properties: 0,
    escrows: 0,
    payments: 0,
    unread: 0,
  });

  useEffect(() => {
    if (isAuthenticated) {
      if(user?.role === "admin") navigate('/admin');
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [profileRes, propertiesRes, escrowsRes, notificationsRes] = await Promise.all([
        UserAPI.getProfile(),
        PropertyAPI.list(1, 10),
        EscrowAPI.list(1),
        NotificationAPI.list(1, 'all'),
      ]);

      setProfile(profileRes.data);
      setProperties(propertiesRes.data.properties || []);
      
      const escrowList = escrowsRes.data.escrows || [];
      setEscrows(escrowList);
      
      const notifs = notificationsRes.data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notificationsRes.data.unread_count || 0);

      const activeEscrows = escrowList.filter(
        (e: EscrowTransaction) => 
          e.status === 'pending' || 
          e.status === 'under_review' || 
          e.status === 'buyer_funded'
      ).length;

      setStats({
        properties: propertiesRes.data.properties?.length || 0,
        escrows: activeEscrows,
        payments: 0,
        unread: notificationsRes.data.unread_count || 0,
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const displayName = profile?.name || user?.name || "User";

  const statItems = [
    { 
      icon: "solar:buildings-bold", 
      label: user?.role === "seller" ? "Listings" : "Properties", 
      value: stats.properties, 
      color: "text-primary", 
      link: user?.role === "seller" ? "/dashboard/properties" : "/properties" 
    },
    { 
      icon: "solar:hand-money-bold", 
      label: "Escrows", 
      value: stats.escrows, 
      color: "text-blue-500", 
      link: "/dashboard/escrows" 
    },
    { 
      icon: "solar:card-bold", 
      label: "Payments", 
      value: stats.payments, 
      color: "text-emerald-500", 
      link: "/dashboard/payments" 
    },
    { 
      icon: "solar:bell-bold", 
      label: "Unread", 
      value: stats.unread, 
      color: "text-amber-500", 
      link: "/dashboard/notifications" 
    },
  ];

  const quickActions = useMemo(() => {
    if (user?.role === "seller") {
      return [
        { icon: "solar:add-circle-bold", label: "List Property", href: "/dashboard/properties/create" },
        { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
        { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
        { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
      ];
    } else if (user?.role === "lawyer") {
      return [
        { icon: "solar:diploma-bold", label: "Profile", href: "/dashboard/lawyer-profile" },
        { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
        { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
        { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
      ];
    } else if (user?.role === "admin") {
      return [
        { icon: "solar:graph-bold", label: "Analytics", href: "/admin" },
        { icon: "solar:users-group-two-rounded-bold", label: "Users", href: "/admin/users" },
        { icon: "solar:buildings-bold", label: "Properties", href: "/admin/properties" },
        { icon: "solar:shield-bold", label: "Disputes", href: "/admin/disputes" },
      ];
    }
    return [
      { icon: "solar:heart-bold", label: "Favorites", href: "/dashboard/favorites" },
      { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
      { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
      { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
    ];
  }, [user?.role]);

  const recentActivity = useMemo(() => {
    const allActivity = [
      ...properties.map(p => ({
        type: 'property',
        title: p.title,
        time: p.created_at || '',
        icon: 'solar:buildings-bold',
        color: 'text-primary'
      })),
      ...escrows.map(e => ({
        type: 'escrow',
        title: `Escrow #${e.uuid?.slice(0, 8) || ''}`,
        time: e.created_at || '',
        icon: 'solar:hand-money-bold',
        color: 'text-blue-500'
      })),
      ...notifications.map(n => ({
        type: 'notification',
        title: n.title || n.message || '',
        time: n.created_at || '',
        icon: 'solar:bell-bold',
        color: 'text-amber-500'
      }))
    ];

    return allActivity
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [properties, escrows, notifications]);

  const handleRetry = () => {
    fetchDashboardData();
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-light tracking-tight">
              Good {greeting}
            </h1>
            <p className="text-lg font-light text-muted-foreground mt-0.5">
              {displayName.split(" ")[0]}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Here's what's happening with your account
            </p>
          </motion.div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            statItems.map((s, i) => (
              <motion.div 
                key={s.label} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={s.link}>
                  <div className="p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <Icon icon={s.icon} className={`w-5 h-5 ${s.color}`} />
                      <Icon icon="solar:arrow-right-up-bold" className="w-3.5 h-3.5 text-muted-foreground/40" />
                    </div>
                    <p className="text-2xl font-light">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl bg-muted/30"
          >
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background hover:bg-muted/30 transition-colors cursor-pointer">
                    <Icon icon={a.icon} className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-5 rounded-2xl bg-muted/30"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Recent Activity
              </h2>
              <Link href="/dashboard/notifications" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View all
              </Link>
            </div>
            
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse" />
                      <div className="h-2 w-1/3 bg-muted/50 rounded mt-1 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                      <Icon icon={item.icon} className={`w-3.5 h-3.5 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground/60">{timeAgo(item.time)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Error State */}
        {!loading && !profile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-muted-foreground text-sm">Failed to load dashboard data</p>
            <button
              onClick={handleRetry}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}