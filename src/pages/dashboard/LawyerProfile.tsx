import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { LawyerAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils";

const SPECIALTIES = [
  "Property Conveyancing", 
  "Land Law", 
  "Real Estate Contracts", 
  "Title Searches", 
  "Mortgage Law", 
  "Commercial Real Estate",
  "Property Disputes",
  "Lease Agreements",
  "Property Development",
  "Real Estate Litigation"
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

interface LawyerProfileData {
  id?: number;
  user_uuid?: string;
  name?: string;
  email?: string;
  phone?: string;
  license_number?: string;
  bar_certificate_url?: string;
  years_experience?: number;
  specialization?: string;
  jurisdiction_states?: string[];
  rating?: number;
  completed_cases?: number;
  total_cases?: number;
  is_approved?: number;
  is_verified?: number;
  bio?: string;
  created_at?: string;
  approved_at?: string;
}

export default function LawyerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LawyerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    license_number: "",
    years_experience: "",
    specialization: "",
    jurisdiction_states: [] as string[],
    bio: "",
  });
  const [barCertificate, setBarCertificate] = useState<File | null>(null);
  const [barCertificatePreview, setBarCertificatePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError(null);
    try {
      const response = await LawyerAPI.getProfile();
      const data = response.data;
      setProfile(data);
      
      if (data) {
        setForm({
          license_number: data.license_number ?? "",
          years_experience: String(data.years_experience ?? ""),
          specialization: data.specialization ?? "",
          jurisdiction_states: data.jurisdiction_states ?? [],
          bio: data.bio ?? "",
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 404) {
          setProfile(null);
        } else {
          toast.error(error.getDisplayMessage());
          setError(error.message);
        }
      } else {
        toast.error("Failed to load lawyer profile");
        setError("Failed to load lawyer profile");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleState(state: string) {
    setForm(f => ({
      ...f,
      jurisdiction_states: f.jurisdiction_states.includes(state)
        ? f.jurisdiction_states.filter(s => s !== state)
        : [...f.jurisdiction_states, state],
    }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setBarCertificate(file);
    
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBarCertificatePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setBarCertificatePreview(null);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!form.license_number.trim()) {
      toast.error("License number is required");
      return;
    }
    if (!form.years_experience || parseInt(form.years_experience) < 0) {
      toast.error("Valid years of experience is required");
      return;
    }
    if (!form.specialization) {
      toast.error("Please select a specialization");
      return;
    }
    if (form.jurisdiction_states.length === 0) {
      toast.error("Please select at least one jurisdiction state");
      return;
    }
    if (!barCertificate && !profile?.bar_certificate_url) {
      toast.error("Please upload your bar certificate");
      return;
    }

    setSubmitting(true);
    try {
      let barCertificateBase64: string | undefined;
      
      if (barCertificate) {
        if (barCertificate.size > 5 * 1024 * 1024) {
          toast.error("File is too large. Maximum size is 5MB");
          setSubmitting(false);
          return;
        }
        barCertificateBase64 = await fileToBase64(barCertificate);
      }

      const data = {
        license_number: form.license_number,
        years_experience: parseInt(form.years_experience),
        specialization: form.specialization,
        jurisdiction_states: form.jurisdiction_states,
        bio: form.bio || undefined,
        bar_certificate: barCertificateBase64,
      };

      await LawyerAPI.register(data);
      
      toast.success(
        profile 
          ? "Lawyer profile updated successfully!" 
          : "Lawyer registration submitted! Awaiting admin approval."
      );
      
      await fetchProfile();
      setBarCertificate(null);
      setBarCertificatePreview(null);
      
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to save lawyer profile");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isRegistered = !!profile?.license_number;
  const isApproved = profile?.is_approved === 1;
  const isVerified = profile?.is_verified === 1;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light tracking-tight">Lawyer Profile</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            {isRegistered 
              ? "Manage your professional profile" 
              : "Register as a lawyer to get discovered by clients"}
          </p>
        </div>

        {/* Profile Status Card */}
        {isRegistered && profile && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-muted/30 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profile Status</h3>
              <div className="flex items-center gap-2">
                {isVerified && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                    Verified
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isApproved 
                    ? "bg-emerald-500/10 text-emerald-500" 
                    : "bg-amber-500/10 text-amber-500"
                }`}>
                  {isApproved ? "Approved" : "Pending"}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground/60">Rating</p>
                <p className="font-medium flex items-center gap-1">
                  <Icon icon="solar:star-bold" className="w-3.5 h-3.5 text-amber-500" />
                  {profile.rating ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/60">Completed</p>
                <p className="font-medium">{profile.completed_cases ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/60">Total Cases</p>
                <p className="font-medium">{profile.total_cases ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/60">Experience</p>
                <p className="font-medium">{profile.years_experience}y</p>
              </div>
            </div>

            {/* License */}
            <div>
              <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">License</p>
              <p className="font-medium text-sm">{profile.license_number}</p>
            </div>

            {/* Jurisdictions */}
            {profile.jurisdiction_states && profile.jurisdiction_states.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1.5">Jurisdictions</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.jurisdiction_states.map(s => (
                    <span key={s} className="px-2.5 py-0.5 rounded-lg bg-primary/5 text-primary text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Specialization */}
            {profile.specialization && (
              <div>
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Specialization</p>
                <p className="font-medium text-sm">{profile.specialization}</p>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div>
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Bio</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Created At */}
            {profile.created_at && (
              <p className="text-xs text-muted-foreground/60">
                Registered {formatDate(profile.created_at)}
              </p>
            )}
          </motion.div>
        )}

        {/* Registration/Update Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-muted/30 space-y-4"
          >
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {isRegistered ? "Update Details" : "Professional Details"}
            </h3>

            {/* License Number */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                License Number <span className="text-red-500">*</span>
              </label>
              <input
                value={form.license_number}
                onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                placeholder="e.g. L-2024-001"
                className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>

            {/* Years Experience */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Years of Experience <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.years_experience}
                onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))}
                placeholder="e.g. 8"
                min="0"
                className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>

            {/* Specialization */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Specialization <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SPECIALTIES.map(s => (
                  <button 
                    key={s} 
                    type="button" 
                    onClick={() => setForm(f => ({ ...f, specialization: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      form.specialization === s 
                        ? "bg-foreground text-background" 
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Jurisdiction States */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Jurisdiction States <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {NIGERIAN_STATES.map(s => (
                  <button 
                    key={s} 
                    type="button" 
                    onClick={() => toggleState(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      form.jurisdiction_states.includes(s) 
                        ? "bg-foreground text-background" 
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {form.jurisdiction_states.length === 0 && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Select at least one state where you practice
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Brief description of your practice and experience..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-colors resize-none"
              />
            </div>

            {/* Bar Certificate Upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Bar Certificate {!profile?.bar_certificate_url && <span className="text-red-500">*</span>}
              </label>
              {profile?.bar_certificate_url && !barCertificate && (
                <div className="mb-2 p-3 rounded-xl bg-emerald-500/5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Certificate uploaded</p>
                    <p className="text-xs text-emerald-500/70">Upload a new file to replace it</p>
                  </div>
                </div>
              )}
              <label 
                className={`block w-full rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  barCertificate 
                    ? "bg-primary/5 ring-2 ring-primary" 
                    : "bg-background hover:bg-muted/30"
                }`}
              >
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                />
                {barCertificate ? (
                  <div>
                    {barCertificatePreview && barCertificate.type.startsWith('image/') ? (
                      <img src={barCertificatePreview} alt="Certificate" className="max-h-20 mx-auto mb-2 rounded-lg object-contain" />
                    ) : (
                      <Icon icon="solar:document-bold" className="w-6 h-6 text-primary mx-auto mb-2" />
                    )}
                    <p className="text-sm font-medium">{barCertificate.name}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {(barCertificate.size / 1024 / 1024).toFixed(2)} MB • Click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                      <Icon icon="solar:upload-bold" className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Click to upload bar certificate</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">PDF, JPG or PNG, max 5MB</p>
                  </div>
                )}
              </label>
            </div>
          </motion.div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
          >
            {submitting && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
            {submitting 
              ? "Saving..." 
              : isRegistered 
                ? "Update Profile" 
                : "Submit for Approval"
            }
          </button>

          {/* Info Text */}
          <p className="text-xs text-center text-muted-foreground/60">
            <Icon icon="solar:shield-check-bold" className="w-3 h-3 inline mr-1" />
            Your information will be reviewed by our team. Approval may take 1-2 business days.
          </p>
        </form>
      </div>
    </DashboardLayout>
  );
}