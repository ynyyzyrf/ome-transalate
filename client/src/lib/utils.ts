import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", zhLabel: "英文", flag: "🇬🇧" },
  { code: "es", label: "Español", zhLabel: "西班牙文", flag: "🇪🇸" },
  { code: "th", label: "ภาษาไทย", zhLabel: "泰文", flag: "🇹🇭" },
  { code: "hi", label: "हिन्दी", zhLabel: "印地文", flag: "🇮🇳" },
  { code: "vi", label: "Tiếng Việt", zhLabel: "越南文", flag: "🇻🇳" },
] as const;

export const LANGUAGE_MAP: Record<string, string> = {
  zh: "中文",
  en: "English",
  es: "Español",
  th: "ภาษาไทย",
  hi: "हिन्दी",
  vi: "Tiếng Việt",
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

export function formatDate(date: Date | string, locale?: string): string {
  return new Date(date).toLocaleString(locale === "en" ? "en-US" : "zh-TW", {
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
