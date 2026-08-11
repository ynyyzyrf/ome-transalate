import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, UI_LOCALES, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * UI 界面語言切換器 —— 只切換系統界面文字語言（繁中/English），
 * 與「文檔內容翻譯」的目標語言、學習門戶的閱讀語言偏好完全無關。
 * 狀態存於 I18nContext（localStorage `uiLang`）。
 */
export function LanguageSwitcher({
  className,
  triggerClassName,
}: {
  className?: string;
  triggerClassName?: string;
}) {
  const { locale, setLocale } = useI18n();

  return (
    <Select
      value={locale}
      onValueChange={(v) => setLocale(v as Locale)}
    >
      <SelectTrigger
        aria-label="Language"
        className={cn("w-36 h-8 text-xs gap-1.5", className, triggerClassName)}
      >
        <Languages className="w-3.5 h-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UI_LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.flag} {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
