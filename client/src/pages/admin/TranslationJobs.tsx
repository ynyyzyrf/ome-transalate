import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { RefreshCw, Search, RotateCcw, Globe, FileText } from "lucide-react";
import { formatDate, LANGUAGE_MAP } from "@/lib/utils";

export default function TranslationJobs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = trpc.translationJobs.listAll.useQuery(
    { page, pageSize: 30 },
    {
      // Auto-poll every 8 seconds when there are active jobs
      refetchInterval: (query) => {
        const items = query.state.data?.items || [];
        const hasActive = items.some(
          (i) => i.job.status === "pending" || i.job.status === "processing"
        );
        return hasActive ? 8000 : false;
      },
    }
  );
  const retryMutation = trpc.documents.retryTranslation.useMutation({
    onSuccess: () => {
      toast.success("已重新觸發翻譯任務");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const utils = trpc.useUtils();

  const handleRefresh = () => {
    refetch();
    utils.documents.list.invalidate();
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (!search) return true;
    const title = item.docTitle || "";
    const lang = LANGUAGE_MAP[item.job.targetLanguage] || item.job.targetLanguage;
    return (
      title.toLowerCase().includes(search.toLowerCase()) ||
      lang.toLowerCase().includes(search.toLowerCase())
    );
  });

  const stats = {
    total: data?.total || 0,
    pending: (data?.items || []).filter((i) => i.job.status === "pending").length,
    processing: (data?.items || []).filter((i) => i.job.status === "processing").length,
    completed: (data?.items || []).filter((i) => i.job.status === "completed").length,
    failed: (data?.items || []).filter((i) => i.job.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">翻譯任務狀態</h1>
          <p className="text-muted-foreground mt-1">追蹤所有文件的翻譯進度</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "待處理", count: stats.pending, cls: "status-pending" },
          { label: "翻譯中", count: stats.processing, cls: "status-processing" },
          { label: "已完成", count: stats.completed, cls: "status-completed" },
          { label: "失敗", count: stats.failed, cls: "status-failed" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{s.count}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索文件名稱或語言..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">翻譯任務列表（共 {data?.total || 0} 條）</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">載入中...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暫無翻譯任務</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">文件名稱</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">目標語言</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">狀態</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">創建時間</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">完成時間</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(({ job, docTitle }) => (
                    <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[200px]">{docTitle || `文件 #${job.documentId}`}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                          {LANGUAGE_MAP[job.targetLanguage] || job.targetLanguage}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {job.completedAt ? formatDate(job.completedAt) : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {job.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() =>
                              retryMutation.mutate({
                                documentId: job.documentId,
                                language: job.targetLanguage,
                              })
                            }
                          >
                            <RotateCcw className="w-3 h-3" />
                            重試
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
