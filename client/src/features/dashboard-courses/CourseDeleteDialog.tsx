import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n";

interface CourseDeleteDialogProps {
  deletingId: number | null;
  onClose: () => void;
  isDeleting: boolean;
  onConfirm: (id: number) => void;
}

export function CourseDeleteDialog({
  deletingId,
  onClose,
  isDeleting,
  onConfirm,
}: CourseDeleteDialogProps) {
  const t = useT();
  return (
    <Dialog open={deletingId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("dashboard.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.deleteDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => deletingId !== null && onConfirm(deletingId)}
            disabled={isDeleting}
          >
            {isDeleting ? t("dashboard.deleting") : t("dashboard.confirmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
