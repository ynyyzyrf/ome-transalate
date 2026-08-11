import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BookOpen, Download, Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/utils";
import { useT } from "@/i18n";

interface LearnHeaderProps {
  title: string;
  selectedLang: string;
  availableLangs: string[];
  downloadUrl: string | null;
  onBack: () => void;
  onLanguageChange: (lang: string) => void;
}

export function LearnHeader({
  title,
  selectedLang,
  availableLangs,
  downloadUrl,
  onBack,
  onLanguageChange,
}: LearnHeaderProps) {
  const t = useT();
  return (
    <header className="sticky top-0 z-50 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)] shadow-sm">
      <div className="px-4 h-14 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Button>
        <a
          href="/"
          className="hidden sm:flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {t("common.home")}
        </a>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[var(--sidebar-foreground)] text-sm truncate">
            {title}
          </h1>
        </div>
        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Select value={selectedLang} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-40 h-8 bg-white/10 border-white/20 text-[var(--sidebar-foreground)] text-xs">
              <Languages className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => {
                const isAvailable = availableLangs.includes(l.code);
                return (
                  <SelectItem key={l.code} value={l.code} disabled={!isAvailable}>
                    {l.flag} {l.label} {!isAvailable && t("learn.translating")}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {downloadUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => window.open(downloadUrl!, "_blank")}
            >
              <Download className="w-3.5 h-3.5" />
              {t("learn.download")}
            </Button>
          )}
          <UserMenu className="h-7 w-7" />
        </div>
      </div>
    </header>
  );
}
