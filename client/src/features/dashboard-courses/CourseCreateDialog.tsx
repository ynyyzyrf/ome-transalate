import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { ALLOWED_EXTENSIONS, SUPPORTED_LANGUAGES } from "./constants";
import type { CreateCourseState } from "./hooks";
import { useT } from "@/i18n";

interface CourseCreateDialogProps {
  open: boolean;
  onClose: () => void;
  create: CreateCourseState;
}

export function CourseCreateDialog({ open, onClose, create }: CourseCreateDialogProps) {
  const t = useT();
  const {
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
    isPending,
    resetForm,
  } = create;

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: any[]) => {
      if (rejections.length > 0) {
        const err = rejections[0]?.errors?.[0];
        if (err?.code === "file-too-large") {
          toast.error(t("dashboard.fileTooLarge"));
        } else {
          toast.error(t("dashboard.unsupportedFormat"));
        }
        return;
      }
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          toast.error(t("dashboard.unsupportedFormatExt", { ext }));
          return;
        }
        setUploadFile(file);
        setUploadMode("file");
        // Auto-fill title from filename if empty
        if (!createForm.title) {
          const name = file.name.replace(/\.[^.]+$/, "");
          setCreateForm((p) => ({ ...p, title: name }));
        }
      }
    },
    [createForm.title, setCreateForm, setUploadFile, setUploadMode]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("dashboard.createTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.createDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <Label>
              {t("dashboard.titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              className="mt-1.5"
              placeholder={t("dashboard.titlePlaceholder")}
              value={createForm.title}
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Content input mode switch */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm">{t("dashboard.contentMode")}</Label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    uploadMode === "text"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setUploadMode("text")}
                >
                  {t("dashboard.textMode")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    uploadMode === "file"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setUploadMode("file")}
                >
                  {t("dashboard.fileMode")}
                </button>
              </div>
            </div>

            {uploadMode === "text" ? (
              <div>
                <Label>
                  {t("dashboard.originalContentLabel")} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  className="mt-1.5 font-mono text-sm !field-sizing-fixed max-h-[360px]"
                  rows={10}
                  placeholder={t("dashboard.originalContentPlaceholder")}
                  value={createForm.originalContent}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, originalContent: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.blockCount", {
                    count: createForm.originalContent.split("\n").filter(Boolean).length,
                  })}
                </p>
              </div>
            ) : (
              <div>
                <Label>
                  {t("dashboard.uploadLabel")} <span className="text-destructive">*</span>
                </Label>
                <div
                  {...getRootProps()}
                  className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : uploadFile
                        ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                        : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="font-medium">{uploadFile.name}</span>
                      <span className="text-muted-foreground">
                        ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                      <button
                        type="button"
                        className="ml-2 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : isDragActive ? (
                    <div className="text-sm text-muted-foreground">
                      <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <p>{t("dashboard.dropToSelect")}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <p>{t("dashboard.dragHere")}</p>
                      <p className="text-xs mt-1">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {t("dashboard.supportsDocx")}
                        </span>
                        {" · "}
                        <span className="line-through opacity-50">
                          {t("dashboard.inProgressFormats")}
                        </span>
                        {" "}
                        {t("dashboard.inProgress")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Target languages */}
          <div>
            <Label className="text-sm">{t("dashboard.targetLangs")}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    targetLanguages.includes(lang.code)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  }`}
                  onClick={() => toggleLanguage(lang.code)}
                >
                  {lang.label}({lang.zhLabel})
                </button>
              ))}
            </div>
            {targetLanguages.length === 0 && (
              <p className="text-xs text-destructive mt-1">{t("dashboard.needTargetLang")}</p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("dashboard.instructor")}</Label>
              <Input
                className="mt-1.5"
                placeholder={t("dashboard.instructorPlaceholder")}
                value={createForm.instructor}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, instructor: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{t("dashboard.category")}</Label>
              <Input
                className="mt-1.5"
                placeholder={t("dashboard.categoryPlaceholder")}
                value={createForm.category}
                onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("dashboard.description")}</Label>
              <Input
                className="mt-1.5"
                placeholder={t("dashboard.descriptionPlaceholder")}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>{t("dashboard.sortOrder")}</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={createForm.sortOrder}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {isPending ? t("dashboard.creating") : t("dashboard.createBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
