import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminSession } from "@/_core/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/i18n";
import { Globe, BookOpen, Zap, Shield, ArrowRight, Languages, FileText, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { isAuthenticated, loading: learnerLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminSession();
  const [, navigate] = useLocation();
  const t = useT();

  // A visitor is "logged in" when EITHER a learner session (ctx.user) or a
  // dashboard admin session (dashboard_session) is present.
  const loading = learnerLoading || adminLoading;
  const isLoggedIn = isAuthenticated || isAdmin;

  const handleGetStarted = () => {
    // Not logged in → the only action is to go log in first.
    navigate(isLoggedIn ? "/learn" : "/login");
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const features = [
    {
      icon: FileText,
      title: t("home.featureUploadTitle"),
      desc: t("home.featureUploadDesc"),
    },
    {
      icon: Sparkles,
      title: t("home.featureTranslateTitle"),
      desc: t("home.featureTranslateDesc"),
    },
    {
      icon: Languages,
      title: t("home.featureCompareTitle"),
      desc: t("home.featureCompareDesc"),
    },
    {
      icon: Zap,
      title: t("home.featureExplainTitle"),
      desc: t("home.featureExplainDesc"),
    },
    {
      icon: BookOpen,
      title: t("home.featureGlossaryTitle"),
      desc: t("home.featureGlossaryDesc"),
    },
    {
      icon: Shield,
      title: t("home.featureRolesTitle"),
      desc: t("home.featureRolesDesc"),
    },
  ];

  const languages = [
    { flag: "🇨🇳", name: "中文", sub: t("home.originalLang") },
    { flag: "🇬🇧", name: "English", sub: t("home.langEnglish") },
    { flag: "🇪🇸", name: "Español", sub: t("home.langSpanish") },
    { flag: "🇹🇭", name: "ภาษาไทย", sub: t("home.langThai") },
    { flag: "🇮🇳", name: "हिन्दी", sub: t("home.langHindi") },
    { flag: "🇻🇳", name: "Tiếng Việt", sub: t("home.langVietnamese") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--sidebar-foreground)]">{t("common.appName")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher triggerClassName="bg-white/10 border-white/20 text-[var(--sidebar-foreground)]" />
            {!loading &&
              (isLoggedIn ? (
                <>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => navigate("/dashboard")}
                    >
                      {t("home.adminBtn")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => navigate("/learn")}
                  >
                    {t("home.startLearning")}
                  </Button>
                  <UserMenu className="h-7 w-7" />
                </>
              ) : (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleLogin}
                >
                  {t("common.login")}
                </Button>
              ))}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[oklch(0.20_0.06_250)] via-[oklch(0.25_0.07_240)] to-[oklch(0.18_0.05_260)] py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            {t("home.heroBadge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            {t("home.heroTitle1")}
            <br />
            <span className="text-accent">{t("home.heroTitle2")}</span>
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            {t("home.heroDesc")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6"
              onClick={handleGetStarted}
            >
              {t("home.startLearning")} <ArrowRight className="w-4 h-4" />
            </Button>
            {!isLoggedIn && (
              <Button
                size="lg"
                variant="outline"
                className="text-white border-white/30 hover:bg-white/10 gap-2 px-6"
                onClick={handleLogin}
              >
                {t("common.login")}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-10 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-6 font-medium">{t("home.supportedLangs")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {languages.map((lang) => (
              <div key={lang.name} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
                <span className="text-2xl">{lang.flag}</span>
                <div>
                  <p className="font-medium text-sm text-foreground">{lang.name}</p>
                  <p className="text-xs text-muted-foreground">{lang.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-3">{t("home.featuresTitle")}</h2>
            <p className="text-muted-foreground">{t("home.featuresSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t("home.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("home.ctaDesc")}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="gap-2" onClick={handleGetStarted}>
              <BookOpen className="w-4 h-4" />
              {isLoggedIn ? t("home.enterPortal") : t("home.startLearning")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border text-center text-sm text-muted-foreground">
        {t("home.footer")}
      </footer>
    </div>
  );
}
