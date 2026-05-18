import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Search, Trash2, Eye, RefreshCw, FileText, Globe, Download } from "lucide-react";
import { formatDate, formatFileSize, getFileTypeIcon, LANGUAGE_MAP } from "@/lib/utils";
import { useLocation } from "wouter";

export default function DocumentList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, refetch } = trpc.documents.list.useQuery({ page, pageSize: 20 });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => { toast.success("文件已刪除"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.documents.setPublished.useMutation({
    onSuccess: () => { toast.success("發布狀態已更新"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (data?.items || []).filter((doc) =>
    !search || doc.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">文件管理</h1>
          <p className="text-muted-foreground mt-1">管理所有已上傳的培訓文件</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          刷新
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索文件名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">文件列表（共 {data?.total || 0} 份）</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">載入中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暫無文件，請先上傳</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors"
                >
                  <span className="text-2xl shrink-0">{getFileTypeIcon(doc.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <StatusBadge status={doc.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.originalFilename} · {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">發布</span>
                      <Switch
                        checked={doc.isPublished === "yes"}
                        onCheckedChange={(checked) =>
                          publishMutation.mutate({ id: doc.id, isPublished: checked })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => navigate(`/learn/${doc.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {doc.s3Url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => window.open(doc.s3Url!, "_blank")}
                        title="下載原始文件"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`確定刪除「${doc.title}」及其所有翻譯？`)) {
                          deleteMutation.mutate({ id: doc.id });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(data?.total || 0) > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一頁
              </Button>
              <span className="text-sm text-muted-foreground self-center">第 {page} 頁</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= (data?.total || 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
