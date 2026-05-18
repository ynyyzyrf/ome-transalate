import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn, formatFileSize, getFileTypeIcon, SUPPORTED_LANGUAGES } from "@/lib/utils";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  progress: number;
}

const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".doc",
  ".xlsx", ".xls",
  ".pptx", ".ppt",
  ".vsdx", ".xmind",
  ".png", ".jpg", ".jpeg",
];

export default function DocumentUpload() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = trpc.documents.upload.useMutation();
  const utils = trpc.useUtils();

  const onDrop = useCallback((acceptedFiles: File[], rejections: any[]) => {
    if (rejections.length > 0) {
      const err = rejections[0]?.errors?.[0];
      if (err?.code === "file-too-large") {
        toast.error("檔案不能超過 50MB");
      } else {
        toast.error("不支援的檔案格式");
      }
      return;
    }
    const validFiles = acceptedFiles.filter((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    });
    const newFiles: UploadFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const uploadAll = async () => {
    if (!files.length || !selectedLanguages.length) {
      toast.error("請選擇文件和目標語言");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const uploadFile of files.filter((f) => f.status === "pending")) {
      setFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading", progress: 30 } : f))
      );

      try {
        const buffer = await uploadFile.file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 60 } : f))
        );

        await uploadMutation.mutateAsync({
          filename: uploadFile.file.name,
          mimeType: uploadFile.file.type || "application/octet-stream",
          base64Content: base64,
          title: uploadFile.file.name.replace(/\.[^.]+$/, ""),
          targetLanguages: selectedLanguages,
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "done", progress: 100 } : f
          )
        );
        successCount++;
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error", error: err.message || "上傳失敗", progress: 0 }
              : f
          )
        );
        errorCount++;
      }
    }

    setIsUploading(false);
    utils.documents.list.invalidate();

    if (successCount > 0) {
      toast.success(`成功上傳 ${successCount} 份文件，AI 翻譯任務已啟動`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} 份文件上傳失敗`);
    }
  };

  const clearDone = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "done"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">批量上傳文件</h1>
        <p className="text-muted-foreground mt-1">
          支持 PDF、DOCX、XLSX、PPTX、JPG、PNG 格式，最大 50MB
        </p>
      </div>

      {/* Language Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">選擇目標翻譯語言</CardTitle>
          <CardDescription>上傳後系統將自動翻譯為所選語言</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div key={lang.code} className="flex items-center space-x-2">
                <Checkbox
                  id={`lang-${lang.code}`}
                  checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={() => toggleLanguage(lang.code)}
                />
                <Label htmlFor={`lang-${lang.code}`} className="cursor-pointer font-normal">
                  {lang.flag} {lang.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200",
              isDragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <input {...getInputProps()} />
            <Upload
              className={cn(
                "w-12 h-12 mx-auto mb-4 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            {isDragActive ? (
              <p className="text-primary font-medium text-lg">放開以添加文件</p>
            ) : (
              <>
                <p className="font-medium text-foreground text-lg">拖拽文件到此處，或點擊選擇</p>
                <p className="text-muted-foreground text-sm mt-2">
                  支持 PDF · DOCX · XLSX · PPTX · JPG · PNG（最大 50MB）
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">待上傳文件（{files.length}）</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearDone} className="text-muted-foreground">
              清除已完成
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <span className="text-2xl">{getFileTypeIcon(f.file.name.split(".").pop() || "")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{f.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</p>
                    {f.status === "uploading" && (
                      <Progress value={f.progress} className="h-1 mt-1" />
                    )}
                    {f.status === "error" && (
                      <p className="text-xs text-destructive mt-1">{f.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {f.status === "done" && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {f.status === "error" && (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                    {f.status === "pending" && (
                      <button
                        onClick={() => removeFile(f.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={uploadAll}
                disabled={isUploading || files.every((f) => f.status !== "pending")}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <FileText className="w-4 h-4 animate-pulse" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    開始上傳並翻譯（{files.filter((f) => f.status === "pending").length} 份）
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
