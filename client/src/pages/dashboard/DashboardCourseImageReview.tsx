import { useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveClientAssetUrl } from "@/lib/assetUrls";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { isImageLikeBlock } from "@shared/imageBlocks";
import { useT } from "@/i18n";

type IRBlock = {
  id: string;
  type?: string;
  text?: string;
  meta?: { imageUrl?: string | null; [key: string]: unknown };
};

export default function DashboardCourseImageReview() {
  const t = useT();
  const [, params] = useRoute("/dashboard/courses/:id/images");
  const [, navigate] = useLocation();
  const docId = Number(params?.id || 0);
  const trpcUtils = trpc.useUtils();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);

  const { data: doc, isLoading } = trpc.courses.getById.useQuery(
    { id: docId },
    { enabled: !!docId }
  );

  const attachImageMutation = trpc.courses.attachImageToBlock.useMutation({
    onSuccess: async () => {
      setPendingBlockId(null);
      toast.success(t("dashboard.imgUploadSuccess"));
      await trpcUtils.courses.getById.invalidate({ id: docId });
    },
    onError: (err) => {
      setPendingBlockId(null);
      toast.error(err.message || t("dashboard.imgUploadFailed"));
    },
  });

  const blocks = useMemo<IRBlock[]>(() => {
    const irBlocks = ((doc as any)?.ir?.blocks as IRBlock[] | undefined) || [];
    if (irBlocks.length > 0) return irBlocks;
    const segments = (doc?.segments as Array<{ id: string; text: string; meta?: Record<string, unknown> }> | undefined) || [];
    return segments.map((seg) => ({
      id: seg.id,
      text: seg.text,
      meta: seg.meta,
    }));
  }, [doc]);

  const imageBlocks = useMemo(
    () => blocks.filter((block) => isImageLikeBlock(block)),
    [blocks]
  );
  const missingImageCount = useMemo(
    () => imageBlocks.filter((block) => !block.meta?.imageUrl).length,
    [imageBlocks]
  );

  const handleManualImageUpload = (blockId: string) => {
    setPendingBlockId(blockId);
    uploadInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const blockId = pendingBlockId;
    event.target.value = "";
    if (!file || !blockId) {
      setPendingBlockId(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      if (!base64) {
        setPendingBlockId(null);
        toast.error(t("dashboard.imgReadFailed"));
        return;
      }
      attachImageMutation.mutate({
        documentId: docId,
        blockId,
        filename: file.name,
        mimeType: file.type || "image/png",
        base64Content: base64,
      });
    };
    reader.onerror = () => {
      setPendingBlockId(null);
      toast.error(t("dashboard.imgReadFailed"));
    };
    reader.readAsDataURL(file);
  };

  return (
    <DashboardAdminLayout>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      {isLoading ? (
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !doc ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard/courses")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t("dashboard.imgBackToList")}
          </Button>
          <div className="text-muted-foreground">{t("dashboard.imgNotFound")}</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Button variant="ghost" onClick={() => navigate("/dashboard/courses")} className="gap-2 -ml-3">
                <ArrowLeft className="w-4 h-4" />
                {t("dashboard.imgBackToList")}
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t("dashboard.imgTitle")}</h1>
                <p className="text-muted-foreground mt-1">{doc.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t("dashboard.imgBlocks", { count: imageBlocks.length })}
              </Badge>
              <Badge variant={missingImageCount > 0 ? "destructive" : "secondary"}>
                {t("dashboard.imgMissing", { count: missingImageCount })}
              </Badge>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.imgChinesePreview")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {blocks.map((block, index) => {
                const isImage = isImageLikeBlock(block);
                const imageUrl = resolveClientAssetUrl(
                  String(block.meta?.imageUrl || "")
                );

                return (
                  <div
                    key={block.id || `blk-${index}`}
                    className={isImage ? "rounded-xl border border-amber-200 bg-amber-50 p-4" : ""}
                  >
                    {isImage ? (
                      imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="document image"
                          className="w-full h-auto rounded-lg border border-border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-700">
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">{t("dashboard.imgMissingHere")}</span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleManualImageUpload(block.id)}
                            disabled={attachImageMutation.isPending}
                          >
                            {attachImageMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            {attachImageMutation.isPending
                              ? t("dashboard.imgUploading")
                              : t("dashboard.imgUpload")}
                          </Button>
                        </div>
                      )
                    ) : (
                      <p className="text-sm leading-8 text-foreground whitespace-pre-wrap">
                        {block.text || ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardAdminLayout>
  );
}
