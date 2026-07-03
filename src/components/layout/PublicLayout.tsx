import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Icon } from "@iconify/react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

const navLinks = [
  { label: "Properties", href: "/properties" },
  { label: "Lawyers", href: "/lawyers" },
  { label: "About", href: "/about" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 backdrop-blur-xl bg-background/80">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <img src={'https://uptrendtrader.com/realtor/uploads/logo.png'} alt="PlotWise" className="h-8 w-auto" />
        </Link>
        <div className="hidden md:flex items-center gap-6 flex-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                location === link.href
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Icon icon={theme === "dark" ? "solar:sun-bold" : "solar:moon-bold"} className="w-5 h-5" />
          </button>
          {isAuthenticated ? (
            <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Login
              </Link>
              <Link href="/auth/register" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Join
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="pt-16">{children}</div>
      {/* Footer */}
      <footer className="border-t border-border py-10 mt-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <img src={'https://uptrendtrader.com/realtor/uploads/logo.png'} alt="PlotWise" className="h-8 w-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nigeria's most trusted real estate platform.</p>
          </div>
          {[
            { title: "Platform", links: [{ label: "Properties", href: "/properties" }, { label: "Lawyers", href: "/lawyers" }, { label: "About", href: "/about" }] },
            { title: "Legal", links: [{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
            { title: "Account", links: [{ label: "Login", href: "/auth/login" }, { label: "Register", href: "/auth/register" }] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} PlotWise. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
