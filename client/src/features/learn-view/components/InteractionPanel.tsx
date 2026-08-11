import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Sparkles,
  X,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn, SUPPORTED_LANGUAGES, LANGUAGE_MAP } from "@/lib/utils";
import { resolveClientAssetUrl } from "@/lib/assetUrls";
import { Streamdown } from "streamdown";
import type { Segment } from "../../../../../drizzle/schema";
import type { IRBlock, ExplainState, FeedbackRecord } from "../types";
import { MissingImage } from "./MissingImage";
import { SegmentImage } from "./SegmentImage";
import { useT, useI18n } from "@/i18n";

interface InteractionPanelProps {
  activeSegmentId: string | null;
  segments: Segment[];
  selectedLang: string;
  isAuthenticated: boolean;
  isImageLikeSegment: (segId: string) => boolean;
  getSourceBlock: (segId: string) => IRBlock | undefined;
  getImageUrlForSegment: (segId: string) => string;
  getTranslatedText: (segId: string) => string;
  // AI explanation
  explainState: ExplainState | null;
  explainLoading: boolean;
  onDismissExplain: () => void;
  onExplainSegment: (seg: Segment) => void;
  // Feedback form
  feedbackContent: string;
  onFeedbackContentChange: (value: string) => void;
  feedbackPending: boolean;
  onSubmitFeedback: () => void;
  // My feedback records
  myFeedbacks: FeedbackRecord[] | undefined;
  showMyFeedbacks: boolean;
  onToggleMyFeedbacks: () => void;
}

/** Right column: active-segment comparison, AI explanation and feedback. */
export function InteractionPanel({
  activeSegmentId,
  segments,
  selectedLang,
  isAuthenticated,
  isImageLikeSegment,
  getSourceBlock,
  getImageUrlForSegment,
  getTranslatedText,
  explainState,
  explainLoading,
  onDismissExplain,
  onExplainSegment,
  feedbackContent,
  onFeedbackContentChange,
  feedbackPending,
  onSubmitFeedback,
  myFeedbacks,
  showMyFeedbacks,
  onToggleMyFeedbacks,
}: InteractionPanelProps) {
  const t = useT();
  const { locale } = useI18n();
  const activeSegment = segments.find((s) => s.id === activeSegmentId);

  // ── Status badge config (labels translated at render time) ────────────────
  const FEEDBACK_STATUS: Record<number, { label: string; icon: ElementType; color: string }> = {
    0: { label: t("learn.statusPending"), icon: Clock, color: "text-muted-foreground" },
    1: { label: t("learn.statusProcessing"), icon: AlertCircle, color: "text-amber-500" },
    2: { label: t("learn.statusResolved"), icon: CheckCircle2, color: "text-green-500" },
  };

  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-muted/20">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("learn.panelTitle")}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* ── Active Segment Info ── */}
        {activeSegmentId ? (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {t("learn.selectedSegment", { id: activeSegmentId })}
            </div>

            {/* Chinese */}
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">🇨🇳 {t("learn.chineseOriginal")}</p>
              <p className="text-sm text-foreground leading-relaxed">
                {isImageLikeSegment(activeSegmentId) ? (
                  (() => {
                    const imgUrl = getSourceBlock(activeSegmentId)?.meta?.imageUrl;
                    return imgUrl ? (
                      <SegmentImage src={resolveClientAssetUrl(imgUrl)} alt="pdf image" />
                    ) : (
                      <MissingImage />
                    );
                  })()
                ) : (
                  activeSegment?.text
                )}
              </p>
            </div>

            {/* Translation */}
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.flag}{" "}
                {LANGUAGE_MAP[selectedLang]}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {isImageLikeSegment(activeSegmentId) ? (
                  getImageUrlForSegment(activeSegmentId) ? (
                    <SegmentImage
                      src={getImageUrlForSegment(activeSegmentId)}
                      alt="pdf image"
                    />
                  ) : (
                    <MissingImage />
                  )
                ) : (
                  getTranslatedText(activeSegmentId) || (
                    <span className="text-muted-foreground italic">?????</span>
                  )
                )}
              </p>
            </div>

            {/* AI Explanation */}
            {explainState && explainState.segmentId === activeSegmentId && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {t("learn.aiExplainTitle")}
                  </p>
                  <button
                    onClick={onDismissExplain}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {explainLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("learn.aiExplaining")}
                  </div>
                ) : (
                  <div className="text-sm text-foreground leading-relaxed">
                    <Streamdown>{explainState.explanation || ""}</Streamdown>
                  </div>
                )}
              </div>
            )}

            {/* Explain Button */}
            {getTranslatedText(activeSegmentId) &&
              getSourceBlock(activeSegmentId)?.type !== "image" && (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => {
                    const seg = segments.find((s) => s.id === activeSegmentId);
                    if (seg) onExplainSegment(seg);
                  }}
                  disabled={explainLoading}
                >
                  {explainLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Explain / AI Translation
                </Button>
              )}

            {/* ── Feedback Module ── */}
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                {t("learn.feedbackTitle")}
              </p>
              {isAuthenticated ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder={t("learn.feedbackPlaceholder")}
                    value={feedbackContent}
                    onChange={(e) => onFeedbackContentChange(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {feedbackContent.length}/2000
                    </span>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      onClick={onSubmitFeedback}
                      disabled={feedbackPending || !feedbackContent.trim()}
                    >
                      {feedbackPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      {t("learn.submitFeedback")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 text-center">
                  <p>{t("learn.loginToFeedback")}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">{t("learn.clickAnySegment")}</p>
            <p className="text-xs mt-1 leading-relaxed">
              {t("learn.clickAnySegmentDesc")}
            </p>
          </div>
        )}

        {/* ── My Feedback Records ── */}
        {isAuthenticated && (
          <div className="border-t border-border pt-3">
            <button
              className="w-full flex items-center justify-between text-xs font-semibold text-foreground mb-2"
              onClick={onToggleMyFeedbacks}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                {t("learn.myFeedbacks")}
                {(myFeedbacks?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {myFeedbacks!.length}
                  </Badge>
                )}
              </span>
              {showMyFeedbacks ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>

            {showMyFeedbacks && (
              <div className="space-y-2">
                {!myFeedbacks || myFeedbacks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{t("learn.noFeedbacks")}</p>
                ) : (
                  myFeedbacks.map((fb) => {
                    const statusInfo = FEEDBACK_STATUS[fb.status] ?? FEEDBACK_STATUS[0];
                    const StatusIcon = statusInfo.icon;
                    return (
                      <div
                        key={fb.id}
                        className="rounded-lg border border-border bg-card p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn("text-xs flex items-center gap-1", statusInfo.color)}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(fb.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-TW")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {t("learn.segmentLabel", { text: fb.originalText })}
                        </p>
                        <p className="text-xs text-foreground line-clamp-2">
                          {fb.feedbackContent}
                        </p>
                        {fb.adminNote && (
                          <div className="mt-1 pt-1.5 border-t border-border">
                            <p className="text-xs text-primary">{t("learn.adminReply", { text: fb.adminNote })}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">{t("learn.tipsTitle")}</p>
          <p>{t("learn.tip1")}</p>
          <p>{t("learn.tip2")}</p>
          <p>{t("learn.tip3")}</p>
          <p>{t("learn.tip4")}</p>
        </div>
      </div>
    </div>
  );
}
