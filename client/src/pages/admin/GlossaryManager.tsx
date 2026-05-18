import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Plus, Trash2, BookOpen, Search, FileText, Info } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

export default function GlossaryManager() {
  const [search, setSearch] = useState("");
  const [newEntry, setNewEntry] = useState({
    sourceTerm: "",
    englishTerm: "",
    spanishTerm: "",
    thaiTerm: "",
    hindiTerm: "",
    vietnameseTerm: "",
  });

  const { data: entries = [], refetch } = trpc.glossary.list.useQuery({});

  const addMutation = trpc.glossary.addEntry.useMutation({
    onSuccess: () => {
      toast.success("術語已添加");
      setNewEntry({ sourceTerm: "", englishTerm: "", spanishTerm: "", thaiTerm: "", hindiTerm: "", vietnameseTerm: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.glossary.deleteEntry.useMutation({
    onSuccess: () => { toast.success("術語已刪除"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const uploadCsvMutation = trpc.glossary.uploadCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`成功導入 ${data.count} 條術語`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );
    uploadCsvMutation.mutate({ filename: file.name, base64Content: base64 });
  }, [uploadCsvMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
    maxFiles: 1,
  });

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.sourceTerm.toLowerCase().includes(q) ||
      e.englishTerm.toLowerCase().includes(q) ||
      (e.spanishTerm ?? "").toLowerCase().includes(q) ||
      (e.thaiTerm ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">術語庫管理</h1>
        <p className="text-muted-foreground mt-1">
          管理多語言翻譯術語表，確保專業詞彙一致性。翻譯邏輯：中文 → 英文 → 目標語言
        </p>
      </div>

      {/* CSV Format Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-semibold mb-1">CSV 格式說明（6 欄，可含標題行）：</p>
          <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded text-xs">
            中文術語, 英文, 西班牙語, 泰文, 印地語, 越南文
          </code>
          <p className="mt-1 text-xs opacity-80">英文欄為必填，其餘語言欄可留空。第一行若為標題行（「中文術語」開頭）將自動跳過。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" /> 批量導入 CSV
            </CardTitle>
            <CardDescription>
              上傳 CSV 文件批量導入多語言術語
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? "放開以上傳 CSV" : "拖拽 CSV 文件或點擊選擇"}
              </p>
            </div>
            {uploadCsvMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center">導入中...</p>
            )}
          </CardContent>
        </Card>

        {/* Manual Add */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" /> 手動添加術語
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">中文術語 *</Label>
                <Input
                  className="mt-1"
                  placeholder="例：開戶流程"
                  value={newEntry.sourceTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, sourceTerm: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">英文 *</Label>
                <Input
                  className="mt-1"
                  placeholder="Account Opening Process"
                  value={newEntry.englishTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, englishTerm: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">西班牙語</Label>
                <Input
                  className="mt-1"
                  placeholder="Proceso de apertura..."
                  value={newEntry.spanishTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, spanishTerm: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">泰文</Label>
                <Input
                  className="mt-1"
                  placeholder="กระบวนการ..."
                  value={newEntry.thaiTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, thaiTerm: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">印地語</Label>
                <Input
                  className="mt-1"
                  placeholder="खाता खोलने..."
                  value={newEntry.hindiTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, hindiTerm: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">越南文</Label>
                <Input
                  className="mt-1"
                  placeholder="Quy trình mở..."
                  value={newEntry.vietnameseTerm}
                  onChange={(e) => setNewEntry((p) => ({ ...p, vietnameseTerm: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => addMutation.mutate({
                sourceTerm: newEntry.sourceTerm,
                englishTerm: newEntry.englishTerm,
                spanishTerm: newEntry.spanishTerm || undefined,
                thaiTerm: newEntry.thaiTerm || undefined,
                hindiTerm: newEntry.hindiTerm || undefined,
                vietnameseTerm: newEntry.vietnameseTerm || undefined,
              })}
              disabled={!newEntry.sourceTerm || !newEntry.englishTerm || addMutation.isPending}
            >
              <Plus className="w-4 h-4" />
              添加術語
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> 術語列表（{entries.length} 條）
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索術語..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>暫無術語條目</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">中文術語</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">英文</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">西班牙語</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">泰文</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">印地語</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">越南文</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">添加時間</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{entry.sourceTerm}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{entry.englishTerm}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{entry.spanishTerm || <span className="opacity-30">—</span>}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{entry.thaiTerm || <span className="opacity-30">—</span>}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{entry.hindiTerm || <span className="opacity-30">—</span>}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{entry.vietnameseTerm || <span className="opacity-30">—</span>}</td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">{formatDate(entry.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: entry.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
