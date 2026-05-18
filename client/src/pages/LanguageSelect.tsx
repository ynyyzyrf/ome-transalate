import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SUPPORTED_LANGUAGES } from "@/lib/utils";
import { useLocation } from "wouter";
import { Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface LanguageSelectProps {
  onSelect: (lang: string) => void;
}

export default function LanguageSelect({ onSelect }: LanguageSelectProps) {
  const { isAuthenticated } = useAuth();
  const setLangMutation = trpc.user.setLanguage.useMutation({
    onError: () => {},
  });

  const handleSelect = (code: string) => {
    if (isAuthenticated) {
      setLangMutation.mutate({ language: code });
    }
    localStorage.setItem("preferredLanguage", code);
    onSelect(code);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.20_0.06_250)] via-[oklch(0.25_0.07_240)] to-[oklch(0.18_0.05_260)] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-5">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            企業多語言培訓學習平台
          </h1>
          <p className="text-white/60 text-lg">
            Enterprise Multilingual Training Platform
          </p>
          <p className="text-white/40 mt-2 text-sm">
            請選擇您的學習語言 · Please select your preferred language
          </p>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Chinese option */}
          <button
            onClick={() => handleSelect("zh")}
            className="group relative bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/40 rounded-2xl p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🇨🇳</span>
              <div>
                <p className="font-semibold text-white">中文</p>
                <p className="text-white/50 text-xs">Chinese</p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 ml-auto transition-colors" />
            </div>
          </button>

          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className="group relative bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/40 rounded-2xl p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{lang.flag}</span>
                <div>
                  <p className="font-semibold text-white">{lang.label}</p>
                  <p className="text-white/50 text-xs capitalize">{lang.code.toUpperCase()}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 ml-auto transition-colors" />
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          您可以在學習門戶中隨時更改語言偏好
        </p>
      </div>
    </div>
  );
}
