import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Icon } from "@iconify/react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { icon: "solar:chart-2-bold", label: "Overview", href: "/admin" },
  { icon: "solar:users-group-two-rounded-bold", label: "Users", href: "/admin/users" },
  { icon: "solar:buildings-bold", label: "Properties", href: "/admin/properties" },
  { icon: "solar:user-rounded-bold", label: "Lawyers", href: "/admin/lawyers" },
  { icon: "solar:transfer-horizontal-bold", label: "Transactions", href: "/admin/transactions" },
  { icon: "solar:shield-warning-bold", label: "Disputes", href: "/admin/disputes" },
  { icon: "solar:hand-money-bold", label: "Escrows", href: "/dashboard/escrows" },
  { icon: "solar:document-bold", label: "KYC Reviews", href: "/admin/kyc" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-sidebar z-40 pt-4 pb-6">
        <div className="px-4 mb-4">
          <Link href="/"><img src={'/logo.png'} alt="MyRealtor" className="h-7 w-auto" /></Link>
          <div className="mt-2 px-2 py-1 rounded-lg bg-primary/10">
            <p className="text-xs font-semibold text-primary">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(item => {
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                  <Icon icon={item.icon} className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="px-2 space-y-0.5">
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <Icon icon={theme === "dark" ? "solar:sun-bold" : "solar:moon-bold"} className="w-4 h-4" />
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
       
          <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-muted transition-all">
            <Icon icon="solar:logout-bold" className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 md:ml-60 flex flex-col">
        <header className="sticky top-0 z-30 h-14 flex items-center px-6 backdrop-blur-xl bg-background/80 border-b border-border">
          <h1 className="font-semibold text-sm">Admin Panel</h1>
          <div className="ml-auto text-xs text-muted-foreground">{user?.name}</div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
