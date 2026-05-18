import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  ChevronRight,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "文件管理", path: "/admin/documents", icon: FileText },
  { label: "批量上傳", path: "/admin/upload", icon: Upload },
  { label: "翻譯任務", path: "/admin/jobs", icon: Globe },
  { label: "術語庫", path: "/admin/glossary", icon: BookOpen },
  { label: "用戶管理", path: "/admin/users", icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to dashboard login when OAuth isn't available
    const loginUrl = getLoginUrl();
    try {
      const parsed = new URL(loginUrl);
      // If OAuth portal is on the same origin (no external provider), use dashboard login
      if (parsed.hostname === window.location.hostname) {
        navigate("/dashboard/login");
        return null;
      }
    } catch { /* fall through */ }
    // External OAuth provider — do the OAuth redirect
    window.location.href = loginUrl;
    return null;
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">無訪問權限</h2>
          <p className="text-muted-foreground mb-4">此頁面僅限管理員訪問</p>
          <button
            onClick={() => navigate("/learn")}
            className="text-primary hover:underline"
          >
            返回學習門戶
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">多語言培訓平台</p>
              <p className="text-xs opacity-60">管理後台</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.path || location.startsWith(item.path + "/");
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                    : "text-[var(--sidebar-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--sidebar-accent)]/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-[var(--sidebar-border)]">
            <button
              onClick={() => navigate("/learn")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium opacity-70 hover:opacity-100 hover:bg-[var(--sidebar-accent)]/50 transition-all"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              學習門戶
            </button>
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[var(--sidebar-border)]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-sm font-semibold">
              {user?.name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "管理員"}</p>
              <p className="text-xs opacity-50">管理員</p>
            </div>
            <button
              onClick={logout}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
