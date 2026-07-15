import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { PaymentAPI, ApiError } from "@/services/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const statusColors: Record<string, string> = {
  success: "text-green-500",
  pending: "text-amber-500",
  failed: "text-red-500",
  refunded: "text-blue-500",
};

const statusBgColors: Record<string, string> = {
  success: "bg-green-500/10",
  pending: "bg-amber-500/10",
  failed: "bg-red-500/10",
  refunded: "bg-blue-500/10",
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
  payment_method?: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
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

  // Get unique statuses
  const statuses = ['all', ...new Set(payments.map(p => p.status).filter(Boolean))];

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = payments;

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    // Period filter
    if (selectedPeriod === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(p => {
        const date = new Date(p.paid_at || p.created_at || '');
        return date >= weekAgo;
      });
    } else if (selectedPeriod === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(p => {
        const date = new Date(p.paid_at || p.created_at || '');
        return date >= monthAgo;
      });
    }

    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.reference?.toLowerCase().includes(search) ||
        p.uuid.toLowerCase().includes(search) ||
        p.transaction_id?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [payments, selectedStatus, selectedPeriod, searchTerm]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = payments.reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);
    const successful = payments.filter(p => p.status === "success");
    const successfulTotal = successful.reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);
    const pendingTotal = payments
      .filter(p => p.status === "pending")
      .reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);
    
    return {
      total,
      successfulTotal,
      pendingTotal,
      successfulCount: successful.length,
      totalCount: payments.length,
    };
  }, [payments]);

  function openDetailModal(payment: Payment) {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  }

  function getStatusIcon(status: string): string {
    return statusIcons[status] || "solar:card-bold";
  }

  function getStatusColor(status: string): string {
    return statusColors[status] || "text-muted-foreground";
  }

  function getStatusBgColor(status: string): string {
    return statusBgColors[status] || "bg-muted";
  }

  // Group payments by date
  const groupedPayments = useMemo(() => {
    const groups: { [key: string]: Payment[] } = {};
    
    filteredPayments.forEach(payment => {
      const date = new Date(payment.paid_at || payment.created_at || '');
      const key = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(payment);
    });
    
    return groups;
  }, [filteredPayments]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight">Payments</h1>
          <p className="text-muted-foreground text-sm font-light mt-1">
            Track and manage your transactions
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-muted/50"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spent</p>
            <p className="text-2xl font-light mt-1">{formatCurrency(metrics.successfulTotal)}</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-2xl bg-muted/50"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-light mt-1 text-amber-500">{formatCurrency(metrics.pendingTotal)}</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-muted/50"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-light mt-1">{metrics.successfulCount}</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-2xl bg-muted/50"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-2xl font-light mt-1">{metrics.totalCount}</p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Icon 
              icon="solar:magnifer-bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search payments..."
              className="w-full pl-9 pr-4 py-2 bg-muted/50 rounded-xl text-sm outline-none transition-colors focus:bg-muted placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Period Filter */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
            {[
              { value: 'all', label: 'All' },
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === period.value
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedStatus === status
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === 'all' ? 'All' : status}
                <span className="ml-1 text-muted-foreground/60">
                  ({status === 'all' ? payments.length : payments.filter(p => p.status === status).length})
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={fetchPayments}
            className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <Icon icon="solar:danger-triangle-bold" className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={fetchPayments}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:card-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">
              {searchTerm || selectedStatus !== 'all' || selectedPeriod !== 'all' 
                ? 'No matching payments found'
                : 'No payments yet'}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {searchTerm || selectedStatus !== 'all' || selectedPeriod !== 'all'
                ? 'Try adjusting your filters'
                : 'Transactions will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPayments).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {date}
                </p>
                <div className="space-y-1">
                  {items.map((payment, index) => (
                    <motion.div
                      key={payment.uuid}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => openDetailModal(payment)}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      {/* Status Icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getStatusBgColor(payment.status || '')}`}>
                        <Icon 
                          icon={getStatusIcon(payment.status || '')} 
                          className={`w-4 h-4 ${getStatusColor(payment.status || '')}`} 
                        />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {payment.reference || `Payment #${payment.uuid.slice(-8)}`}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(payment.paid_at || payment.created_at || '')}
                          </span>
                          {payment.transaction_id && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground/60 font-mono">
                                {payment.transaction_id.slice(0, 8)}...
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Amount & Status */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {payment.amount ? formatCurrency(parseFloat(payment.amount)) : "—"}
                        </p>
                        {payment.status && (
                          <span className={`text-xs font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        )}
                      </div>
                      
                      <Icon 
                        icon="solar:arrow-right-bold" 
                        className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" 
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal - Apple Style */}
      <AnimatePresence>
        {showDetailModal && selectedPayment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowDetailModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-light">Payment Details</h3>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-5 h-5" />
                  </button>
                </div>

                {/* Amount */}
                <div className="text-center py-4 mb-6 bg-muted/30 rounded-2xl">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
                  <p className="text-3xl font-light mt-1">
                    {selectedPayment.amount ? formatCurrency(parseFloat(selectedPayment.amount)) : "—"}
                  </p>
                  {selectedPayment.status && (
                    <span className={`inline-block mt-2 text-xs font-medium ${getStatusColor(selectedPayment.status)}`}>
                      {selectedPayment.status}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono font-light">{selectedPayment.reference || "—"}</span>
                  </div>

                  {selectedPayment.transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID</span>
                      <span className="font-mono font-light text-xs">{selectedPayment.transaction_id}</span>
                    </div>
                  )}

                  {selectedPayment.escrow_uuid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrow</span>
                      <span className="font-mono font-light text-xs">{selectedPayment.escrow_uuid.slice(0, 8)}...</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-light">
                      {formatDateTime(selectedPayment.paid_at || selectedPayment.created_at || '')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="font-mono font-light text-xs">{selectedPayment.uuid.slice(0, 12)}...</span>
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full mt-6 py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}