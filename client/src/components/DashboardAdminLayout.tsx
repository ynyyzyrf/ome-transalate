/**
 * DashboardAdminLayout
 * Independent admin dashboard layout with username/password auth.
 * Completely separate from the main Manus OAuth flow.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/i18n";
import {
  BookOpen,
  MessageSquare,
  BookMarked,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  Home,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

export default function DashboardAdminLayout({ children }: Props) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useT();

  const NAV_ITEMS = [
    { href: "/dashboard", label: t("dashboard.navOverview"), icon: LayoutDashboard },
    { href: "/dashboard/courses", label: t("dashboard.navCourses"), icon: BookOpen },
    { href: "/dashboard/feedbacks", label: t("dashboard.navFeedbacks"), icon: MessageSquare },
    { href: "/dashboard/glossary", label: t("dashboard.navGlossary"), icon: BookMarked },
  ];

  const meQuery = trpc.dashboard.me.useQuery(undefined, {
    retry: 2,
    retryDelay: 1000,
  });

  const logoutMutation = trpc.dashboard.logout.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.loggedOut"));
      window.location.href = "/login";
    },
  });

  // Redirect to login only if we're sure the session is invalid
  // (not loading, no data, and not a temporary network error)
  if (!meQuery.isLoading && !meQuery.data) {
    // Only redirect if the error is auth-related
    const errMsg = (meQuery.error as any)?.message;
    if (meQuery.isError && errMsg) {
      console.error("[DashboardAdmin] Auth check failed:", errMsg);
    }
    window.location.href = "/login";
    return null;
  }

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const admin = meQuery.data;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 bg-white dark:bg-slate-900 border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo — click to go home */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
          <a
            href="/"
            className="flex items-center gap-3 min-w-0 group"
            title={t("common.home")}
          >
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0 group-hover:bg-primary/80 transition-colors">
              <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {t("common.appName")}
            </span>
          </a>
          <button
            className="ml-auto lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {((admin?.displayName || admin?.username || "A")[0] || "A").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {admin?.displayName || admin?.username || t("dashboard.roleAdmin")}
              </p>
              <p className="text-xs text-muted-foreground">{t("dashboard.roleAdmin")}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("common.logout")}
          </Button>
          <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
            <a
              href="/learn"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              {t("dashboard.backToPortal")}
            </a>
            <a
              href="/"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="w-3 h-3" />
              {t("dashboard.backHome")}
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("common.home")}</span>
            </a>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              {t("dashboard.title")}
            </a>
            {location !== "/dashboard" && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 hidden sm:block" />
                <span className="text-foreground font-medium hidden sm:inline">
                  {NAV_ITEMS.find((n) => n.href !== "/dashboard" && location.startsWith(n.href))?.label ?? ""}
                </span>
              </>
            )}
          </div>
          <div className="flex-1" />
          <LanguageSwitcher />
          <UserMenu className="h-7 w-7" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
