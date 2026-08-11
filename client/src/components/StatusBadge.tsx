import { cn, STATUS_CLASSES } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useT } from "@/i18n";

interface StatusBadgeProps {
  status: "pending" | "processing" | "completed" | "failed";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useT();
  const labelMap: Record<string, string> = {
    pending: t("common.statusPending"),
    processing: t("common.statusProcessing"),
    completed: t("common.statusCompleted"),
    failed: t("common.statusFailed"),
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_CLASSES[status],
        className
      )}
    >
      {status === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
      {labelMap[status] || status}
    </span>
  );
}
