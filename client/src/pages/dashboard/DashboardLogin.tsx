import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/i18n";
import { toast } from "sonner";
import { LayoutDashboard, Eye, EyeOff, Lock } from "lucide-react";

export default function DashboardLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const t = useT();

  const loginMutation = trpc.dashboard.login.useMutation({
    onSuccess: () => {
      toast.success(t("login.success"));
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      toast.error(err.message || t("login.failed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(t("dashLogin.fillRequired"));
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
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
            <LayoutDashboard className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashLogin.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("common.appName")}</p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {t("dashLogin.cardTitle")}
            </CardTitle>
            <CardDescription>{t("dashLogin.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">{t("dashLogin.usernameLabel")}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("dashLogin.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                    placeholder={t("login.pwdPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="current-password"
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
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {t("dashLogin.loggingIn")}
                  </span>
                ) : t("common.login")}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <a href="/learn" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {t("common.backToPortal")}
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("dashLogin.footerFirstUse")}
        </p>
      </div>
    </div>
  );
}
