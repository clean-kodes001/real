import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { TableRowSkeleton } from "@/components/shared/SkeletonCard";
import { PaymentAPI, EscrowAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/utils";

const statusColors: Record<string, string> = {
  success: "bg-green-500/10 text-green-600",
  successful: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  failed: "bg-red-500/10 text-red-600",
  refunded: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
  disputed: "bg-red-500/10 text-red-600",
  under_review: "bg-blue-500/10 text-blue-600",
  buyer_funded: "bg-blue-500/10 text-blue-600",
  seller_confirmed: "bg-purple-500/10 text-purple-600",
  lawyer_approved: "bg-indigo-500/10 text-indigo-600",
};

const statusIcons: Record<string, string> = {
  success: "solar:check-circle-bold",
  successful: "solar:check-circle-bold",
  pending: "solar:clock-circle-bold",
  failed: "solar:close-circle-bold",
  refunded: "solar:arrow-left-bold",
  completed: "solar:check-circle-bold",
  cancelled: "solar:close-circle-bold",
  disputed: "solar:danger-triangle-bold",
  under_review: "solar:eye-bold",
  buyer_funded: "solar:card-bold",
  seller_confirmed: "solar:check-circle-bold",
  lawyer_approved: "solar:shield-check-bold",
};

interface Transaction {
  uuid: string;
  type: 'payment' | 'escrow';
  reference?: string;
  amount: number;
  status: string;
  user_name?: string;
  user_email?: string;
  created_at: string;
  updated_at?: string;
  description?: string;
  property_title?: string;
  payment_reference?: string;
}

export default function AdminTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    volume: 0,
    success: 0,
    pending: 0,
    failed: 0,
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
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    setError(null);
    try {
      // Fetch both payments and escrows to get full transaction history
      const [paymentsRes, escrowsRes] = await Promise.all([
        PaymentAPI.history(1),
        EscrowAPI.list(1),
      ]);

      // Map payments to transactions
      const paymentTransactions: Transaction[] = (paymentsRes.data.payments || []).map((p: any) => ({
        uuid: p.uuid,
        type: 'payment',
        reference: p.reference,
        amount: parseFloat(p.amount || 0),
        status: p.status || 'pending',
        created_at: p.paid_at || p.created_at,
        description: `Payment ${p.reference}`,
      }));

      // Map escrows to transactions
      const escrowTransactions: Transaction[] = (escrowsRes.data.escrows || []).map((e: any) => ({
        uuid: e.uuid,
        type: 'escrow',
        reference: e.payment_reference || e.uuid,
        amount: parseFloat(e.total_amount || e.amount || 0),
        status: e.status || 'pending',
        created_at: e.created_at,
        description: `Escrow: ${e.property_title || 'Property'}`,
        property_title: e.property_title,
        payment_reference: e.payment_reference,
      }));

      // Combine and sort by date (newest first)
      const allTransactions = [...paymentTransactions, ...escrowTransactions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTransactions);

      // Calculate stats
      const total = allTransactions.length;
      const volume = allTransactions.reduce((sum, t) => sum + (t.status === 'success' || t.status === 'successful' || t.status === 'completed' ? t.amount : 0), 0);
      const success = allTransactions.filter(t => t.status === 'success' || t.status === 'successful' || t.status === 'completed').length;
      const pending = allTransactions.filter(t => t.status === 'pending' || t.status === 'under_review').length;
      const failed = allTransactions.filter(t => t.status === 'failed' || t.status === 'cancelled').length;

      setStats({
        total,
        volume,
        success,
        pending,
        failed,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load transactions");
        setError("Failed to load transactions");
      }
    } finally {
      setLoading(false);
    }
  }

  // Get unique statuses for filter
  const statuses = ['all', ...new Set(transactions.map(t => t.status))];

  // Filter transactions
  const filteredTransactions = transactions
    .filter(t => filter === 'all' ? true : t.status === filter)
    .filter(t => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        t.reference?.toLowerCase().includes(search) ||
        t.uuid.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search) ||
        t.user_name?.toLowerCase().includes(search) ||
        t.user_email?.toLowerCase().includes(search)
      );
    });

  const getStatusCount = (status: string) => {
    if (status === 'all') return transactions.length;
    return transactions.filter(t => t.status === status).length;
  };

  function openDetailModal(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  }

  function getStatusIcon(status: string): string {
    return statusIcons[status] || "solar:document-bold";
  }

  function getStatusColor(status: string): string {
    return statusColors[status] || "bg-muted text-muted-foreground";
  }

  function getTypeLabel(type: string): string {
    return type === 'payment' ? 'Payment' : 'Escrow';
  }

  function getTypeColor(type: string): string {
    return type === 'payment' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600';
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Transactions</h1>
            <p className="text-muted-foreground text-sm">
              {stats.total} total transactions • {formatCurrency(stats.volume)} volume
            </p>
          </div>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Summary */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-muted">
              <Icon icon="solar:transfer-horizontal-bold" className="w-5 h-5 text-primary mb-2" />
              <p className="text-xl font-bold">{formatCurrency(stats.volume)}</p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </div>
            <div className="p-5 rounded-2xl bg-green-500/10">
              <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-xl font-bold text-green-600">{stats.success}</p>
              <p className="text-xs text-muted-foreground">Successful</p>
            </div>
            <div className="p-5 rounded-2xl bg-yellow-500/10">
              <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-yellow-500 mb-2" />
              <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-5 rounded-2xl bg-red-500/10">
              <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-500 mb-2" />
              <p className="text-xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && transactions.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by reference, description, or user..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>
        )}

        {/* Status Filter */}
        {!loading && transactions.length > 0 && (
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
              onClick={fetchTransactions}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="rounded-2xl bg-muted overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Transaction</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
              </tbody>
            </table>
          </div>
        ) : filteredTransactions.length === 0 ? (
          // Empty State
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:card-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {searchTerm || filter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Transactions will appear here when users make payments'}
            </p>
            {(searchTerm || filter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilter("all");
                }}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Transactions Table
          <div className="rounded-2xl bg-muted overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Transaction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t, i) => (
                    <motion.tr 
                      key={t.uuid} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(t)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-xs truncate max-w-[150px]">
                            {t.reference || t.uuid.slice(0, 12)}
                          </p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTypeColor(t.type)}`}>
                          {getTypeLabel(t.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {formatDateTime(t.created_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm">
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(t.status)}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Transaction Details</h3>
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
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-mono">{selectedTransaction.reference || selectedTransaction.uuid.slice(0, 12)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getTypeColor(selectedTransaction.type)}`}>
                    {getTypeLabel(selectedTransaction.type)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedTransaction.status)}`}>
                    {selectedTransaction.status.replace('_', ' ')}
                  </span>
                </div>

                {selectedTransaction.description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="text-sm">{selectedTransaction.description}</span>
                  </div>
                )}

                {selectedTransaction.property_title && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Property</span>
                    <span className="text-sm">{selectedTransaction.property_title}</span>
                  </div>
                )}

                {selectedTransaction.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Payment Ref</span>
                    <span className="text-sm font-mono">{selectedTransaction.payment_reference}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">{formatDateTime(selectedTransaction.created_at)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-sm font-mono">{selectedTransaction.uuid.slice(0, 12)}...</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}