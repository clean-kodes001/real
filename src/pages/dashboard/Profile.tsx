import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { UserAPI, ApiError } from "@/services/api";
import { getInitials, formatDate } from "@/lib/utils";

interface ProfileData {
  uuid?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  is_active?: number;
  email_verified?: number;
  created_at?: string;
  photo?: string;
  photo_url?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "account" | "bank">("profile");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
  });
  const [bankForm, setBankForm] = useState({
    bank_name: "",
    account_number: "",
    account_name: "",
  });
  const [pwdForm, setPwdForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddBankDetails = user?.role === 'seller' || user?.role === 'lawyer';

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError(null);
    try {
      const response = await UserAPI.getProfile();
      const data = response.data;
      setProfile(data);

      if (data) {
        setForm({
          name: data.name ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          country: data.country ?? "",
        });
        
        setBankForm({
          bank_name: data.bank_name ?? "",
          account_number: data.account_number ?? "",
          account_name: data.account_name ?? "",
        });
        
        if (user && data.photo_url) {
          updateUser({ photo: data.photo_url });
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load profile");
        setError("Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    
    setUpdating(true);
    try {
      await UserAPI.updateProfile({
        name: form.name,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country || undefined,
      });
      
      toast.success("Profile updated successfully!");
      
      if (user) {
        updateUser({ 
          name: form.name,
          phone: form.phone,
        });
      }
      
      await fetchProfile();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateBankDetails(e: React.FormEvent) {
    e.preventDefault();
    
    if (!bankForm.bank_name.trim()) {
      toast.error("Bank name is required");
      return;
    }
    if (!bankForm.account_number.trim() || bankForm.account_number.length < 10) {
      toast.error("Valid account number is required");
      return;
    }
    if (!bankForm.account_name.trim()) {
      toast.error("Account name is required");
      return;
    }

    setUpdating(true);
    try {
      await UserAPI.updateBankDetails({
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        account_name: bankForm.account_name,
      });
      
      toast.success("Bank details updated successfully!");
      await fetchProfile();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to update bank details");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (pwdForm.new_password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pwdForm.current_password === pwdForm.new_password) {
      toast.error("New password must be different from current password");
      return;
    }

    setChangingPwd(true);
    try {
      await UserAPI.changePassword(
        pwdForm.current_password,
        pwdForm.new_password,
        pwdForm.confirm_password
      );
      
      toast.success("Password changed successfully!");
      setPwdForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setChangingPwd(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 2MB");
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingPhoto(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await UserAPI.uploadPhoto(base64);
      
      toast.success("Profile photo updated!");
      
      const photoUrl = response.data?.photo_url;
      
      setProfile(prev => prev ? { 
        ...prev, 
        photo_url: photoUrl,
        photo: photoUrl
      } : null);
      
      if (user && photoUrl) {
        updateUser({ photo: photoUrl });
      }
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to upload photo");
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure you want to deactivate your account? This action cannot be undone.")) return;
    
    const password = prompt("Please enter your password to confirm account deletion:");
    if (!password) return;

    try {
      await UserAPI.deleteAccount(password);
      toast.success("Account deactivated successfully");
      logout();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to deactivate account");
      }
    }
  }

  const getPhotoUrl = () => {
    return profile?.photo_url || profile?.photo || null;
  };

  const getTabs = () => {
    const tabs = ["profile", "security", "account"];
    if (canAddBankDetails) {
      tabs.push("bank");
    }
    return tabs;
  };

  const tabLabels: Record<string, string> = {
    profile: "Profile",
    security: "Security",
    account: "Account",
    bank: "Bank Details"
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">
            Manage your account information
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-muted/30">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Profile Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-muted/30 mb-6"
            >
              <div className="relative group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-light overflow-hidden">
                  {getPhotoUrl() ? (
                    <img 
                      src={getPhotoUrl()} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const initials = document.createElement('span');
                          initials.textContent = getInitials(profile?.name ?? user?.name ?? "U");
                          parent.appendChild(initials);
                        }
                      }}
                    />
                  ) : (
                    getInitials(profile?.name ?? user?.name ?? "U")
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50"
                  title="Change photo"
                >
                  {uploadingPhoto ? (
                    <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />
                  ) : (
                    <Icon icon="solar:camera-bold" className="w-3 h-3" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-lg">{profile?.name ?? user?.name ?? ""}</p>
                <p className="text-sm text-muted-foreground">{profile?.email ?? user?.email ?? ""}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">
                    {profile?.role ?? user?.role ?? ""}
                  </span>
                  {profile?.email_verified ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <Icon icon="solar:clock-circle-bold" className="w-3.5 h-3.5" /> Unverified
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-6">
              {getTabs().map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    activeTab === tab 
                      ? "bg-background text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tabLabels[tab] || tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    {[
                      { key: "name" as const, label: "Full Name", icon: "solar:user-bold" },
                      { key: "phone" as const, label: "Phone Number", icon: "solar:phone-bold" },
                      { key: "address" as const, label: "Address", icon: "solar:map-point-bold" },
                      { key: "city" as const, label: "City", icon: "solar:city-bold" },
                      { key: "state" as const, label: "State", icon: "solar:map-bold" },
                      { key: "country" as const, label: "Country", icon: "solar:globe-bold" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                        <div className="relative">
                          <Icon icon={f.icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            value={form[f.key]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      type="submit" 
                      disabled={updating}
                      className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                    >
                      {updating && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                      {updating ? "Saving..." : "Save Changes"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <motion.div 
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Current Password</label>
                      <div className="relative">
                        <Icon icon="solar:lock-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type={showCurrentPwd ? "text" : "password"}
                          value={pwdForm.current_password}
                          onChange={e => setPwdForm(prev => ({ ...prev, current_password: e.target.value }))}
                          placeholder="Enter current password"
                          className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPwd(s => !s)} 
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <Icon icon={showCurrentPwd ? "solar:eye-closed-bold" : "solar:eye-bold"} className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">New Password</label>
                      <div className="relative">
                        <Icon icon="solar:lock-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type={showNewPwd ? "text" : "password"}
                          value={pwdForm.new_password}
                          onChange={e => setPwdForm(prev => ({ ...prev, new_password: e.target.value }))}
                          placeholder="Enter new password (min 8 characters)"
                          className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPwd(s => !s)} 
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <Icon icon={showNewPwd ? "solar:eye-closed-bold" : "solar:eye-bold"} className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <Icon icon="solar:lock-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type={showNewPwd ? "text" : "password"}
                          value={pwdForm.confirm_password}
                          onChange={e => setPwdForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                          placeholder="Confirm new password"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={changingPwd}
                      className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                    >
                      {changingPwd && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                      {changingPwd ? "Changing..." : "Change Password"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Bank Details Tab */}
              {activeTab === "bank" && canAddBankDetails && (
                <motion.div 
                  key="bank"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4">
                    <h3 className="font-medium text-lg">Bank Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Add your bank account details for receiving payouts
                    </p>
                  </div>

                  <form onSubmit={handleUpdateBankDetails} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Icon icon="solar:buildings-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          value={bankForm.bank_name}
                          onChange={e => setBankForm(prev => ({ ...prev, bank_name: e.target.value }))}
                          placeholder="e.g. GTBank, Access Bank, UBA"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Account Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Icon icon="solar:card-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={bankForm.account_number}
                          onChange={e => setBankForm(prev => ({ ...prev, account_number: e.target.value.replace(/\D/g, '') }))}
                          placeholder="e.g. 0123456789"
                          maxLength={10}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Account Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Icon icon="solar:user-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          value={bankForm.account_name}
                          onChange={e => setBankForm(prev => ({ ...prev, account_name: e.target.value }))}
                          placeholder="Full name on the bank account"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 focus:bg-muted transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={updating}
                      className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                    >
                      {updating && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                      {updating ? "Saving..." : "Save Bank Details"}
                    </button>
                  </form>

                  {/* Current Bank Details */}
                  {profile?.bank_name && profile?.account_number && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-500/5">
                      <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2">Current Bank Details</p>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Bank:</span> {profile.bank_name}</p>
                        <p><span className="text-muted-foreground">Account Number:</span> {profile.account_number}</p>
                        <p><span className="text-muted-foreground">Account Name:</span> {profile.account_name}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Account Tab */}
              {activeTab === "account" && (
                <motion.div 
                  key="account"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="p-5 rounded-2xl bg-muted/30">
                    <h3 className="font-medium text-lg">Account Information</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account ID</span>
                        <span className="font-mono text-xs">{profile?.uuid || user?.uuid || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Member Since</span>
                        <span>{profile?.created_at ? formatDate(profile.created_at) : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Status</span>
                        <span className={profile?.is_active ? "text-emerald-500" : "text-red-500"}>
                          {profile?.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email Status</span>
                        <span className={profile?.email_verified ? "text-emerald-500" : "text-amber-500"}>
                          {profile?.email_verified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <span className="capitalize">{profile?.role || user?.role || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-5 rounded-2xl bg-red-500/5">
                    <h3 className="font-medium text-red-500">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Once you deactivate your account, you will lose access to all your data.
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      Deactivate Account
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}