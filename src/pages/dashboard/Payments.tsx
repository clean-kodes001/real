import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { PaymentAPI, ApiError } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const statusColors: Record<string, string> = {
  success: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  failed: "bg-red-500/10 text-red-600",
  refunded: "bg-blue-500/10 text-blue-600",
};

const statusIcons: Record<string, string> = {
  success: "solar:check-circle-bold",
  pending: "solar:clock-circle-bold",
  failed: "solar:close-circle-bold",
  refunded: "solar:arrow-left-bold",
};

interface Payment {
  uuid: string;
  amount?: string;
  reference?: string;
  status?: string;
  paid_at?: string;
  created_at?: string;
  escrow_uuid?: string;
  transaction_id?: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    setLoading(true);
    setError(null);
    try {
      const response = await PaymentAPI.history(1);
      setPayments(response.data.payments || []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load payment history");
        setError("Failed to load payment history");
      }
    } finally {
      setLoading(false);
    }
  }

  // Get unique statuses for filter
  const statuses = ['all', ...new Set(payments.map(p => p.status).filter(Boolean))];

  // Filter payments
  const filteredPayments = payments
    .filter(p => filter === 'all' ? true : p.status === filter)
    .filter(p => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        p.reference?.toLowerCase().includes(search) ||
        p.uuid.toLowerCase().includes(search) ||
        p.transaction_id?.toLowerCase().includes(search)
      );
    });

  // Calculate totals
  const totalPaid = payments
    .filter(p => p.status === "success")
    .reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);

  const totalPending = payments
    .filter(p => p.status === "pending")
    .reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);

  const getStatusCount = (status: string) => {
    if (status === 'all') return payments.length;
    return payments.filter(p => p.status === status).length;
  };

  function openDetailModal(payment: Payment) {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  }

  function getStatusIcon(status: string): string {
    return statusIcons[status] || "solar:card-bold";
  }

  function getStatusColor(status: string): string {
    return statusColors[status] || "bg-muted text-muted-foreground";
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Payment History</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track all your transactions</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20"
          >
            <p className="text-sm text-green-600">Total Spent</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-green-600/70 mt-1">
              {payments.filter(p => p.status === "success").length} successful transactions
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20"
          >
            <p className="text-sm text-yellow-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-yellow-600/70 mt-1">
              {payments.filter(p => p.status === "pending").length} pending transactions
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 16 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-primary/10 border border-primary/20"
          >
            <p className="text-sm text-primary">Total Transactions</p>
            <p className="text-2xl font-bold text-primary mt-1">{payments.length}</p>
            <p className="text-xs text-primary/70 mt-1">
              {payments.filter(p => p.status === "failed").length} failed
            </p>
          </motion.div>
        </div>

        {/* Search & Filter */}
        {!loading && payments.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by reference or transaction ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchPayments}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Status Filter */}
        {!loading && payments.length > 0 && (
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
                {status === 'all' ? 'All' : status}
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
              onClick={fetchPayments}
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
        ) : filteredPayments.length === 0 ? (
          // Empty State
          <div className="text-center py-16 rounded-2xl bg-muted">
            <Icon icon="solar:card-bold" className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold">
              {filter === 'all' ? 'No payment history' : `No ${filter} payments`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all' 
                ? 'Transactions will appear here' 
                : `You don't have any ${filter} payments`}
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
          // Payments List
          <div className="rounded-2xl bg-muted overflow-hidden divide-y divide-border">
            {filteredPayments.map((p, i) => (
              <motion.div 
                key={p.uuid} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => openDetailModal(p)}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  p.status === 'success' ? 'bg-green-500/10' :
                  p.status === 'pending' ? 'bg-yellow-500/10' :
                  p.status === 'failed' ? 'bg-red-500/10' :
                  'bg-muted'
                }`}>
                  <Icon 
                    icon={getStatusIcon(p.status || '')} 
                    className={`w-5 h-5 ${
                      p.status === 'success' ? 'text-green-500' :
                      p.status === 'pending' ? 'text-yellow-500' :
                      p.status === 'failed' ? 'text-red-500' :
                      'text-muted-foreground'
                    }`} 
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm font-mono truncate">
                    {p.reference || `Payment #${p.uuid.slice(-8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.paid_at || p.created_at || '')}
                  </p>
                  {p.transaction_id && (
                    <p className="text-xs text-muted-foreground font-mono">
                      TXN: {p.transaction_id.slice(0, 12)}...
                    </p>
                  )}
                </div>
                
                {/* Amount & Status */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className={`font-semibold text-sm ${
                    p.status === 'success' ? 'text-green-600' :
                    p.status === 'pending' ? 'text-yellow-600' :
                    p.status === 'failed' ? 'text-red-600' :
                    ''
                  }`}>
                    {p.amount ? formatCurrency(parseFloat(p.amount)) : "—"}
                  </p>
                  {p.status && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  )}
                </div>
                
                <Icon icon="solar:arrow-right-bold" className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Payment Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Amount */}
              <div className="text-center p-4 rounded-xl bg-muted">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-3xl font-bold text-primary">
                  {selectedPayment.amount ? formatCurrency(parseFloat(selectedPayment.amount)) : "—"}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono">{selectedPayment.reference || "—"}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedPayment.status || '')}`}>
                    {selectedPayment.status || "—"}
                  </span>
                </div>

                {selectedPayment.transaction_id && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Transaction ID</span>
                    <span className="text-sm font-mono">{selectedPayment.transaction_id}</span>
                  </div>
                )}

                {selectedPayment.escrow_uuid && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Escrow</span>
                    <span className="text-sm font-mono">{selectedPayment.escrow_uuid.slice(0, 8)}...</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">
                    {formatDateTime(selectedPayment.paid_at || selectedPayment.created_at || '')}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Payment ID</span>
                  <span className="text-sm font-mono">{selectedPayment.uuid.slice(0, 12)}...</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}