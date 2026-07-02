import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { KYCAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, getInitials } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
};

const statusIcons: Record<string, string> = {
  pending: "solar:clock-circle-bold",
  approved: "solar:check-circle-bold",
  rejected: "solar:close-circle-bold",
};

interface KYCDocument {
  id: number;
  user_uuid: string;
  document_type: string;
  document_url: string;
  document_number: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment: string | null;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  name?: string;
  email?: string;
  phone?: string;
}

export default function AdminKYC() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<KYCDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
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
    fetchSubmissions();
  }, [filter]);

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const response = await KYCAPI.adminList(filter, 1);
      
      // Handle the response structure
      let documents = [];
      let paginationData = {};
      
      if (response && response.data) {
        // Response has a data wrapper
        documents = response.data.documents || [];
        paginationData = response.data.pagination || {};
      } else if (response && response.documents) {
        // Response is the data directly
        documents = response.documents || [];
        paginationData = response.pagination || {};
      } else {
        // Fallback - try to get documents from any property
        documents = response?.documents || [];
        paginationData = response?.pagination || {};
      }

      setSubmissions(documents);
      setPagination({
        page: paginationData.page || 1,
        limit: paginationData.limit || 20,
        total: paginationData.total || 0,
        pages: paginationData.pages || 0,
      });

      // Calculate stats from documents
      const stats = {
        pending: documents.filter((d: KYCDocument) => d.status === 'pending').length,
        approved: documents.filter((d: KYCDocument) => d.status === 'approved').length,
        rejected: documents.filter((d: KYCDocument) => d.status === 'rejected').length,
        total: documents.length,
      };
      setStats(stats);

    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load KYC submissions");
        setError("Failed to load KYC submissions");
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllStats() {
    try {
      // Fetch all submissions to get accurate stats
      const response = await KYCAPI.adminList('all', 1);
      let documents = [];
      
      if (response && response.data) {
        documents = response.data.documents || [];
      } else if (response && response.documents) {
        documents = response.documents || [];
      } else {
        documents = response?.documents || [];
      }

      const stats = {
        pending: documents.filter((d: KYCDocument) => d.status === 'pending').length,
        approved: documents.filter((d: KYCDocument) => d.status === 'approved').length,
        rejected: documents.filter((d: KYCDocument) => d.status === 'rejected').length,
        total: documents.length,
      };
      setStats(stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }

  async function handleApprove(id: number) {
    setProcessing(true);
    try {
      await KYCAPI.adminApprove(id.toString());
      toast.success("KYC document approved successfully!");
      await fetchSubmissions();
      await fetchAllStats();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to approve KYC");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(id: number) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      await KYCAPI.adminReject(id.toString(), rejectReason);
      toast.success("KYC document rejected");
      setShowRejectModal(false);
      setRejectReason("");
      await fetchSubmissions();
      await fetchAllStats();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to reject KYC");
      }
    } finally {
      setProcessing(false);
    }
  }

  function openDetailModal(doc: KYCDocument) {
    setSelectedDoc(doc);
    setShowDetailModal(true);
  }

  function openRejectModal(doc: KYCDocument) {
    setSelectedDoc(doc);
    setRejectReason("");
    setShowRejectModal(true);
  }

  // Filter submissions by search
  const filteredSubmissions = submissions.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const name = s.name || '';
    const email = s.email || '';
    return (
      name.toLowerCase().includes(search) ||
      email.toLowerCase().includes(search) ||
      s.document_type.toLowerCase().includes(search) ||
      s.document_number?.toLowerCase().includes(search)
    );
  });

  const getStatusCount = (status: string) => {
    if (status === 'all') return stats.total;
    return stats[status as keyof typeof stats] || 0;
  };

  // Build document URL
  const getDocumentUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${import.meta.VITE_APP_URL || ''}/uploads/documents/${url}`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">KYC Reviews</h1>
            <p className="text-muted-foreground text-sm">Review identity verification submissions</p>
          </div>
          <button
            onClick={fetchSubmissions}
            disabled={loading}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Icon icon="solar:refresh-bold" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Stats Summary */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-muted">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon 
              icon="solar:magnifer-bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or document type..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((status) => (
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

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchSubmissions}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
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
        ) : filteredSubmissions.length === 0 ? (
          // Empty State
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:document-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {searchTerm || filter !== 'all' ? 'No matching submissions' : 'No pending submissions'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'All KYC submissions have been reviewed'}
            </p>
            {(searchTerm || filter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilter("pending");
                }}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Submissions List
          <div className="space-y-4">
            {filteredSubmissions.map((s, i) => (
              <motion.div 
                key={s.id} 
                initial={{ opacity: 0, y: 16 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.06 }}
                className="p-5 rounded-2xl bg-muted hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => openDetailModal(s)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {getInitials(s.name || "?")}
                    </div>
                    <div>
                      <p className="font-semibold">{s.name || 'Unknown User'}</p>
                      <p className="text-xs text-muted-foreground">{s.email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.created_at ? formatDate(s.created_at) : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[s.status]}`}>
                    {s.status}
                  </span>
                </div>

                {/* Document Info */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Document Type</p>
                    <p className="font-medium capitalize">{s.document_type.replace('_', ' ')}</p>
                  </div>
                  {s.document_number && (
                    <div>
                      <p className="text-xs text-muted-foreground">Document Number</p>
                      <p className="font-medium">{s.document_number}</p>
                    </div>
                  )}
                </div>

                {/* Document Preview */}
                <div className="mb-4">
                  <a 
                    href={getDocumentUrl(s.document_url)}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 p-2 rounded-xl bg-background hover:bg-muted transition-colors text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon icon="solar:document-bold" className="w-4 h-4 text-primary" />
                    <span className="text-xs">View Document</span>
                    <Icon icon="solar:arrow-right-up-bold" className="w-3 h-3 text-muted-foreground" />
                  </a>
                </div>

                {/* Admin Comment */}
                {s.admin_comment && (
                  <div className="mb-4 p-3 rounded-xl bg-background/50">
                    <p className="text-xs text-muted-foreground">Admin Comment</p>
                    <p className="text-sm">{s.admin_comment}</p>
                  </div>
                )}

                {/* Actions */}
                {s.status === 'pending' && (
                  <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-green-500/10 text-green-600 font-semibold rounded-xl hover:bg-green-500/20 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => openRejectModal(s)}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-destructive/10 text-destructive font-semibold rounded-xl hover:bg-destructive/20 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Icon icon="solar:close-circle-bold" className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination Info */}
        {!loading && submissions.length > 0 && (
          <div className="text-center text-xs text-muted-foreground">
            Showing {submissions.length} of {pagination.total} submissions
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">KYC Document Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">User</p>
                <p className="font-medium">{selectedDoc.name || 'Unknown User'}</p>
                <p className="text-sm text-muted-foreground">{selectedDoc.email || 'No email'}</p>
                {selectedDoc.phone && (
                  <p className="text-sm text-muted-foreground">{selectedDoc.phone}</p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Document Type</p>
                <p className="font-medium capitalize">{selectedDoc.document_type.replace('_', ' ')}</p>
              </div>

              {selectedDoc.document_number && (
                <div>
                  <p className="text-xs text-muted-foreground">Document Number</p>
                  <p className="font-medium">{selectedDoc.document_number}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedDoc.status]}`}>
                  {selectedDoc.status}
                </span>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-sm">{formatDate(selectedDoc.created_at)}</p>
              </div>

              {selectedDoc.verified_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Reviewed</p>
                  <p className="text-sm">{formatDate(selectedDoc.verified_at)}</p>
                </div>
              )}

              {selectedDoc.admin_comment && (
                <div>
                  <p className="text-xs text-muted-foreground">Admin Comment</p>
                  <p className="text-sm">{selectedDoc.admin_comment}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Document</p>
                <a 
                  href={getDocumentUrl(selectedDoc.document_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                >
                  <Icon icon="solar:eye-bold" className="w-4 h-4" />
                  View Document
                </a>
              </div>

              {selectedDoc.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleApprove(selectedDoc.id);
                    }}
                    disabled={processing}
                    className="flex-1 py-2.5 bg-green-500/10 text-green-600 font-semibold rounded-xl hover:bg-green-500/20 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openRejectModal(selectedDoc);
                    }}
                    disabled={processing}
                    className="flex-1 py-2.5 bg-destructive/10 text-destructive font-semibold rounded-xl hover:bg-destructive/20 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Reject KYC</h3>
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Rejecting KYC for <span className="font-medium text-foreground">{selectedDoc.name || 'Unknown User'}</span>
            </p>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Reason for Rejection <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleReject(selectedDoc.id)}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 py-3 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {processing && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                {processing ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}