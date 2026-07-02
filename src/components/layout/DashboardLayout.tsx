import { ReactNode, useState, useEffect } from "react";
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
  // Base nav items for all roles
  const overview: NavItem = { icon: "solar:home-2-bold", label: "Overview", href: "/dashboard" };
  const messages: NavItem = { icon: "solar:chat-round-bold", label: "Messages", href: "/dashboard/messages" };
  const notifications: NavItem = { icon: "solar:bell-bold", label: "Notifications", href: "/dashboard/notifications" };
  const profile: NavItem = { icon: "solar:user-bold", label: "Profile", href: "/dashboard/profile" };
  const escrows: NavItem = { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" };
  const payments: NavItem = { icon: "solar:card-bold", label: "Payments", href: "/dashboard/payments" };
  const disputes: NavItem = { icon: "solar:shield-bold", label: "Disputes", href: "/dashboard/disputes" };
  const kyc: NavItem = { icon: "solar:document-bold", label: "KYC", href: "/dashboard/kyc" };

  // Return role-specific navigation

  console.log(role)
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

  // Default: Buyer role
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const role = user?.role

  // Get profile photo from user or localStorage
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

  // Get nav items based on role
  const navItems = getNavItems(role);

  
  // Mobile nav items - take first 5 or all if less than 5
  const mobileNavItems = navItems.length > 5 ? navItems.slice(0, 5) : navItems;

  // If no role, show minimal layout
  if (!role) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-16 flex items-center px-4 md:px-6 backdrop-blur-xl bg-background/80">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <Link href="/dashboard/profile">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold cursor-pointer overflow-hidden">
                  ?
                </div>
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

  const NavLink = ({ item, mobile = false }: { item: NavItem; mobile?: boolean }) => {
    const isActive = location === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
    return (
      <Link href={item.href}>
        <div
          onClick={() => mobile && setSidebarOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Icon icon={item.icon} className="w-5 h-5 shrink-0" />
          {item.label}
        </div>
      </Link>
    );
  };

  const displayName = user?.name || "User";
  const initials = getInitials(displayName);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-sidebar z-40 pt-4 pb-6">
        <div className="px-4 mb-4">
          <Link href="/">
            <img src={'/logo.png'} alt="MyRealtor" className="h-8 w-auto" />
          </Link>
        </div>
        {role && (
          <div className="px-4 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
              <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5" />
              {roleLabels[role] ?? role}
            </span>
          </div>
        )}
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {navItems.length > 0 ? (
            navItems.map(item => <NavLink key={item.href} item={item} />)
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              No navigation items
            </div>
          )}
        </nav>
        <div className="px-2 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Icon icon={theme === "dark" ? "solar:sun-bold" : "solar:moon-bold"} className="w-5 h-5" />
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-muted transition-all"
          >
            <Icon icon="solar:logout-bold" className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-sidebar z-50 flex flex-col pt-6 pb-6 md:hidden"
            >
              <div className="px-4 mb-4 flex items-center justify-between">
                <img src={'/logo.png'} alt="MyRealtor" className="h-8 w-auto" />
                <button onClick={() => setSidebarOpen(false)} className="p-1">
                  <Icon icon="solar:close-circle-bold" className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
              {role && (
                <div className="px-4 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                    <Icon icon="solar:verified-check-bold" className="w-3.5 h-3.5" />
                    {roleLabels[role] ?? role}
                  </span>
                </div>
              )}
              <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
                {navItems.length > 0 ? (
                  navItems.map(item => <NavLink key={item.href} item={item} mobile />)
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No navigation items
                  </div>
                )}
              </nav>
              <div className="px-2 space-y-1">
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-muted transition-all"
                >
                  <Icon icon="solar:logout-bold" className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 flex items-center px-4 md:px-6 backdrop-blur-xl bg-background/80">
          <button className="md:hidden p-2 mr-2" onClick={() => setSidebarOpen(true)}>
            <Icon icon="solar:hamburger-menu-bold" className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Link href="/dashboard/notifications">
              <button className="p-2 rounded-full hover:bg-muted transition-colors relative">
                <Icon icon="solar:bell-bold" className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/dashboard/profile">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold cursor-pointer overflow-hidden">
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
                  initials
                )}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar - Only show if there are items */}
      {mobileNavItems.length > 0 && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden h-16 flex items-center bg-background/90 backdrop-blur-xl border-t border-border">
          {mobileNavItems.map(item => {
            const isActive = location === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={`flex flex-col items-center gap-0.5 py-2 cursor-pointer transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  <Icon icon={item.icon} className="w-5 h-5" />
                  <span className="text-[10px] font-medium truncate max-w-[50px]">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}