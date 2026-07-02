import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link, useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PropertyCardSkeleton } from "@/components/shared/SkeletonCard";
import { PropertyAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  approved: "bg-green-500/90 text-white",
  pending: "bg-yellow-500/90 text-black",
  rejected: "bg-red-500/90 text-white",
  sold: "bg-blue-500/90 text-white",
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
      // ✅ Use the dedicated userList endpoint
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
      
      // Update pagination total
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

  // Get image URL
  const getImageUrl = (image: string) => {
    if (image.startsWith('http')) return image;
    return process.env.VITE_APP_URL + '/uploads/properties/' + image;
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">My Properties</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {pagination.total > 0 ? `${pagination.total} properties listed` : 'Manage your listed properties'}
            </p>
          </div>
          <Link href="/dashboard/properties/create">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm">
              <Icon icon="solar:add-circle-bold" className="w-4 h-4" /> List Property
            </button>
          </Link>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => fetchProperties()}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : properties.length === 0 ? (
          // Empty State
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:buildings-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">No properties yet</h3>
            <p className="text-muted-foreground text-sm mb-6">Start by listing your first property</p>
            <Link href="/dashboard/properties/create">
              <button className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm">
                List Your First Property
              </button>
            </Link>
          </div>
        ) : (
          // Properties Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((p, i) => (
              <motion.div 
                key={p.uuid} 
                initial={{ opacity: 0, y: 16 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl bg-muted overflow-hidden"
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-muted relative">
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
                    <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[p.status] ?? "bg-muted text-muted-foreground"}`}>
                      {p.status}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="font-bold text-primary">{formatCurrency(parseFloat(p.price))}</p>
                  <h3 className="font-semibold mt-0.5 line-clamp-1">{p.title}</h3>
                  
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                    {[p.city, p.state].filter(Boolean).join(", ")}
                  </p>
                  
                  {p.created_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Listed {formatDate(p.created_at)}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => navigate(`/property/${p.uuid}`)}
                      className="flex-1 py-2 bg-background hover:bg-muted rounded-xl text-xs font-medium transition-colors"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => openDeleteModal(p)}
                      disabled={deleting === p.uuid}
                      className="py-2 px-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {deleting === p.uuid ? (
                        <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => fetchProperties(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 disabled:opacity-50 transition-colors text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => fetchProperties(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 disabled:opacity-50 transition-colors text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && propertyToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Delete Property</h3>
              <button 
                onClick={closeDeleteModal}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-sm font-medium">{propertyToDelete.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(parseFloat(propertyToDelete.price))} • {propertyToDelete.city}, {propertyToDelete.state}
                </p>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Warning</p>
                    <p className="text-xs text-muted-foreground">
                      This action cannot be undone. This will permanently delete this property and all its data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={closeDeleteModal}
                  className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting === propertyToDelete.uuid}
                  className="flex-1 py-3 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {deleting === propertyToDelete.uuid && (
                    <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                  )}
                  {deleting === propertyToDelete.uuid ? "Deleting..." : "Delete Property"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}