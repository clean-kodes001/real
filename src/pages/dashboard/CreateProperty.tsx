import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
        <div className="max-w-2xl mx-auto py-20 text-center">
          <Icon icon="solar:danger-triangle-bold" className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only sellers and admins can list properties.</p>
          <button 
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  function validate() {
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
  }

  function handleChange(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear client-side error
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    // Clear API errors for this field
    if (apiErrors[key]) {
      setApiErrors(e => {
        const newErrors = { ...e };
        delete newErrors[key];
        return newErrors;
      });
    }
  }

  // ✅ FIX: Handle number inputs properly
  function handleNumberChange(key: keyof FormData, value: string) {
    // Allow empty string or valid numbers only
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setForm(prev => ({ ...prev, [key]: value }));
      if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
      if (apiErrors[key]) {
        setApiErrors(e => {
          const newErrors = { ...e };
          delete newErrors[key];
          return newErrors;
        });
      }
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Image ${file.name} is too large (max 5MB)`);
        continue;
      }
      // Check file type
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
      // Clear image errors
      if (errors.images) setErrors(e => ({ ...e, images: undefined }));
      if (apiErrors.images) {
        setApiErrors(e => {
          const newErrors = { ...e };
          delete newErrors.images;
          return newErrors;
        });
      }
    }
  }

  function removeImage(index: number) {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imagePreviews: prev.imagePreviews.filter((_, i) => i !== index),
    }));
  }

  // Convert image to base64 for API
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate form
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);
    setApiErrors({});
    
    try {
      // Convert images to base64
      const imagePromises = form.images.map(fileToBase64);
      const imageBase64 = await Promise.all(imagePromises);

      // Prepare data for API
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
      // Handle ApiError properly
      if (error instanceof ApiError) {
        // Show the error message from API
        toast.error(error.getDisplayMessage());
        
        // If there are field-specific errors, set them
        if (error.hasFieldErrors()) {
          setApiErrors(error.errors || {});
          
          // Map API errors to form fields
          const fieldErrors: Partial<Record<keyof FormData, string>> = {};
          Object.entries(error.errors || {}).forEach(([key, values]) => {
            const formKey = key as keyof FormData;
            if (formKey in form) {
              fieldErrors[formKey] = values[0] || `${key} is invalid`;
            }
          });
          setErrors(fieldErrors);
        }
        
        // Handle specific status codes
        if (error.statusCode === 401) {
          toast.error("Your session has expired. Please login again.");
          navigate("/auth/login");
        } else if (error.statusCode === 403) {
          toast.error("You don't have permission to list properties.");
        } else if (error.statusCode === 422) {
          toast.error("Please check your form inputs.");
        }
      } else {
        // Handle unexpected errors
        toast.error("Failed to list property. Please try again.");
        console.error("Unexpected error:", error);
      }
    } finally {
      setLoading(false);
    }
  }

  function Field({ 
    name, 
    label, 
    type = "text", 
    placeholder = "",
    required = false 
  }: { 
    name: keyof FormData; 
    label: string; 
    type?: string; 
    placeholder?: string;
    required?: boolean;
  }) {
    // Check if there are API errors for this field
    const hasApiError = apiErrors[name] && apiErrors[name].length > 0;
    const apiErrorMessage = hasApiError ? apiErrors[name][0] : null;
    const hasError = errors[name] || hasApiError;
    
    const isNumberType = type === "number";
    
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <input
          type={type}
          value={form[name] as string}
          onChange={(e) => {
            if (isNumberType) {
              handleNumberChange(name, e.target.value);
            } else {
              handleChange(name, e.target.value);
            }
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all ${
            hasError ? "ring-2 ring-destructive" : ""
          }`}
        />
        {errors[name] && <p className="text-destructive text-xs mt-1">{errors[name]}</p>}
        {apiErrorMessage && !errors[name] && (
          <p className="text-destructive text-xs mt-1">{apiErrorMessage}</p>
        )}
      </div>
    );
  }

  // ✅ Get display name for property type
  function getPropertyTypeLabel(type: string): string {
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
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <button 
            onClick={() => navigate("/dashboard/properties")} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
          >
            <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back to properties
          </button>
          <h1 className="text-2xl font-display font-bold">List New Property</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Fill in the details to list your property for approval
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <Field name="title" label="Property Title" placeholder="e.g. Modern 4-Bedroom Duplex in Lekki" required />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-destructive">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => handleChange("description", e.target.value)}
              placeholder="Describe the property in detail..."
              rows={4}
              className={`w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all resize-none ${
                errors.description || apiErrors.description ? "ring-2 ring-destructive" : ""
              }`}
            />
            {errors.description && <p className="text-destructive text-xs mt-1">{errors.description}</p>}
            {apiErrors.description && !errors.description && (
              <p className="text-destructive text-xs mt-1">{apiErrors.description[0]}</p>
            )}
          </div>

          {/* Price */}
          <Field name="price" label="Price (₦)" type="number" placeholder="e.g. 45000000" required />

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <Field name="city" label="City" placeholder="e.g. Lagos" required />
            <div>
              <label className="block text-sm font-medium mb-1.5">
                State <span className="text-destructive">*</span>
              </label>
              <select
                value={form.state}
                onChange={e => handleChange("state", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.state || apiErrors.state ? "ring-2 ring-destructive" : ""
                }`}
              >
                <option value="">Select State</option>
                {NIGERIAN_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              {errors.state && <p className="text-destructive text-xs mt-1">{errors.state}</p>}
              {apiErrors.state && !errors.state && (
                <p className="text-destructive text-xs mt-1">{apiErrors.state[0]}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <Field name="address" label="Full Address" placeholder="e.g. 14 Admiralty Way, Lekki Phase 1" required />

          {/* Property Type - ✅ Updated to match database ENUM */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Property Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROPERTY_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChange("property_type", type)}
                  className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    form.property_type === type 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`}
                >
                  {getPropertyTypeLabel(type)}
                </button>
              ))}
            </div>
            {errors.property_type && <p className="text-destructive text-xs mt-1">{errors.property_type}</p>}
            {apiErrors.property_type && !errors.property_type && (
              <p className="text-destructive text-xs mt-1">{apiErrors.property_type[0]}</p>
            )}
          </div>

          {/* Bedrooms, Bathrooms, Area */}
          <div className="grid grid-cols-3 gap-4">
            <Field name="bedrooms" label="Bedrooms" type="number" placeholder="4" />
            <Field name="bathrooms" label="Bathrooms" type="number" placeholder="3" />
            <Field name="square_meters" label="Area (sqm)" type="number" placeholder="350" />
          </div>

          {/* Features */}
          <Field 
            name="features" 
            label="Features (comma-separated)" 
            placeholder="Swimming Pool, Generator, CCTV, Parking..." 
          />

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Property Images <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center justify-center w-full">
              <label className={`w-full flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                errors.images || apiErrors.images 
                  ? "border-destructive bg-destructive/5" 
                  : "border-muted-foreground/30 hover:border-primary/50 bg-muted/30"
              }`}>
                <Icon icon="solar:upload-bold" className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (max 5MB each)</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            
            {errors.images && <p className="text-destructive text-xs mt-1">{errors.images}</p>}
            {apiErrors.images && !errors.images && (
              <p className="text-destructive text-xs mt-1">{apiErrors.images[0]}</p>
            )}
            
            {/* Image Previews */}
            {form.imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {form.imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={preview} alt={`Property ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 hover:bg-destructive text-white transition-colors"
                    >
                      <Icon icon="solar:close-bold" className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {form.images.length} image{form.images.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
            {loading ? "Listing property..." : "List Property"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}