import type { RefObject } from "react";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { cn, LANGUAGE_MAP } from "@/lib/utils";
import type { Segment } from "../../../../../drizzle/schema";
import type { TranslationJobView } from "../types";
import { MissingImage } from "./MissingImage";
import { SegmentImage } from "./SegmentImage";
import { useT } from "@/i18n";

interface TranslationColumnProps {
  segments: Segment[];
  activeSegmentId: string | null;
  selectedLang: string;
  translationJob: TranslationJobView;
  transLoading: boolean;
  isImageLikeSegment: (segId: string) => boolean;
  getImageUrlForSegment: (segId: string) => string;
  getTranslatedText: (segId: string) => string;
  onSegmentClick: (segId: string) => void;
  onExplain: (seg: Segment) => void;
  colRef: RefObject<HTMLDivElement | null>;
}

/** Middle column: translated segments, with per-segment AI explain button. */
export function TranslationColumn({
  segments,
  activeSegmentId,
  selectedLang,
  translationJob,
  transLoading,
  isImageLikeSegment,
  getImageUrlForSegment,
  getTranslatedText,
  onSegmentClick,
  onExplain,
  colRef,
}: TranslationColumnProps) {
  const t = useT();
  return (
    <div className="flex-1 flex flex-col border-r border-border">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {LANGUAGE_MAP[selectedLang] || selectedLang}
        </span>
        {transLoading && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
        )}
        {translationJob?.status === "processing" && (
          <span className="ml-2 text-xs text-blue-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> {t("learn.translatingStatus")}
          </span>
        )}
      </div>
      <div ref={colRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
        {translationJob?.status === "pending" || translationJob?.status === "processing" ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" />
            <p className="font-medium">{t("learn.translatingTitle")}</p>
            <p className="text-sm mt-1">{t("learn.translatingDesc")}</p>
          </div>
        ) : !translationJob || translationJob.status === "failed" ? (
          <div className="text-center py-16 text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {translationJob?.status === "failed" ? t("learn.translateFailed") : t("learn.noTranslation")}
            </p>
            <p className="text-sm mt-1">
              {translationJob?.status === "failed"
                ? translationJob.errorMessage || t("learn.translateFailedDesc")
                : t("learn.chooseOtherLang")}
            </p>
          </div>
        ) : (
          segments.map((seg) => {
            const translated = getTranslatedText(seg.id);
            return (
              <div
                key={seg.id}
                id={`seg-${seg.id}`}
                className={cn(
                  "segment-block group relative",
                  activeSegmentId === seg.id && "active"
                )}
                onClick={() => onSegmentClick(seg.id)}
              >
                <p
                  className={cn(
                    "text-sm leading-relaxed text-foreground pr-6",
                    seg.type === "heading" && "font-semibold text-base"
                  )}
                >
                  {isImageLikeSegment(seg.id) ? (
                    getImageUrlForSegment(seg.id) ? (
                      <SegmentImage src={getImageUrlForSegment(seg.id)} alt="pdf image" />
                    ) : (
                      <MissingImage />
                    )
                  ) : (
                    translated || <span className="text-muted-foreground italic">?????</span>
                  )}
                </p>
                {translated && !isImageLikeSegment(seg.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExplain(seg);
                    }}
                    className={cn(
                      "absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150",
                      "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                      "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 whitespace-nowrap",
                      activeSegmentId === seg.id && "opacity-100"
                    )}
                  >
                    <Sparkles className="w-3 h-3" />
                    Explain / AI Translation
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
