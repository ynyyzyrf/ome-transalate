import type { Feedback } from "../../../../drizzle/schema";

/** Intermediate representation block used by the learn view's columns. */
export interface IRBlock {
  id: string;
  type: "heading" | "paragraph" | "list" | "table" | "image";
  text: string;
  meta?: { imageUrl?: string | null; [key: string]: unknown };
}

/** State of the AI explanation panel (Explain / AI Translation). */
export interface ExplainState {
  segmentId: string;
  originalText: string;
  translatedText: string;
  explanation: string | null;
  loading: boolean;
}

/** Translation job fields actually consumed by the learn view. */
export interface TranslationJobView {
  status?: string;
  errorMessage?: string | null;
  outputS3Url?: string | null;
  previewHtmlUrl?: string | null;
}

/** Feedback fields actually consumed by the interaction panel. */
export type FeedbackRecord = Pick<
  Feedback,
  "id" | "status" | "createdAt" | "originalText" | "feedbackContent" | "adminNote"
>;
