import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { EscrowAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  under_review: "bg-blue-500/10 text-blue-600",
  buyer_funded: "bg-blue-500/10 text-blue-600",
  seller_confirmed: "bg-purple-500/10 text-purple-600",
  lawyer_approved: "bg-indigo-500/10 text-indigo-600",
  completed: "bg-green-500/10 text-green-600",
  disputed: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-orange-500/10 text-orange-600",
};

const statusIcons: Record<string, string> = {
  pending: "solar:clock-circle-bold",
  under_review: "solar:eye-bold",
  buyer_funded: "solar:card-bold",
  seller_confirmed: "solar:check-circle-bold",
  lawyer_approved: "solar:shield-check-bold",
  completed: "solar:check-circle-bold",
  disputed: "solar:danger-triangle-bold",
  cancelled: "solar:close-circle-bold",
  refunded: "solar:arrow-left-bold",
};

interface Escrow {
  uuid: string;
  property_uuid: string;
  property_title: string;
  buyer_uuid: string;
  buyer_name?: string;
  seller_uuid: string;
  seller_name?: string;
  lawyer_uuid: string;
  lawyer_name?: string;
  amount: number;
  fee: number;
  total_amount: number;
  status: 'pending' | 'under_review' | 'buyer_funded' | 'seller_confirmed' | 'lawyer_approved' | 'completed' | 'cancelled' | 'disputed' | 'refunded';
  payment_reference: string;
  created_at: string;
  funded_at: string;
  seller_confirmed_at: string;
  lawyer_approved_at: string;
  released_at: string;
}

export default function Escrows() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null);
  const [actionType, setActionType] = useState<'release' | 'cancel' | 'refund' | null>(null);

  const isAdmin = user?.role === 'admin';
  const isLawyer = user?.role === 'lawyer';
  const isSeller = user?.role === 'seller';
  const isBuyer = user?.role === 'buyer';

  useEffect(() => {
    fetchEscrows();
  }, []);

  async function fetchEscrows() {
    setLoading(true);
    setError(null);
    try {
      // If admin, use admin list endpoint
      const endpoint = isAdmin ? EscrowAPI.adminList : EscrowAPI.list;
      const response = await endpoint(1);
      setEscrows(response.data.escrows || []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load escrows");
        setError("Failed to load escrows");
      }
    } finally {
      setLoading(false);
    }
  }

  // Get unique statuses for filter
  const statuses = ['all', ...new Set(escrows.map(e => e.status))];

  // Filter escrows by status and search
  const filteredEscrows = escrows
    .filter(e => filter === 'all' ? true : e.status === filter)
    .filter(e => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        e.property_title?.toLowerCase().includes(search) ||
        e.uuid.toLowerCase().includes(search) ||
        e.payment_reference?.toLowerCase().includes(search) ||
        e.buyer_name?.toLowerCase().includes(search) ||
        e.seller_name?.toLowerCase().includes(search) ||
        e.lawyer_name?.toLowerCase().includes(search)
      );
    });

  // Count escrows by status
  const getStatusCount = (status: string) => {
    if (status === 'all') return escrows.length;
    return escrows.filter(e => e.status === status).length;
  };

  // Get icon background color
  const getIconBg = (status: string) => {
    const bgColors: Record<string, string> = {
      pending: "bg-yellow-500/10",
      under_review: "bg-blue-500/10",
      buyer_funded: "bg-blue-500/10",
      seller_confirmed: "bg-purple-500/10",
      lawyer_approved: "bg-indigo-500/10",
      completed: "bg-green-500/10",
      disputed: "bg-red-500/10",
      cancelled: "bg-muted",
      refunded: "bg-orange-500/10",
    };
    return bgColors[status] || "bg-muted";
  };

  // Get icon color
  const getIconColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "text-yellow-600",
      under_review: "text-blue-600",
      buyer_funded: "text-blue-600",
      seller_confirmed: "text-purple-600",
      lawyer_approved: "text-indigo-600",
      completed: "text-green-600",
      disputed: "text-red-600",
      cancelled: "text-muted-foreground",
      refunded: "text-orange-600",
    };
    return colorMap[status] || "text-muted-foreground";
  };

  // Check if escrow can be cancelled
  const canCancel = (escrow: Escrow) => {
    return ['pending', 'under_review', 'buyer_funded'].includes(escrow.status) && (isBuyer || isAdmin);
  };

  // Check if admin can release funds
  const canRelease = (escrow: Escrow) => {
    return isAdmin && (escrow.status === 'lawyer_approved' || escrow.status === 'ready_for_release');
  };

  // Check if admin can refund
  const canRefund = (escrow: Escrow) => {
    return isAdmin && (escrow.status === 'buyer_funded' || escrow.status === 'seller_confirmed');
  };

  // ✅ Admin: Release Funds
  async function handleReleaseFunds() {
    if (!selectedEscrow) return;
    
    setActionLoading(selectedEscrow.uuid);
    try {
      await EscrowAPI.release(selectedEscrow.uuid);
      toast.success("Funds released successfully!");
      setShowActionModal(false);
      setSelectedEscrow(null);
      setActionType(null);
      await fetchEscrows();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to release funds");
      }
    } finally {
      setActionLoading(null);
    }
  }

  // ✅ Admin: Cancel Escrow
  async function handleCancelEscrow() {
    if (!selectedEscrow) return;
    
    setActionLoading(selectedEscrow.uuid);
    try {
      // You'll need to add this endpoint to your API
      await EscrowAPI.cancel(selectedEscrow.uuid);
      toast.success("Escrow cancelled successfully!");
      setShowActionModal(false);
      setSelectedEscrow(null);
      setActionType(null);
      await fetchEscrows();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to cancel escrow");
      }
    } finally {
      setActionLoading(null);
    }
  }

  // ✅ Admin: Refund Escrow
  async function handleRefundEscrow() {
    if (!selectedEscrow) return;
    
    setActionLoading(selectedEscrow.uuid);
    try {
      // You'll need to add this endpoint to your API
      await EscrowAPI.refund(selectedEscrow.uuid);
      toast.success("Escrow refunded successfully!");
      setShowActionModal(false);
      setSelectedEscrow(null);
      setActionType(null);
      await fetchEscrows();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to refund escrow");
      }
    } finally {
      setActionLoading(null);
    }
  }

  // Open action modal
  function openActionModal(escrow: Escrow, action: 'release' | 'cancel' | 'refund') {
    setSelectedEscrow(escrow);
    setActionType(action);
    setShowActionModal(true);
  }

  // Get action modal details
  const getActionModalDetails = () => {
    if (!selectedEscrow || !actionType) return { title: '', description: '', buttonText: '', buttonColor: '' };
    
    switch(actionType) {
      case 'release':
        return {
          title: 'Release Funds',
          description: 'Are you sure you want to release the funds to the seller? This action cannot be undone.',
          buttonText: 'Release Funds',
          buttonColor: 'bg-green-500 hover:bg-green-600'
        };
      case 'cancel':
        return {
          title: 'Cancel Escrow',
          description: 'Are you sure you want to cancel this escrow? All funds will be refunded to the buyer.',
          buttonText: 'Cancel Escrow',
          buttonColor: 'bg-destructive hover:opacity-90'
        };
      case 'refund':
        return {
          title: 'Refund Escrow',
          description: 'Are you sure you want to refund this escrow? The buyer will receive a full refund.',
          buttonText: 'Refund Buyer',
          buttonColor: 'bg-orange-500 hover:opacity-90'
        };
      default:
        return { title: '', description: '', buttonText: '', buttonColor: '' };
    }
  };

  // Get status summary
  const getStatusSummary = () => {
    const total = escrows.length;
    const active = escrows.filter(e => 
      ['pending', 'under_review', 'buyer_funded', 'seller_confirmed', 'lawyer_approved'].includes(e.status)
    ).length;
    const completed = escrows.filter(e => e.status === 'completed').length;
    const disputed = escrows.filter(e => e.status === 'disputed').length;
    return { total, active, completed, disputed };
  };

  const summary = getStatusSummary();
  const modalDetails = getActionModalDetails();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">
              {isAdmin ? 'All Escrow Transactions' : 'Escrow Transactions'}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAdmin ? 'Manage all escrow transactions' : 'Track your secure property transactions'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={fetchEscrows}
              disabled={loading}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          )}
        </div>

        {/* Summary Stats */}
        {!loading && escrows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10">
              <p className="text-2xl font-bold text-blue-600">{summary.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <p className="text-2xl font-bold text-red-600">{summary.disputed}</p>
              <p className="text-xs text-muted-foreground">Disputed</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && escrows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, ID, reference, or party name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <button
              onClick={fetchEscrows}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Status Filter */}
        {!loading && escrows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  filter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
                <span className="ml-1.5 text-xs opacity-70">
                  ({getStatusCount(status)})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchEscrows}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="rounded-2xl bg-muted divide-y divide-border overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredEscrows.length === 0 ? (
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:hand-money-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {filter === 'all' ? 'No escrow transactions' : `No ${filter.replace('_', ' ')} escrows`}
            </h3>
            <p className="text-muted-foreground text-sm">
              {filter === 'all' 
                ? 'Start a transaction on a property to create an escrow'
                : `No escrows with status "${filter.replace('_', ' ')}"`}
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
          <div className="rounded-2xl bg-muted overflow-hidden divide-y divide-border">
            {filteredEscrows.map((e, i) => (
              <motion.div 
                key={e.uuid} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.05 }}
                className="group"
              >
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors">
                  <Link href={`/dashboard/escrow/${e.uuid}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${getIconBg(e.status)} flex items-center justify-center shrink-0`}>
                      <Icon 
                        icon={statusIcons[e.status] || "solar:hand-money-bold"} 
                        className={`w-5 h-5 ${getIconColor(e.status)}`} 
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {e.property_title || `Escrow #${e.uuid.slice(-8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.created_at ? formatDate(e.created_at) : ""}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.buyer_name && `Buyer: ${e.buyer_name}`}
                        {e.seller_name && ` • Seller: ${e.seller_name}`}
                      </p>
                      {e.payment_reference && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Ref: {e.payment_reference.slice(0, 12)}...
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="font-semibold text-sm">
                        {e.total_amount ? formatCurrency(e.total_amount) : "—"}
                      </p>
                      {e.status && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[e.status] || "bg-muted text-muted-foreground"}`}>
                          {e.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    
                    <Icon icon="solar:arrow-right-bold" className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
                  </Link>

                  {/* ✅ Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canRelease(e) && (
                        <button
                          onClick={() => openActionModal(e, 'release')}
                          className="p-2 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                          title="Release Funds"
                        >
                          <Icon icon="solar:hand-money-bold" className="w-4 h-4" />
                        </button>
                      )}
                      {canRefund(e) && (
                        <button
                          onClick={() => openActionModal(e, 'refund')}
                          className="p-2 rounded-xl bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors"
                          title="Refund Buyer"
                        >
                          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
                        </button>
                      )}
                      {canCancel(e) && (
                        <button
                          onClick={() => openActionModal(e, 'cancel')}
                          className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          title="Cancel Escrow"
                        >
                          <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* ✅ Buyer Cancel */}
                  {!isAdmin && canCancel(e) && (
                    <button
                      onClick={() => openActionModal(e, 'cancel')}
                      className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Cancel Escrow"
                    >
                      <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedEscrow && actionType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">{modalDetails.title}</h3>
              <button 
                onClick={() => {
                  setShowActionModal(false);
                  setSelectedEscrow(null);
                  setActionType(null);
                }}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {modalDetails.description}
            </p>
            
            <div className="p-4 rounded-xl bg-muted mb-4">
              <p className="text-sm font-medium">{selectedEscrow.property_title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Amount: {formatCurrency(selectedEscrow.total_amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="capitalize">{selectedEscrow.status.replace('_', ' ')}</span>
              </p>
              {selectedEscrow.buyer_name && (
                <p className="text-xs text-muted-foreground">Buyer: {selectedEscrow.buyer_name}</p>
              )}
              {selectedEscrow.seller_name && (
                <p className="text-xs text-muted-foreground">Seller: {selectedEscrow.seller_name}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setShowActionModal(false);
                  setSelectedEscrow(null);
                  setActionType(null);
                }}
                className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (actionType === 'release') handleReleaseFunds();
                  else if (actionType === 'cancel') handleCancelEscrow();
                  else if (actionType === 'refund') handleRefundEscrow();
                }}
                disabled={actionLoading === selectedEscrow.uuid}
                className={`flex-1 py-3 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${modalDetails.buttonColor}`}
              >
                {actionLoading === selectedEscrow.uuid && (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                )}
                {actionLoading === selectedEscrow.uuid ? "Processing..." : modalDetails.buttonText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}