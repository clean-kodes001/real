import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthAPI } from "@/services/api";

export default function VerifyEmail() {
  const { user, verifyEmail, resendVerification, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [uuid, setUuid] = useState("");

  useEffect(() => {
   
    
    // Method 1: Get from window.history.state (works with wouter)
    // wouter stores state in window.history.state
    if (window.history.state) {
      const state = window.history.state;
      
      // Check if state has the data we need
      if (state.email || state.uuid) {
        setEmail(state.email || "");
        setUuid(state.uuid || "");
        toast.success(`Found: ${state.email} - ${state.uuid}`);
        return;
      }
      
      // Check if state is nested inside a 'state' property
      if (state.state && (state.state.email || state.state.uuid)) {
        setEmail(state.state.email || "");
        setUuid(state.state.uuid || "");
        toast.success(`Found nested: ${state.state.email} - ${state.state.uuid}`);
        return;
      }
    }

    // Method 2: Get from URL query parameters (fallback)
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const uuidParam = params.get('uuid');
    if (emailParam) setEmail(decodeURIComponent(emailParam));
    if (uuidParam) setUuid(uuidParam);
    if (emailParam || uuidParam) {
      toast.success(`From URL: ${emailParam} - ${uuidParam}`);
      return;
    }

    // Method 3: Get from localStorage (fallback)
    const storedEmail = localStorage.getItem('verify_email');
    const storedUuid = localStorage.getItem('verify_uuid');
    if (storedEmail) setEmail(storedEmail);
    if (storedUuid) setUuid(storedUuid);
    if (storedEmail || storedUuid) {
      toast.success(`From localStorage: ${storedEmail} - ${storedUuid}`);
      return;
    }

    // Method 4: Get from user context
    if (user) {
      setEmail(user.email || "");
      setUuid(user.uuid || "");
      toast.success(`From user: ${user.email} - ${user.uuid}`);
    }

    // If already authenticated and verified, go to dashboard
    if (isAuthenticated && user?.email_verified && !isLoading) {
      navigate("/dashboard");
    }
  }, [location, isAuthenticated, user, isLoading, navigate]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Please enter the verification code");
      return;
    }
    if (!uuid) {
      toast.error("User ID not found. Please try again.");
      return;
    }
    
    setLoading(true);
    try {
      await verifyEmail(uuid, code.trim());
      toast.success("Email verified! You can now sign in.");
      localStorage.removeItem('verify_email');
      localStorage.removeItem('verify_uuid');
      navigate("/auth/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!uuid) {
      toast.error("User ID not found. Please try again.");
      return;
    }
    
    setResending(true);
    try {
      await resendVerification(uuid);
      toast.success("Verification code resent to your email");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
        <Link href="/" className="flex justify-center mb-8">
          <img src={'/logo.png'} alt="MyRealtor" className="h-10 w-auto" />
        </Link>
        
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Icon icon="solar:letter-bold" className="w-8 h-8 text-primary" />
        </div>
        
        <h1 className="text-2xl font-display font-bold mb-2">Verify Your Email</h1>
        <p className="text-muted-foreground text-sm mb-2">
          We sent a verification code to <span className="font-medium text-foreground">{email || 'your email'}</span>
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Enter it below to activate your account.
        </p>
        
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            className="w-full text-center px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all tracking-widest"
            maxLength={6}
            autoFocus
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>
        
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Didn't receive the code?</span>
          <button 
            onClick={handleResend} 
            disabled={resending} 
            className="text-primary hover:opacity-80 transition-opacity disabled:opacity-50 font-medium"
          >
            {resending ? "Resending..." : "Resend code"}
          </button>
        </div>
        
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary font-medium hover:opacity-80 transition-opacity">
            Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}