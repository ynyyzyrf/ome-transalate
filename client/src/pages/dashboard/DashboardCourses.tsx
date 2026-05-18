import { useState, useCallback } from "react";
import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Trash2, MessageSquare, BookOpen, Search, ChevronLeft, ChevronRight, Plus, Upload, FileText, X, Loader2, RotateCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Link } from "wouter";
import { useDropzone } from "react-dropzone";

interface CourseEditForm {
  title: string;
  originalContent: string;
  instructor: string;
  category: string;
  description: string;
  sortOrder: number;
  isPublished: "yes" | "no";
}

export default function DashboardCourses() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<CourseEditForm>({
    title: "",
    originalContent: "",
    instructor: "",
    category: "",
    description: "",
    sortOrder: 0,
    isPublished: "no",
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    originalContent: "",
    category: "",
    instructor: "",
    description: "",
    sortOrder: 0,
  });
  // File upload state for course creation
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [targetLanguages, setTargetLanguages] = useState<string[]>(["en"]);

  const SUPPORTED_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "th", label: "ภาษาไทย" },
    { code: "hi", label: "हिन्दी" },
    { code: "vi", label: "Tiếng Việt" },
  ];

  const PAGE_SIZE = 15;

  const { data, refetch, isLoading } = trpc.courses.list.useQuery(
    { page, pageSize: PAGE_SIZE },
    {
      refetchInterval: (query) => {
        const items = (query.state.data?.items ?? []) as any[];
        return items.some((c) => c.status === "processing" || c.status === "pending") ? 5000 : false;
      },
    }
  );

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("課程已建立，翻譯任務已排程");
        setShowCreateDialog(false);
        setCreateForm({ title: "", originalContent: "", category: "", instructor: "", description: "", sortOrder: 0 });
        setUploadFile(null);
        setUploadMode("text");
        setTargetLanguages(["en"]);
        refetch();
      } else {
        toast.error(data.error || "建立失敗");
      }
    },
    onError: (err) => {
      console.error("[createCourse] Error:", err.message, err);
      toast.error(err.message);
    },
  });

  const retryMutation = trpc.courses.retryTranslation.useMutation({
    onSuccess: () => {
      toast.success("已重新觸發翻譯");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateCourse = useCallback(async () => {
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

  const toggleLanguage = (code: string) => {
    setTargetLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  // File dropzone setup — currently only DOCX is enabled; other formats under construction
  const ALLOWED_EXTENSIONS = [".docx"];

  const COMING_SOON_EXTENSIONS = [
    ".pdf", ".xlsx", ".pptx", ".vsdx", ".xmind", ".png", ".jpg",
  ];

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
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (COMING_SOON_EXTENSIONS.includes(ext)) {
        toast.error(`${ext.toUpperCase()} 格式翻譯功能建設中，目前僅支援 DOCX`);
        return;
      }
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`不支援的檔案格式：${ext}`);
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
  }, [createForm.title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const updateMutation = trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success("課程已更新");
      setEditingCourse(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success("課程已刪除");
      setDeletingId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (course: any) => {
    setEditingCourse(course);
    setEditForm({
      title: course.title ?? "",
      originalContent: course.extractedText ?? "",
      instructor: course.instructor ?? "",
      category: course.category ?? "",
      description: course.description ?? "",
      sortOrder: course.sortOrder ?? 0,
      isPublished: course.isPublished ?? "no",
    });
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = search
    ? items.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <DashboardAdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">課程管理</h1>
            <p className="text-muted-foreground mt-1 text-sm">共 {total} 門課程</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            新增課程
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索課程名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                載入中...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>暫無課程</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">課程名稱</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">導師</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">分類</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">狀態</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">翻譯狀態</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">首次上傳</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">最後更新</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">反饋數</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((course) => (
                      <tr key={course.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{course.id}</td>
                        <td className="py-3 px-4 font-medium max-w-[200px]">
                          <span className="truncate block" title={course.title ?? ""}>
                            {course.title ?? "（未命名）"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{course.instructor ?? "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{course.category ?? "—"}</td>
                        <td className="py-3 px-4">
                          <Badge variant={course.isPublished === "yes" ? "default" : "secondary"}>
                            {course.isPublished === "yes" ? "啟用" : "停用"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {course.status === "completed" ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              已完成
                            </Badge>
                          ) : course.status === "processing" ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              翻譯中
                            </Badge>
                          ) : course.status === "pending" ? (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800">
                              <Clock className="w-3 h-3 mr-1" />
                              待翻譯
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="w-3 h-3" />
                                翻譯失敗
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => retryMutation.mutate({ documentId: course.id })}
                                disabled={retryMutation.isPending}
                              >
                                <RotateCw className={cn("w-3 h-3", retryMutation.isPending && "animate-spin")} />
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(course.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(course.updatedAt)}
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/dashboard/feedbacks?tutorialId=${course.id}`}>
                            <a className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {(course as any).feedbackCount ?? 0}
                            </a>
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(course)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeletingId(course.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 頁，共 {total} 條
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

      {/* Edit Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>編輯課程</DialogTitle>
            <DialogDescription>修改課程基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            <div>
              <Label>課程名稱</Label>
              <Input
                className="mt-1.5"
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>課程內容</Label>
              <Textarea
                className="mt-1.5"
                rows={8}
                placeholder="輸入課程中文內容，每行將自動切分為一個段落..."
                value={editForm.originalContent}
                onChange={(e) => setEditForm((p) => ({ ...p, originalContent: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>導師</Label>
                <Input
                  className="mt-1.5"
                  placeholder="導師姓名"
                  value={editForm.instructor}
                  onChange={(e) => setEditForm((p) => ({ ...p, instructor: e.target.value }))}
                />
              </div>
              <div>
                <Label>分類</Label>
                <Input
                  className="mt-1.5"
                  placeholder="課程分類"
                  value={editForm.category}
                  onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>課程描述</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                placeholder="課程簡介..."
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>排序</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>開課狀態</Label>
                <Select
                  value={editForm.isPublished}
                  onValueChange={(v: "yes" | "no") => setEditForm((p) => ({ ...p, isPublished: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">啟用</SelectItem>
                    <SelectItem value="no">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>取消</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editingCourse.id, ...editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setUploadFile(null); setUploadMode("text"); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>新增課程</DialogTitle>
            <DialogDescription>
              輸入文字內容或上傳 Word 檔案（DOCX），其餘格式建设中
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <Label>課程標題 <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1.5"
                placeholder="請輸入課程標題"
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            {/* Content input mode switch */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm">內容輸入方式</Label>
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${uploadMode === "text" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setUploadMode("text")}
                  >
                    文字輸入
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium transition-colors ${uploadMode === "file" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setUploadMode("file")}
                  >
                    檔案上傳
                  </button>
                </div>
              </div>

              {uploadMode === "text" ? (
                <div>
                  <Label>中文原文內容 <span className="text-destructive">*</span></Label>
                  <Textarea
                    className="mt-1.5 font-mono text-sm !field-sizing-fixed max-h-[360px]"
                    rows={10}
                    placeholder="請輸入中文課程內容，每行為一個語義塊。第一行將自動設為標題。"
                    value={createForm.originalContent}
                    onChange={(e) => setCreateForm((p) => ({ ...p, originalContent: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    共 {createForm.originalContent.split("\n").filter(Boolean).length} 行（語義塊）
                  </p>
                </div>
              ) : (
                <div>
                  <Label>上傳檔案 <span className="text-destructive">*</span></Label>
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
                          onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : isDragActive ? (
                      <div className="text-sm text-muted-foreground">
                        <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        <p>放開以選擇檔案</p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        <p>拖放 Word 檔案至此處，或點擊選擇</p>
                        <p className="text-xs mt-1">
                          <span className="text-green-600 dark:text-green-400 font-medium">支援：DOCX</span>
                          {" · "}
                          <span className="line-through opacity-50">PDF、Excel、PPT、Visio、XMind、圖片</span>
                          {" 建設中"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Target languages */}
            <div>
              <Label className="text-sm">目標翻譯語言</Label>
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
                    {lang.label}
                  </button>
                ))}
              </div>
              {targetLanguages.length === 0 && (
                <p className="text-xs text-destructive mt-1">至少選擇一個目標語言</p>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>導師</Label>
                <Input
                  className="mt-1.5"
                  placeholder="導師姓名"
                  value={createForm.instructor}
                  onChange={(e) => setCreateForm((p) => ({ ...p, instructor: e.target.value }))}
                />
              </div>
              <div>
                <Label>分類</Label>
                <Input
                  className="mt-1.5"
                  placeholder="課程分類"
                  value={createForm.category}
                  onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>課程描述</Label>
                <Input
                  className="mt-1.5"
                  placeholder="簡短介紹"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <Label>排序</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={createForm.sortOrder}
                  onChange={(e) => setCreateForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setUploadFile(null); setUploadMode("text"); }}>取消</Button>
            <Button
              onClick={handleCreateCourse}
              disabled={
                createMutation.isPending ||
                !createForm.title.trim() ||
                (uploadMode === "text" && !createForm.originalContent.trim()) ||
                (uploadMode === "file" && !uploadFile) ||
                targetLanguages.length === 0
              }
            >
              {createMutation.isPending ? "建立中..." : "建立課程"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              刪除後將同時移除該課程的所有翻譯任務和用戶反饋，此操作不可撤銷。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId !== null && deleteMutation.mutate({ id: deletingId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardAdminLayout>
  );
}
