import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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

// Filter options from your backend's property types
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

  // Fetch properties when page changes
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

  // Client-side filtering
  const filteredProperties = properties.filter((p) => {
    // Search filter
    const matchSearch = !search || 
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.state?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase());

    // Type filter
    const matchType = type === "All" || p.property_type === type;

    // Location filter
    const matchLocation = location === "All" || 
      p.city === location || 
      p.state === location;

    return matchSearch && matchType && matchLocation;
  });

  // Handle property click
  const handlePropertyClick = (uuid: string) => {
    navigate(`/property/${uuid}`);
  };

  // Handle retry
  const handleRetry = () => {
    fetchProperties();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-8"
        >
          <h1 className="text-4xl font-display font-bold mb-2">Browse Properties</h1>
          <p className="text-muted-foreground">
            Find your perfect property from our verified listings across Nigeria
          </p>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Icon 
              icon="solar:magnifer-bold" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, city, state, or address..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all min-w-[140px]"
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
            className="px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all min-w-[150px]"
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
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredProperties.length} of {total} properties
            {search && ` matching "${search}"`}
          </p>
        )}

        {/* Error State */}
        {error ? (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          // Loading Skeletons
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          // Empty State
          <div className="text-center py-20">
            <Icon icon="solar:buildings-bold" className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-lg">No properties found</p>
            <p className="text-muted-foreground text-sm mt-1">
              {search || type !== "All" || location !== "All" 
                ? "Try adjusting your search or filters" 
                : "No properties are available right now"}
            </p>
            {(search || type !== "All" || location !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setType("All");
                  setLocation("All");
                }}
                className="mt-4 text-sm text-primary hover:opacity-80 transition-opacity"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          // Properties Grid
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property) => (
                <motion.div
                  key={property.uuid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
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
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors"
                >
                  <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
                </button>

                {/* Page numbers */}
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
                      className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                        page === pg
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors"
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