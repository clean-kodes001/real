import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import PublicLayout from "@/components/layout/PublicLayout";
import PropertyCard from "@/components/shared/PropertyCard";
import { PropertyCardSkeleton } from "@/components/shared/SkeletonCard";
import { PropertyAPI } from "@/services/api";

// Type definitions
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
  images: string[];
  features: string[];
  seller_name: string;
  seller_email: string;
  seller_phone: string;
}

// Filter options
const PROPERTY_TYPES = ["All", "house", "apartment", "duplex", "bungalow", "commercial", "land"];
const NIGERIAN_STATES = [
  "All", "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

export default function Properties() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [location, setLocation] = useState("All");
  const [page, setPage] = useState(1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    fetchProperties();
  }, [page]);

  async function fetchProperties() {
    setLoading(true);
    setError(null);
    try {
      const response = await PropertyAPI.list(page, limit);
      const data = response.data;
      
      setProperties(data.properties || []);
      setTotal(data.pagination?.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load properties");
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchSearch = !search || 
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.city?.toLowerCase().includes(search.toLowerCase()) ||
        p.state?.toLowerCase().includes(search.toLowerCase()) ||
        p.address?.toLowerCase().includes(search.toLowerCase());

      const matchType = type === "All" || p.property_type === type;
      const matchLocation = location === "All" || 
        p.city === location || 
        p.state === location;

      return matchSearch && matchType && matchLocation;
    });
  }, [properties, search, type, location]);

  const handlePropertyClick = (uuid: string) => {
    navigate(`/property/${uuid}`);
  };

  const handleRetry = () => {
    fetchProperties();
  };

  const clearFilters = () => {
    setSearch("");
    setType("All");
    setLocation("All");
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-light tracking-tight">Browse Properties</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Find your perfect property from our verified listings across Nigeria
          </p>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Icon 
              icon="solar:magnifer-bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, city, state, or address..."
              className="w-full pl-9 pr-4 py-2.5 bg-muted/30 focus:bg-muted/50 transition-colors rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/60"
            />
          </div>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-4 py-2.5 bg-muted/30 focus:bg-muted/50 transition-colors rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-4 py-2.5 bg-muted/30 focus:bg-muted/50 transition-colors rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
          >
            {NIGERIAN_STATES.map((l) => (
              <option key={l} value={l}>
                {l === "All" ? "All Locations" : l}
              </option>
            ))}
          </select>
        </div>

        {/* Results count */}
        {!loading && !error && filteredProperties.length > 0 && (
          <p className="text-xs text-muted-foreground/60 mb-4">
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'}
            {search && ` matching "${search}"`}
          </p>
        )}

        {/* Error State */}
        {error ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:buildings-bold" className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-light text-muted-foreground">No properties found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {search || type !== "All" || location !== "All" 
                ? "Try adjusting your search or filters" 
                : "No properties are available right now"}
            </p>
            {(search || type !== "All" || location !== "All") && (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-primary hover:opacity-80 transition-opacity"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProperties.map((property, index) => (
                <motion.div
                  key={property.uuid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handlePropertyClick(property.uuid)}
                  className="cursor-pointer"
                >
                  <PropertyCard
                    id={property.uuid}
                    title={property.title}
                    price={property.price}
                    city={property.city}
                    state={property.state}
                    bedrooms={property.bedrooms}
                    bathrooms={property.bathrooms}
                    images={property.images || []}
                    property_type={property.property_type}
                    status={property.status}
                  />
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 disabled:opacity-30 transition-colors"
                >
                  <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pg;
                    if (totalPages <= 5) {
                      pg = i + 1;
                    } else if (page <= 3) {
                      pg = i + 1;
                    } else if (page >= totalPages - 2) {
                      pg = totalPages - 4 + i;
                    } else {
                      pg = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          page === pg
                            ? "bg-foreground text-background"
                            : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 disabled:opacity-30 transition-colors"
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