import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { DisputeAPI, EscrowAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatCurrency } from "@/lib/utils";

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-green-500/10 text-green-600",
};

const actionColors: Record<string, string> = {
  refund_buyer: "bg-blue-500/10 text-blue-600",
  release_seller: "bg-green-500/10 text-green-600",
  partial_refund: "bg-purple-500/10 text-purple-600",
  cancel_transaction: "bg-red-500/10 text-red-600",
};

// Updated Dispute interface with full details
interface Dispute {
  uuid: string;
  escrow_uuid: string;
  title: string;
  description: string;
  evidence_urls: string[];
  status: 'open' | 'resolved';
  resolution: string;
  created_at: string;
  updated_at: string;
  
  // Escrow Info
  escrow: {
    uuid: string;
    amount: number;
    total_amount: number;
    status: string;
    funded_at: string;
    created_at: string;
  };
  
  // Property Info
  property: {
    uuid: string;
    title: string;
    description: string;
    price: number;
    address: string;
    city: string;
    state: string;
    type: string;
    bedrooms: number;
    bathrooms: number;
  };
  
  // Users
  raised_by: {
    uuid: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  
  against: {
    uuid: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  
  parties: {
    buyer: { uuid: string; name: string; email: string; phone: string };
    seller: { uuid: string; name: string; email: string; phone: string };
    lawyer: { uuid: string; name: string; email: string; phone: string };
  };
}

interface Escrow {
  uuid: string;
  property_title: string;
  status: string;
  total_amount: number;
}

export default function Disputes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingDispute, setViewingDispute] = useState<Dispute | null>(null);
  const [form, setForm] = useState({
    escrow_uuid: "",
    against_uuid: "",
    title: "",
    description: "",
  });
  const [resolveForm, setResolveForm] = useState({
    resolution: "",
    action: "" as 'refund_buyer' | 'release_seller' | 'partial_refund' | 'cancel_transaction' | '',
  });
  
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const disputesPromise = isAdmin 
        ? DisputeAPI.adminList('all', 1)
        : DisputeAPI.list(1);
      
      const [disputesRes, escrowsRes] = await Promise.all([
        disputesPromise,
        EscrowAPI.list(1),
      ]);

      // Handle the new response structure
      const disputesData = disputesRes.data?.disputes || disputesRes.data || [];
      setDisputes(disputesData);
      setEscrows(escrowsRes.data?.escrows || []);
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

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  function handleEvidenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 5MB)`);
        continue;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setEvidenceFiles([...evidenceFiles, ...validFiles]);
      setEvidencePreviews([...evidencePreviews, ...validPreviews]);
    }
  }

  function removeEvidence(index: number) {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
    setEvidencePreviews(evidencePreviews.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!form.escrow_uuid.trim()) {
      toast.error("Please select an escrow");
      return;
    }
    if (!form.against_uuid.trim()) {
      toast.error("Please enter the user ID you're disputing against");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setSubmitting(true);
    try {
      const evidenceBase64 = evidenceFiles.length > 0 
        ? await Promise.all(evidenceFiles.map(fileToBase64))
        : undefined;

      await DisputeAPI.create({
        escrow_uuid: form.escrow_uuid,
        against_uuid: form.against_uuid,
        title: form.title,
        description: form.description,
        evidence: evidenceBase64,
      });
      
      toast.success("Dispute submitted successfully!");
      setShowForm(false);
      setForm({ escrow_uuid: "", against_uuid: "", title: "", description: "" });
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to submit dispute");
      }
    } finally {
      setSubmitting(false);
    }
  }

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

    setResolving(selectedDispute.uuid);
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
      await fetchData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to resolve dispute");
      }
    } finally {
      setResolving(null);
    }
  }

  function openResolveModal(dispute: Dispute) {
    setSelectedDispute(dispute);
    setResolveForm({ resolution: "", action: "" });
    setShowResolveModal(true);
  }

  function openDetailModal(dispute: Dispute) {
    setViewingDispute(dispute);
    setShowDetailModal(true);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Disputes</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAdmin ? "Review and manage all disputes" : "Manage and track your disputes"}
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button 
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted/70 transition-opacity text-sm"
              >
                <Icon icon="solar:refresh-bold" className="w-4 h-4" /> Refresh
              </button>
            )}
            {!isAdmin && (
              <button 
                onClick={() => setShowForm(s => !s)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                <Icon icon="solar:add-circle-bold" className="w-4 h-4" /> New Dispute
              </button>
            )}
          </div>
        </div>

        {/* Create Dispute Form */}
        {showForm && !isAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-muted">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">File a Dispute</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEvidenceFiles([]);
                  setEvidencePreviews([]);
                }}
                className="p-2 hover:bg-background/50 rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Escrow <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.escrow_uuid}
                  onChange={e => setForm(f => ({ ...f, escrow_uuid: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Select an escrow</option>
                  {escrows.map((escrow) => (
                    <option key={escrow.uuid} value={escrow.uuid}>
                      {escrow.property_title} - ₦{escrow.total_amount.toLocaleString()} ({escrow.status})
                    </option>
                  ))}
                </select>
                {escrows.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No escrows available. You need an active escrow to file a dispute.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Against User ID <span className="text-destructive">*</span>
                </label>
                <input 
                  value={form.against_uuid} 
                  onChange={e => setForm(f => ({ ...f, against_uuid: e.target.value }))}
                  placeholder="Enter the user UUID you're disputing against"
                  className="w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Title <span className="text-destructive">*</span>
                </label>
                <input 
                  value={form.title} 
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief title for the dispute"
                  className="w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Description <span className="text-destructive">*</span>
                </label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detailed description of the dispute..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all resize-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Evidence (Optional)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="w-full flex flex-col items-center justify-center px-4 py-4 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                    <Icon icon="solar:upload-bold" className="w-6 h-6 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">Click to upload</span> evidence files
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF (max 5MB each)</p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleEvidenceUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                
                {evidencePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {evidencePreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        {preview.startsWith('data:image') ? (
                          <img src={preview} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <Icon icon="solar:document-bold" className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeEvidence(index)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 hover:bg-destructive text-white transition-colors"
                        >
                          <Icon icon="solar:close-bold" className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {evidenceFiles.length} file{evidenceFiles.length !== 1 ? 's' : ''} selected
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    setEvidenceFiles([]);
                    setEvidencePreviews([]);
                  }}
                  className="flex-1 py-3 bg-background text-foreground font-medium rounded-xl hover:bg-muted transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {submitting && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="rounded-2xl bg-muted divide-y divide-border overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-muted">
            <Icon icon="solar:shield-bold" className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold">No disputes</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "No disputes to review" : "All your transactions are running smoothly"}
            </p>
            {!isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                File a Dispute
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-muted overflow-hidden divide-y divide-border">
            {disputes.map((d, i) => (
              <motion.div 
                key={d.uuid} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => openDetailModal(d)}
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <Icon icon="solar:shield-warning-bold" className="w-5 h-5 text-destructive" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.property?.title || 'Unknown Property'} • {formatDate(d.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Raised by: {d.raised_by?.name || 'Unknown'} • Against: {d.against?.name || 'Unknown'}
                  </p>
                  {d.escrow?.total_amount && (
                    <p className="text-xs text-muted-foreground">
                      Amount: {formatCurrency(d.escrow.total_amount)}
                    </p>
                  )}
                  {d.resolution && (
                    <p className="text-xs text-green-600 mt-1">
                      Resolution: {d.resolution}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {d.status && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[d.status] ?? ""}`}>
                      {d.status}
                    </span>
                  )}
                  
                  {isAdmin && d.status === 'open' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openResolveModal(d);
                      }}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      Resolve
                    </button>
                  )}
                  
                  <Icon icon="solar:arrow-right-bold" className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Detail Modal */}
      {showDetailModal && viewingDispute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 pb-2 border-b border-border">
              <h3 className="text-xl font-display font-bold">Dispute Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2  rounded-xl transition-colors"
                aria-label="Close"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title & Status */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium">{viewingDispute.title}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[viewingDispute.status] ?? ""}`}>
                  {viewingDispute.status}
                </span>
              </div>

              {/* Property Info */}
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground mb-2">Property Details</p>
                <p className="font-medium">{viewingDispute.property?.title || 'Unknown Property'}</p>
                {viewingDispute.property?.address && (
                  <p className="text-sm text-muted-foreground">
                    {viewingDispute.property.address}, {viewingDispute.property.city}, {viewingDispute.property.state}
                  </p>
                )}
                <div className="flex gap-4 mt-2">
                  {viewingDispute.property?.type && (
                    <span className="text-xs px-2 py-1 bg-background rounded-full capitalize">
                      {viewingDispute.property.type.replace('_', ' ')}
                    </span>
                  )}
                  {viewingDispute.property?.bedrooms > 0 && (
                    <span className="text-xs px-2 py-1 bg-background rounded-full">
                      🛏 {viewingDispute.property.bedrooms}
                    </span>
                  )}
                  {viewingDispute.property?.bathrooms > 0 && (
                    <span className="text-xs px-2 py-1 bg-background rounded-full">
                      🛁 {viewingDispute.property.bathrooms}
                    </span>
                  )}
                  {viewingDispute.property?.price > 0 && (
                    <span className="text-xs px-2 py-1 bg-background rounded-full">
                      {formatCurrency(viewingDispute.property.price)}
                    </span>
                  )}
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <p className="text-xs text-muted-foreground">Raised By</p>
                  <p className="font-medium">{viewingDispute.raised_by?.name}</p>
                  <p className="text-xs text-muted-foreground">{viewingDispute.raised_by?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">Role: {viewingDispute.raised_by?.role}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10">
                  <p className="text-xs text-muted-foreground">Against</p>
                  <p className="font-medium">{viewingDispute.against?.name}</p>
                  <p className="text-xs text-muted-foreground">{viewingDispute.against?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">Role: {viewingDispute.against?.role}</p>
                </div>
              </div>

              {/* All Parties */}
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground mb-2">All Parties</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Buyer</p>
                    <p className="font-medium">{viewingDispute.parties?.buyer?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Seller</p>
                    <p className="font-medium">{viewingDispute.parties?.seller?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lawyer</p>
                    <p className="font-medium">{viewingDispute.parties?.lawyer?.name || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Escrow Info */}
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-xs text-muted-foreground mb-2">Escrow Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(viewingDispute.escrow?.total_amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{viewingDispute.escrow?.status || 'Unknown'}</p>
                  </div>
                </div>
                {viewingDispute.escrow?.funded_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Funded: {formatDate(viewingDispute.escrow.funded_at)}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm mt-1 bg-muted p-3 rounded-xl">{viewingDispute.description}</p>
              </div>

              {/* Evidence */}
              {viewingDispute.evidence_urls && viewingDispute.evidence_urls.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Evidence</p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingDispute.evidence_urls.map((url, index) => (
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

              {/* Resolution */}
              {viewingDispute.resolution && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-muted-foreground">Resolution</p>
                  <p className="text-sm text-green-600 mt-1">{viewingDispute.resolution}</p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <p>Created</p>
                  <p className="font-medium">{formatDate(viewingDispute.created_at)}</p>
                </div>
                {viewingDispute.updated_at && viewingDispute.updated_at !== viewingDispute.created_at && (
                  <div>
                    <p>Updated</p>
                    <p className="font-medium">{formatDate(viewingDispute.updated_at)}</p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {isAdmin && viewingDispute.status === 'open' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openResolveModal(viewingDispute);
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

      {/* Resolve Dispute Modal - Admin Only */}
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
                aria-label="Close"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-3 rounded-xl bg-muted">
              <p className="text-xs text-muted-foreground">Property</p>
              <p className="font-medium">{selectedDispute.property?.title || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground mt-1">Amount: {formatCurrency(selectedDispute.escrow?.total_amount || 0)}</p>
            </div>

            <form onSubmit={handleResolve} className="space-y-4">
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

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={resolving === selectedDispute.uuid}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {resolving === selectedDispute.uuid && (
                    <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                  )}
                  {resolving === selectedDispute.uuid ? "Resolving..." : "Resolve Dispute"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}