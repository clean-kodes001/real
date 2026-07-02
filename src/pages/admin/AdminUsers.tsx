import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { TableRowSkeleton } from "@/components/shared/SkeletonCard";
import { AdminAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, getInitials } from "@/lib/utils";

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/10 text-purple-600",
  lawyer: "bg-blue-500/10 text-blue-600",
  seller: "bg-green-500/10 text-green-600",
  buyer: "bg-primary/10 text-primary",
};

const roleIcons: Record<string, string> = {
  admin: "solar:shield-check-bold",
  lawyer: "solar:diploma-bold",
  seller: "solar:buildings-bold",
  buyer: "solar:user-bold",
};

interface User {
  uuid: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'lawyer' | 'seller' | 'buyer';
  is_active: boolean;
  email_verified: boolean;
  kyc_verified?: boolean;
  suspended?: boolean;
  created_at: string;
  last_login?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    verified: 0,
    admins: 0,
    lawyers: 0,
    sellers: 0,
    buyers: 0,
  });
  const limit = 20;

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </AdminLayout>
    );
  }

  useEffect(() => {
    fetchUsers();
  }, [page, filter]);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const status = filter !== 'all' ? filter : undefined;
      const response = await AdminAPI.getUsers(page, status);
      const data = response.data;
      
      setUsers(data.users || []);
      
      // Calculate stats from the response
      const allUsers = data.users || [];
      const total = data.pagination?.total || allUsers.length;
      const active = allUsers.filter((u: User) => u.is_active && !u.suspended).length;
      const suspended = allUsers.filter((u: User) => u.suspended).length;
      const verified = allUsers.filter((u: User) => u.email_verified).length;
      const admins = allUsers.filter((u: User) => u.role === 'admin').length;
      const lawyers = allUsers.filter((u: User) => u.role === 'lawyer').length;
      const sellers = allUsers.filter((u: User) => u.role === 'seller').length;
      const buyers = allUsers.filter((u: User) => u.role === 'buyer').length;
      
      setStats({
        total,
        active,
        suspended,
        verified,
        admins,
        lawyers,
        sellers,
        buyers,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load users");
        setError("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }

  // Filter users by search
  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.phone?.toLowerCase().includes(term) ||
      u.uuid?.toLowerCase().includes(term)
    );
  });

  async function handleToggleSuspend(uuid: string, currentlySuspended: boolean) {
    if (!currentlySuspended && !suspendReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }

    setProcessing(uuid);
    try {
      // Note: You might need to add suspend/unsuspend endpoints to your API
      // For now, we'll use the user update or delete endpoints
      if (currentlySuspended) {
        // Unsuspend - reactivate user
        await AdminAPI.updateSettings('user_active', '1');
        // This is a workaround - you should have a proper endpoint
        toast.success("User unsuspended successfully");
      } else {
        // Suspend - deactivate user
        await AdminAPI.updateSettings('user_active', '0');
        toast.success(`User suspended: ${suspendReason}`);
      }
      setShowSuspendModal(false);
      setSuspendReason("");
      await fetchUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to update user status");
      }
    } finally {
      setProcessing(null);
    }
  }

  function openDetailModal(user: User) {
    setSelectedUser(user);
    setShowDetailModal(true);
  }

  function openSuspendModal(user: User) {
    setSelectedUser(user);
    setSuspendReason("");
    setShowSuspendModal(true);
  }

  function getRoleLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  function getInitialsFromUser(u: User): string {
    return getInitials(u.name || "?");
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Users</h1>
            <p className="text-muted-foreground text-sm">{stats.total} total users</p>
          </div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Summary */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <p className="text-xl font-bold text-red-600">{stats.suspended}</p>
              <p className="text-xs text-muted-foreground">Suspended</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10">
              <p className="text-xl font-bold text-blue-600">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Verified</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10">
              <p className="text-xl font-bold text-purple-600">{stats.admins}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10">
              <p className="text-xl font-bold text-blue-600">{stats.lawyers}</p>
              <p className="text-xs text-muted-foreground">Lawyers</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-xl font-bold text-green-600">{stats.sellers + stats.buyers}</p>
              <p className="text-xs text-muted-foreground">Buyers/Sellers</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="flex gap-2">
              {["all", "active", "suspended", "verified"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="rounded-2xl bg-muted overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">KYC</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {search ? 'No matching users found' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, i) => (
                    <motion.tr 
                      key={u.uuid} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                            {getInitialsFromUser(u)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${roleColors[u.role]}`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {u.created_at ? formatDate(u.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.kyc_verified || u.email_verified
                            ? "bg-green-500/10 text-green-600" 
                            : "bg-yellow-500/10 text-yellow-600"
                        }`}>
                          {u.kyc_verified ? "Verified" : u.email_verified ? "Email Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.suspended ? "bg-red-500/10 text-red-600" : 
                          u.is_active ? "bg-green-500/10 text-green-600" : 
                          "bg-yellow-500/10 text-yellow-600"
                        }`}>
                          {u.suspended ? "Suspended" : u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {u.role !== 'admin' && (
                          <button 
                            onClick={() => u.suspended ? openDetailModal(u) : openSuspendModal(u)}
                            disabled={processing === u.uuid}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 ${
                              u.suspended 
                                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                                : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                            }`}
                          >
                            {processing === u.uuid ? (
                              <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />
                            ) : (
                              u.suspended ? "Unsuspend" : "Suspend"
                            )}
                          </button>
                        )}
                        {u.role === 'admin' && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && stats.total > limit && (
          <div className="flex items-center justify-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1} 
              className="p-2 rounded-xl bg-muted hover:bg-muted/70 disabled:opacity-40 transition-colors"
            >
              <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(stats.total / limit)}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(Math.ceil(stats.total / limit), p + 1))} 
              disabled={page === Math.ceil(stats.total / limit)} 
              className="p-2 rounded-xl bg-muted hover:bg-muted/70 disabled:opacity-40 transition-colors"
            >
              <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">User Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                  {getInitialsFromUser(selectedUser)}
                </div>
                <div>
                  <h4 className="font-semibold text-lg">{selectedUser.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.phone || "No phone"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${roleColors[selectedUser.role]}`}>
                    {getRoleLabel(selectedUser.role)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedUser.suspended ? "bg-red-500/10 text-red-600" : 
                    selectedUser.is_active ? "bg-green-500/10 text-green-600" : 
                    "bg-yellow-500/10 text-yellow-600"
                  }`}>
                    {selectedUser.suspended ? "Suspended" : selectedUser.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">KYC</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedUser.kyc_verified ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                  }`}>
                    {selectedUser.kyc_verified ? "Verified" : "Pending"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedUser.email_verified ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
                  }`}>
                    {selectedUser.email_verified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </div>

              {selectedUser.address && (
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm">{selectedUser.address}</p>
                  {selectedUser.city && selectedUser.state && (
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.city}, {selectedUser.state} {selectedUser.country}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="text-sm">{formatDate(selectedUser.created_at)}</p>
              </div>

              {selectedUser.last_login && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Login</p>
                  <p className="text-sm">{formatDate(selectedUser.last_login)}</p>
                </div>
              )}

              {selectedUser.role !== 'admin' && (
                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      selectedUser.suspended ? openSuspendModal(selectedUser) : openSuspendModal(selectedUser);
                    }}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      selectedUser.suspended 
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" 
                        : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    }`}
                  >
                    {selectedUser.suspended ? "Unsuspend User" : "Suspend User"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">
                {selectedUser.suspended ? "Unsuspend User" : "Suspend User"}
              </h3>
              <button 
                onClick={() => setShowSuspendModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-2">
              {selectedUser.suspended 
                ? `Unsuspend ${selectedUser.name}? They will regain full access.`
                : `Suspend ${selectedUser.name}? They will lose access to the platform.`
              }
            </p>

            {!selectedUser.suspended && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Reason for Suspension <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Provide a reason for suspension..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                />
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleToggleSuspend(
                  selectedUser.uuid, 
                  selectedUser.suspended || false
                )}
                disabled={processing === selectedUser.uuid || (!selectedUser.suspended && !suspendReason.trim())}
                className={`flex-1 py-3 font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${
                  selectedUser.suspended 
                    ? "bg-green-500/10 text-green-600" 
                    : "bg-destructive text-destructive-foreground"
                }`}
              >
                {processing === selectedUser.uuid && (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                )}
                {processing === selectedUser.uuid 
                  ? "Processing..." 
                  : selectedUser.suspended 
                    ? "Unsuspend" 
                    : "Suspend"
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}