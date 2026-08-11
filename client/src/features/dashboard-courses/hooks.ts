import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import { COURSE_PAGE_SIZE, EMPTY_CREATE_FORM } from "./constants";
import type { CourseCreateForm } from "./types";

/**
 * Paginated course list query + retry-translation mutation.
 * Polls every 5s while any course on the page is still translating.
 */
export function useCourseList() {
  const t = useT();
  const [page, setPage] = useState(1);

  const { data, refetch, isLoading } = trpc.courses.list.useQuery(
    { page, pageSize: COURSE_PAGE_SIZE },
    {
      refetchInterval: (query) => {
        const items = (query.state.data?.items ?? []) as any[];
        return items.some((c: any) => c.status === "processing" || c.status === "pending")
          ? 5000
          : false;
      },
    }
  );

  const retryMutation = trpc.courses.retryTranslation.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.retranslated"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / COURSE_PAGE_SIZE);

  return { page, setPage, items, total, totalPages, isLoading, refetch, retryMutation };
}

export type CreateCourseState = ReturnType<typeof useCreateCourse>;

/**
 * Create-course form state + mutation, supporting both text input and
 * base64 file upload modes. `onCreated` fires after a successful create.
 */
export function useCreateCourse(onCreated?: () => void) {
  const t = useT();
  const [createForm, setCreateForm] = useState<CourseCreateForm>(EMPTY_CREATE_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [targetLanguages, setTargetLanguages] = useState<string[]>(["en"]);

  const resetForm = useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setUploadFile(null);
    setUploadMode("text");
    setTargetLanguages(["en"]);
  }, []);

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t("dashboard.created"));
        resetForm();
        onCreated?.();
      } else {
        toast.error(data.error || t("dashboard.createFailed"));
      }
    },
    onError: (err) => {
      console.error("[createCourse] Error:", err.message, err);
      toast.error(err.message);
    },
  });

  const toggleLanguage = useCallback((code: string) => {
    setTargetLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (uploadMode === "file" && uploadFile) {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        createMutation.mutate({
          title: createForm.title,
          file: {
            filename: uploadFile.name,
            mimeType: uploadFile.type,
            base64Content: base64,
          },
          category: createForm.category || undefined,
          instructor: createForm.instructor || undefined,
          description: createForm.description || undefined,
          sortOrder: createForm.sortOrder || undefined,
          targetLanguages,
        });
      };
      reader.readAsDataURL(uploadFile);
    } else {
      createMutation.mutate({
        title: createForm.title,
        originalContent: createForm.originalContent,
        category: createForm.category || undefined,
        instructor: createForm.instructor || undefined,
        description: createForm.description || undefined,
        sortOrder: createForm.sortOrder || undefined,
        targetLanguages,
      });
    }
  }, [createForm, uploadFile, uploadMode, targetLanguages, createMutation]);

  const canSubmit =
    !createMutation.isPending &&
    !!createForm.title.trim() &&
    (uploadMode === "text" ? !!createForm.originalContent.trim() : !!uploadFile) &&
    targetLanguages.length > 0;

  return {
    createForm,
    setCreateForm,
    uploadFile,
    setUploadFile,
    uploadMode,
    setUploadMode,
    targetLanguages,
    toggleLanguage,
    handleCreate,
    canSubmit,
    isPending: createMutation.isPending,
    resetForm,
  };
}

/** Update-course mutation. `onUpdated` fires after a successful save. */
export function useCourseEdit(onUpdated?: () => void) {
  const t = useT();
  return trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.updated"));
      onUpdated?.();
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Delete-course mutation. `onDeleted` fires after a successful delete. */
export function useCourseDelete(onDeleted?: () => void) {
  const t = useT();
  return trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.deleted"));
      onDeleted?.();
    },
    onError: (err) => toast.error(err.message),
  });
}
