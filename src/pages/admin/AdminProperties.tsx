import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import AdminLayout from "@/components/layout/AdminLayout";
import { TableRowSkeleton } from "@/components/shared/SkeletonCard";
import { PropertyAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  sold: "bg-blue-500/10 text-blue-600",
};

const statusIcons: Record<string, string> = {
  pending: "solar:clock-circle-bold",
  approved: "solar:check-circle-bold",
  rejected: "solar:close-circle-bold",
  sold: "solar:check-circle-bold",
};

interface Property {
  uuid: string;
  title: string;
  description: string;
  property_type: string;
  price: number;
  address: string;
  city: string;
  state: string;
  country: string;
  bedrooms: number;
  bathrooms: number;
  square_meters: number;
  status: 'pending' | 'approved' | 'rejected' | 'sold';
  views: number;
  is_featured: boolean;
  created_at: string;
  approved_at?: string;
  images: string[];
  features: string[];
  seller_name: string;
  seller_email: string;
  seller_phone: string;
  seller_uuid?: string;
  admin_comment?: string;
}

export default function AdminProperties() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [processing, setProcessing] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    sold: 0,
  });
  const [mobileView, setMobileView] = useState(false);

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
    fetchProperties();
  }, [filter]);

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  async function fetchProperties() {
    setLoading(true);
    setError(null);
    try {
      const response = await PropertyAPI.adminlist(1, 100);
      
      let allProperties = response.data.properties || [];
      
      // Filter by status if needed
      if (filter !== 'all') {
        allProperties = allProperties.filter((p: Property) => p.status === filter);
      }
      
      setProperties(allProperties);
      
      // Calculate stats
      const pending = allProperties.filter((p: Property) => p.status === 'pending').length;
      const approved = allProperties.filter((p: Property) => p.status === 'approved').length;
      const rejected = allProperties.filter((p: Property) => p.status === 'rejected').length;
      const sold = allProperties.filter((p: Property) => p.status === 'sold').length;
      
      setStats({
        total: allProperties.length,
        pending,
        approved,
        rejected,
        sold,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load properties");
        setError("Failed to load properties");
      }
    } finally {
      setLoading(false);
    }
  }

  // Filter properties by search
  const filteredProperties = properties.filter(p => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term) ||
      p.city.toLowerCase().includes(term) ||
      p.state.toLowerCase().includes(term) ||
      p.seller_name.toLowerCase().includes(term)
    );
  });

  async function handleApprove(uuid: string) {
    setProcessing(true);
    try {
      await PropertyAPI.adminApprove(uuid);
      toast.success("Property approved successfully!");
      await fetchProperties();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to approve property");
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(uuid: string) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      await PropertyAPI.adminReject(uuid, rejectReason);
      toast.success("Property rejected");
      setShowRejectModal(false);
      setRejectReason("");
      await fetchProperties();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to reject property");
      }
    } finally {
      setProcessing(false);
    }
  }

  function openDetailModal(property: Property) {
    setSelectedProperty(property);
    setShowDetailModal(true);
  }

  function openRejectModal(property: Property) {
    setSelectedProperty(property);
    setRejectReason("");
    setShowRejectModal(true);
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <button 
          onClick={() => navigate("/admin")} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-2"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Properties</h1>
            <p className="text-muted-foreground text-sm">{stats.total} total listings</p>
          </div>
          <button
            onClick={fetchProperties}
            className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2 self-start"
          >
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Summary - Mobile Friendly */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Rejected</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 col-span-2 sm:col-span-1">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.sold}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Sold</p>
            </div>
          </div>
        )}

        {/* Search & Filter - Mobile Friendly */}
        {!loading && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, location, or seller..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["all", "pending", "approved", "rejected", "sold"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                  <span className="ml-1 text-[8px] sm:text-xs opacity-70">
                    ({f === 'all' ? stats.total : stats[f as keyof typeof stats] || 0})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchProperties}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Table - Mobile Responsive */}
        <div className="rounded-2xl bg-muted overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] md:min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground">Property</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Seller</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Price</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Listed</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-muted-foreground text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredProperties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {search || filter !== 'all' ? 'No matching properties found' : 'No properties found'}
                    </td>
                  </tr>
                ) : (
                  filteredProperties.map((p, i) => (
                    <motion.tr 
                      key={p.uuid} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => openDetailModal(p)}
                    >
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-background shrink-0">
                            {p.images && p.images.length > 0 ? (
                              <img 
                                src={p.images[0]} 
                                alt={p.title} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon icon="solar:buildings-bold" className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm line-clamp-1">{p.title}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {p.city}, {p.state}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground capitalize hidden sm:block">
                              {p.property_type} • {p.bedrooms || 0} bed • {p.bathrooms || 0} bath
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm hidden sm:table-cell">
                        <div>
                          <p className="font-medium truncate max-w-[80px] md:max-w-none">{p.seller_name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[80px] md:max-w-none">{p.seller_email}</p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold hidden md:table-cell">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                        {p.created_at ? formatDate(p.created_at) : "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium capitalize ${statusColors[p.status]}`}>
                          {getStatusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          {p.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleApprove(p.uuid)}
                                disabled={processing}
                                className="p-1 sm:p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <Icon icon="solar:check-bold" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                              <button 
                                onClick={() => openRejectModal(p)}
                                disabled={processing}
                                className="p-1 sm:p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <Icon icon="solar:close-bold" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => openDetailModal(p)}
                            className="p-1 sm:p-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors"
                            title="View Details"
                          >
                            <Icon icon="solar:eye-bold" className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                          </button>
                          <Link href={`/property/${p.uuid}`} target="_blank">
                            <button 
                              className="p-1 sm:p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              title="View on Site"
                            >
                              <Icon icon="solar:link-bold" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Property Detail Modal - Mobile Responsive */}
      {showDetailModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 pb-2 border-b border-border">
              <h3 className="text-lg sm:text-xl font-display font-bold truncate">Property Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Images - Mobile responsive grid */}
              {selectedProperty.images && selectedProperty.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedProperty.images.slice(0, 3).map((img, i) => (
                    <img 
                      key={i} 
                      src={img} 
                      alt={`${selectedProperty.title} ${i + 1}`}
                      className="w-full aspect-square rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ))}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-base sm:text-lg">{selectedProperty.title}</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Price</p>
                  <p className="font-bold text-sm sm:text-base text-primary">{formatCurrency(selectedProperty.price)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Status</p>
                  <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium capitalize ${statusColors[selectedProperty.status]}`}>
                    {getStatusLabel(selectedProperty.status)}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Property Type</p>
                  <p className="font-medium text-xs sm:text-sm capitalize">{selectedProperty.property_type}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Views</p>
                  <p className="font-medium text-xs sm:text-sm">{selectedProperty.views || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Bedrooms</p>
                  <p className="font-medium text-xs sm:text-sm">{selectedProperty.bedrooms || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Bathrooms</p>
                  <p className="font-medium text-xs sm:text-sm">{selectedProperty.bathrooms || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Area</p>
                  <p className="font-medium text-xs sm:text-sm">{selectedProperty.square_meters || 0} sqm</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Listed</p>
                  <p className="font-medium text-xs sm:text-sm">{formatDate(selectedProperty.created_at)}</p>
                </div>
              </div>

              {selectedProperty.features && selectedProperty.features.length > 0 && (
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedProperty.features.map((feature, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-muted text-[10px] sm:text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProperty.description && (
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Description</p>
                  <p className="text-xs sm:text-sm mt-1 line-clamp-3">{selectedProperty.description}</p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Seller</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {getInitials(selectedProperty.seller_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{selectedProperty.seller_name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{selectedProperty.seller_email}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{selectedProperty.seller_phone}</p>
                  </div>
                </div>
              </div>

              {selectedProperty.admin_comment && (
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Admin Comment</p>
                  <p className="text-xs sm:text-sm">{selectedProperty.admin_comment}</p>
                </div>
              )}

              {selectedProperty.status === 'pending' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleApprove(selectedProperty.uuid);
                    }}
                    disabled={processing}
                    className="flex-1 py-2.5 bg-green-500/10 text-green-600 font-semibold rounded-xl hover:bg-green-500/20 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openRejectModal(selectedProperty);
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

      {/* Reject Modal - Mobile Responsive */}
      {showRejectModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-4 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-display font-bold">Reject Property</h3>
              <button 
                onClick={() => setShowRejectModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-2">
              Rejecting: <span className="font-medium text-foreground">{selectedProperty.title}</span>
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

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleReject(selectedProperty.uuid)}
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