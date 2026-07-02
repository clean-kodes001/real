import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import PublicLayout from "@/components/layout/PublicLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { LawyerAPI } from "@/services/api";
import { getInitials } from "@/lib/utils";

interface Lawyer {
  user_uuid: string;
  license_number: string;
  bar_certificate_url: string;
  years_experience: number;
  specialization: string;
  jurisdiction_states: string[];
  rating: number;
  total_cases: number;
  completed_cases: number;
  is_approved: boolean;
  is_verified: boolean;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  state: string;
}

export default function Lawyers() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    fetchLawyers();
  }, [page]);

  async function fetchLawyers() {
    setLoading(true);
    setError(null);
    try {
      const response = await LawyerAPI.discover({
        page,
        limit,
        state: user?.state || undefined,
      });
      
      setLawyers(response.data.lawyers || []);
      setTotal(response.data.lawyers?.length || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load lawyers");
      toast.error("Failed to load lawyers");
    } finally {
      setLoading(false);
    }
  }

  // Filter lawyers by search
  const filteredLawyers = lawyers.filter((l) => {
    if (!search) return true;
    const name = l.name || "";
    const spec = l.specialization || "";
    return name.toLowerCase().includes(search.toLowerCase()) ||
      spec.toLowerCase().includes(search.toLowerCase());
  });

  const handleContact = (lawyer: Lawyer) => {
    if (!isAuthenticated) {
      toast.error("Please login to contact lawyers");
      navigate("/auth/login");
      return;
    }
    navigate(`/dashboard/messages?user=${lawyer.user_uuid}`);
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const stars = [];
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Icon key={i} icon="solar:star-bold" className="w-3.5 h-3.5 text-yellow-500" />);
    }
    const remaining = 5 - stars.length;
    for (let i = 0; i < remaining; i++) {
      stars.push(<Icon key={`empty-${i}`} icon="solar:star-outline" className="w-3.5 h-3.5 text-muted-foreground" />);
    }
    return stars;
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-8"
        >
          <h1 className="text-4xl font-display font-bold mb-2">Real Estate Lawyers</h1>
          <p className="text-muted-foreground">
            Connect with verified, experienced legal professionals for your property transactions
          </p>
        </motion.div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <Icon 
            icon="solar:magnifer-bold" 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lawyers by name, specialization, or location..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </div>

        {/* Error State */}
        {error ? (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchLawyers}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          // Loading Skeletons
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-6 rounded-2xl bg-muted space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredLawyers.length === 0 ? (
          // Empty State
          <div className="text-center py-20">
            <Icon icon="solar:user-rounded-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-lg">No lawyers found</p>
            <p className="text-muted-foreground text-sm mt-1">
              {search ? "Try a different search term" : "No lawyers are available in your area yet"}
            </p>
          </div>
        ) : (
          // Lawyers Grid
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredLawyers.length} {filteredLawyers.length === 1 ? 'lawyer' : 'lawyers'} 
              {search && ` matching "${search}"`}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLawyers.map((lawyer, i) => (
                <motion.div
                  key={lawyer.user_uuid || i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-2xl bg-muted hover:bg-muted/70 transition-colors border border-transparent hover:border-primary/20"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                      {getInitials(lawyer.name || "L")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{lawyer.name || "Lawyer"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lawyer.specialization || "Real Estate Law"}
                      </p>
                      {lawyer.rating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {renderStars(lawyer.rating)}
                          <span className="text-xs font-medium ml-1">({lawyer.rating.toFixed(1)})</span>
                        </div>
                      )}
                    </div>
                    {lawyer.is_verified && (
                      <div className="shrink-0" title="Verified Lawyer">
                        <Icon icon="solar:verified-check-bold" className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground">
                    {lawyer.years_experience > 0 && (
                      <span className="px-2 py-1 bg-background/50 rounded-full">
                        {lawyer.years_experience}+ years
                      </span>
                    )}
                    {lawyer.total_cases > 0 && (
                      <span className="px-2 py-1 bg-background/50 rounded-full">
                        {lawyer.total_cases} cases
                      </span>
                    )}
                    {lawyer.jurisdiction_states && lawyer.jurisdiction_states.length > 0 && (
                      <span className="px-2 py-1 bg-background/50 rounded-full">
                        {lawyer.jurisdiction_states.slice(0, 2).join(", ")}
                        {lawyer.jurisdiction_states.length > 2 && ` +${lawyer.jurisdiction_states.length - 2}`}
                      </span>
                    )}
                  </div>

                  {/* Contact Button */}
                  <button
                    onClick={() => handleContact(lawyer)}
                    className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4" />
                    {isAuthenticated ? "Contact Lawyer" : "Login to Contact"}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl bg-muted disabled:opacity-40 hover:bg-muted/70 transition-colors"
                >
                  <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page === Math.ceil(total / limit)}
                  className="p-2 rounded-xl bg-muted disabled:opacity-40 hover:bg-muted/70 transition-colors"
                >
                  <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}