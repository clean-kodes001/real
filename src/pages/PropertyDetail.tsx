import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import PublicLayout from "@/components/layout/PublicLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { PropertyAPI, EscrowAPI, LawyerAPI } from "@/services/api";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

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

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [activeImage, setActiveImage] = useState(0);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showLawyerModal, setShowLawyerModal] = useState(false);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [selectedLawyer, setSelectedLawyer] = useState<string>("");
  const [escrowLoading, setEscrowLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProperty();
      checkIfFavorited();
      fetchLawyers();
    }
  }, [id]);

  async function fetchProperty() {
    setLoading(true);
    setError(null);
    try {
      const response = await PropertyAPI.get(id);
      setProperty(response.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Property not found");
    } finally {
      setLoading(false);
    }
  }

  async function checkIfFavorited() {
    if (!isAuthenticated) return;
    try {
      // You might need a GET /property/favorites endpoint to check
      // For now, we'll assume it's not favorited
      setIsFavorited(false);
    } catch (err) {
      // Ignore
    }
  }

  async function fetchLawyers() {
    if (!isAuthenticated) return;
    try {
      const response = await LawyerAPI.discover({
        state: property?.state || undefined,
        limit: 20,
      });
      console.log('lawyers',response)
      setLawyers(response.data.lawyers || []);
    } catch (err) {
      // Ignore
    }
  }

  async function handleFavorite() {
    if (!isAuthenticated) {
      toast.error("Please login to favorite properties");
      navigate("/auth/login");
      return;
    }

    setFavoriteLoading(true);
    try {
      if (isFavorited) {
        await PropertyAPI.unfavorite(id);
        toast.success("Removed from favorites");
      } else {
        await PropertyAPI.favorite(id);
        toast.success("Added to favorites!");
      }
      setIsFavorited(!isFavorited);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update favorites");
    } finally {
      setFavoriteLoading(false);
    }
  }

  async function handleStartEscrow() {
    if (!isAuthenticated) {
      toast.error("Please login to start escrow");
      navigate("/auth/login");
      return;
    }

    if (!selectedLawyer) {
      toast.error("Please select a lawyer");
      return;
    }

    if (!property) return;

    setEscrowLoading(true);
    try {
      const response = await EscrowAPI.create(property.uuid, selectedLawyer);
      toast.success("Escrow created successfully!");
    navigate(`/dashboard/escrow/${response.data.uuid}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create escrow");
    } finally {
      setEscrowLoading(false);
      setShowLawyerModal(false);
    }
  }

  async function handleContactSeller() {
    if (!isAuthenticated) {
      toast.error("Please login to contact seller");
      navigate("/auth/login");
      return;
    }

    if (!property) return;
    
    // Navigate to chat with seller
    // You'll need the seller's UUID from the property
    navigate(`/dashboard/messages?user=${property.seller_uuid || ''}`);
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="space-y-6">
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-full aspect-[16/9] rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !property) {
    return (
      <PublicLayout>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-semibold text-lg">{error || "Property not found"}</p>
          <p className="text-muted-foreground text-sm mt-1">The property you're looking for doesn't exist or was removed.</p>
          <button 
            onClick={() => navigate("/properties")} 
            className="mt-4 inline-flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
          >
            <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back to listings
          </button>
        </div>
      </PublicLayout>
    );
  }

  const images = property.images || [];
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    approved: "bg-green-500/10 text-green-500",
    rejected: "bg-red-500/10 text-red-500",
    sold: "bg-gray-500/10 text-gray-500",
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Back Button */}
        <button 
          onClick={() => navigate("/properties")} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back to listings
        </button>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Image Gallery */}
          <div className="rounded-2xl overflow-hidden mb-6">
            <div className="aspect-[16/9] bg-muted relative">
              {images.length > 0 ? (
                <img 
                  src={process.env.VITE_APP_URL + '/uploads/properties/' +images[activeImage]} 
                  alt={property.title} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon icon="solar:buildings-bold" className="w-20 h-20 text-muted-foreground/20" />
                </div>
              )}
              
              {/* Status Badge */}
              {property.status && (
                <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold ${statusColors[property.status]}`}>
                  {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveImage(i)}
                    className={`flex-1 min-w-[80px] aspect-[4/3] rounded-xl overflow-hidden transition-all ${
                      activeImage === i ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
                    }`}
                  >

                    <img src={process.env.VITE_APP_URL + '/uploads/properties/' +img} alt={`${property.title} - ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold mb-2">{property.title}</h1>
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Icon icon="solar:map-point-bold" className="w-4 h-4 shrink-0 text-primary" />
                  {property.address}, {property.city}, {property.state}
                </p>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-3">
                {property.bedrooms > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm">
                    <Icon icon="solar:bed-bold" className="w-4 h-4 text-primary" />
                    {property.bedrooms} {property.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                  </div>
                )}
                {property.bathrooms > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm">
                    <Icon icon="solar:shower-bold" className="w-4 h-4 text-primary" />
                    {property.bathrooms} {property.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
                  </div>
                )}
                {property.square_meters > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm">
                    <Icon icon="solar:ruler-cross-pen-bold" className="w-4 h-4 text-primary" />
                    {property.square_meters.toLocaleString()} sqm
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm">
                  <Icon icon="solar:buildings-bold" className="w-4 h-4 text-primary" />
                  {property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)}
                </div>
                {property.views > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm">
                    <Icon icon="solar:eye-bold" className="w-4 h-4 text-primary" />
                    {property.views} views
                  </div>
                )}
              </div>

              {/* Features List */}
              {property.features && property.features.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.features.map((feature, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-muted text-sm">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {property.description && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Description</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {property.description}
                  </p>
                </div>
              )}

              {/* Listing Date */}
              <p className="text-xs text-muted-foreground">
                Listed on {formatDate(property.created_at)}
              </p>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-4">
              {/* Price Card */}
              <div className="p-6 rounded-2xl bg-muted">
                <p className="text-3xl font-bold text-primary mb-1">{formatCurrency(property.price)}</p>
                <p className="text-muted-foreground text-sm mb-4">Asking Price</p>

                <div className="space-y-3">
                  {isAuthenticated ? (
                    user?.role === 'buyer' && property.status === 'approved' &&
                    <>
                      <button
                        onClick={handleFavorite}
                        disabled={favoriteLoading}
                        className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Icon icon={isFavorited ? "solar:heart-bold" : "solar:heart-line-duotone"} className="w-4 h-4" />
                        {isFavorited ? "Saved" : "Save Property"}
                      </button>
                      
                      <button
                        onClick={handleContactSeller}
                        className="w-full py-3 bg-muted hover:bg-muted/70 text-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon icon="solar:chat-round-bold" className="w-4 h-4" /> Contact Seller
                      </button>
                      
                      {user?.role === 'buyer' && property.status === 'approved' && (
                        <button
                          onClick={() => {
                         //   fetchLawyers();
                            setShowLawyerModal(true);
                          }}
                          className="w-full py-3 bg-muted hover:bg-muted/70 text-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:hand-money-bold" className="w-4 h-4" /> Start Escrow
                        </button>
                      )}
                    </>
                  ) : (
                    <button 
                      onClick={() => navigate("/auth/login")}
                      className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Login to Contact Seller
                    </button>
                  )}
                </div>
              </div>

              {/* Seller Info */}
              {property.seller_name && (
                <div className="p-4 rounded-2xl bg-muted">
                  <p className="text-sm font-semibold mb-3">Listed by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {getInitials(property.seller_name)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{property.seller_name}</p>
                      <p className="text-xs text-muted-foreground">Verified Seller</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Lawyer Selection Modal */}
        {showLawyerModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background rounded-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-display font-bold">Select a Lawyer</h3>
                <button 
                  onClick={() => setShowLawyerModal(false)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <Icon icon="solar:close-bold" className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Choose a lawyer to handle your escrow transaction
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {lawyers.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No lawyers available in your area
                  </p>
                ) : (
                  lawyers.map((lawyer) => (
                    <button
                      key={lawyer.user_uuid}
                      onClick={() => setSelectedLawyer(lawyer.user_uuid)}
                      className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                        selectedLawyer === lawyer.user_uuid
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted hover:bg-muted/70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {getInitials(lawyer.name)}
                        </div>
                        <div>
                          <p className="font-medium">{lawyer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lawyer.specialization || "Real Estate Law"} • {lawyer.years_experience}+ years
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowLawyerModal(false)}
                  className="flex-1 py-3 bg-muted hover:bg-muted/70 rounded-xl transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartEscrow}
                  disabled={!selectedLawyer || escrowLoading}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {escrowLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  {escrowLoading ? "Creating..." : "Start Escrow"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}