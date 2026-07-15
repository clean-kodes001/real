import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { NotificationAPI, ApiError } from "@/services/api";
import { formatRelativeTime } from "@/lib/utils";

const typeIcons: Record<string, { icon: string; color: string; bg: string }> = {
  payment: { icon: "solar:card-bold", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  escrow: { icon: "solar:hand-money-bold", color: "text-blue-500", bg: "bg-blue-500/10" },
  dispute: { icon: "solar:shield-warning-bold", color: "text-red-500", bg: "bg-red-500/10" },
  message: { icon: "solar:chat-round-bold", color: "text-purple-500", bg: "bg-purple-500/10" },
  property: { icon: "solar:buildings-bold", color: "text-primary", bg: "bg-primary/10" },
  kyc: { icon: "solar:document-bold", color: "text-amber-500", bg: "bg-amber-500/10" },
  lawyer: { icon: "solar:diploma-bold", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  system: { icon: "solar:bell-bold", color: "text-muted-foreground", bg: "bg-muted/50" },
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
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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
      
      setNotifications(prev => 
        prev.map(n => 
          n.uuid === uuid ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      toast.success("Marked as read");
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
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
      
      toast.success("All marked as read");
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
    try {
      await NotificationAPI.delete(uuid);
      
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

  function openDetail(notification: Notification) {
    setSelectedNotification(notification);
    setShowDetail(true);
    if (!notification.is_read) {
      handleMarkAsRead(notification.uuid);
    }
  }

  const notificationTypes = ['all', ...new Set(notifications.map(n => n.type).filter(Boolean))];

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  const getTypeCount = (type: string) => {
    if (type === 'all') return notifications.length;
    return notifications.filter(n => n.type === type).length;
  };

  const unreadFiltered = filteredNotifications.filter(n => !n.is_read).length;

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {};
    
    filteredNotifications.forEach(notification => {
      const date = new Date(notification.created_at || '');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date >= today) {
        key = 'Today';
      } else if (date >= yesterday) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(notification);
    });
    
    return groups;
  }, [filteredNotifications]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light tracking-tight">Notifications</h1>
              <p className="text-sm text-muted-foreground font-light mt-1">
                {unreadCount > 0 
                  ? `${unreadCount} unread` 
                  : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead} 
                  disabled={markingAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {markingAll && <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />}
                  {markingAll ? "Marking..." : "Mark all read"}
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <Icon icon="solar:refresh-bold" className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {!loading && notifications.length > 0 && (
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6 overflow-x-auto">
            {notificationTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filter === type
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'all' ? 'All' : type}
                <span className="ml-1 text-muted-foreground/60">
                  ({getTypeCount(type)})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={fetchNotifications}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:bell-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">
              {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {filter === 'all' 
                ? "You'll see activity updates here" 
                : `You don't have any ${filter} notifications`}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
              >
                View All
              </button>
            )}
          </div>
        ) : (
          // Notifications List - Grouped by Date
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {date}
                </p>
                <div className="space-y-1">
                  {items.map((n, index) => {
                    const typeStyle = typeIcons[n.type ?? "system"] ?? typeIcons.system;
                    const isUnread = !n.is_read;
                    
                    return (
                      <motion.div
                        key={n.uuid}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => openDetail(n)}
                        className={`group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer ${
                          isUnread ? 'bg-primary/5' : ''
                        }`}
                      >
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${typeStyle.bg}`}>
                          <Icon icon={typeStyle.icon} className={`w-4 h-4 ${typeStyle.color}`} />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {n.title && (
                                <p className={`text-sm truncate ${isUnread ? 'font-medium' : 'font-normal'}`}>
                                  {n.title}
                                </p>
                              )}
                              {n.message && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {n.message}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/60 mt-0.5">
                                {formatRelativeTime(n.created_at || '')}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Unread dot */}
                        {isUnread && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        
                        <Icon 
                          icon="solar:arrow-right-bold" 
                          className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" 
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal - Apple Style */}
      <AnimatePresence>
        {showDetail && selectedNotification && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowDetail(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedNotification.type && (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeIcons[selectedNotification.type]?.bg || 'bg-muted/50'}`}>
                        <Icon 
                          icon={typeIcons[selectedNotification.type]?.icon || 'solar:bell-bold'} 
                          className={`w-5 h-5 ${typeIcons[selectedNotification.type]?.color || 'text-muted-foreground'}`} 
                        />
                      </div>
                    )}
                    <h3 className="text-lg font-light">{selectedNotification.title || 'Notification'}</h3>
                  </div>
                  <button 
                    onClick={() => setShowDetail(false)}
                    className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {selectedNotification.message && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selectedNotification.message}
                    </p>
                  )}
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground/60">Type</span>
                    <span className="font-medium capitalize">{selectedNotification.type || 'System'}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground/60">Status</span>
                    <span className={`font-medium ${selectedNotification.is_read ? 'text-muted-foreground' : 'text-primary'}`}>
                      {selectedNotification.is_read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground/60">Received</span>
                    <span className="font-medium">{formatRelativeTime(selectedNotification.created_at || '')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6 pt-4 border-t border-border/30">
                  {!selectedNotification.is_read && (
                    <button
                      onClick={() => {
                        handleMarkAsRead(selectedNotification.uuid);
                        setShowDetail(false);
                      }}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      Mark as Read
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleDelete(selectedNotification.uuid);
                      setShowDetail(false);
                    }}
                    className={`${!selectedNotification.is_read ? 'flex-1' : 'w-full'} py-2.5 rounded-xl text-sm font-medium hover:bg-red-500/10 text-red-500 transition-colors`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}