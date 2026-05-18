import { cn, STATUS_CLASSES, STATUS_LABELS } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: "pending" | "processing" | "completed" | "failed";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_CLASSES[status],
        className
      )}
    >
      {status === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}
