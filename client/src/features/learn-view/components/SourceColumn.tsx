import type { RefObject } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveClientAssetUrl } from "@/lib/assetUrls";
import type { Segment } from "../../../../../drizzle/schema";
import type { IRBlock } from "../types";
import { MissingImage } from "./MissingImage";
import { SegmentImage } from "./SegmentImage";
import { useT } from "@/i18n";

interface SourceColumnProps {
  segments: Segment[];
  activeSegmentId: string | null;
  isImageLikeSegment: (segId: string) => boolean;
  getSourceBlock: (segId: string) => IRBlock | undefined;
  onSegmentClick: (segId: string) => void;
  colRef: RefObject<HTMLDivElement | null>;
}

/** Left column: Chinese original segments. */
export function SourceColumn({
  segments,
  activeSegmentId,
  isImageLikeSegment,
  getSourceBlock,
  onSegmentClick,
  colRef,
}: SourceColumnProps) {
  const t = useT();
  return (
    <div className="w-[33%] flex flex-col border-r border-border">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("learn.chineseOriginal")}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("learn.segmentsCount", { count: segments.length })}
        </span>
      </div>
      <div ref={colRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
        {segments.map((seg) => {
          const sourceBlock = getSourceBlock(seg.id);
          return (
            <div
              key={seg.id}
              id={`seg-${seg.id}`}
              className={cn("segment-block", activeSegmentId === seg.id && "active")}
              onClick={() => onSegmentClick(seg.id)}
            >
              <p
                className={cn(
                  "text-sm leading-relaxed text-foreground",
                  seg.type === "heading" && "font-semibold text-base"
                )}
              >
                {isImageLikeSegment(seg.id) ? (
                  sourceBlock?.meta?.imageUrl ? (
                    <SegmentImage
                      src={resolveClientAssetUrl(sourceBlock.meta.imageUrl)}
                      alt="pdf image"
                    />
                  ) : (
                    <MissingImage />
                  )
                ) : (
                  seg.text
                )}
              </p>
            </div>
          );
        })}
        {segments.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {t("learn.noContent")}
          </div>
        )}
      </div>
    </div>
  );
}
