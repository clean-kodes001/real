import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { NotificationAPI, ApiError } from "@/services/api";
import { formatRelativeTime } from "@/lib/utils";

const typeIcons: Record<string, { icon: string; color: string; bg: string }> = {
  payment: { icon: "solar:card-bold", color: "text-green-500", bg: "bg-green-500/10" },
  escrow: { icon: "solar:hand-money-bold", color: "text-blue-500", bg: "bg-blue-500/10" },
  dispute: { icon: "solar:shield-warning-bold", color: "text-red-500", bg: "bg-red-500/10" },
  message: { icon: "solar:chat-round-bold", color: "text-purple-500", bg: "bg-purple-500/10" },
  property: { icon: "solar:buildings-bold", color: "text-primary", bg: "bg-primary/10" },
  kyc: { icon: "solar:document-bold", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  lawyer: { icon: "solar:diploma-bold", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  system: { icon: "solar:bell-bold", color: "text-muted-foreground", bg: "bg-muted" },
};

interface Notification {
  uuid: string;
  type?: string;
  title?: string;
  message?: string;
  data?: any;
  is_read: number | boolean;
  created_at?: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingOne, setMarkingOne] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const response = await NotificationAPI.list(1, 'all');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load notifications");
        setError("Failed to load notifications");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(uuid: string) {
    setMarkingOne(uuid);
    try {
      await NotificationAPI.markAsRead(uuid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.uuid === uuid ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      toast.success("Notification marked as read");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to mark as read");
      }
    } finally {
      setMarkingOne(null);
    }
  }

  async function handleMarkAllAsRead() {
    if (unreadCount === 0) {
      toast.error("No unread notifications");
      return;
    }

    setMarkingAll(true);
    try {
      await NotificationAPI.markAllAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
      
      toast.success("All notifications marked as read");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to mark all as read");
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(uuid: string) {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    
    try {
      await NotificationAPI.delete(uuid);
      
      // Remove from local state
      const removed = notifications.find(n => n.uuid === uuid);
      setNotifications(prev => prev.filter(n => n.uuid !== uuid));
      
      if (removed && !removed.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      toast.success("Notification deleted");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to delete notification");
      }
    }
  }

  // Get unique notification types for filter
  const notificationTypes = ['all', ...new Set(notifications.map(n => n.type).filter(Boolean))];

  // Filter notifications
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  // Count by type
  const getTypeCount = (type: string) => {
    if (type === 'all') return notifications.length;
    return notifications.filter(n => n.type === type).length;
  };

  const unreadFiltered = filteredNotifications.filter(n => !n.is_read).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Notifications</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {unreadCount > 0 
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` 
                : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead} 
                disabled={markingAll}
                className="text-sm text-primary font-medium hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                {markingAll && <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />}
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}
            <button
              onClick={fetchNotifications}
              className="p-2 hover:bg-muted/70 rounded-xl transition-colors"
              title="Refresh"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Type Filter */}
        {!loading && notifications.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {notificationTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  filter === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {type === 'all' ? 'All' : type}
                <span className="ml-1.5 text-xs opacity-70">
                  ({getTypeCount(type)})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Filter Results Info */}
        {filter !== 'all' && filteredNotifications.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredNotifications.length} {filter} notification{filteredNotifications.length > 1 ? 's' : ''}
            {unreadFiltered > 0 && ` (${unreadFiltered} unread)`}
          </p>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="rounded-2xl bg-muted divide-y divide-border overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty State
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:bell-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
            </h3>
            <p className="text-muted-foreground text-sm">
              {filter === 'all' 
                ? "You'll see activity updates here" 
                : `You don't have any ${filter} notifications`}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                View All
              </button>
            )}
          </div>
        ) : (
          // Notifications List
          <div className="rounded-2xl bg-muted overflow-hidden divide-y divide-border">
            {filteredNotifications.map((n, i) => {
              const typeStyle = typeIcons[n.type ?? "system"] ?? typeIcons.system;
              const isUnread = !n.is_read;
              
              return (
                <motion.div 
                  key={n.uuid} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: i * 0.03 }}
                  className={`group ${isUnread ? "bg-primary/5" : ""}`}
                >
                  <div className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/50 transition-colors ${isUnread ? "border-l-2 border-l-primary" : ""}`}>
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeStyle.bg}`}>
                      <Icon icon={typeStyle.icon} className={`w-5 h-5 ${typeStyle.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {n.title && (
                            <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                              {n.title}
                            </p>
                          )}
                          {n.message && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                          )}
                          {n.created_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeTime(n.created_at)}
                            </p>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(n.uuid);
                              }}
                              disabled={markingOne === n.uuid}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                              title="Mark as read"
                            >
                              {markingOne === n.uuid ? (
                                <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                              ) : (
                                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-primary" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(n.uuid);
                            }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Unread dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}