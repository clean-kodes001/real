import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PropertyCardSkeleton } from "@/components/shared/SkeletonCard";
import { PropertyAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  approved: "text-emerald-500",
  pending: "text-amber-500",
  rejected: "text-red-500",
  sold: "text-blue-500",
};

const statusBgColors: Record<string, string> = {
  approved: "bg-emerald-500/10",
  pending: "bg-amber-500/10",
  rejected: "bg-red-500/10",
  sold: "bg-blue-500/10",
};

interface Property {
  uuid: string;
  title: string;
  price: string;
  city?: string;
  state?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  images?: string[];
  status?: string;
  created_at?: string;
}

export default function DashboardProperties() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties(page: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const response = await PropertyAPI.userList(page, 20);
      
      const data = response.data || response;
      const propertiesData = data.properties || [];
      const paginationData = data.pagination || {};
      
      setProperties(propertiesData);
      setPagination({
        page: paginationData.page || 1,
        limit: paginationData.limit || 20,
        total: paginationData.total || 0,
        pages: paginationData.pages || 0,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load your properties");
        setError("Failed to load your properties");
      }
    } finally {
      setLoading(false);
    }
  }

  function openDeleteModal(property: Property) {
    setPropertyToDelete(property);
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    if (!propertyToDelete) return;
    
    setDeleting(propertyToDelete.uuid);
    try {
      await PropertyAPI.delete(propertyToDelete.uuid);
      toast.success("Property deleted successfully");
      setProperties(properties.filter(p => p.uuid !== propertyToDelete.uuid));
      setShowDeleteModal(false);
      setPropertyToDelete(null);
      
      setPagination(prev => ({
        ...prev,
        total: prev.total - 1,
        pages: Math.ceil((prev.total - 1) / prev.limit)
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to delete property");
      }
    } finally {
      setDeleting(null);
    }
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setPropertyToDelete(null);
  }

  const getImageUrl = (image: string) => {
    if (image.startsWith('http')) return image;
    return 'https://uptrendtrader.com/realtor' + '/uploads/properties/' + image;
  };

  // Get unique statuses
  const statuses = ['all', ...new Set(properties.map(p => p.status).filter(Boolean))];

  // Filter properties
  const filteredProperties = useMemo(() => {
    let filtered = properties;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(search) ||
        p.city?.toLowerCase().includes(search) ||
        p.state?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [properties, selectedStatus, searchTerm]);

  // Get status count
  const getStatusCount = (status: string) => {
    if (status === 'all') return properties.length;
    return properties.filter(p => p.status === status).length;
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight">Properties</h1>
            <p className="text-muted-foreground text-sm font-light mt-1">
              {pagination.total > 0 ? `${pagination.total} properties` : 'Manage your listings'}
            </p>
          </div>
          <Link href="/dashboard/properties/create">
            <button className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity">
              <Icon icon="solar:add-circle-bold" className="w-4 h-4" /> 
              List Property
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Icon 
              icon="solar:magnifer-bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search properties..."
              className="w-full pl-9 pr-4 py-2 bg-muted/50 rounded-xl text-sm outline-none transition-colors focus:bg-muted placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedStatus === status
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === 'all' ? 'All' : status}
                <span className="ml-1 text-muted-foreground/60">
                  ({getStatusCount(status)})
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchProperties()}
            className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <Icon icon="solar:refresh-bold" className="w-4 h-4" />
          </button>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16">
            <Icon icon="solar:danger-triangle-bold" className="w-8 h-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={() => fetchProperties()}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:buildings-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">
              {searchTerm || selectedStatus !== 'all' 
                ? 'No matching properties found'
                : 'No properties yet'}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {searchTerm || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by listing your first property'}
            </p>
            {!searchTerm && selectedStatus === 'all' && (
              <Link href="/dashboard/properties/create">
                <button className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity">
                  List Your First Property
                </button>
              </Link>
            )}
          </div>
        ) : (
          // Properties Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties.map((p, i) => (
              <motion.div 
                key={p.uuid} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group"
              >
                <div className="rounded-2xl bg-muted/30 overflow-hidden">
                  {/* Image */}
                  <div className="aspect-[4/3] bg-muted/50 relative">
                    {p.images?.[0] ? (
                      <img 
                        src={getImageUrl(p.images[0])}
                        alt={p.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon icon="solar:buildings-bold" className="w-10 h-10 text-muted-foreground/20" />
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    {p.status && (
                      <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBgColors[p.status] || 'bg-muted'} ${statusColors[p.status] || 'text-muted-foreground'}`}>
                        {p.status}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-light">{formatCurrency(parseFloat(p.price))}</p>
                        <h3 className="font-medium text-sm mt-0.5 line-clamp-1">{p.title}</h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                        {[p.city, p.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    
                    {p.created_at && (
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        Listed {formatDate(p.created_at)}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/30">
                      <button 
                        onClick={() => navigate(`/property/${p.uuid}`)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium hover:bg-muted/50 transition-colors"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => openDeleteModal(p)}
                        disabled={deleting === p.uuid}
                        className="py-2 px-3 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {deleting === p.uuid ? (
                          <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                        ) : (
                          <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => fetchProperties(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted disabled:opacity-30 transition-colors text-sm font-medium"
            >
              <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => fetchProperties(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-4 py-2 rounded-xl bg-muted/50 hover:bg-muted disabled:opacity-30 transition-colors text-sm font-medium"
            >
              <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal - Apple Style */}
      <AnimatePresence>
        {showDeleteModal && propertyToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={closeDeleteModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
            >
              <div className="bg-background rounded-2xl p-6">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:trash-bin-minimalistic-bold" className="w-6 h-6 text-red-500" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-light text-center">Delete Property</h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Are you sure you want to delete this property? This action cannot be undone.
                </p>

                {/* Property Preview */}
                <div className="mt-4 p-3 bg-muted/30 rounded-xl">
                  <p className="text-sm font-medium">{propertyToDelete.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(parseFloat(propertyToDelete.price))} • {propertyToDelete.city}, {propertyToDelete.state}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={closeDeleteModal}
                    className="flex-1 py-3 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    disabled={deleting === propertyToDelete.uuid}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                  >
                    {deleting === propertyToDelete.uuid && (
                      <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                    )}
                    {deleting === propertyToDelete.uuid ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}