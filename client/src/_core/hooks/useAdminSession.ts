import { trpc } from "@/lib/trpc";

/**
 * Dashboard admin session (dashboard_session cookie → dashboard.me).
 *
 * Deliberately separate from useAuth(), which reflects the learner ctx.user
 * (auth.me). A dashboard admin has NO ctx.user — their identity lives only in
 * ctx.dashboardSession — so any UI that must show admin state (Home nav, the
 * /learn guard, header buttons) needs this hook too.
 */
export function useAdminSession() {
  const { data, isLoading } = trpc.dashboard.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    admin: data ?? null,
    isAdmin: Boolean(data),
    loading: isLoading,
  };
}
