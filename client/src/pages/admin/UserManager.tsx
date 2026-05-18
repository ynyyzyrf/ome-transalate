/**
 * Admin User Manager Page
 * Allows admins to view all registered users and promote/demote their roles.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Shield, ShieldOff, Users, Crown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserManager() {
  const { user: currentUser } = useAuth();
  const [page] = useState(1);

  const { data, isLoading, refetch } = trpc.usersAdmin.list.useQuery({ page, pageSize: 50 });

  const setRoleMutation = trpc.usersAdmin.setRole.useMutation({
    onSuccess: (_, variables) => {
      const action = variables.role === "admin" ? "提升為管理員" : "降級為一般用戶";
      toast.success(`已成功${action}`);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "操作失敗，請稍後再試");
    },
  });

  const handleSetRole = (userId: number, role: "admin" | "user") => {
    setRoleMutation.mutate({ userId, role });
  };

  const users = data?.items ?? [];
  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = users.filter((u) => u.role === "user").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            用戶管理
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            管理平台用戶的存取權限，提升同事為管理員以使用後台功能
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">總用戶數</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground">管理員</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-xs text-muted-foreground">一般用戶</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">用戶列表</CardTitle>
          <CardDescription>
            點擊「提升為管理員」可讓同事訪問管理後台；他們需要先登入平台一次才會出現在此列表中。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚無用戶記錄</p>
              <p className="text-sm mt-1">請讓同事先登入平台，他們的帳號將自動出現在此列表</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isAdmin = u.role === "admin";

                return (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isSelf ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:bg-muted/30"
                    }`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {(u.name || u.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {u.name || u.email || `用戶 #${u.id}`}
                          </span>
                          {isSelf && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-primary/40 text-primary">
                              您
                            </Badge>
                          )}
                          <Badge
                            variant={isAdmin ? "default" : "secondary"}
                            className={`text-xs px-1.5 py-0 h-5 ${
                              isAdmin
                                ? "bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20"
                                : ""
                            }`}
                          >
                            {isAdmin ? "管理員" : "一般用戶"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                          {u.email && <span>{u.email}</span>}
                          <span>最後登入：{formatDate(u.lastSignedIn)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 ml-4">
                      {isAdmin ? (
                        // Demote to user — with confirmation dialog
                        isSelf ? (
                          <Button variant="ghost" size="sm" disabled className="text-muted-foreground text-xs">
                            <ShieldOff className="w-3.5 h-3.5 mr-1" />
                            無法降級自己
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/5 text-xs"
                                disabled={setRoleMutation.isPending}
                              >
                                <ShieldOff className="w-3.5 h-3.5 mr-1" />
                                降級為一般用戶
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確認降級管理員？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  將 <strong>{u.name || u.email || `用戶 #${u.id}`}</strong> 降級為一般用戶後，
                                  他將無法再訪問管理後台。此操作可隨時撤銷。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleSetRole(u.id, "user")}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  確認降級
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )
                      ) : (
                        // Promote to admin
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs"
                              disabled={setRoleMutation.isPending}
                            >
                              <Crown className="w-3.5 h-3.5 mr-1" />
                              提升為管理員
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>確認提升為管理員？</AlertDialogTitle>
                              <AlertDialogDescription>
                                將 <strong>{u.name || u.email || `用戶 #${u.id}`}</strong> 提升為管理員後，
                                他將可以訪問管理後台、上傳文件、管理術語庫及查看所有翻譯任務。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleSetRole(u.id, "admin")}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                              >
                                確認提升
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tip */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>提示：</strong>同事需要先訪問平台並完成登入，他們的帳號才會出現在此列表中。
        登入後，您可以在此頁面將其提升為管理員，讓他們使用後台功能。
      </div>
    </div>
  );
}
