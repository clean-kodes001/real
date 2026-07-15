import { useState, useCallback, useMemo, memo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PropertyAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";

// ✅ MATCH DATABASE ENUM VALUES
const PROPERTY_TYPES = [
  "land",
  "house", 
  "apartment",
  "commercial",
  "rental",
  "industrial",
  "farm_land",
  "mixed_use"
] as const;

interface FormData {
  title: string;
  description: string;
  price: string;
  address: string;
  city: string;
  state: string;
  country: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  square_meters: string;
  features: string;
  images: File[];
  imagePreviews: string[];
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

// Memoized input component
const FormField = memo(({ 
  name, 
  label, 
  type = "text", 
  placeholder = "",
  required = false,
  value,
  onChange,
  error,
  apiError
}: { 
  name: string;
  label: string; 
  type?: string; 
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  apiError?: string;
}) => {
  const hasError = error || apiError;
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (type === "number") {
      if (val === "" || /^\d*\.?\d*$/.test(val)) {
        onChange(name, val);
      }
    } else {
      onChange(name, val);
    }
  }, [name, onChange, type]);

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary ${
          hasError ? "ring-2 ring-red-500" : ""
        }`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {apiError && !error && <p className="text-red-500 text-xs mt-1">{apiError}</p>}
    </div>
  );
});

FormField.displayName = 'FormField';

export default function CreateProperty() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    price: "",
    address: "",
    city: "",
    state: "",
    country: "Nigeria",
    property_type: "house",
    bedrooms: "",
    bathrooms: "",
    square_meters: "",
    features: "",
    images: [],
    imagePreviews: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [apiErrors, setApiErrors] = useState<Record<string, string[]>>({});

  // Check if user is seller or admin
  if (user?.role !== 'seller' && user?.role !== 'admin') {
    toast.error("Only sellers and admins can list properties");
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:danger-triangle-bold" className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-light mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm">Only sellers and admins can list properties.</p>
          <button 
            onClick={() => navigate("/dashboard")}
            className="mt-6 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const validate = useCallback(() => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      e.price = "Valid price is required";
    }
    if (!form.city.trim()) e.city = "City is required";
    if (!form.state.trim()) e.state = "State is required";
    if (!form.address.trim()) e.address = "Address is required";
    if (!form.property_type) e.property_type = "Property type is required";
    if (form.images.length === 0) e.images = "At least one image is required";
    return e;
  }, [form]);

  const handleChange = useCallback((key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(e => ({ ...e, [key]: undefined }));
    }
    if (apiErrors[key]) {
      setApiErrors(e => {
        const newErrors = { ...e };
        delete newErrors[key];
        return newErrors;
      });
    }
  }, [errors, apiErrors]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Image ${file.name} is too large (max 5MB)`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`File ${file.name} is not an image`);
        continue;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setForm(prev => ({
        ...prev,
        images: [...prev.images, ...validFiles],
        imagePreviews: [...prev.imagePreviews, ...validPreviews],
      }));
      if (errors.images) {
        setErrors(e => ({ ...e, images: undefined }));
      }
      if (apiErrors.images) {
        setApiErrors(e => {
          const newErrors = { ...e };
          delete newErrors.images;
          return newErrors;
        });
      }
    }
  }, [errors, apiErrors]);

  const removeImage = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imagePreviews: prev.imagePreviews.filter((_, i) => i !== index),
    }));
  }, []);

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);
    setApiErrors({});
    
    try {
      const imagePromises = form.images.map(fileToBase64);
      const imageBase64 = await Promise.all(imagePromises);

      const propertyData = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country || "Nigeria",
        property_type: form.property_type,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : 0,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : 0,
        square_meters: form.square_meters ? Number(form.square_meters) : 0,
        features: form.features ? form.features.split(",").map(f => f.trim()).filter(Boolean) : [],
        images: imageBase64,
      };

      const response = await PropertyAPI.create(propertyData);
      
      toast.success("Property listed successfully! Awaiting admin approval.");
      navigate(`/property/${response.data.uuid}`);
      
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        
        if (error.hasFieldErrors()) {
          setApiErrors(error.errors || {});
          
          const fieldErrors: Partial<Record<keyof FormData, string>> = {};
          Object.entries(error.errors || {}).forEach(([key, values]) => {
            const formKey = key as keyof FormData;
            if (formKey in form) {
              fieldErrors[formKey] = values[0] || `${key} is invalid`;
            }
          });
          setErrors(fieldErrors);
        }
        
        if (error.statusCode === 401) {
          toast.error("Your session has expired. Please login again.");
          navigate("/auth/login");
        } else if (error.statusCode === 403) {
          toast.error("You don't have permission to list properties.");
        } else if (error.statusCode === 422) {
          toast.error("Please check your form inputs.");
        }
      } else {
        toast.error("Failed to list property. Please try again.");
        console.error("Unexpected error:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [form, validate, fileToBase64, navigate]);

  const getPropertyTypeLabel = useCallback((type: string): string => {
    const labels: Record<string, string> = {
      land: "Land",
      house: "House",
      apartment: "Apartment",
      commercial: "Commercial",
      rental: "Rental",
      industrial: "Industrial",
      farm_land: "Farm Land",
      mixed_use: "Mixed Use"
    };
    return labels[type] || type;
  }, []);

  const propertyTypeButtons = useMemo(() => {
    return PROPERTY_TYPES.map(type => (
      <button
        key={type}
        type="button"
        onClick={() => handleChange("property_type", type)}
        className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
          form.property_type === type 
            ? "bg-foreground text-background" 
            : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        {getPropertyTypeLabel(type)}
      </button>
    ));
  }, [form.property_type, handleChange, getPropertyTypeLabel]);

  const imagePreviews = useMemo(() => {
    return form.imagePreviews.map((preview, index) => (
      <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted/30">
        <img src={preview} alt={`Property ${index + 1}`} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={() => removeImage(index)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          <Icon icon="solar:close-bold" className="w-3 h-3" />
        </button>
      </div>
    ));
  }, [form.imagePreviews, removeImage]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button 
            onClick={() => navigate("/dashboard/properties")} 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back
          </button>
          <h1 className="text-3xl font-light tracking-tight">List New Property</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Fill in the details to list your property for approval
          </p>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit} 
          className="space-y-5"
        >
          {/* Title */}
          <FormField
            name="title"
            label="Property Title"
            placeholder="e.g. Modern 4-Bedroom Duplex in Lekki"
            required
            value={form.title}
            onChange={handleChange}
            error={errors.title}
            apiError={apiErrors.title?.[0]}
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => handleChange("description", e.target.value)}
              placeholder="Describe the property in detail..."
              rows={4}
              className={`w-full px-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary resize-none ${
                errors.description || apiErrors.description ? "ring-2 ring-red-500" : ""
              }`}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            {apiErrors.description && !errors.description && (
              <p className="text-red-500 text-xs mt-1">{apiErrors.description[0]}</p>
            )}
          </div>

          {/* Price */}
          <FormField
            name="price"
            label="Price (₦)"
            type="number"
            placeholder="e.g. 45000000"
            required
            value={form.price}
            onChange={handleChange}
            error={errors.price}
            apiError={apiErrors.price?.[0]}
          />

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="city"
              label="City"
              placeholder="e.g. Lagos"
              required
              value={form.city}
              onChange={handleChange}
              error={errors.city}
              apiError={apiErrors.city?.[0]}
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={form.state}
                onChange={e => handleChange("state", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground text-sm outline-none focus:ring-2 focus:ring-primary ${
                  errors.state || apiErrors.state ? "ring-2 ring-red-500" : ""
                }`}
              >
                <option value="">Select State</option>
                {NIGERIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
              {apiErrors.state && !errors.state && (
                <p className="text-red-500 text-xs mt-1">{apiErrors.state[0]}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <FormField
            name="address"
            label="Full Address"
            placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
            required
            value={form.address}
            onChange={handleChange}
            error={errors.address}
            apiError={apiErrors.address?.[0]}
          />

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Property Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {propertyTypeButtons}
            </div>
            {errors.property_type && <p className="text-red-500 text-xs mt-1">{errors.property_type}</p>}
            {apiErrors.property_type && !errors.property_type && (
              <p className="text-red-500 text-xs mt-1">{apiErrors.property_type[0]}</p>
            )}
          </div>

          {/* Bedrooms, Bathrooms, Area */}
          <div className="grid grid-cols-3 gap-4">
            <FormField
              name="bedrooms"
              label="Bedrooms"
              type="number"
              placeholder="4"
              value={form.bedrooms}
              onChange={handleChange}
              error={errors.bedrooms}
              apiError={apiErrors.bedrooms?.[0]}
            />
            <FormField
              name="bathrooms"
              label="Bathrooms"
              type="number"
              placeholder="3"
              value={form.bathrooms}
              onChange={handleChange}
              error={errors.bathrooms}
              apiError={apiErrors.bathrooms?.[0]}
            />
            <FormField
              name="square_meters"
              label="Area (sqm)"
              type="number"
              placeholder="350"
              value={form.square_meters}
              onChange={handleChange}
              error={errors.square_meters}
              apiError={apiErrors.square_meters?.[0]}
            />
          </div>

          {/* Features */}
          <FormField
            name="features"
            label="Features (comma-separated)"
            placeholder="Swimming Pool, Generator, CCTV, Parking..."
            value={form.features}
            onChange={handleChange}
            error={errors.features}
            apiError={apiErrors.features?.[0]}
          />

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Property Images <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center justify-center w-full">
              <label className={`w-full flex flex-col items-center justify-center px-4 py-6 rounded-xl cursor-pointer transition-colors ${
                errors.images || apiErrors.images 
                  ? "bg-red-500/5 ring-2 ring-red-500" 
                  : "bg-muted/30 hover:bg-muted/50"
              }`}>
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Icon icon="solar:upload-bold" className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WEBP (max 5MB each)</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            
            {errors.images && <p className="text-red-500 text-xs mt-1">{errors.images}</p>}
            {apiErrors.images && !errors.images && (
              <p className="text-red-500 text-xs mt-1">{apiErrors.images[0]}</p>
            )}
            
            {/* Image Previews */}
            {form.imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {imagePreviews}
              </div>
            )}
            <p className="text-xs text-muted-foreground/60 mt-2">
              {form.images.length} image{form.images.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
          >
            {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
            {loading ? "Listing..." : "List Property"}
          </button>
        </motion.form>
      </div>
    </DashboardLayout>
  );
}