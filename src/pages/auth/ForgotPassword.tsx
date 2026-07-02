import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { AuthAPI } from "@/services/api";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [uuid, setUuid] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    
    setLoading(true);
    try {
      const response = await AuthAPI.forgotPassword(email);
      setResetEmail(email);
      setUuid(response.data?.uuid || "");
      setSent(true);
      toast.success("Reset code sent to your email");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
        <Link href="/" className="flex justify-center mb-8">
          <img src={'/logo.png'} alt="MyRealtor" className="h-10 w-auto" />
        </Link>
        
        {sent ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <Icon icon="solar:check-circle-bold" className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">Check Your Email</h1>
            <p className="text-muted-foreground text-sm mb-2">
              We sent a password reset OTP to <strong className="text-foreground">{resetEmail}</strong>
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Enter the 6-digit OTP on the next page to reset your password. The OTP expires in 10 minutes.
            </p>
            <button 
              onClick={() => navigate(`/auth/reset-password?uuid=${uuid}`)} 
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Enter OTP Code
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Icon icon="solar:key-bold" className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">Forgot Password?</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Enter your email and we'll send you a 6-digit OTP to reset your password.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email Address</label>
                <div className="relative">
                  <Icon icon="solar:letter-bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                    autoFocus
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              >
                {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          </>
        )}
        
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary font-medium hover:opacity-80 transition-opacity">
            Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}