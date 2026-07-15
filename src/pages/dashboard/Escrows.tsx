import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { EscrowAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "text-amber-500",
  under_review: "text-blue-500",
  buyer_funded: "text-blue-500",
  seller_confirmed: "text-purple-500",
  lawyer_approved: "text-indigo-500",
  completed: "text-emerald-500",
  disputed: "text-red-500",
  cancelled: "text-muted-foreground",
  refunded: "text-orange-500",
};

const statusBgColors: Record<string, string> = {
  pending: "bg-amber-500/10",
  under_review: "bg-blue-500/10",
  buyer_funded: "bg-blue-500/10",
  seller_confirmed: "bg-purple-500/10",
  lawyer_approved: "bg-indigo-500/10",
  completed: "bg-emerald-500/10",
  disputed: "bg-red-500/10",
  cancelled: "bg-muted/30",
  refunded: "bg-orange-500/10",
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

  const statuses = ['all', ...new Set(escrows.map(e => e.status))];

  const filteredEscrows = useMemo(() => {
    return escrows
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
  }, [escrows, filter, searchTerm]);

  const getStatusCount = (status: string) => {
    if (status === 'all') return escrows.length;
    return escrows.filter(e => e.status === status).length;
  };

  const getIconBg = (status: string) => statusBgColors[status] || "bg-muted/30";
  const getIconColor = (status: string) => statusColors[status] || "text-muted-foreground";
  const getStatusLabel = (status: string) => status.replace('_', ' ');

  const canCancel = (escrow: Escrow) => {
    return ['pending', 'under_review', 'buyer_funded'].includes(escrow.status) && (isBuyer || isAdmin);
  };

  const canRelease = (escrow: Escrow) => {
    return isAdmin && (escrow.status === 'lawyer_approved' || escrow.status === 'ready_for_release');
  };

  const canRefund = (escrow: Escrow) => {
    return isAdmin && (escrow.status === 'buyer_funded' || escrow.status === 'seller_confirmed');
  };

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

  async function handleCancelEscrow() {
    if (!selectedEscrow) return;
    setActionLoading(selectedEscrow.uuid);
    try {
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

  async function handleRefundEscrow() {
    if (!selectedEscrow) return;
    setActionLoading(selectedEscrow.uuid);
    try {
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

  function openActionModal(escrow: Escrow, action: 'release' | 'cancel' | 'refund') {
    setSelectedEscrow(escrow);
    setActionType(action);
    setShowActionModal(true);
  }

  const modalDetails = useMemo(() => {
    if (!selectedEscrow || !actionType) return { title: '', description: '', buttonText: '', buttonColor: '' };
    
    switch(actionType) {
      case 'release':
        return {
          title: 'Release Funds',
          description: 'Release the funds to the seller. This action cannot be undone.',
          buttonText: 'Release Funds',
          buttonColor: 'bg-emerald-500'
        };
      case 'cancel':
        return {
          title: 'Cancel Escrow',
          description: 'Cancel this escrow and refund the buyer.',
          buttonText: 'Cancel Escrow',
          buttonColor: 'bg-red-500'
        };
      case 'refund':
        return {
          title: 'Refund Escrow',
          description: 'Refund the buyer. This will return all funds to the buyer.',
          buttonText: 'Refund Buyer',
          buttonColor: 'bg-orange-500'
        };
      default:
        return { title: '', description: '', buttonText: '', buttonColor: '' };
    }
  }, [selectedEscrow, actionType]);

  const summary = useMemo(() => {
    const total = escrows.length;
    const active = escrows.filter(e => 
      ['pending', 'under_review', 'buyer_funded', 'seller_confirmed', 'lawyer_approved'].includes(e.status)
    ).length;
    const completed = escrows.filter(e => e.status === 'completed').length;
    const disputed = escrows.filter(e => e.status === 'disputed').length;
    return { total, active, completed, disputed };
  }, [escrows]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight">
            {isAdmin ? 'All Escrows' : 'Escrows'}
          </h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            {isAdmin ? 'Manage all escrow transactions' : 'Track your secure property transactions'}
          </p>
        </div>

        {/* Summary Stats */}
        {!loading && escrows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-2xl font-light">{summary.total}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5">
              <p className="text-2xl font-light text-blue-500">{summary.active}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5">
              <p className="text-2xl font-light text-emerald-500">{summary.completed}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/5">
              <p className="text-2xl font-light text-red-500">{summary.disputed}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Disputed</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && escrows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search escrows..."
                className="w-full pl-9 pr-4 py-2 bg-muted/30 focus:bg-muted/50 transition-colors rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>
            <button
              onClick={fetchEscrows}
              className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status Filter */}
        {!loading && escrows.length > 0 && (
          <div className="flex gap-1 bg-muted/30 p-1 rounded-xl mb-6 overflow-x-auto">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filter === status
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === 'all' ? 'All' : getStatusLabel(status)}
                <span className="ml-1 text-muted-foreground/60">
                  ({getStatusCount(status)})
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
              onClick={fetchEscrows}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : filteredEscrows.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:hand-money-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">
              {filter === 'all' ? 'No escrow transactions' : `No ${getStatusLabel(filter)} escrows`}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {filter === 'all' 
                ? 'Start a transaction on a property to create an escrow'
                : `No escrows with status "${getStatusLabel(filter)}"`}
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
          <div className="space-y-1">
            {filteredEscrows.map((e, i) => (
              <motion.div 
                key={e.uuid} 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                  <Link 
                    href={`/dashboard/escrow/${e.uuid}`} 
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className={`w-9 h-9 rounded-full ${getIconBg(e.status)} flex items-center justify-center shrink-0`}>
                      <Icon 
                        icon={statusIcons[e.status] || "solar:hand-money-bold"} 
                        className={`w-4 h-4 ${getIconColor(e.status)}`} 
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {e.property_title || `Escrow #${e.uuid.slice(-8)}`}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{e.created_at ? formatDate(e.created_at) : ""}</span>
                        {e.buyer_name && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                            <span className="truncate">Buyer: {e.buyer_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="font-medium text-sm">
                        {e.total_amount ? formatCurrency(e.total_amount) : "—"}
                      </p>
                      {e.status && (
                        <span className={`text-xs font-medium capitalize ${getIconColor(e.status)}`}>
                          {getStatusLabel(e.status)}
                        </span>
                      )}
                    </div>
                    
                    <Icon 
                      icon="solar:arrow-right-bold" 
                      className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" 
                    />
                  </Link>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canRelease(e) && (
                        <button
                          onClick={() => openActionModal(e, 'release')}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Release Funds"
                        >
                          <Icon icon="solar:hand-money-bold" className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canRefund(e) && (
                        <button
                          onClick={() => openActionModal(e, 'refund')}
                          className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
                          title="Refund Buyer"
                        >
                          <Icon icon="solar:arrow-left-bold" className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canCancel(e) && (
                        <button
                          onClick={() => openActionModal(e, 'cancel')}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                          title="Cancel Escrow"
                        >
                          <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Buyer Cancel */}
                  {!isAdmin && canCancel(e) && (
                    <button
                      onClick={() => openActionModal(e, 'cancel')}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title="Cancel Escrow"
                    >
                      <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal - Apple Style */}
      <AnimatePresence>
        {showActionModal && selectedEscrow && actionType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => {
                setShowActionModal(false);
                setSelectedEscrow(null);
                setActionType(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full ${modalDetails.buttonColor}/10 flex items-center justify-center mx-auto mb-4`}>
                  <Icon 
                    icon={
                      actionType === 'release' ? 'solar:hand-money-bold' :
                      actionType === 'cancel' ? 'solar:close-circle-bold' :
                      'solar:arrow-left-bold'
                    } 
                    className={`w-6 h-6 ${modalDetails.buttonColor}`} 
                  />
                </div>

                {/* Content */}
                <h3 className="text-lg font-light text-center">{modalDetails.title}</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {modalDetails.description}
                </p>

                {/* Escrow Preview */}
                <div className="mt-4 p-3 bg-muted/30 rounded-xl">
                  <p className="text-sm font-medium">{selectedEscrow.property_title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{formatCurrency(selectedEscrow.total_amount)}</span>
                    <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                    <span className="capitalize">{getStatusLabel(selectedEscrow.status)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => {
                      setShowActionModal(false);
                      setSelectedEscrow(null);
                      setActionType(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (actionType === 'release') handleReleaseFunds();
                      else if (actionType === 'cancel') handleCancelEscrow();
                      else if (actionType === 'refund') handleRefundEscrow();
                    }}
                    disabled={actionLoading === selectedEscrow.uuid}
                    className={`flex-1 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity ${modalDetails.buttonColor}`}
                  >
                    {actionLoading === selectedEscrow.uuid && (
                      <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                    )}
                    {actionLoading === selectedEscrow.uuid ? "Processing..." : modalDetails.buttonText}
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