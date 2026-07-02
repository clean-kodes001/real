import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Register() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    role: "buyer" as "buyer" | "seller" | "lawyer",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.phone) e.phone = "Phone number is required";
    else if (!/^[0-9+\-\s()]{10,15}$/.test(form.phone)) e.phone = "Enter a valid phone number";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters";
    if (form.password !== form.confirm_password) e.confirm_password = "Passwords do not match";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { confirm_password, ...registerData } = form;
      const result = await register(registerData);
      toast.success("Account created! Please verify your email.");
      navigate("/auth/verify-email", { 
        state: { email: form.email, uuid: result.uuid } 
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const field = (name: keyof typeof form, label: string, type = "text", icon = "solar:user-bold", placeholder = "") => {
    const isPassword = name === "password" || name === "confirm_password";
    const showState = name === "password" ? showPass : showConfirmPass;
    const setShowState = name === "password" ? setShowPass : setShowConfirmPass;
    
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5">{label}</label>
        <div className="relative">
          <Icon icon={icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={isPassword ? (showState ? "text" : "password") : type}
            value={form[name]}
            onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
            placeholder={placeholder}
            className={`w-full pl-10 pr-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition-all ${errors[name] ? "ring-2 ring-destructive" : ""}`}
          />
          {isPassword && (
            <button 
              type="button" 
              onClick={() => setShowState(s => !s)} 
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <Icon icon={showState ? "solar:eye-closed-bold" : "solar:eye-bold"} className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {errors[name] && <p className="text-destructive text-xs mt-1">{errors[name]}</p>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8">
          <img src={'/logo.png'} alt="MyRealtor" className="h-10 w-auto" />
        </Link>
        <h1 className="text-2xl font-display font-bold text-center mb-1">Create Account</h1>
        <p className="text-center text-muted-foreground text-sm mb-8">Join thousands of Nigerians on MyRealtor</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field("full_name", "Full Name", "text", "solar:user-bold", "John Doe")}
          {field("email", "Email", "email", "solar:letter-bold", "you@example.com")}
          {field("phone", "Phone Number", "tel", "solar:phone-bold", "+234 800 000 0000")}
          {field("password", "Password", "password", "solar:lock-bold", "••••••••")}
          {field("confirm_password", "Confirm Password", "password", "solar:lock-bold", "••••••••")}

          <div>
            <label className="block text-sm font-medium mb-2">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {(["buyer", "seller", "lawyer"] as const).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role }))}
                  className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    form.role === role ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="text-primary">Terms</Link>{" "}and{" "}
          <Link href="/privacy" className="text-primary">Privacy Policy</Link>
        </p>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary font-semibold hover:opacity-80 transition-opacity">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}