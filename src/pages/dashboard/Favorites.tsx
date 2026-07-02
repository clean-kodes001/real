import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Link } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PropertyCard from "@/components/shared/PropertyCard";
import { PropertyCardSkeleton } from "@/components/shared/SkeletonCard";
import { PropertyAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";

interface FavoriteProperty {
  uuid: string;
  title: string;
  price: number;
  city?: string;
  state?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_meters?: number;
  images?: string[];
  status?: string;
}

export default function Favorites() {
  const { isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unfavoriting, setUnfavoriting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedProperty, setSelectedProperty] = useState<FavoriteProperty | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFavorites();
    }
  }, [isAuthenticated]);

  async function fetchFavorites() {
    setLoading(true);
    setError(null);
    try {
      const response = await PropertyAPI.getFavorites();
      // Response data is an array directly
      setFavorites(response.data || []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load favorites");
        setError("Failed to load favorites");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfavorite(property_uuid: string) {
    setUnfavoriting(property_uuid);
    try {
      await PropertyAPI.unfavorite(property_uuid);
      toast.success("Removed from favorites");
      // Remove from list
      setFavorites(favorites.filter(p => p.uuid !== property_uuid));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to remove from favorites");
      }
    } finally {
      setUnfavoriting(null);
      setShowRemoveModal(false);
      setSelectedProperty(null);
    }
  }

  function openRemoveModal(property: FavoriteProperty) {
    setSelectedProperty(property);
    setShowRemoveModal(true);
  }

  // Get unique property types for filter
  const propertyTypes = ['all', ...new Set(favorites.map(p => p.property_type).filter(Boolean))];

  // Filter favorites
  const filteredFavorites = favorites
    .filter(p => {
      if (filterType === 'all') return true;
      return p.property_type === filterType;
    })
    .filter(p => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        p.title?.toLowerCase().includes(search) ||
        p.city?.toLowerCase().includes(search) ||
        p.state?.toLowerCase().includes(search)
      );
    });

  // Get count by type
  const getTypeCount = (type: string) => {
    if (type === 'all') return favorites.length;
    return favorites.filter(p => p.property_type === type).length;
  };

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <Icon icon="solar:heart-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Please Login</h3>
          <p className="text-muted-foreground text-sm">Login to view your saved properties</p>
          <Link href="/auth/login" className="mt-4 inline-block px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity">
            Login
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold">Saved Properties</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Properties you've added to your favorites
          </p>
        </div>

        {/* Stats */}
        {!loading && favorites.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">{favorites.length} saved properties</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {favorites.filter(p => p.status === 'approved' || !p.status).length} available
            </span>
          </div>
        )}

        {/* Search & Filter */}
        {!loading && favorites.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Icon 
                icon="solar:magnifer-bold" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search saved properties..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchFavorites}
              className="px-4 py-2.5 bg-muted hover:bg-muted/70 rounded-xl transition-colors text-sm flex items-center gap-2"
            >
              <Icon icon="solar:refresh-bold" className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}

        {/* Property Type Filter */}
        {!loading && favorites.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {propertyTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  filterType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {type === 'all' ? 'All' : type}
                <span className="ml-1.5 text-xs opacity-70">
                  ({getTypeCount(type)})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchFavorites}
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
        ) : filteredFavorites.length === 0 ? (
          // Empty State
          <div className="text-center py-20 rounded-2xl bg-muted">
            <Icon icon="solar:heart-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {searchTerm || filterType !== 'all' ? 'No matching properties' : 'No saved properties'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Browse listings and save properties you like'}
            </p>
            {(searchTerm || filterType !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                }}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Favorites Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFavorites.map((p, i) => (
              <motion.div 
                key={p.uuid} 
                initial={{ opacity: 0, y: 16 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.06 }}
                className="relative group"
              >
                <PropertyCard
                  uuid={p.uuid}
                  title={p.title || ""}
                  price={typeof p.price === "string" ? parseFloat(p.price) : (p.price || 0)}
                  city={p.city}
                  state={p.state}
                  property_type={p.property_type}
                  bedrooms={p.bedrooms}
                  bathrooms={p.bathrooms}
                  square_meters={p.square_meters}
                  images={p.images}
                  isFavorited={true}
                  onFavorite={() => openRemoveModal(p)}
                />
                
                {/* Remove button overlay on hover */}
                <button
                  onClick={() => openRemoveModal(p)}
                  disabled={unfavoriting === p.uuid}
                  className="absolute top-3 right-3 p-2 rounded-full bg-destructive/90 text-white hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove from favorites"
                >
                  {unfavoriting === p.uuid ? (
                    <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon icon="solar:heart-bold" className="w-4 h-4" />
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-display font-bold">Remove from Favorites</h3>
              <button 
                onClick={() => {
                  setShowRemoveModal(false);
                  setSelectedProperty(null);
                }}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Icon icon="solar:close-bold" className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              Are you sure you want to remove this property from your favorites?
            </p>
            <p className="text-sm font-medium mb-4">
              {selectedProperty.title}
            </p>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setShowRemoveModal(false);
                  setSelectedProperty(null);
                }}
                className="flex-1 py-3 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/70 transition-colors text-sm"
              >
                Keep
              </button>
              <button 
                type="button"
                onClick={() => handleUnfavorite(selectedProperty.uuid)}
                disabled={unfavoriting === selectedProperty.uuid}
                className="flex-1 py-3 bg-destructive text-destructive-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {unfavoriting === selectedProperty.uuid && (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                )}
                {unfavoriting === selectedProperty.uuid ? "Removing..." : "Remove"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}