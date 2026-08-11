import { z } from "zod";

export const DASHBOARD_DEFAULT_TARGET_LANGUAGES = ["en", "es", "th", "hi", "vi"] as const;

export const ingestionMetadataSchema = z.object({
  category: z.string().max(128).optional(),
  instructor: z.string().max(256).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const uploadedFileSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  base64Content: z.string(),
});

export const documentUploadInputSchema = uploadedFileSchema.extend({
  title: z.string().optional(),
  targetLanguages: z.array(z.string()).default(["en"]),
  category: ingestionMetadataSchema.shape.category,
  instructor: ingestionMetadataSchema.shape.instructor,
  description: ingestionMetadataSchema.shape.description,
  sortOrder: ingestionMetadataSchema.shape.sortOrder,
});

export const courseCreateInputSchema = z.object({
  title: z.string().min(1).max(512),
  originalContent: z.string().optional(),
  file: uploadedFileSchema.optional(),
  category: ingestionMetadataSchema.shape.category,
  instructor: ingestionMetadataSchema.shape.instructor,
  description: ingestionMetadataSchema.shape.description,
  sortOrder: ingestionMetadataSchema.shape.sortOrder,
  targetLanguages: z.array(z.string()).optional(),
});

export type IngestionMetadataInput = z.infer<typeof ingestionMetadataSchema>;
export type UploadedFileInput = z.infer<typeof uploadedFileSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadInputSchema>;
export type CourseCreateInput = z.infer<typeof courseCreateInputSchema>;
export type IngestionSourceInput = UploadedFileInput | { originalContent: string };

export function resolveTargetLanguages(
  targetLanguages: string[] | undefined,
  fallbackLanguages: readonly string[],
): string[] {
  if (targetLanguages?.length) {
    return targetLanguages;
  }

  return [...fallbackLanguages];
}
