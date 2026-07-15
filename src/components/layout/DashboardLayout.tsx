import { ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

function getNavItems(role: string | null): NavItem[] {
  const overview: NavItem = { icon: "solar:home-2-bold", label: "Overview", href: "/dashboard" };
  const messages: NavItem = { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" };
  const notifications: NavItem = { icon: "solar:bell-bold", label: "Notifications", href: "/dashboard/notifications" };
  const profile: NavItem = { icon: "solar:user-bold", label: "Profile", href: "/dashboard/profile" };
  const escrows: NavItem = { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" };
  const payments: NavItem = { icon: "solar:card-bold", label: "Payments", href: "/dashboard/payments" };
  const disputes: NavItem = { icon: "solar:shield-bold", label: "Disputes", href: "/dashboard/disputes" };
  const kyc: NavItem = { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" };

  if (role === "seller") {
    return [
      overview,
      { icon: "solar:buildings-bold", label: "My Properties", href: "/dashboard/properties" },
      escrows,
      payments,
      disputes,
      kyc,
      messages,
      notifications,
      profile,
    ];
  }

  if (role === "lawyer") {
    return [
      overview,
      { icon: "solar:diploma-bold", label: "Manage Licence", href: "/dashboard/lawyer-profile" },
      escrows,
      disputes,
      messages,
      notifications,
      profile,
    ];
  }

  if (role === "admin") {
    return [
      overview,
      { icon: "solar:graph-bold", label: "Admin Panel", href: "/admin" },
      { icon: "solar:users-group-two-rounded-bold", label: "Users", href: "/admin/users" },
      { icon: "solar:buildings-bold", label: "Properties", href: "/admin/properties" },
      { icon: "solar:diploma-bold", label: "Lawyers", href: "/admin/lawyers" },
      { icon: "solar:hand-money-bold", label: "Transactions", href: "/admin/transactions" },
      { icon: "solar:shield-bold", label: "Disputes", href: "/admin/disputes" },
      { icon: "solar:document-bold", label: "KYC", href: "/admin/kyc" },
      messages,
      notifications,
      profile,
    ];
  }

  return [
    overview,
    { icon: "solar:heart-bold", label: "Favorites", href: "/dashboard/favorites" },
    escrows,
    payments,
    disputes,
    kyc,
    messages,
    notifications,
    profile,
  ];
}

const roleLabels: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  lawyer: "Lawyer",
  admin: "Admin",
};

const roleIcons: Record<string, string> = {
  buyer: "solar:user-bold",
  seller: "solar:shop-bold",
  lawyer: "solar:diploma-bold",
  admin: "solar:shield-check-bold",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const role = user?.role;

  useEffect(() => {
    if (user?.photo) {
      setProfilePhoto(user.photo);
    } else {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed.photo) {
            setProfilePhoto(parsed.photo);
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [user]);

  const navItems = getNavItems(role);
  const mobileNavItems = navItems.length > 5 ? navItems.slice(0, 5) : navItems;

  if (!role) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-16 flex items-center px-4 md:px-6 backdrop-blur-xl bg-background/80">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <Link href="/dashboard/profile">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold cursor-pointer overflow-hidden"
                >
                  ?
                </motion.div>
              </Link>
            </div>
          </header>
          <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  const NavLink = ({ item, mobile = false, index = 0 }: { item: NavItem; mobile?: boolean; index?: number }) => {
    const isActive = location === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
    
    return (
      <motion.div
        initial={mobile ? { x: -20, opacity: 0 } : { opacity: 0, y: -10 }}
        animate={mobile ? { x: 0, opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: mobile ? index * 0.03 : index * 0.02 }}
      >
        <Link href={item.href}>
          <motion.div
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => mobile && setSidebarOpen(false)}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNav"
                className="absolute inset-0 rounded-xl bg-primary/5"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <Icon icon={item.icon} className={`w-5 h-5 shrink-0 relative z-10 ${isActive ? "text-primary" : ""}`} />
            <span className="relative z-10">{item.label}</span>
            {isActive && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute left-0 w-0.5 h-6 bg-primary rounded-r-full"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </motion.div>
        </Link>
      </motion.div>
    );
  };

  const displayName = user?.name || "User";
  const initials = getInitials(displayName);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <motion.aside 
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-card/50 backdrop-blur-xl border-r border-border/50 z-40 pt-6 pb-6"
      >
        <div className="px-4 mb-6">
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Link href="/">
              <img src={'https://uptrendtrader.com/realtor/uploads/logo.png'} alt="PlotWise" className="h-10 w-auto" />
            </Link>
          </motion.div>
        </div>
        
        {role && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 mb-4"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
              <Icon icon={roleIcons[role] || "solar:user-bold"} className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">{roleLabels[role] ?? role}</span>
            </div>
          </motion.div>
        )}

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item, index) => (
            <NavLink key={item.href} item={item} index={index} />
          ))}
        </nav>

        <div className="px-2 space-y-0.5 mt-4 pt-4 border-t border-border/50">
          <motion.button
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
          >
            <Icon icon={theme === "dark" ? "solar:sun-bold" : "solar:moon-bold"} className="w-5 h-5" />
            {theme === "dark" ? "Light" : "Dark"}
          </motion.button>
          
          <motion.button
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
          >
            <Icon icon="solar:logout-bold" className="w-5 h-5" />
            Logout
          </motion.button>
        </div>
      </motion.aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-card/95 backdrop-blur-xl border-r border-border/50 z-50 flex flex-col pt-6 pb-6 md:hidden"
            >
              <div className="px-4 mb-4 flex items-center justify-between">
                <img src={'https://uptrendtrader.com/realtor/uploads/logo.png'} alt="PlotWise" className="h-8 w-auto" />
                <motion.button
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                >
                  <Icon icon="solar:close-circle-bold" className="w-6 h-6 text-muted-foreground" />
                </motion.button>
              </div>
              
              {role && (
                <div className="px-4 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 w-fit">
                    <Icon icon={roleIcons[role] || "solar:user-bold"} className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">{roleLabels[role] ?? role}</span>
                  </div>
                </div>
              )}

              <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                {navItems.map((item, index) => (
                  <NavLink key={item.href} item={item} mobile index={index} />
                ))}
              </nav>

              <div className="px-2 space-y-0.5 mt-4 pt-4 border-t border-border/50">
                <motion.button
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { logout(); navigate("/"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
                >
                  <Icon icon="solar:logout-bold" className="w-5 h-5" />
                  Logout
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 flex items-center px-4 md:px-6 backdrop-blur-xl bg-background/80 border-b border-border/50">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="md:hidden p-2 mr-2 rounded-full hover:bg-muted/50 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon icon="solar:hamburger-menu-bold" className="w-6 h-6" />
          </motion.button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link href="/dashboard/notifications">
                <button className="p-2 rounded-full hover:bg-muted/50 transition-colors relative">
                  <Icon icon="solar:bell-bold" className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full"></span>
                </button>
              </Link>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link href="/dashboard/profile">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold cursor-pointer overflow-hidden border border-primary/20">
                  {profilePhoto ? (
                    <img 
                      src={profilePhoto} 
                      alt={displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const span = document.createElement('span');
                          span.textContent = initials;
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
              </Link>
            </motion.div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      {mobileNavItems.length > 0 && (
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden h-16 flex items-center bg-background/90 backdrop-blur-xl border-t border-border/50"
        >
          {mobileNavItems.map((item, index) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
            return (
              <motion.div
                key={item.href}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex-1"
              >
                <Link href={item.href}>
                  <motion.div
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex flex-col items-center gap-0.5 py-2 cursor-pointer transition-all duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div className="relative">
                      <Icon icon={item.icon} className="w-5 h-5" />
                      {isActive && (
                        <motion.div
                          layoutId="mobileActive"
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-medium truncate max-w-[50px]">{item.label}</span>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>
      )}
    </div>
  );
}