import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminSession } from "@/_core/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/i18n";
import { toast } from "sonner";
import { Globe, Eye, EyeOff, Lock, UserPlus, LogIn, Home } from "lucide-react";

type Mode = "login" | "register";

/**
 * Unified auth page — login (admin username or learner email) OR learner
 * registration. After success the server returns the role and the client routes
 * admin → /dashboard, user → /learn.
 */
export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [name, setName] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const t = useT();

  // A logged-in visitor (learner OR dashboard admin) may have reached /login
  // directly (e.g. typed the URL) — for them "back" means /learn. An anonymous
  // visitor cannot access /learn (login guard bounces to /login), so "back"
  // must go to the homepage instead.
  const { isAuthenticated, loading: learnerLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminSession();
  const authLoading = learnerLoading || adminLoading;
  const backHref = isAuthenticated || isAdmin ? "/learn" : "/";

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success(t("login.success"));
      window.location.href = data.redirect;
    },
    onError: (err) => {
      toast.error(err.message || t("login.failed"));
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success(t("register.success"));
      window.location.href = data.redirect;
    },
    onError: (err) => {
      toast.error(err.message || t("register.failed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      if (!name.trim()) {
        toast.error(t("register.nameRequired"));
        return;
      }
      if (!identifier.trim() || !password) {
        toast.error(t("register.fillEmailPwd"));
        return;
      }
      if (password.length < 6) {
        toast.error(t("register.pwdMin"));
        return;
      }
      if (password !== confirmPwd) {
        toast.error(t("register.pwdMismatch"));
        return;
      }
      registerMutation.mutate({ email: identifier.trim(), password, name: name.trim() });
      return;
    }
    if (!identifier.trim() || !password.trim()) {
      toast.error(t("login.fillRequired"));
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword("");
    setConfirmPwd("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Globe className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "login" ? t("login.title") : t("register.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("common.appName")}</p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {mode === "login" ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mode === "login" ? t("login.cardTitle") : t("register.cardTitle")}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? t("login.desc") : t("register.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <Label htmlFor="name">{t("register.name")}</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("register.namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="identifier">
                  {mode === "login" ? t("login.identifierLabel") : t("register.emailLabel")}
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder={mode === "login" ? t("login.identifierPlaceholder") : t("register.emailPlaceholder")}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-1.5"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="password">{t("common.password")}</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder={mode === "register" ? t("register.pwdPlaceholder") : t("login.pwdPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {mode === "register" && (
                <div>
                  <Label htmlFor="confirmPwd">{t("register.confirmPwd")}</Label>
                  <Input
                    id="confirmPwd"
                    type={showPwd ? "text" : "password"}
                    placeholder={t("register.confirmPwdPlaceholder")}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="mt-1.5"
                    autoComplete="new-password"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || registerMutation.isPending}
              >
                {(loginMutation.isPending || registerMutation.isPending) ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {t("common.processing")}
                  </span>
                ) : mode === "login" ? t("common.login") : t("register.action")}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="w-full text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1.5"
              >
                {mode === "login" ? (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    {t("login.switchToRegister")}
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    {t("register.switchToLogin")}
                  </>
                )}
              </button>
              {!authLoading && (
                <a
                  href={backHref}
                  className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <Home className="w-3 h-3" />
                  {isAuthenticated || isAdmin ? t("common.backToPortal") : t("common.backHome")}
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {mode === "login" ? t("login.footerFirstUse") : t("register.footerAgree")}
        </p>
      </div>
    </div>
  );
}
