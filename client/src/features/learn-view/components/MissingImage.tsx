/** Placeholder rendered when a block is an image but no image is available. */
import { useT } from "@/i18n";

export function MissingImage() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="text-muted-foreground italic">[image unavailable]</span>
      <span className="text-xs text-muted-foreground">{t("learn.uploadToAdmin")}</span>
    </span>
  );
}
