/**
 * Shared types for the Dashboard Courses feature.
 * Kept separate from hooks/components so UI and data layers
 * can reference the same shape without circular imports.
 */

export interface Course {
  id: number;
  title: string | null;
  instructor: string | null;
  category: string | null;
  description: string | null;
  sortOrder: number;
  isPublished: "yes" | "no";
  status: string;
  extractedText?: string | null;
  createdAt: string;
  updatedAt: string;
  feedbackCount?: number;
}

export interface CourseEditForm {
  title: string;
  originalContent: string;
  instructor: string;
  category: string;
  description: string;
  sortOrder: number;
  isPublished: "yes" | "no";
}

export interface CourseCreateForm {
  title: string;
  originalContent: string;
  category: string;
  instructor: string;
  description: string;
  sortOrder: number;
}
