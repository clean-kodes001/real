import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import PublicLayout from "@/components/layout/PublicLayout";
import { formatCurrency } from "@/lib/utils";
import { PropertyAPI, ApiError } from "@/services/api";
import toast from "react-hot-toast";

// Types
interface Property {
  uuid: string;
  title: string;
  price: number;
  description?: string;
  city?: string;
  state?: string;
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_meters?: number;
  images?: string[];
  property_type?: string;
  status?: string;
  created_at?: string;
}

interface Review {
  id: number;
  name: string;
  role: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
}

const features = [
  { icon: "solar:buildings-bold", title: "Verified Listings", desc: "Every property is verified by our team before going live." },
  { icon: "solar:shield-check-bold", title: "Secure Escrow", desc: "Funds held safely in escrow until all conditions are met." },
  { icon: "solar:user-rounded-bold", title: "Expert Lawyers", desc: "Connect with certified real estate lawyers for every deal." },
  { icon: "solar:chart-bold", title: "Transparent Pricing", desc: "No hidden fees. See exactly what you pay and when." },
];

const stats = [
  { value: "12,500+", label: "Properties Listed" },
  { value: "₦8.2B+", label: "Transactions Completed" },
  { value: "4,800+", label: "Happy Clients" },
  { value: "320+", label: "Expert Lawyers" },
];

const reviews: Review[] = [
  {
    id: 1,
    name: "Chidi Okonkwo",
    role: "Buyer",
    rating: 5,
    comment: "PlotWise made buying my first home in Lagos seamless. The escrow service gave me peace of mind.",
    date: "2 months ago"
  },
  {
    id: 2,
    name: "Amina Bello",
    role: "Seller",
    rating: 5,
    comment: "Sold my property in Abuja within 2 weeks! The verification process attracted serious buyers.",
    date: "3 months ago"
  },
  {
    id: 3,
    name: "Dr. Emeka Okafor",
    role: "Lawyer",
    rating: 5,
    comment: "The platform makes legal due diligence easy. I've handled over 50 transactions on PlotWise.",
    date: "1 month ago"
  },
  {
    id: 4,
    name: "Fatima Suleiman",
    role: "Buyer",
    rating: 4,
    comment: "Great platform! Found my dream apartment in Lekki. The lawyers were very professional.",
    date: "2 weeks ago"
  },
  {
    id: 5,
    name: "Oluwaseun Adeyemi",
    role: "Investor",
    rating: 5,
    comment: "Best real estate platform in Nigeria. Transparent pricing and excellent customer support.",
    date: "1 week ago"
  }
];

const faqs: FAQ[] = [
  {
    id: 1,
    question: "How does the escrow system work?",
    answer: "The escrow system holds the buyer's funds securely until all conditions of the sale are met. Once the seller confirms the transaction and the lawyer approves, the funds are released to the seller. This protects both parties."
  },
  {
    id: 2,
    question: "Is PlotWise free to use?",
    answer: "Creating an account and browsing properties is completely free. We charge a small commission (2.5%) on successful transactions which is included in the escrow fee."
  },
  {
    id: 3,
    question: "How do I become a verified lawyer on the platform?",
    answer: "Lawyers need to register, provide their license number, bar certificate, and complete KYC verification. Our team reviews and approves qualified lawyers to join the platform."
  },
  {
    id: 4,
    question: "What happens if there's a dispute?",
    answer: "If a dispute arises, both parties can file a dispute through our platform. Our admin team reviews the case, and with the lawyer's input, resolves the dispute fairly."
  },
  {
    id: 5,
    question: "How long does a transaction take?",
    answer: "The timeline varies depending on the property and parties involved. Typically, a transaction can take 2-4 weeks from payment to completion, including legal reviews and confirmations."
  },
  {
    id: 6,
    question: "Is my money safe with the escrow service?",
    answer: "Yes! Funds are held in a licensed escrow account with Paystack integration. Funds are only released when all parties confirm the transaction conditions are met."
  }
];

export default function Landing() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  async function fetchProperties() {
    setLoading(true);
    try {
      const response = await PropertyAPI.list(1, 6);
      const data = response.data?.properties || response.data || [];
      setProperties(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        console.error("Failed to fetch properties:", error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentReviewIndex((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-1/3 w-96 h-96 rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute bottom-10 right-1/4 w-72 h-72 rounded-full bg-primary/5 blur-[80px]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-3 py-1 rounded-full bg-primary/5 text-primary text-xs font-medium tracking-wider uppercase mb-4">
              Nigeria's Trusted Real Estate Platform
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-tight mb-4">
              Find Your<br />
              <span className="text-primary font-medium">Dream Property</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-8 font-light">
              Buy, sell, and rent verified properties with secure escrow, expert legal support, and seamless transactions.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/properties">
                <button className="px-8 py-3.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity">
                  Browse Properties
                </button>
              </Link>
              <Link href="/auth/register">
                <button className="px-8 py-3.5 bg-muted/30 text-foreground rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors">
                  List Your Property
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-t border-b border-border/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <p className="text-2xl md:text-3xl font-light">{stat.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-light tracking-tight">Featured Properties</h2>
              <p className="text-sm text-muted-foreground font-light mt-1">Handpicked listings just for you</p>
            </div>
            <Link href="/properties">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                View all <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-muted/30 animate-pulse">
                  <div className="aspect-[4/3] bg-muted/50 rounded-t-2xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 bg-muted/50 rounded w-1/2" />
                    <div className="h-4 bg-muted/50 rounded w-3/4" />
                    <div className="h-4 bg-muted/50 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Icon icon="solar:buildings-bold" className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground text-sm">No properties available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {properties.slice(0, 3).map((p, i) => (
                <motion.div
                  key={p.uuid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link href={`/property/${p.uuid}`}>
                    <div className="rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden group cursor-pointer">
                      <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center relative">
                        {p.images && p.images.length > 0 ? (
                          <img
                            src={'https://uptrendtrader.com/realtor/uploads/properties/'+p.images[0]}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Icon icon="solar:buildings-bold" className="w-12 h-12 text-muted-foreground/20" />
                        )}
                        
                        {p.status && (
                          <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm bg-background/80">
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-lg font-medium text-primary">{formatCurrency(p.price)}</p>
                        <h3 className="font-medium text-sm mt-0.5 line-clamp-1">{p.title}</h3>
                        {(p.city || p.state) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                            {[p.city, p.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          {p.bedrooms && p.bedrooms > 0 && (
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:bed-bold" className="w-3.5 h-3.5" />
                              {p.bedrooms}
                            </span>
                          )}
                          {p.bathrooms && p.bathrooms > 0 && (
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:shower-bold" className="w-3.5 h-3.5" />
                              {p.bathrooms}
                            </span>
                          )}
                          {p.square_meters && p.square_meters > 0 && (
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:ruler-cross-pen-bold" className="w-3.5 h-3.5" />
                              {p.square_meters}m²
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30 border-y border-border/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-light tracking-tight">Why Choose PlotWise?</h2>
            <p className="text-sm text-muted-foreground font-light mt-1">Everything you need for a safe, smooth property deal</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="p-5 rounded-2xl bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-3">
                  <Icon icon={f.icon} className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-light tracking-tight">What Our Users Say</h2>
            <p className="text-sm text-muted-foreground font-light mt-1">Real stories from real people</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleReviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="p-5 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{review.name}</h4>
                    <p className="text-xs text-muted-foreground">{review.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Icon
                      key={i}
                      icon={i < review.rating ? "solar:star-bold" : "solar:star-line-duotone"}
                      className={`w-3.5 h-3.5 ${i < review.rating ? "text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground font-light italic">"{review.comment}"</p>
                <p className="text-xs text-muted-foreground/60 mt-2">{review.date}</p>
              </motion.div>
            ))}
          </div>

          {reviews.length > 3 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="px-5 py-2 bg-foreground text-background rounded-xl text-xs font-medium hover:opacity-80 transition-opacity"
              >
                {showAllReviews ? "Show Less" : "See All Reviews"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/30 border-y border-border/30">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-light tracking-tight">Frequently Asked Questions</h2>
            <p className="text-sm text-muted-foreground font-light mt-1">Find answers to common questions</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-background overflow-hidden"
              >
                <button
                  onClick={() => setActiveFAQ(activeFAQ === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm font-medium">{faq.question}</span>
                  <Icon
                    icon={activeFAQ === faq.id ? "solar:minus-bold" : "solar:add-bold"}
                    className="w-4 h-4 text-primary shrink-0 ml-4"
                  />
                </button>
                <AnimatePresence>
                  {activeFAQ === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4"
                    >
                      <p className="text-sm text-muted-foreground font-light">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl bg-foreground p-12 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
            <div className="relative z-10 text-center">
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-background mb-3">
                Ready to Find Your Dream Property?
              </h2>
              <p className="text-background/70 text-sm font-light mb-6 max-w-lg mx-auto">
                Join thousands of Nigerians who trust PlotWise for safe, transparent real estate transactions.
              </p>
              <Link href="/auth/register">
                <button className="px-8 py-3 bg-background text-foreground rounded-xl text-sm font-medium hover:opacity-80 transition-opacity">
                  Get Started Free
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}