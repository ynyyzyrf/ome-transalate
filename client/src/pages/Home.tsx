import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Globe, BookOpen, Zap, Shield, ArrowRight, Languages, FileText, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const handleGetStarted = () => {
    navigate("/learn");
  };

  const features = [
    {
      icon: FileText,
      title: "批量文件上傳",
      desc: "支持 PDF、DOCX、XLSX、PPTX、圖片等多種格式，自動識別並路由至對應處理管道",
    },
    {
      icon: Sparkles,
      title: "AI 智能翻譯",
      desc: "調用 LLM 進行高精度翻譯，結合術語庫確保專業詞彙一致性，支持 5 種目標語言",
    },
    {
      icon: Languages,
      title: "對比學習視圖",
      desc: "三欄佈局同步顯示中文原文與譯文，雙向高亮聯動，直觀對比學習",
    },
    {
      icon: Zap,
      title: "AI 即時解釋",
      desc: "每段譯文配備 AI 解釋按鈕，以更簡單語言重新解釋複雜術語和段落",
    },
    {
      icon: BookOpen,
      title: "術語庫管理",
      desc: "支持 CSV 批量導入術語表，確保翻譯時嚴格遵循企業專業詞彙標準",
    },
    {
      icon: Shield,
      title: "角色權限控制",
      desc: "管理員可上傳管理文件，員工用戶訪問學習門戶，安全可靠的權限分離",
    },
  ];

  const languages = [
    { flag: "🇨🇳", name: "中文", sub: "原始語言" },
    { flag: "🇬🇧", name: "English", sub: "英語" },
    { flag: "🇪🇸", name: "Español", sub: "西班牙語" },
    { flag: "🇹🇭", name: "ภาษาไทย", sub: "泰語" },
    { flag: "🇮🇳", name: "हिन्दी", sub: "印地語" },
    { flag: "🇻🇳", name: "Tiếng Việt", sub: "越南語" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--sidebar-foreground)]">多語言培訓平台</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/learn")}
            >
              學習門戶
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/dashboard")}
            >
              後台管理
            </Button>
            {!loading && (
              isAuthenticated ? (
                <Button
                  size="sm"
                  className="bg-accent hover:bg-accent/90 text-white"
                  onClick={() => navigate(user?.role === "admin" ? "/admin/documents" : "/learn")}
                >
                  {user?.role === "admin" ? "管理後台" : "開始學習"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-accent hover:bg-accent/90 text-white"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  登入
                </Button>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[oklch(0.20_0.06_250)] via-[oklch(0.25_0.07_240)] to-[oklch(0.18_0.05_260)] py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            AI 驅動的企業培訓本地化解決方案
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            企業多語言培訓<br />
            <span className="text-accent">智能本地化學習平台</span>
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            將中文培訓材料高效轉化為多語言版本，為全球員工提供直觀的對比學習環境與 AI 即時解釋支持
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white gap-2 px-6"
              onClick={handleGetStarted}
            >
              開始學習 <ArrowRight className="w-4 h-4" />
            </Button>
            {!isAuthenticated && (
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 gap-2 px-6"
                onClick={() => window.location.href = getLoginUrl()}
              >
                管理員登入
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-10 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-6 font-medium">支持語言</p>
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
            <h2 className="text-2xl font-bold text-foreground mb-3">核心功能</h2>
            <p className="text-muted-foreground">完整的企業培訓本地化解決方案</p>
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
          <h2 className="text-2xl font-bold text-foreground mb-3">立即開始使用</h2>
          <p className="text-muted-foreground mb-6">員工可直接訪問學習門戶，管理員需登入後訪問管理後台</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="gap-2" onClick={() => navigate("/learn")}>
              <BookOpen className="w-4 h-4" />
              進入學習門戶
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border text-center text-sm text-muted-foreground">
        企業多語言培訓智能本地化學習平台 · 由 AI 驅動
      </footer>
    </div>
  );
}
