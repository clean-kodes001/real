import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ListItemSkeleton } from "@/components/shared/SkeletonCard";
import { DisputeAPI, EscrowAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatCurrency } from "@/lib/utils";

const statusColors: Record<string, string> = {
  open: "text-amber-500",
  resolved: "text-emerald-500",
};

const statusBgColors: Record<string, string> = {
  open: "bg-amber-500/10",
  resolved: "bg-emerald-500/10",
};

const actionColors: Record<string, string> = {
  refund_buyer: "text-blue-500",
  release_seller: "text-emerald-500",
  partial_refund: "text-purple-500",
  cancel_transaction: "text-red-500",
};

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
  escrow: {
    uuid: string;
    amount: number;
    total_amount: number;
    status: string;
    funded_at: string;
    created_at: string;
  };
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light tracking-tight">Disputes</h1>
              <p className="text-sm text-muted-foreground font-light mt-1">
                {isAdmin ? "Review and manage all disputes" : "Manage and track your disputes"}
              </p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <button 
                  onClick={fetchData}
                  className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Icon icon="solar:refresh-bold" className="w-4 h-4" />
                </button>
              )}
              {!isAdmin && (
                <button 
                  onClick={() => setShowForm(s => !s)}
                  className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                >
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4" /> 
                  New Dispute
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Create Dispute Form */}
        <AnimatePresence>
          {showForm && !isAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 rounded-2xl bg-muted/30 mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">File a Dispute</h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEvidenceFiles([]);
                    setEvidencePreviews([]);
                  }}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Icon icon="solar:close-bold" className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Escrow <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.escrow_uuid}
                    onChange={e => setForm(f => ({ ...f, escrow_uuid: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors"
                  >
                    <option value="">Select an escrow</option>
                    {escrows.map((escrow) => (
                      <option key={escrow.uuid} value={escrow.uuid}>
                        {escrow.property_title} - {formatCurrency(escrow.total_amount)} ({escrow.status})
                      </option>
                    ))}
                  </select>
                  {escrows.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      No escrows available. You need an active escrow to file a dispute.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Against User ID <span className="text-red-500">*</span>
                  </label>
                  <input 
                    value={form.against_uuid} 
                    onChange={e => setForm(f => ({ ...f, against_uuid: e.target.value }))}
                    placeholder="Enter the user UUID"
                    className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input 
                    value={form.title} 
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief title for the dispute"
                    className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    value={form.description} 
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detailed description of the dispute..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors resize-none" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Evidence</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="w-full flex flex-col items-center justify-center px-4 py-4 rounded-xl bg-background hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                        <Icon icon="solar:upload-bold" className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Click to upload</span> evidence
                      </p>
                      <p className="text-xs text-muted-foreground/60">PNG, JPG, PDF (max 5MB each)</p>
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
                        <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted/30">
                          {preview.startsWith('data:image') ? (
                            <img src={preview} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/30">
                              <Icon icon="solar:document-bold" className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEvidence(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            <Icon icon="solar:close-bold" className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-2">
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
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                  >
                    {submitting && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                    {submitting ? "Submitting..." : "Submit Dispute"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:shield-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">No disputes</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {isAdmin ? "No disputes to review" : "All your transactions are running smoothly"}
            </p>
            {!isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
              >
                File a Dispute
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {disputes.map((d, i) => (
              <motion.div 
                key={d.uuid} 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group"
              >
                <div 
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => openDetailModal(d)}
                >
                  <div className={`w-9 h-9 rounded-full ${statusBgColors[d.status] || 'bg-muted/30'} flex items-center justify-center shrink-0`}>
                    <Icon icon="solar:shield-warning-bold" className={`w-4 h-4 ${statusColors[d.status] || 'text-muted-foreground'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <span>{d.property?.title || 'Unknown Property'}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                      <span>{formatDate(d.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <span>By: {d.raised_by?.name || 'Unknown'}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                      <span>Against: {d.against?.name || 'Unknown'}</span>
                    </div>
                    {d.escrow?.total_amount && (
                      <p className="text-xs text-muted-foreground/60">
                        {formatCurrency(d.escrow.total_amount)}
                      </p>
                    )}
                    {d.resolution && (
                      <p className="text-xs text-emerald-500 mt-0.5">{d.resolution}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {d.status && (
                      <span className={`text-xs font-medium capitalize ${statusColors[d.status] || ''}`}>
                        {d.status}
                      </span>
                    )}
                    
                    {isAdmin && d.status === 'open' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openResolveModal(d);
                        }}
                        className="px-3 py-1 bg-foreground text-background rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                      >
                        Resolve
                      </button>
                    )}
                    
                    <Icon 
                      icon="solar:arrow-right-bold" 
                      className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" 
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Detail Modal - Apple Style */}
      <AnimatePresence>
        {showDetailModal && viewingDispute && (
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
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-2xl mx-auto z-50 max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${statusBgColors[viewingDispute.status] || 'bg-muted/30'} flex items-center justify-center`}>
                      <Icon icon="solar:shield-warning-bold" className={`w-5 h-5 ${statusColors[viewingDispute.status] || 'text-muted-foreground'}`} />
                    </div>
                    <h3 className="text-lg font-light">{viewingDispute.title}</h3>
                  </div>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/60">Status:</span>
                    <span className={`text-sm font-medium capitalize ${statusColors[viewingDispute.status] || ''}`}>
                      {viewingDispute.status}
                    </span>
                  </div>

                  {/* Property Info */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Property</p>
                    <p className="font-medium">{viewingDispute.property?.title || 'Unknown Property'}</p>
                    {viewingDispute.property?.address && (
                      <p className="text-sm text-muted-foreground/60">
                        {viewingDispute.property.address}, {viewingDispute.property.city}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {viewingDispute.property?.type && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background capitalize">
                          {viewingDispute.property.type.replace('_', ' ')}
                        </span>
                      )}
                      {viewingDispute.property?.price > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background">
                          {formatCurrency(viewingDispute.property.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Raised By</p>
                      <p className="font-medium text-sm">{viewingDispute.raised_by?.name}</p>
                      <p className="text-xs text-muted-foreground/60">{viewingDispute.raised_by?.email}</p>
                      <p className="text-xs text-muted-foreground/60 capitalize">{viewingDispute.raised_by?.role}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Against</p>
                      <p className="font-medium text-sm">{viewingDispute.against?.name}</p>
                      <p className="text-xs text-muted-foreground/60">{viewingDispute.against?.email}</p>
                      <p className="text-xs text-muted-foreground/60 capitalize">{viewingDispute.against?.role}</p>
                    </div>
                  </div>

                  {/* All Parties */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">All Parties</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground/60">Buyer</p>
                        <p className="font-medium">{viewingDispute.parties?.buyer?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60">Seller</p>
                        <p className="font-medium">{viewingDispute.parties?.seller?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60">Lawyer</p>
                        <p className="font-medium">{viewingDispute.parties?.lawyer?.name || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Escrow Info */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Escrow</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground/60">Amount</p>
                        <p className="font-medium">{formatCurrency(viewingDispute.escrow?.total_amount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/60">Status</p>
                        <p className="font-medium capitalize">{viewingDispute.escrow?.status || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                    <p className="text-sm leading-relaxed p-3 rounded-xl bg-muted/30">{viewingDispute.description}</p>
                  </div>

                  {/* Evidence */}
                  {viewingDispute.evidence_urls && viewingDispute.evidence_urls.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Evidence</p>
                      <div className="grid grid-cols-3 gap-2">
                        {viewingDispute.evidence_urls.map((url, index) => (
                          <a 
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded-xl overflow-hidden bg-muted/30 hover:opacity-80 transition-opacity"
                          >
                            {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon icon="solar:document-bold" className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {viewingDispute.resolution && (
                    <div className="p-3 rounded-xl bg-emerald-500/5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolution</p>
                      <p className="text-sm text-emerald-600 mt-1">{viewingDispute.resolution}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground/60">
                    <div>
                      <p>Created</p>
                      <p className="font-medium text-foreground">{formatDate(viewingDispute.created_at)}</p>
                    </div>
                    {viewingDispute.updated_at && viewingDispute.updated_at !== viewingDispute.created_at && (
                      <div>
                        <p>Updated</p>
                        <p className="font-medium text-foreground">{formatDate(viewingDispute.updated_at)}</p>
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
                      className="w-full py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      Resolve This Dispute
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Resolve Dispute Modal - Admin Only */}
      <AnimatePresence>
        {showResolveModal && selectedDispute && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowResolveModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-light">Resolve Dispute</h3>
                  <button 
                    onClick={() => setShowResolveModal(false)}
                    className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Dispute Preview */}
                <div className="mb-4 p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground/60">Property</p>
                  <p className="font-medium text-sm">{selectedDispute.property?.title || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {formatCurrency(selectedDispute.escrow?.total_amount || 0)}
                  </p>
                </div>

                <form onSubmit={handleResolve} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Resolution <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={resolveForm.resolution}
                      onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))}
                      placeholder="Describe the resolution..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Action <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={resolveForm.action}
                      onChange={e => setResolveForm(f => ({ ...f, action: e.target.value as any }))}
                      className="w-full px-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
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
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={resolving === selectedDispute.uuid}
                      className="flex-1 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                    >
                      {resolving === selectedDispute.uuid && (
                        <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                      )}
                      {resolving === selectedDispute.uuid ? "Resolving..." : "Resolve"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}