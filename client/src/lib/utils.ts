import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "th", label: "ภาษาไทย", flag: "🇹🇭" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
] as const;

export const LANGUAGE_MAP: Record<string, string> = {
  zh: "中文",
  en: "English",
  es: "Español",
  th: "ภาษาไทย",
  hi: "हिन्दी",
  vi: "Tiếng Việt",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "待處理",
  processing: "翻譯中",
  completed: "已完成",
  failed: "失敗",
};

export const STATUS_CLASSES: Record<string, string> = {
  pending: "status-pending",
  processing: "status-processing",
  completed: "status-completed",
  failed: "status-failed",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFileTypeIcon(fileType: string): string {
  const icons: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    xlsx: "📊",
    pptx: "📋",
    jpg: "🖼️",
    png: "🖼️",
    other: "📁",
  };
  return icons[fileType] || "📁";
}
