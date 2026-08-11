import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "./locales/en";
import zh, { type LocaleDict } from "./locales/zh";

export type Locale = "zh" | "en";

export const UI_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "zh", label: "繁體中文", flag: "🇨🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

// 與「文檔翻譯目標語言」完全獨立的 UI 界面語言存儲鍵
export const UI_LANG_KEY = "uiLang";

const DICTS: Record<Locale, LocaleDict> = { zh, en };

function resolveInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(UI_LANG_KEY);
    if (stored === "zh" || stored === "en") return stored;
    const nav = navigator.language?.toLowerCase() ?? "";
    return nav.startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}

function lookup(dict: LocaleDict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, k: string) =>
    k in params ? String(params[k]) : match
  );
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    try {
      localStorage.setItem(UI_LANG_KEY, locale);
    } catch {
      // ignore storage errors
    }
    document.documentElement.lang = locale === "zh" ? "zh-TW" : "en";
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let text = lookup(DICTS[locale], key);
      if (text === undefined) text = lookup(zh, key); // 回退繁中
      if (text === undefined) return key; // 缺 key 返回本身，便於發現漏翻
      return interpolate(text, params);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}
