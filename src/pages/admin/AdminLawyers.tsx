import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { TableRowSkeleton } from "@/components/shared/SkeletonCard";
import { LawyerAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, getInitials } from "@/lib/utils";

const statusColors: Record<string, string> = {
  approved: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  rejected: "bg-red-500/10 text-red-600",
  suspended: "bg-red-500/10 text-red-600",
};

interface Lawyer {
  id: number;
  user_uuid: string;
  license_number: string;
  bar_certificate_url: string;
  years_experience: number;
  specialization: string;
  jurisdiction_states: string[];
  rating: number;
  total_cases: number;
  completed_cases: number;
  is_approved: boolean;
  is_verified: boolean;
  is_suspended?: boolean;
  admin_comment?: string;
  created_at: string;
  approved_at?: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  bio?: string;
}

export default function AdminLawyers() {
  const { user } = useAuth();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    suspended: 0,
  });

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
    fetchLawyers();
  }, []);

  async function fetchLawyers() {
    setLoading(true);
    setError(null);
    try {
      const response = await LawyerAPI.adminList({ 
        page: 1, 
        limit: 100,
      });
      
      const allLawyers = response.data.lawyers || [];
      setLawyers(allLawyers);
      
      const approved = allLawyers.filter((l: Lawyer) => l.is_approved && !l.is_suspended).length;
      const pending = allLawyers.filter((l: Lawyer) => !l.is_approved && !l.is_suspended).length;
      const suspended = allLawyers.filter((l: Lawyer) => l.is_suspended).length;
      
      setStats({
        total: allLawyers.length,
        approved,
        pending,
        suspended,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load lawyers");
        setError("Failed to load lawyers");
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredLawyers = lawyers
    .filter(l => {
      if (filter === 'all') return true;
      if (filter === 'approved') return l.is_approved && !l.is_suspended;
      if (filter === 'pending') return !l.is_approved && !l.is_suspended;
      if (filter === 'suspended') return l.is_suspended;
      return true;
    })
    .filter(l => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        l.name.toLowerCase().includes(search) ||
        l.email.toLowerCase().includes(search) ||
        l.specialization.toLowerCase().includes(search) ||
        l.license_number.toLowerCase().includes(search) ||
        l.state.toLowerCase().includes(search)
      );
    });

  async function handleApprove(user_uuid: string) {
    setProcessing(true);
    try {
      await LawyerAPI.adminApprove(user_uuid);
      toast.success("Lawyer approved successfully!");
      await fetchLawyers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to approve lawyer");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(user_uuid: string) {
    if (!confirm("Are you sure you want to reject this lawyer?")) return;
    
    setProcessing(true);
    try {
      await LawyerAPI.adminReject(user_uuid, "Application rejected by admin");
      toast.success("Lawyer rejected");
      await fetchLawyers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to reject lawyer");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleSuspend(user_uuid: string) {
    if (!suspendReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }

    setProcessing(true);
    try {
      await LawyerAPI.adminSuspend?.(user_uuid, suspendReason) || 
      await LawyerAPI.adminReject(user_uuid, `Suspended: ${suspendReason}`);
      toast.success("Lawyer suspended successfully");
      setShowSuspendModal(false);
      setSuspendReason("");
      await fetchLawyers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to suspend lawyer");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleUnsuspend(user_uuid: string) {
    if (!confirm("Are you sure you want to unsuspend this lawyer?")) return;
    
    setProcessing(true);
    try {
      await LawyerAPI.adminUnsuspend?.(user_uuid) || 
      await LawyerAPI.adminApprove(user_uuid);
      toast.success("Lawyer unsuspended successfully");
      await fetchLawyers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to unsuspend lawyer");
      }
    } finally {
      setProcessing(false);
    }
  }

  function openDetailModal(lawyer: Lawyer) {
    setSelectedLawyer(lawyer);
    setShowDetailModal(true);
  }

  function openSuspendModal(lawyer: Lawyer) {
    setSelectedLawyer(lawyer);
    setSuspendReason("");
    setShowSuspendModal(true);
  }

  const getStatusLabel = (lawyer: Lawyer) => {
    if (lawyer.is_suspended) return "Suspended";
    if (lawyer.is_approved) return "Approved";
    return "Pending";
  };

  const getStatusColor = (lawyer: Lawyer) => {
    if (lawyer.is_suspended) return "bg-red-500/10 text-red-600";
    if (lawyer.is_approved) return "bg-green-500/10 text-green-600";
    return "bg-yellow-500/10 text-yellow-600";
  };

  // Close modal on outside click
  const handleModalClose = (e: React.MouseEvent, modalState: (value: boolean) => void) => {
    if (e.target === e.currentTarget) {
      modalState(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Lawyers</h1>
            <p className="text-sm text-muted-foreground">Manage verified legal professionals</p>
          </div>
          <button
            onClick={fetchLawyers}
            disabled={loading}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Stats Summary - Mobile Responsive */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-xl md:text-2xl font-bold">{stats.total}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-xl md:text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <p className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <p className="text-xl md:text-2xl font-bold text-red-600">{stats.suspended}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Suspended</p>
            </div>
          </div>
        )}

        {/* Search & Filter - Mobile Responsive */}
        {!loading && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, specialization..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>
        )}

        {/* Status Filter - Mobile Responsive */}
        {!loading && (
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {['all', 'approved', 'pending', 'suspended'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-2.5 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium capitalize transition-all ${
                  filter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {status === 'all' ? 'All' : status}
                <span className="ml-1 text-[8px] md:text-xs opacity-70">
                  ({status === 'all' ? stats.total : stats[status as keyof typeof stats] || 0})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 md:py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchLawyers}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Table - Mobile Responsive */}
        <div className="rounded-2xl bg-muted overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] md:min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground">Lawyer</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Specialization</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Experience</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Joined</th>
                  <th className="text-left px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 md:px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredLawyers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {searchTerm || filter !== 'all' ? 'No matching lawyers found' : 'No lawyers found'}
                    </td>
                  </tr>
                ) : (
                  filteredLawyers.map((l, i) => (
                    <motion.tr 
                      key={l.user_uuid || l.id} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(l)}
                    >
                      <td className="px-3 md:px-4 py-3">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] md:text-xs font-bold shrink-0">
                            {getInitials(l.name || "?")}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs md:text-sm truncate">{l.name}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground truncate">{l.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-muted-foreground hidden sm:table-cell">
                        {l.specialization ? l.specialization.substring(0, 20) + (l.specialization.length > 20 ? '...' : '') : "—"}
                      </td>
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-muted-foreground hidden md:table-cell">
                        {l.years_experience || 0} years
                      </td>
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-muted-foreground hidden lg:table-cell">
                        {l.created_at ? formatDate(l.created_at) : "—"}
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium capitalize ${getStatusColor(l)}`}>
                          {getStatusLabel(l)}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-3" onClick={(e) => e.stopPropagation()}>
  <div className="flex items-center justify-center gap-1 md:gap-2">
    {!l.is_approved && !l.is_suspended && (
      <>
        <button 
          onClick={() => handleApprove(l.user_uuid)}
          disabled={processing}
          className="p-1.5 md:p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
          title="Approve"
        >
          <Icon icon="solar:check-bold" className="w-4 h-4 md:w-4 md:h-4" />
        </button>
        <button 
          onClick={() => handleReject(l.user_uuid)}
          disabled={processing}
          className="p-1.5 md:p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
          title="Reject"
        >
          <Icon icon="solar:close-bold" className="w-4 h-4 md:w-4 md:h-4" />
        </button>
      </>
    )}
    {l.is_approved && !l.is_suspended && (
      <button 
        onClick={() => openSuspendModal(l)}
        disabled={processing}
        className="p-1.5 md:p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm"
        title="Suspend"
      >
        <Icon icon="solar:forbidden-bold" className="w-4 h-4 md:w-4 md:h-4" />
      </button>
    )}
    {l.is_suspended && (
      <button 
        onClick={() => handleUnsuspend(l.user_uuid)}
        disabled={processing}
        className="p-1.5 md:p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-sm"
        title="Unsuspend"
      >
        <Icon icon="solar:check-bold" className="w-4 h-4 md:w-4 md:h-4" />
      </button>
    )}
    <button 
      onClick={() => openDetailModal(l)}
      className="p-1.5 md:p-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition-colors shadow-sm"
      title="View Details"
    >
      <Icon icon="solar:eye-bold" className="w-4 h-4 md:w-4 md:h-4" />
    </button>
  </div>
</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lawyer Detail Modal - Mobile Responsive with Outside Click */}
        {showDetailModal && selectedLawyer && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50"
            onClick={(e) => handleModalClose(e, setShowDetailModal)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background rounded-2xl max-w-2xl w-full p-4 md:p-6 max-h-[90vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 pb-2 border-b border-border">
                <h3 className="text-lg md:text-xl font-display font-bold">Lawyer Details</h3>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <Icon icon="solar:close-bold" className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl md:text-2xl font-bold">
                    {getInitials(selectedLawyer.name)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-base md:text-lg truncate">{selectedLawyer.name}</h4>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{selectedLawyer.email}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{selectedLawyer.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">License Number</p>
                    <p className="font-medium text-sm md:text-base truncate">{selectedLawyer.license_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Years Experience</p>
                    <p className="font-medium text-sm md:text-base">{selectedLawyer.years_experience} years</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Specialization</p>
                    <p className="font-medium text-sm md:text-base">{selectedLawyer.specialization || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">State</p>
                    <p className="font-medium text-sm md:text-base">{selectedLawyer.state || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Rating</p>
                    <p className="font-medium text-sm md:text-base flex items-center gap-1">
                      <Icon icon="solar:star-bold" className="w-4 h-4 text-yellow-500" />
                      {selectedLawyer.rating || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Cases</p>
                    <p className="font-medium text-sm md:text-base">{selectedLawyer.completed_cases || 0} / {selectedLawyer.total_cases || 0}</p>
                  </div>
                </div>

                {selectedLawyer.jurisdiction_states && selectedLawyer.jurisdiction_states.length > 0 && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Jurisdiction States</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedLawyer.jurisdiction_states.map((state) => (
                        <span key={state} className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] md:text-xs">
                          {state}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLawyer.bio && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Bio</p>
                    <p className="text-xs md:text-sm mt-1">{selectedLawyer.bio}</p>
                  </div>
                )}

                {selectedLawyer.admin_comment && (
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-[10px] md:text-xs text-muted-foreground">Admin Comment</p>
                    <p className="text-xs md:text-sm">{selectedLawyer.admin_comment}</p>
                  </div>
                )}

                {selectedLawyer.bar_certificate_url && (
                  <div className="pt-4 border-t border-border">
                    <a 
                      href={selectedLawyer.bar_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm"
                    >
                      <Icon icon="solar:eye-bold" className="w-4 h-4" />
                      View Bar Certificate
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Suspend Modal - Mobile Responsive with Outside Click */}
        {showSuspendModal && selectedLawyer && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50"
            onClick={(e) => handleModalClose(e, setShowSuspendModal)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background rounded-2xl max-w-md w-full p-4 md:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg md:text-xl font-display font-bold">Suspend Lawyer</h3>
                <button 
                  onClick={() => setShowSuspendModal(false)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <Icon icon="solar:close-bold" className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-2">
                Suspending <span className="font-medium text-foreground">{selectedLawyer.name}</span>
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                The lawyer will not be able to accept new cases while suspended.
              </p>

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

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowSuspendModal(false)}
                  className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => handleSuspend(selectedLawyer.user_uuid)}
                  disabled={processing || !suspendReason.trim()}
                  className="flex-1 py-3 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {processing && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {processing ? "Suspending..." : "Suspend"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}