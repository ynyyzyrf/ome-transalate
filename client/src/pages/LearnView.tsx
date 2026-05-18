import { useState, useRef, useCallback, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Download,
  Loader2,
  Sparkles,
  X,
  MessageSquare,
  BookOpen,
  Languages,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn, SUPPORTED_LANGUAGES, LANGUAGE_MAP } from "@/lib/utils";
import type { Segment, TranslatedSegment } from "../../../drizzle/schema";
import { Streamdown } from "streamdown";

// ── Status badge config ─────────────────────────────────────────────────────
const FEEDBACK_STATUS: Record<number, { label: string; icon: React.ElementType; color: string }> = {
  0: { label: "未接收", icon: Clock, color: "text-muted-foreground" },
  1: { label: "處理中", icon: AlertCircle, color: "text-amber-500" },
  2: { label: "已處理", icon: CheckCircle2, color: "text-green-500" },
};

export default function LearnView() {
  const [, params] = useRoute("/learn/:id");
  const [, navigate] = useLocation();
  const docId = parseInt(params?.id || "0");
  const { user, isAuthenticated } = useAuth();

  // Get lang from URL query
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedLang, setSelectedLang] = useState(
    urlParams.get("lang") || localStorage.getItem("preferredLanguage") || "en"
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [explainState, setExplainState] = useState<{
    segmentId: string;
    originalText: string;
    translatedText: string;
    explanation: string | null;
    loading: boolean;
  } | null>(null);

  // Feedback state
  const [feedbackContent, setFeedbackContent] = useState("");
  const [showMyFeedbacks, setShowMyFeedbacks] = useState(false);

  const zhColRef = useRef<HTMLDivElement>(null);
  const transColRef = useRef<HTMLDivElement>(null);

  // Data fetching
  const { data: doc, isLoading: docLoading } = trpc.documents.getById.useQuery(
    { id: docId },
    { enabled: !!docId }
  );
  const { data: translationJob, isLoading: transLoading } = trpc.documents.getTranslation.useQuery(
    { documentId: docId, language: selectedLang },
    {
      enabled: !!docId && !!selectedLang,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "pending" || status === "processing" ? 5000 : false;
      },
    }
  );
  const { data: allJobs } = trpc.documents.getTranslations.useQuery(
    { documentId: docId },
    { enabled: !!docId }
  );

  // My feedbacks for this tutorial
  const { data: myFeedbacks, refetch: refetchMyFeedbacks } = trpc.feedbacks.myFeedbacks.useQuery(
    { tutorialId: docId },
    { enabled: isAuthenticated && !!docId }
  );

  const explainMutation = trpc.ai.explain.useMutation({
    onSuccess: (data) => {
      setExplainState((prev) => prev ? { ...prev, explanation: data.explanation, loading: false } : null);
    },
    onError: (err) => {
      toast.error("AI 解釋失敗：" + err.message);
      setExplainState((prev) => prev ? { ...prev, loading: false } : null);
    },
  });

  const submitFeedbackMutation = trpc.feedbacks.submit.useMutation({
    onSuccess: () => {
      toast.success("反饋已提交！感謝您的意見");
      setFeedbackContent("");
      refetchMyFeedbacks();
    },
    onError: (err) => toast.error("提交失敗：" + err.message),
  });

  const segments: Segment[] = (doc?.segments as Segment[]) || [];
  const translatedSegments: TranslatedSegment[] = (translationJob?.translatedSegments as TranslatedSegment[]) || [];

  const getTranslatedText = useCallback((segId: string): string => {
    return translatedSegments.find((s) => s.id === segId)?.text || "";
  }, [translatedSegments]);

  // Scroll sync: when active segment changes, scroll both columns
  useEffect(() => {
    if (!activeSegmentId) return;
    const scrollToSeg = (ref: React.RefObject<HTMLDivElement | null>, prefix: string) => {
      const el = ref.current?.querySelector(`#${prefix}-${activeSegmentId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    scrollToSeg(zhColRef, "seg");
    scrollToSeg(transColRef, "seg");
  }, [activeSegmentId]);

  const handleSegmentClick = (segId: string) => {
    setActiveSegmentId((prev) => prev === segId ? null : segId);
    setFeedbackContent(""); // reset feedback input on new selection
  };

  const handleExplain = (seg: Segment) => {
    const translated = getTranslatedText(seg.id);
    if (!translated) { toast.error("此段落尚無譯文"); return; }

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

  const handleSubmitFeedback = () => {
    if (!isAuthenticated) {
      toast.error("請先登入後再提交反饋");
      return;
    }
    if (!feedbackContent.trim()) {
      toast.error("請輸入反饋內容");
      return;
    }
    if (!activeSegmentId) {
      toast.error("請先選取一個段落");
      return;
    }
    const seg = segments.find((s) => s.id === activeSegmentId);
    if (!seg) return;
    const translated = getTranslatedText(activeSegmentId);

    submitFeedbackMutation.mutate({
      tutorialId: docId,
      tutorialTitle: doc?.title ?? "",
      originalText: seg.text,
      translatedText: translated || "（無譯文）",
      targetLanguage: selectedLang,
      feedbackType: "suggestion",
      feedbackContent: feedbackContent.trim(),
    });
  };

  const availableLangs = (allJobs || [])
    .filter((j) => j.status === "completed")
    .map((j) => j.targetLanguage);

  if (docLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">文檔不存在或已被刪除</p>
          <Button variant="ghost" onClick={() => navigate("/learn")} className="mt-4">
            返回教程列表
          </Button>
        </div>
      </div>
    );
  }

  const activeSegment = segments.find((s) => s.id === activeSegmentId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)] shadow-sm">
        <div className="px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/learn")}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <a
            href="/"
            className="hidden sm:flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded"
          >
            <BookOpen className="w-3.5 h-3.5" />
            首頁
          </a>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[var(--sidebar-foreground)] text-sm truncate">{doc.title}</h1>
          </div>
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <Select value={selectedLang} onValueChange={setSelectedLang}>
              <SelectTrigger className="w-40 h-8 bg-white/10 border-white/20 text-[var(--sidebar-foreground)] text-xs">
                <Languages className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => {
                  const isAvailable = availableLangs.includes(l.code);
                  return (
                    <SelectItem key={l.code} value={l.code} disabled={!isAvailable}>
                      {l.flag} {l.label} {!isAvailable && "(翻譯中)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {translationJob?.outputS3Url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => window.open(translationJob.outputS3Url!, "_blank")}
              >
                <Download className="w-3.5 h-3.5" />
                下載
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        {/* Left Column: Chinese Original */}
        <div className="w-[33%] flex flex-col border-r border-border">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              中文原文
            </span>
            <span className="ml-auto text-xs text-muted-foreground">{segments.length} 段</span>
          </div>
          <div
            ref={zhColRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1"
          >
            {segments.map((seg) => (
              <div
                key={seg.id}
                id={`seg-${seg.id}`}
                className={cn(
                  "segment-block",
                  activeSegmentId === seg.id && "active"
                )}
                onClick={() => handleSegmentClick(seg.id)}
              >
                <p className={cn(
                  "text-sm leading-relaxed text-foreground",
                  seg.type === "heading" && "font-semibold text-base"
                )}>
                  {seg.text}
                </p>
              </div>
            ))}
            {segments.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                暫無內容
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Translation */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {LANGUAGE_MAP[selectedLang] || selectedLang}
            </span>
            {transLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />}
            {translationJob?.status === "processing" && (
              <span className="ml-2 text-xs text-blue-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 翻譯中...
              </span>
            )}
          </div>
          <div
            ref={transColRef}
            className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1"
          >
            {translationJob?.status === "pending" || translationJob?.status === "processing" ? (
              <div className="text-center py-16 text-muted-foreground">
                <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" />
                <p className="font-medium">翻譯進行中</p>
                <p className="text-sm mt-1">AI 正在翻譯此文檔，請稍候...</p>
              </div>
            ) : !translationJob || translationJob.status === "failed" ? (
              <div className="text-center py-16 text-muted-foreground">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {translationJob?.status === "failed" ? "翻譯失敗" : "尚無此語言譯文"}
                </p>
                <p className="text-sm mt-1">請選擇其他語言或聯繫管理員</p>
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
                    onClick={() => handleSegmentClick(seg.id)}
                  >
                    <p className={cn(
                      "text-sm leading-relaxed text-foreground pr-6",
                      seg.type === "heading" && "font-semibold text-base"
                    )}>
                      {translated || <span className="text-muted-foreground italic">（無譯文）</span>}
                    </p>
                    {translated && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExplain(seg); }}
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

        {/* Right Column: Interaction Panel */}
        <div className="w-[300px] shrink-0 flex flex-col bg-muted/20">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              互動面板
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

            {/* ── Active Segment Info ── */}
            {activeSegmentId ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  已選中段落 #{activeSegmentId}
                </div>

                {/* Chinese */}
                <div className="rounded-lg bg-card border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">🇨🇳 中文原文</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {activeSegment?.text}
                  </p>
                </div>

                {/* Translation */}
                <div className="rounded-lg bg-card border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.flag}{" "}
                    {LANGUAGE_MAP[selectedLang]}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {getTranslatedText(activeSegmentId) || (
                      <span className="text-muted-foreground italic">（無譯文）</span>
                    )}
                  </p>
                </div>

                {/* AI Explanation */}
                {explainState && explainState.segmentId === activeSegmentId && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI 其他合適的表述
                      </p>
                      <button
                        onClick={() => setExplainState(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {explainState.loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 正在解釋...
                      </div>
                    ) : (
                      <div className="text-sm text-foreground leading-relaxed">
                        <Streamdown>{explainState.explanation || ""}</Streamdown>
                      </div>
                    )}
                  </div>
                )}

                {/* Explain Button */}
                {getTranslatedText(activeSegmentId) && (
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => {
                      const seg = segments.find((s) => s.id === activeSegmentId);
                      if (seg) handleExplain(seg);
                    }}
                    disabled={explainState?.loading}
                  >
                    {explainState?.loading ? (
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
                    反饋意見
                  </p>
                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="針對此段落提交您的翻譯意見或建議..."
                        value={feedbackContent}
                        onChange={(e) => setFeedbackContent(e.target.value)}
                        rows={3}
                        className="text-xs resize-none"
                        maxLength={2000}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{feedbackContent.length}/2000</span>
                        <Button
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={handleSubmitFeedback}
                          disabled={submitFeedbackMutation.isPending || !feedbackContent.trim()}
                        >
                          {submitFeedbackMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          提交反饋
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 text-center">
                      <p>請先登入後提交反饋</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">點擊任意段落</p>
                <p className="text-xs mt-1 leading-relaxed">
                  在左欄或中欄點擊段落，即可查看對比內容、使用 AI 解釋並提交反饋
                </p>
              </div>
            )}

            {/* ── My Feedback Records ── */}
            {isAuthenticated && (
              <div className="border-t border-border pt-3">
                <button
                  className="w-full flex items-center justify-between text-xs font-semibold text-foreground mb-2"
                  onClick={() => setShowMyFeedbacks((v) => !v)}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    我的反饋記錄
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
                      <p className="text-xs text-muted-foreground text-center py-3">
                        尚無反饋記錄
                      </p>
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
                              <span className={cn("text-xs flex items-center gap-1", statusInfo.color)}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(fb.createdAt).toLocaleDateString("zh-TW")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              段落：{fb.originalText}
                            </p>
                            <p className="text-xs text-foreground line-clamp-2">
                              {fb.feedbackContent}
                            </p>
                            {fb.adminNote && (
                              <div className="mt-1 pt-1.5 border-t border-border">
                                <p className="text-xs text-primary">
                                  管理員回覆：{fb.adminNote}
                                </p>
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
              <p className="font-medium text-foreground">使用提示</p>
              <p>• 點擊段落可同步高亮顯示對應原文</p>
              <p>• 懸浮段落顯示 AI 解釋按鈕</p>
              <p>• 選中段落後可提交翻譯反饋意見</p>
              <p>• 使用頂部下拉切換目標語言</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
