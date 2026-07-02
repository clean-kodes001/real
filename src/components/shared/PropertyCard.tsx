import { Link } from "wouter";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

interface PropertyCardProps {
  uuid: string; // Changed from id to uuid
  title: string;
  price: number;
  city?: string;
  state?: string;
  location?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  square_meters?: number | null;
  images?: string[];
  type?: string;
  property_type?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'sold' | 'available' | null;
  isFavorited?: boolean;
  onFavorite?: () => void;
}

export default function PropertyCard({
  uuid, // Changed from id to uuid
  title,
  price,
  city,
  state,
  location,
  bedrooms,
  bathrooms,
  area,
  square_meters,
  images,
  type,
  property_type,
  status,
  isFavorited,
  onFavorite,
}: PropertyCardProps) {
  // Get first image or fallback
  const image = images && images.length > 0 ? images[0] : null;
  // Build location string
  const displayLocation = location ?? (city && state ? `${city}, ${state}` : city || state || "");
  
  // Get property type
  const displayType = property_type ?? type;
  
  // Get area
  const displayArea = square_meters ?? area;

  // Status badge colors
  const getStatusStyles = (status: string) => {
    const statusMap: Record<string, string> = {
      approved: "bg-green-500/90 text-white",
      available: "bg-green-500/90 text-white",
      sold: "bg-red-500/90 text-white",
      pending: "bg-yellow-500/90 text-black",
      rejected: "bg-red-500/90 text-white",
    };
    return statusMap[status] || "bg-muted-foreground/80 text-white";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl overflow-hidden bg-muted hover:bg-muted/80 transition-all cursor-pointer"
    >
      <Link href={`/property/${uuid}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/60">
          {/* Image */}
          {image ? (
            <img 
              src={import.meta.env.VITE_APP_URL + '/uploads/properties/' +image} 
              alt={title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon icon="solar:buildings-bold" className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Status Badge */}
          {status && (
            <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${getStatusStyles(status)}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </div>
          )}
          
          {/* Property Type Badge */}
          {displayType && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm bg-background/80 text-foreground">
              {displayType.charAt(0).toUpperCase() + displayType.slice(1)}
            </div>
          )}
          
          {/* Favorite Button */}
          {onFavorite && (
            <button
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onFavorite(); 
              }}
              className="absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-sm bg-background/80 hover:bg-background transition-colors"
            >
              <Icon
                icon={isFavorited ? "solar:heart-bold" : "solar:heart-line-duotone"}
                className={`w-4 h-4 ${isFavorited ? "text-red-500" : "text-muted-foreground"}`}
              />
            </button>
          )}
        </div>
      </Link>
      
      <Link href={`/property/${uuid}`}>
        <div className="p-4">
          {/* Price */}
          <p className="text-lg font-bold text-primary">{formatCurrency(price)}</p>
          
          {/* Title */}
          <h3 className="font-semibold text-foreground mt-1 line-clamp-1">{title}</h3>
          
          {/* Location */}
          {displayLocation && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Icon icon="solar:map-point-bold" className="w-3.5 h-3.5 shrink-0" />
              {displayLocation}
            </p>
          )}
          
          {/* Features */}
          <div className="flex items-center gap-4 mt-3">
            {bedrooms != null && bedrooms > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon icon="solar:bed-bold" className="w-4 h-4" />
                {bedrooms} {bedrooms === 1 ? 'bed' : 'beds'}
              </span>
            )}
            {bathrooms != null && bathrooms > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon icon="solar:shower-bold" className="w-4 h-4" />
                {bathrooms} {bathrooms === 1 ? 'bath' : 'baths'}
              </span>
            )}
            {displayArea != null && displayArea > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon icon="solar:ruler-cross-pen-bold" className="w-4 h-4" />
                {Number(displayArea).toLocaleString()} sqm
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}