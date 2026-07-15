import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { KYCAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { id: "government_id", label: "Government ID", icon: "solar:card-bold", desc: "National ID, Voters Card, or International Passport" },
  { id: "utility_bill", label: "Utility Bill", icon: "solar:map-point-bold", desc: "Recent electricity, water, or gas bill" },
];

const docStatusColors: Record<string, string> = {
  pending: "text-amber-500",
  approved: "text-emerald-500",
  rejected: "text-red-500",
};

const docStatusBgColors: Record<string, string> = {
  pending: "bg-amber-500/10",
  approved: "bg-emerald-500/10",
  rejected: "bg-red-500/10",
};

const docStatusIcons: Record<string, string> = {
  pending: "solar:clock-circle-bold",
  approved: "solar:check-circle-bold",
  rejected: "solar:close-circle-bold",
};

interface KYCDocument {
  document_type: string;
  document_url?: string;
  status?: string;
  admin_comment?: string | null;
  created_at?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function KYC() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("government_id");
  const [docNumber, setDocNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  async function fetchKYCStatus() {
    setLoading(true);
    setError(null);
    try {
      const response = await KYCAPI.getStatus();
      setDocuments(response.data.documents || []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load KYC status");
        setError("Failed to load KYC status");
      }
    } finally {
      setLoading(false);
    }
  }

  const submittedTypes = new Set(documents.map(d => d.document_type));
  const allApproved = documents.length > 0 && documents.every(d => d.status === "approved");
  const hasPending = documents.some(d => d.status === "pending");
  const hasRejected = documents.some(d => d.status === "rejected");
  const isFullyVerified = user?.email_verified && allApproved;

  async function handleSubmit() {
    if (!file) {
      toast.error("Please select a document to upload");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB");
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPG, PNG, GIF, WEBP, or PDF");
      return;
    }

    setSubmitting(true);
    try {
      const base64 = await fileToBase64(file);
      
      await KYCAPI.submit({
        document_type: selectedType,
        document: base64,
        document_number: docNumber || undefined,
      });

      toast.success("Document submitted for review successfully!");
      setFile(null);
      setPreviewUrl(null);
      setDocNumber("");
      if (fileRef.current) fileRef.current.value = "";
      
      await fetchKYCStatus();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to submit document");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl(null);
      }
    } else {
      setPreviewUrl(null);
    }
  }

  function getDocumentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
    };
    return labels[status] || status;
  }

  function isDocumentTypeDisabled(type: string): boolean {
    const doc = documents.find(d => d.document_type === type);
    return !!doc && doc.status !== 'rejected';
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight">Identity Verification</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Verify your identity to unlock all platform features
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Fully Verified Badge */}
            {isFullyVerified && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-2xl bg-emerald-500/5 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-light text-emerald-600">Verification Complete</h2>
                <p className="text-sm text-emerald-600/70 mt-1">
                  Your identity has been verified successfully.
                </p>
              </motion.div>
            )}

            {/* Pending Status */}
            {hasPending && !allApproved && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-amber-500/5 flex items-start gap-3"
              >
                <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-amber-600">Documents Under Review</p>
                  <p className="text-sm text-amber-600/70">
                    This usually takes 1–2 business days.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Rejected Status */}
            {hasRejected && !allApproved && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-500/5 flex items-start gap-3"
              >
                <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-red-600">Some Documents Rejected</p>
                  <p className="text-sm text-red-600/70">
                    Please check the comments below and resubmit.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Submitted Documents List */}
            {documents.length > 0 && (
              <div className="space-y-3 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Submitted Documents</h3>
                  <span className="text-xs text-muted-foreground">
                    {documents.filter(d => d.status === 'approved').length}/{documents.length} verified
                  </span>
                </div>
                {documents.map((doc) => (
                  <motion.div 
                    key={doc.document_type}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${docStatusBgColors[doc.status || 'pending'] || 'bg-muted/50'}`}>
                      <Icon 
                        icon={docStatusIcons[doc.status || 'pending'] || 'solar:document-bold'} 
                        className={`w-4 h-4 ${docStatusColors[doc.status || 'pending'] || 'text-muted-foreground'}`} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                      {doc.admin_comment && (
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.admin_comment}</p>
                      )}
                      {doc.created_at && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {formatDate(doc.created_at)}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${docStatusColors[doc.status || 'pending'] || 'text-muted-foreground'}`}>
                      {getDocumentStatusLabel(doc.status || 'pending')}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Submit Form - Only show if not fully verified */}
            {!allApproved && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-5"
              >
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Submit a Document</h3>

                {/* Document Type Selection */}
                <div className="space-y-2">
                  {DOCUMENT_TYPES.map((dt) => {
                    const isDisabled = isDocumentTypeDisabled(dt.id);
                    const existingDoc = documents.find(d => d.document_type === dt.id);
                    const isRejected = existingDoc?.status === 'rejected';
                    
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        onClick={() => !isDisabled && setSelectedType(dt.id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left ${
                          selectedType === dt.id && !isDisabled
                            ? "bg-primary/5 ring-2 ring-primary"
                            : isRejected
                            ? "bg-red-500/5"
                            : "bg-muted/30 hover:bg-muted/50"
                        } ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <Icon 
                          icon={dt.icon} 
                          className={`w-5 h-5 ${selectedType === dt.id && !isDisabled ? "text-primary" : "text-muted-foreground"}`} 
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{dt.label}</p>
                          <p className="text-xs text-muted-foreground">{dt.desc}</p>
                        </div>
                        {existingDoc?.status === 'approved' && (
                          <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-emerald-500" />
                        )}
                        {existingDoc?.status === 'rejected' && (
                          <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-500" />
                        )}
                        {existingDoc?.status === 'pending' && (
                          <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Document Number */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Document Number</label>
                  <div className="relative">
                    <Icon icon="solar:card-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={docNumber}
                      onChange={e => setDocNumber(e.target.value)}
                      placeholder="e.g. A01234567"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Upload Document</label>
                  <label 
                    className={`block w-full rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      file 
                        ? "bg-primary/5 ring-2 ring-primary" 
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <input 
                      ref={fileRef} 
                      type="file" 
                      className="hidden" 
                      accept="image/*,.pdf"
                      onChange={handleFileSelect} 
                    />
                    {file ? (
                      <div>
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" className="max-h-32 mx-auto mb-2 rounded-lg object-contain" />
                        ) : (
                          <Icon icon="solar:document-bold" className="w-8 h-8 text-primary mx-auto mb-2" />
                        )}
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <Icon icon="solar:upload-bold" className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          JPG, PNG, GIF, WEBP or PDF, max 5MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Submit Button */}
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting || !file}
                  className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                >
                  {submitting && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>

                {/* Info Text */}
                <p className="text-xs text-center text-muted-foreground/60">
                  <Icon icon="solar:shield-check-bold" className="w-3 h-3 inline mr-1" />
                  Your documents are securely encrypted and only used for verification purposes.
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}