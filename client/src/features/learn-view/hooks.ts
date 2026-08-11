import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { resolveClientAssetUrl } from "@/lib/assetUrls";
import { isImageLikeBlock } from "@shared/imageBlocks";
import { useT } from "@/i18n";
import type { Segment, TranslatedSegment } from "../../../../drizzle/schema";
import type { IRBlock, ExplainState, FeedbackRecord } from "./types";

/**
 * All data fetching + derived selectors for the learn view:
 * document, current translation job, all jobs, my feedbacks, and the
 * segment/translation lookup helpers shared by the three columns.
 */
export function useLearnData(docId: number, selectedLang: string, isAuthenticated: boolean) {
  const enabled = !!docId;

  const { data: doc, isLoading: docLoading } = trpc.documents.getById.useQuery(
    { id: docId },
    { enabled }
  );
  const { data: translationJob, isLoading: transLoading } = trpc.documents.getTranslation.useQuery(
    { documentId: docId, language: selectedLang },
    {
      enabled: enabled && !!selectedLang,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "pending" || status === "processing" ? 5000 : false;
      },
    }
  );
  const { data: allJobs } = trpc.documents.getTranslations.useQuery(
    { documentId: docId },
    { enabled }
  );

  // My feedbacks for this tutorial
  const { data: myFeedbacks, refetch: refetchMyFeedbacks } = trpc.feedbacks.myFeedbacks.useQuery(
    { tutorialId: docId },
    { enabled: isAuthenticated && enabled }
  );

  const irBlocks: IRBlock[] = (doc as any)?.ir?.blocks || [];
  const segments: Segment[] = irBlocks.length
    ? irBlocks.map((b, idx) => ({
        id: b.id,
        text: b.text,
        order: idx + 1,
        type: (b.type as any) || "paragraph",
      }))
    : ((doc?.segments as Segment[]) || []);
  const translatedSegments: TranslatedSegment[] = (
    ((translationJob as any)?.translationBlocks || []).length
      ? ((translationJob as any).translationBlocks as IRBlock[]).map((b) => ({
          id: b.id,
          text: b.text,
        }))
      : ((translationJob?.translatedSegments as TranslatedSegment[]) || [])
  ) as TranslatedSegment[];
  const translatedBlocks: IRBlock[] =
    ((translationJob as any)?.translationBlocks as IRBlock[] | undefined) || [];

  const getSourceBlock = (segId: string) => irBlocks.find((b) => b.id === segId);
  const getTranslatedBlock = (segId: string) => translatedBlocks.find((b) => b.id === segId);
  const isImageLikeSegment = (segId: string) => {
    const sourceBlock = getSourceBlock(segId);
    const segment = segments.find((s) => s.id === segId);
    return isImageLikeBlock(sourceBlock) || isImageLikeBlock(segment);
  };
  const getImageUrlForSegment = (segId: string) =>
    resolveClientAssetUrl(
      (getTranslatedBlock(segId)?.meta?.imageUrl as string | undefined) ||
        (getSourceBlock(segId)?.meta?.imageUrl as string | undefined)
    );

  const getTranslatedText = useCallback(
    (segId: string): string => {
      const byId = translatedSegments.find((s) => s.id === segId)?.text;
      if (byId) return byId;

      // Compatibility fallback: if segment ids changed after translation, align by index.
      const idx = segments.findIndex((s) => s.id === segId);
      if (idx >= 0 && idx < translatedSegments.length) {
        return translatedSegments[idx]?.text || "";
      }
      return "";
    },
    [translatedSegments, segments]
  );

  const availableLangs = (allJobs || [])
    .filter((j) => j.status === "completed")
    .map((j) => j.targetLanguage);

  return {
    doc,
    docLoading,
    translationJob,
    transLoading,
    segments,
    getSourceBlock,
    isImageLikeSegment,
    getImageUrlForSegment,
    getTranslatedText,
    availableLangs,
    myFeedbacks: myFeedbacks as FeedbackRecord[] | undefined,
    refetchMyFeedbacks,
  };
}

/**
 * AI explanation (Explain / AI Translation) state + mutation.
 */
export function useExplain(
  selectedLang: string,
  segments: Segment[],
  getTranslatedText: (segId: string) => string
) {
  const [explainState, setExplainState] = useState<ExplainState | null>(null);
  const t = useT();

  const explainMutation = trpc.ai.explain.useMutation({
    onSuccess: (data) => {
      setExplainState((prev) =>
        prev ? { ...prev, explanation: data.explanation, loading: false } : null
      );
    },
    onError: (err) => {
      toast.error(t("learn.explainFailed", { msg: err.message }));
      setExplainState((prev) => (prev ? { ...prev, loading: false } : null));
    },
  });

  const handleExplain = (seg: Segment) => {
    const translated = getTranslatedText(seg.id);
    if (!translated) {
      toast.error(t("learn.noTranslationForSegment"));
      return;
    }

    // Build context window from surrounding segments
    const segIndex = segments.findIndex((s) => s.id === seg.id);
    const CONTEXT_WINDOW = 2;
    const precedingSegments = segments
      .slice(Math.max(0, segIndex - CONTEXT_WINDOW), segIndex)
      .map((s) => ({ original: s.text, translated: getTranslatedText(s.id) }))
      .filter((s) => s.translated);
    const followingSegments = segments
      .slice(segIndex + 1, segIndex + 1 + CONTEXT_WINDOW)
      .map((s) => ({ original: s.text, translated: getTranslatedText(s.id) }))
      .filter((s) => s.translated);

    setExplainState({
      segmentId: seg.id,
      originalText: seg.text,
      translatedText: translated,
      explanation: null,
      loading: true,
    });
    explainMutation.mutate({
      originalText: seg.text,
      translatedText: translated,
      targetLanguage: selectedLang,
      context: {
        ...(precedingSegments.length > 0 && { precedingSegments }),
        ...(followingSegments.length > 0 && { followingSegments }),
      },
    });
  };

  return {
    explainState,
    setExplainState,
    handleExplain,
    explainLoading: explainState?.loading ?? false,
  };
}

/**
 * Feedback submission state + mutation for the currently selected segment.
 */
export function useFeedback(opts: {
  docId: number;
  docTitle: string;
  segments: Segment[];
  selectedLang: string;
  isAuthenticated: boolean;
  activeSegmentId: string | null;
  getTranslatedText: (segId: string) => string;
  refetchMyFeedbacks: () => void;
}) {
  const [feedbackContent, setFeedbackContent] = useState("");
  const t = useT();

  const submitFeedbackMutation = trpc.feedbacks.submit.useMutation({
    onSuccess: () => {
      toast.success(t("learn.feedbackSubmitted"));
      setFeedbackContent("");
      opts.refetchMyFeedbacks();
    },
    onError: (err) => toast.error(t("learn.submitFailed", { msg: err.message })),
  });

  const handleSubmitFeedback = () => {
    if (!opts.isAuthenticated) {
      toast.error(t("learn.loginRequiredFeedback"));
      return;
    }
    if (!feedbackContent.trim()) {
      toast.error(t("learn.enterFeedback"));
      return;
    }
    if (!opts.activeSegmentId) {
      toast.error(t("learn.selectSegmentFirst"));
      return;
    }
    const seg = opts.segments.find((s) => s.id === opts.activeSegmentId);
    if (!seg) return;
    const translated = opts.getTranslatedText(opts.activeSegmentId);

    submitFeedbackMutation.mutate({
      tutorialId: opts.docId,
      tutorialTitle: opts.docTitle,
      originalText: seg.text,
      translatedText: translated || t("learn.noTranslationFallback"),
      targetLanguage: opts.selectedLang,
      feedbackType: "suggestion",
      feedbackContent: feedbackContent.trim(),
    });
  };

  return { feedbackContent, setFeedbackContent, submitFeedbackMutation, handleSubmitFeedback };
}

/**
 * Creates the two column scroll refs and scrolls both into view when the
 * active segment changes (sync highlight across original / translation).
 */
export function useScrollSync(activeSegmentId: string | null) {
  const zhColRef = useRef<HTMLDivElement>(null);
  const transColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSegmentId) return;
    const scrollToSeg = (ref: RefObject<HTMLDivElement | null>, prefix: string) => {
      const el = ref.current?.querySelector(`#${prefix}-${activeSegmentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    scrollToSeg(zhColRef, "seg");
    scrollToSeg(transColRef, "seg");
  }, [activeSegmentId]);

  return { zhColRef, transColRef };
}
