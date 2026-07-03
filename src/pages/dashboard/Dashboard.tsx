import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

const chartData = [
  { month: "Jan", value: 1200000 },
  { month: "Feb", value: 2100000 },
  { month: "Mar", value: 800000 },
  { month: "Apr", value: 3200000 },
  { month: "May", value: 2700000 },
  { month: "Jun", value: 4100000 },
];

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
      if(user?.role === "admin") navigate('/admin')
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // Fetch all data in parallel
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

      // Calculate stats
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
      label: user?.role === "seller" ? "My Listings" : "Properties", 
      value: stats.properties, 
      color: "text-primary", 
      link: user?.role === "seller" ? "/dashboard/properties" : "/properties" 
    },
    { 
      icon: "solar:hand-money-bold", 
      label: "Active Escrows", 
      value: stats.escrows, 
      color: "text-blue-500", 
      link: "/dashboard/escrows" 
    },
    { 
      icon: "solar:card-bold", 
      label: "Payments", 
      value: stats.payments, 
      color: "text-green-500", 
      link: "/dashboard/payments" 
    },
    { 
      icon: "solar:bell-bold", 
      label: "Unread", 
      value: stats.unread, 
      color: "text-yellow-500", 
      link: "/dashboard/notifications" 
    },
  ];

  const quickActions = user?.role === "seller"
    ? [
        { icon: "solar:add-circle-bold", label: "List Property", href: "/dashboard/properties/create" },
        { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
        { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
        { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
      ]
    : user?.role === "lawyer"
    ? [
        { icon: "solar:diploma-bold", label: "My Profile", href: "/dashboard/lawyer-profile" },
        { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
        { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
        { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
      ]
    : user?.role === "admin"
    ? [
        { icon: "solar:graph-bold", label: "Admin Panel", href: "/admin" },
        { icon: "solar:users-group-two-rounded-bold", label: "Users", href: "/admin/users" },
        { icon: "solar:buildings-bold", label: "Properties", href: "/admin/properties" },
        { icon: "solar:shield-bold", label: "Disputes", href: "/admin/disputes" },
      ]
    : [
        { icon: "solar:heart-bold", label: "Favorites", href: "/dashboard/favorites" },
        { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
        { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" },
        { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" },
      ];

  const handleRetry = () => {
    fetchDashboardData();

  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold">
            Good {greeting}, {displayName.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here's what's happening with your account today.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            statItems.map((s, i) => (
              <motion.div 
                key={s.label} 
                initial={{ opacity: 0, y: 16 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.08 }}
              >
                <Link href={s.link}>
                  <div className="p-5 rounded-2xl bg-muted hover:bg-muted/70 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <Icon icon={s.icon} className={`w-6 h-6 ${s.color}`} />
                      <Icon icon="solar:arrow-right-up-bold" className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>


        {/* Quick Actions & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="p-6 rounded-2xl bg-muted">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background hover:bg-muted/40 transition-colors cursor-pointer text-center">
                    <Icon icon={a.icon} className="w-6 h-6 text-primary" />
                    <span className="text-xs font-medium">{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="p-6 rounded-2xl bg-muted">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent Notifications</h2>
              <Link href="/dashboard/notifications" className="text-xs text-primary hover:opacity-80">
                View all {unreadCount > 0 && `(${unreadCount} unread)`}
              </Link>
            </div>
            
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-1.5" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-muted-foreground/20 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-muted-foreground/20 rounded mt-1 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-6">
                <Icon icon="solar:bell-bold" className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 4).map((n) => (
                  <div key={n.uuid} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      n.is_read ? "bg-muted-foreground/30" : "bg-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title || n.message}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {!loading && !profile && (
          <div className="text-center py-10">
            <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">Failed to load dashboard data</p>
            <button
              onClick={handleRetry}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}