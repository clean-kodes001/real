import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { TableRowSkeleton } from "@/components/shared/SkeletonCard";
import { DisputeAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatCurrency } from "@/lib/utils";

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-green-500/10 text-green-600",
};

const statusIcons: Record<string, string> = {
  open: "solar:clock-circle-bold",
  resolved: "solar:check-circle-bold",
};

interface Dispute {
  uuid: string;
  escrow_uuid: string;
  raised_by_uuid: string;
  against_uuid: string;
  title: string;
  description: string;
  evidence_urls: string[];
  status: 'open' | 'resolved';
  resolution: string;
  created_at: string;
  raised_by_name: string;
  against_name: string;
  property_title: string;
  property_uuid?: string;
  escrow_amount?: number;
}

export default function AdminDisputes() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    resolution: "",
    action: "" as 'refund_buyer' | 'release_seller' | 'partial_refund' | 'cancel_transaction' | '',
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
    fetchDisputes();
  }, []);

  async function fetchDisputes() {
    setLoading(true);
    setError(null);
    try {
      const response = await DisputeAPI.adminList('all', 1);
      setDisputes(response.data.disputes || []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load disputes");
        setError("Failed to load disputes");
      }
    } finally {
      setLoading(false);
    }
  }

  // Get unique statuses for filter
  const statuses = ['all', ...new Set(disputes.map(d => d.status))];

  // Filter disputes
  const filteredDisputes = disputes
    .filter(d => filter === 'all' ? true : d.status === filter)
    .filter(d => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        d.title.toLowerCase().includes(search) ||
        d.raised_by_name.toLowerCase().includes(search) ||
        d.against_name.toLowerCase().includes(search) ||
        d.property_title.toLowerCase().includes(search) ||
        d.uuid.toLowerCase().includes(search)
      );
    });

  // Count by status
  const getStatusCount = (status: string) => {
    if (status === 'all') return disputes.length;
    return disputes.filter(d => d.status === status).length;
  };

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    
    if (!resolveForm.resolution.trim()) {
      toast.error("Please enter a resolution");
      return;
    }
    if (!resolveForm.action) {
      toast.error("Please select an action");
      return;
    }
    if (!selectedDispute) {
      toast.error("No dispute selected");
      return;
    }

    setResolving(true);
    try {
      await DisputeAPI.adminResolve(
        selectedDispute.uuid,
        resolveForm.resolution,
        resolveForm.action as 'refund_buyer' | 'release_seller' | 'partial_refund' | 'cancel_transaction'
      );
      
      toast.success("Dispute resolved successfully!");
      setShowResolveModal(false);
      setSelectedDispute(null);
      setResolveForm({ resolution: "", action: "" });
      await fetchDisputes();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to resolve dispute");
      }
    } finally {
      setResolving(false);
    }
  }

  function openResolveModal(dispute: Dispute) {
    setSelectedDispute(dispute);
    setResolveForm({ resolution: "", action: "" });
    setShowResolveModal(true);
  }

  function openDetailModal(dispute: Dispute) {
    setSelectedDispute(dispute);
    setShowDetailModal(true);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Dispute Management</h1>
          <p className="text-muted-foreground text-sm">Review and resolve platform disputes</p>
        </div>

        {/* Stats Summary */}
        {!loading && disputes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-2xl font-bold">{disputes.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">
                {disputes.filter(d => d.status === 'open').length}
              </p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">
                {disputes.filter(d => d.status === 'resolved').length}
              </p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <p className="text-2xl font-bold text-primary">
                {Math.round((disputes.filter(d => d.status === 'resolved').length / disputes.length) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Resolution Rate</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && disputes.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, user, property..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <button
              onClick={fetchDisputes}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Status Filter */}
        {!loading && disputes.length > 0 && (
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
              onClick={fetchDisputes}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-muted overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Dispute</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Raised By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Against</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden xl:table-cell">Property</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : filteredDisputes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      {searchTerm || filter !== 'all' 
                        ? 'No matching disputes found' 
                        : 'No disputes to review'}
                    </td>
                  </tr>
                ) : (
                  filteredDisputes.map((d, i) => (
                    <motion.tr 
                      key={d.uuid} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(d)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm line-clamp-1">{d.title}</p>
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">{d.raised_by_name}</td>
                      <td className="px-4 py-3 text-sm hidden lg:table-cell">{d.against_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden xl:table-cell line-clamp-1">
                        {d.property_title}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        {formatDate(d.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[d.status] ?? ""}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {d.status === 'open' && (
                          <button
                            onClick={() => openResolveModal(d)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
                            Resolve
                          </button>
                        )}
                        {d.status === 'resolved' && (
                          <span className="text-xs text-muted-foreground">Completed</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination placeholder - can be extended */}
        {!loading && filteredDisputes.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>Showing {filteredDisputes.length} disputes</p>
          </div>
        )}
      </div>

      {/* Dispute Detail Modal */}
      {showDetailModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Dispute Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium">{selectedDispute.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedDispute.status]}`}>
                    {selectedDispute.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Property</p>
                <p className="font-medium">{selectedDispute.property_title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Raised By</p>
                  <p className="font-medium">{selectedDispute.raised_by_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Against</p>
                  <p className="font-medium">{selectedDispute.against_name}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm mt-1">{selectedDispute.description}</p>
              </div>

              {selectedDispute.evidence_urls && selectedDispute.evidence_urls.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Evidence</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDispute.evidence_urls.map((url, index) => (
                      <a 
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                      >
                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon icon="solar:document-bold" className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedDispute.resolution && (
                <div>
                  <p className="text-xs text-muted-foreground">Resolution</p>
                  <p className="text-sm text-green-600">{selectedDispute.resolution}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(selectedDispute.created_at)}</p>
              </div>

              {selectedDispute.status === 'open' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openResolveModal(selectedDispute);
                  }}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  Resolve This Dispute
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Resolve Dispute</h3>
              <button 
                onClick={() => setShowResolveModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              Resolving: <span className="font-medium text-foreground">{selectedDispute.title}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Property: {selectedDispute.property_title}
            </p>

            <form onSubmit={handleResolve} className="space-y-4">
              {/* Resolution */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Resolution <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={resolveForm.resolution}
                  onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))}
                  placeholder="Describe the resolution..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                />
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Action <span className="text-destructive">*</span>
                </label>
                <select
                  value={resolveForm.action}
                  onChange={e => setResolveForm(f => ({ ...f, action: e.target.value as any }))}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Select action</option>
                  <option value="refund_buyer">Refund Buyer</option>
                  <option value="release_seller">Release to Seller</option>
                  <option value="partial_refund">Partial Refund</option>
                  <option value="cancel_transaction">Cancel Transaction</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={resolving}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resolving && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {resolving ? "Resolving..." : "Resolve Dispute"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}