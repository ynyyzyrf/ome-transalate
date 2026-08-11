import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import type { Course, CourseEditForm } from "./types";
import { useT } from "@/i18n";

const DEFAULT_EDIT_FORM: CourseEditForm = {
  title: "",
  originalContent: "",
  instructor: "",
  category: "",
  description: "",
  sortOrder: 0,
  isPublished: "no",
};

interface CourseEditDialogProps {
  course: Course | null;
  onClose: () => void;
  isSaving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}

export function CourseEditDialog({ course, onClose, isSaving, onSave }: CourseEditDialogProps) {
  const t = useT();
  const [editForm, setEditForm] = useState<CourseEditForm>(DEFAULT_EDIT_FORM);

  // Re-initialize the form whenever a different course is opened.
  useEffect(() => {
    if (course) {
      setEditForm({
        title: course.title ?? "",
        originalContent: course.extractedText ?? "",
        instructor: course.instructor ?? "",
        category: course.category ?? "",
        description: course.description ?? "",
        sortOrder: course.sortOrder ?? 0,
        isPublished: course.isPublished ?? "no",
      });
    }
  }, [course]);

  const handleSave = () => {
    if (!course) return;
    const payload: Record<string, unknown> = { id: course.id, ...editForm };
    // Only send content when the admin actually changed the text — an unchanged
    // save must never re-split the source segments (which would discard images).
    if (editForm.originalContent === (course.extractedText ?? "")) {
      delete payload.originalContent;
    }
    onSave(payload);
  };

  return (
    <Dialog open={!!course} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl max-h-[calc(100vh-64px)] overflow-hidden p-0 flex flex-col gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="space-y-1">
            <DialogTitle>{t("dashboard.editTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("dashboard.editSubtitle")}</p>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">{t("dashboard.close")}</span>
            </Button>
          </DialogClose>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{t("dashboard.editBasic")}</h3>
                <p className="text-sm text-muted-foreground">{t("dashboard.editBasicDesc")}</p>
              </div>

              <div>
                <Label className="block mb-2">{t("dashboard.editName")}</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{t("dashboard.editContent")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.editContentDesc")}
                </p>
              </div>

              <div>
                <Label className="block mb-2">{t("dashboard.editContentEditor")}</Label>
                <Textarea
                  className="min-h-[320px] w-full box-border !field-sizing-fixed resize-y"
                  rows={12}
                  placeholder={t("dashboard.editContentPlaceholder")}
                  value={editForm.originalContent}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, originalContent: e.target.value }))
                  }
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">{t("dashboard.editExtra")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block mb-2">{t("dashboard.instructor")}</Label>
                  <Input
                    placeholder={t("dashboard.instructorPlaceholder")}
                    value={editForm.instructor}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, instructor: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="block mb-2">{t("dashboard.category")}</Label>
                  <Input
                    placeholder={t("dashboard.categoryPlaceholder")}
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, category: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="block mb-2">{t("dashboard.description")}</Label>
                <Textarea
                  className="w-full box-border !field-sizing-fixed min-h-28"
                  rows={3}
                  placeholder={t("dashboard.editDescriptionPlaceholder")}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="block mb-2">{t("dashboard.sortOrder")}</Label>
                  <Input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        sortOrder: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="block mb-2">{t("dashboard.editPublished")}</Label>
                  <Select
                    value={editForm.isPublished}
                    onValueChange={(v: "yes" | "no") =>
                      setEditForm((p) => ({ ...p, isPublished: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t("dashboard.published")}</SelectItem>
                      <SelectItem value="no">{t("dashboard.unpublished")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("dashboard.saving") : t("dashboard.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
