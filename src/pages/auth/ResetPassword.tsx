import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { AuthAPI } from "@/services/api";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ 
    uuid: "",
    otp: "",
    new_password: "", 
    confirm_password: "" 
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    // Get UUID from URL params
    const params = new URLSearchParams(window.location.search);
    const uuid = params.get('uuid');
    
    if (uuid) {
      setForm(prev => ({ ...prev, uuid }));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate
    if (!form.uuid) {
      toast.error("Invalid reset session. Please request a new OTP.");
      return;
    }
    if (!form.otp || form.otp.length < 6) {
      toast.error("Please enter the 6-digit OTP code");
      return;
    }
    if (!form.new_password || form.new_password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    
    setLoading(true);
    try {
      await AuthAPI.resetPassword(form.uuid, form.otp, form.new_password);
      setResetSuccess(true);
      toast.success("Password reset successfully!");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/auth/login");
      }, 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  }

  // Handle OTP input - only allow numbers
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setForm(prev => ({ ...prev, otp: value }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Link href="/" className="flex justify-center mb-8">
          <img src={'https://uptrendtrader.com/realtor/uploads/logo.png'} alt="PlotWise" className="h-10 w-auto" />
        </Link>
        
        {resetSuccess ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-display font-bold text-center mb-2">Password Reset!</h1>
            <p className="text-center text-muted-foreground text-sm mb-8">
              Your password has been reset successfully. Redirecting to login...
            </p>
            <Link 
              href="/auth/login" 
              className="block w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-center"
            >
              Go to Login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold text-center mb-1">Reset Password</h1>
            <p className="text-center text-muted-foreground text-sm mb-8">
              Enter the 6-digit OTP from your email and your new password.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* OTP Code */}
              <div>
                <label className="block text-sm font-medium mb-1.5">OTP Code</label>
                <div className="relative">
                  <Icon icon="solar:key-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={form.otp}
                    onChange={handleOtpChange}
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all text-center tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Enter the 6-digit code sent to your email
                </p>
              </div>
              
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5">New Password</label>
                <div className="relative">
                  <Icon icon="solar:lock-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.new_password}
                    onChange={e => setForm(prev => ({ ...prev, new_password: e.target.value }))}
                    placeholder="•••••••• (min 8 characters)"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(s => !s)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <Icon icon={showPass ? "solar:eye-closed-bold" : "solar:eye-bold"} className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              
              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Icon icon="solar:lock-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.confirm_password}
                    onChange={e => setForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              >
                {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}
        
        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/auth/login" className="text-primary font-medium hover:opacity-80 transition-opacity">
            Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}