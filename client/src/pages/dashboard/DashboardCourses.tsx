import { useState } from "react";
import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  useCourseList,
  useCreateCourse,
  useCourseEdit,
  useCourseDelete,
} from "@/features/dashboard-courses/hooks";
import { CourseListTable } from "@/features/dashboard-courses/CourseListTable";
import { CourseCreateDialog } from "@/features/dashboard-courses/CourseCreateDialog";
import { CourseEditDialog } from "@/features/dashboard-courses/CourseEditDialog";
import { CourseDeleteDialog } from "@/features/dashboard-courses/CourseDeleteDialog";
import type { Course } from "@/features/dashboard-courses/types";
import { useT } from "@/i18n";

export default function DashboardCourses() {
  const t = useT();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { page, setPage, items, total, totalPages, isLoading, refetch, retryMutation } =
    useCourseList();
  const create = useCreateCourse(() => {
    setShowCreateDialog(false);
    refetch();
  });
  const updateMutation = useCourseEdit(() => {
    setEditingCourse(null);
    refetch();
  });
  const deleteMutation = useCourseDelete(() => {
    setDeletingId(null);
    refetch();
  });

  return (
    <DashboardAdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.coursesTitle")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("dashboard.coursesTotal", { count: total })}
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("dashboard.addCourse")}
          </Button>
        </div>

        <CourseListTable
          items={items}
          isLoading={isLoading}
          onEdit={setEditingCourse}
          onDelete={setDeletingId}
          retryPending={retryMutation.isPending}
          onRetry={(id) => retryMutation.mutate({ documentId: id })}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.pageInfo", { page, totalPages, total })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <CourseEditDialog
        course={editingCourse}
        onClose={() => setEditingCourse(null)}
        isSaving={updateMutation.isPending}
        onSave={(payload) => updateMutation.mutate(payload as any)}
      />

      <CourseCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        create={create}
      />

      <CourseDeleteDialog
        deletingId={deletingId}
        onClose={() => setDeletingId(null)}
        isDeleting={deleteMutation.isPending}
        onConfirm={(id) => deleteMutation.mutate({ id })}
      />
    </DashboardAdminLayout>
  );
}
