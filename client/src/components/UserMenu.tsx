import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminSession } from "@/_core/hooks/useAdminSession";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

/**
 * Clickable avatar menu shown in page headers for a logged-in visitor.
 *
 * Resolves BOTH identity models — the learner (ctx.user via auth.me) and the
 * dashboard admin (dashboard_session via dashboard.me) — so a single component
 * works for learners and admins alike. Clicking the avatar opens a dropdown
 * with the identity label and a 退出登錄 action.
 */
export function UserMenu({ className }: { className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const { admin, isAdmin } = useAdminSession();
  const t = useT();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

  // The caller only renders this while logged in; derive the label defensively.
  const displayName = admin?.displayName || user?.name || user?.email || t("userMenu.fallbackName");
  const subtitle = admin ? admin.username : user?.email || t("userMenu.subtitleLearner");
  const roleLabel = admin || user?.role === "admin" ? t("userMenu.roleAdmin") : t("userMenu.roleLearner");
  const initial = (displayName[0] || "U").toUpperCase();

  const handleLogout = () => logoutMutation.mutate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("userMenu.account")}
          className={cn(
            "rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
        >
          <Avatar className="h-7 w-7 border border-white/20 bg-primary/10">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <div className="px-2 pb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent-foreground">
            <UserIcon className="h-3 w-3" />
            {roleLabel}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
