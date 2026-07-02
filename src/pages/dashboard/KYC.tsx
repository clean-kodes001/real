import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
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
  pending: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
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
  
  // Check if user is fully verified (for display)
  const isFullyVerified = user?.email_verified && allApproved;

  async function handleSubmit() {
    if (!file) {
      toast.error("Please select a document to upload");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 5MB");
      return;
    }

    // Validate file type
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
      
      // Refresh KYC status
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
      // Create preview for images
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
      approved: "Approved ✓",
      rejected: "Rejected ✗",
    };
    return labels[status] || status;
  }

  // Check if document type is already submitted and not rejected
  function isDocumentTypeDisabled(type: string): boolean {
    const doc = documents.find(d => d.document_type === type);
    return !!doc && doc.status !== 'rejected';
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Identity Verification (KYC)</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
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
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 rounded-2xl bg-green-500/10 text-center border border-green-500/20"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-green-600">Verification Complete</h2>
                <p className="text-green-600/80 text-sm mt-1">
                  Your identity has been verified successfully. You now have full access to all platform features.
                </p>
              </motion.div>
            )}

            {/* Pending Status */}
            {hasPending && !allApproved && (
              <div className="p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                <Icon icon="solar:clock-circle-bold" className="w-6 h-6 text-yellow-500 shrink-0" />
                <div>
                  <p className="font-semibold text-yellow-700">Documents Under Review</p>
                  <p className="text-yellow-600/80 text-sm">
                    Some documents are being reviewed. This usually takes 1–2 business days.
                  </p>
                </div>
              </div>
            )}

            {/* Rejected Status */}
            {hasRejected && !allApproved && (
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-red-600">Some Documents Rejected</p>
                  <p className="text-red-600/80 text-sm">
                    Please check the comments below and resubmit the rejected documents.
                  </p>
                </div>
              </div>
            )}

            {/* Submitted Documents List */}
            {documents.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center justify-between">
                  <span>Submitted Documents</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {documents.filter(d => d.status === 'approved').length}/{documents.length} verified
                  </span>
                </h3>
                {documents.map((doc) => (
                  <div key={doc.document_type} className="flex items-center gap-3 p-4 rounded-xl bg-muted">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      doc.status === 'approved' ? 'bg-green-500/10' :
                      doc.status === 'rejected' ? 'bg-red-500/10' :
                      'bg-yellow-500/10'
                    }`}>
                      <Icon 
                        icon={docStatusIcons[doc.status || 'pending'] || 'solar:document-bold'} 
                        className={`w-5 h-5 ${
                          doc.status === 'approved' ? 'text-green-500' :
                          doc.status === 'rejected' ? 'text-red-500' :
                          'text-yellow-500'
                        }`} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                      {doc.admin_comment && (
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.admin_comment}</p>
                      )}
                      {doc.created_at && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          Submitted {formatDate(doc.created_at)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${docStatusColors[doc.status || 'pending'] ?? ""}`}>
                        {getDocumentStatusLabel(doc.status || 'pending')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Form - Only show if not fully verified */}
            {!allApproved && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-6 rounded-2xl bg-muted space-y-5"
              >
                <h3 className="font-semibold">Submit a Document</h3>

                {/* Document Type Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Document Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {DOCUMENT_TYPES.map((dt) => {
                      const isDisabled = isDocumentTypeDisabled(dt.id);
                      const existingDoc = documents.find(d => d.document_type === dt.id);
                      
                      return (
                        <button
                          key={dt.id}
                          type="button"
                          onClick={() => !isDisabled && setSelectedType(dt.id)}
                          disabled={isDisabled}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            selectedType === dt.id && !isDisabled
                              ? "border-primary bg-primary/5" 
                              : "border-transparent bg-background hover:border-border"
                          } ${existingDoc?.status === 'rejected' ? 'border-red-500/30 bg-red-500/5' : ''}`}
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
                            <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-500" />
                          )}
                          {existingDoc?.status === 'rejected' && (
                            <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-red-500" />
                          )}
                          {existingDoc?.status === 'pending' && (
                            <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-yellow-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Document Number */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Document Number (optional)</label>
                  <input
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    placeholder="e.g. A01234567"
                    className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Upload Document</label>
                  <label 
                    className={`block w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      file 
                        ? "border-primary/40 bg-primary/5" 
                        : "border-border hover:border-primary/30"
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
                        <Icon icon="solar:upload-bold" className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, GIF, WEBP or PDF, max 5MB</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Submit Button */}
                <button 
                  onClick={handleSubmit} 
                  disabled={submitting || !file}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                >
                  {submitting && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>

                {/* Info Text */}
                <p className="text-xs text-center text-muted-foreground">
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