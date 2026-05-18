import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LanguageSelect from "./LanguageSelect";
import { Search, BookOpen, Globe, LogIn, Settings, FileText, ChevronRight } from "lucide-react";
import { SUPPORTED_LANGUAGES, LANGUAGE_MAP, formatDate, getFileTypeIcon } from "@/lib/utils";
import { useLocation } from "wouter";

export default function LearnPortal() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [preferredLang, setPreferredLang] = useState<string | null>(null);
  const [displayLang, setDisplayLang] = useState("en");
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");

  // Check if language has been selected
  useEffect(() => {
    const saved = localStorage.getItem("preferredLanguage");
    if (saved) {
      setPreferredLang(saved);
      setDisplayLang(saved === "zh" ? "en" : saved);
    }
    if (user?.preferredLanguage && user.preferredLanguage !== "zh") {
      setDisplayLang(user.preferredLanguage);
    }
  }, [user]);

  const { data: documents = [], isLoading } = trpc.documents.listPublished.useQuery(
    { search: search || undefined },
    { enabled: !!preferredLang }
  );

  if (!preferredLang) {
    return <LanguageSelect onSelect={(lang) => { setPreferredLang(lang); setDisplayLang(lang === "zh" ? "en" : lang); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <a href="/" className="flex items-center gap-2.5 shrink-0 group" title="返回首頁">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center group-hover:bg-accent/80 transition-colors">
              <Globe className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-[var(--sidebar-foreground)] text-sm group-hover:text-white/80 transition-colors">
              多語言培訓平台
            </span>
          </a>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索教程名稱或內容..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 bg-white/10 border-white/20 text-[var(--sidebar-foreground)] placeholder:text-white/40 focus:bg-white/15"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Language selector */}
            <Select value={displayLang} onValueChange={setDisplayLang}>
              <SelectTrigger className="w-36 h-8 bg-white/10 border-white/20 text-[var(--sidebar-foreground)] text-xs">
                <Globe className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-white/70 hover:text-white hover:bg-white/10 gap-1.5"
                    onClick={() => navigate("/admin/documents")}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    管理後台
                  </Button>
                )}
                <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center text-xs font-semibold text-white">
                  {user?.name?.charAt(0) || "U"}
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-white/70 hover:text-white hover:bg-white/10 gap-1.5"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <LogIn className="w-3.5 h-3.5" />
                登入
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            培訓教程庫
          </h1>
          <p className="text-muted-foreground mt-1">
            瀏覽並學習多語言培訓材料，支持中文對比閱讀
          </p>
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">暫無已發布的教程</p>
            <p className="text-sm mt-1">
              {search ? "嘗試其他搜索關鍵詞" : "管理員尚未發布任何培訓材料"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border-border"
                onClick={() => navigate(`/learn/${doc.id}?lang=${displayLang}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl shrink-0 mt-0.5">{getFileTypeIcon(doc.fileType)}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatDate(doc.createdAt)}
                      </p>
                      {doc.extractedText && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {doc.extractedText.slice(0, 100)}...
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="w-3.5 h-3.5" />
                      <span>
                        {SUPPORTED_LANGUAGES.find((l) => l.code === displayLang)?.flag}{" "}
                        {LANGUAGE_MAP[displayLang] || displayLang}
                      </span>
                    </div>
                    <span className="text-xs text-primary flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                      開始學習 <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
