import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAdminSession } from "@/_core/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  useLearnData,
  useExplain,
  useFeedback,
  useScrollSync,
} from "@/features/learn-view/hooks";
import { LearnHeader } from "@/features/learn-view/components/LearnHeader";
import { SourceColumn } from "@/features/learn-view/components/SourceColumn";
import { TranslationColumn } from "@/features/learn-view/components/TranslationColumn";
import { InteractionPanel } from "@/features/learn-view/components/InteractionPanel";
import { useT } from "@/i18n";

/**
 * Auth guard for the tutorial viewer. Browsing tutorials (list + viewer)
 * requires a login — either a learner (auth.me) or a dashboard admin.
 * The guard lives in its own component so all hooks in LearnViewContent run
 * unconditionally (no conditional-return hook violations).
 */
export default function LearnView() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminSession();
  const [, navigate] = useLocation();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLoggedIn = isAuthenticated || isAdmin;
  if (!isLoggedIn) {
    navigate("/login", { replace: true });
    return null;
  }

  return <LearnViewContent />;
}

function LearnViewContent() {
  const [, params] = useRoute("/learn/:id");
  const [, navigate] = useLocation();
  const t = useT();
  const docId = parseInt(params?.id || "0");
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useAdminSession();

  // A learner (auth.me) OR a dashboard admin can submit feedback without an
  // extra login — the feedback form must not gate on the learner identity alone.
  const canGiveFeedback = isAuthenticated || isAdmin;

  // Get lang from URL query
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedLang, setSelectedLang] = useState(
    urlParams.get("lang") || localStorage.getItem("preferredLanguage") || "en"
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [showMyFeedbacks, setShowMyFeedbacks] = useState(false);

  const { zhColRef, transColRef } = useScrollSync(activeSegmentId);
  const data = useLearnData(docId, selectedLang, canGiveFeedback);
  const {
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
    myFeedbacks,
    refetchMyFeedbacks,
  } = data;

  const explain = useExplain(selectedLang, segments, getTranslatedText);
  const feedback = useFeedback({
    docId,
    docTitle: doc?.title ?? "",
    segments,
    selectedLang,
    isAuthenticated: canGiveFeedback,
    activeSegmentId,
    getTranslatedText,
    refetchMyFeedbacks,
  });

  const handleSegmentClick = (segId: string) => {
    setActiveSegmentId((prev) => (prev === segId ? null : segId));
    feedback.setFeedbackContent(""); // reset feedback input on new selection
  };

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
          <p className="text-muted-foreground">{t("learn.docNotFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/learn")} className="mt-4">
            {t("learn.backToTutorials")}
          </Button>
        </div>
      </div>
    );
  }

  const downloadUrl =
    ((translationJob as any)?.previewHtmlUrl as string | null) || translationJob?.outputS3Url || null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LearnHeader
        title={doc.title}
        selectedLang={selectedLang}
        availableLangs={availableLangs}
        downloadUrl={downloadUrl}
        onBack={() => navigate("/learn")}
        onLanguageChange={setSelectedLang}
      />

      {/* Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <SourceColumn
          segments={segments}
          activeSegmentId={activeSegmentId}
          isImageLikeSegment={isImageLikeSegment}
          getSourceBlock={getSourceBlock}
          onSegmentClick={handleSegmentClick}
          colRef={zhColRef}
        />

        <TranslationColumn
          segments={segments}
          activeSegmentId={activeSegmentId}
          selectedLang={selectedLang}
          translationJob={translationJob as any}
          transLoading={transLoading}
          isImageLikeSegment={isImageLikeSegment}
          getImageUrlForSegment={getImageUrlForSegment}
          getTranslatedText={getTranslatedText}
          onSegmentClick={handleSegmentClick}
          onExplain={explain.handleExplain}
          colRef={transColRef}
        />

        <InteractionPanel
          activeSegmentId={activeSegmentId}
          segments={segments}
          selectedLang={selectedLang}
          isAuthenticated={canGiveFeedback}
          isImageLikeSegment={isImageLikeSegment}
          getSourceBlock={getSourceBlock}
          getImageUrlForSegment={getImageUrlForSegment}
          getTranslatedText={getTranslatedText}
          explainState={explain.explainState}
          explainLoading={explain.explainLoading}
          onDismissExplain={() => explain.setExplainState(null)}
          onExplainSegment={explain.handleExplain}
          feedbackContent={feedback.feedbackContent}
          onFeedbackContentChange={feedback.setFeedbackContent}
          feedbackPending={feedback.submitFeedbackMutation.isPending}
          onSubmitFeedback={feedback.handleSubmitFeedback}
          myFeedbacks={myFeedbacks}
          showMyFeedbacks={showMyFeedbacks}
          onToggleMyFeedbacks={() => setShowMyFeedbacks((v) => !v)}
        />
      </div>
    </div>
  );
}
