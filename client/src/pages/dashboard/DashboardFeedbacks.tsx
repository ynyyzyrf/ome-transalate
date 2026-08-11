/**
 * DashboardFeedbacks — 後台反饋處理頁面
 * 以教程為分組清單，展開查看每條反饋詳情，支持狀態跟進、篩選搜尋
 */
import { useState, useMemo } from "react";
import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Search,
  User,
  Calendar,
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useT, useI18n } from "@/i18n";

const STATUS_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-600 border-gray-200",
  1: "bg-blue-100 text-blue-700 border-blue-200",
  2: "bg-green-100 text-green-700 border-green-200",
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface FeedbackItem {
  id: number;
  tutorialId: number | null;
  tutorialTitle?: string | null;
  userId: number | null;
  userName: string | null;
  originalText: string | null;
  translatedText: string | null;
  feedbackContent: string;
  status: number;
  adminNote: string | null;
  createdAt: Date | string;
  targetLanguage?: string | null;
}

interface TutorialGroup {
  tutorialId: number;
  tutorialTitle: string;
  feedbacks: FeedbackItem[];
}

export default function DashboardFeedbacks() {
  const t = useT();
  const { locale } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedTutorials, setExpandedTutorials] = useState<Set<number>>(new Set());
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Translated at render time so a UI-language switch reflects immediately.
  const STATUS_LABELS: Record<number, string> = {
    0: t("dashboard.fbPending"),
    1: t("dashboard.fbProcessing"),
    2: t("dashboard.fbResolved"),
  };
  const NEXT_STATUS: Record<number, { label: string; value: number } | null> = {
    0: { label: t("dashboard.fbMarkProcessing"), value: 1 },
    1: { label: t("dashboard.fbMarkResolved"), value: 2 },
    2: null,
  };

  // Fetch all feedbacks (large page size to group client-side)
  const { data, refetch, isLoading } = trpc.feedbacks.adminList.useQuery({
    page: 1,
    pageSize: 100,
    status: statusFilter !== "all" ? parseInt(statusFilter) : undefined,
  });

  // Fetch courses for display names
  const { data: coursesData } = trpc.feedbacks.listCourses.useQuery();
  const courseMap = useMemo(() => {
    const map: Record<number, string> = {};
    (coursesData ?? []).forEach((c: { id: number; title: string | null }) => {
      map[c.id] = c.title ?? t("dashboard.fbTutorialFallback", { id: c.id });
    });
    return map;
  }, [coursesData, t]);

  const updateStatusMutation = trpc.feedbacks.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.fbStatusUpdated"));
      setUpdatingId(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setUpdatingId(null);
    },
  });

  // Group feedbacks by tutorial
  const tutorialGroups = useMemo((): TutorialGroup[] => {
    const items: FeedbackItem[] = (data?.items ?? []) as FeedbackItem[];

    // Sort by date
    const sorted = [...items].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });

    // Filter by search term (tutorial name)
    const filtered = searchTerm
      ? sorted.filter((fb) => {
          const title =
            (fb.tutorialTitle as string | null | undefined) ??
            courseMap[fb.tutorialId ?? 0] ??
            "";
          return title.toLowerCase().includes(searchTerm.toLowerCase());
        })
      : sorted;

    // Group by tutorialId
    const groupMap = new Map<number, TutorialGroup>();
    filtered.forEach((fb) => {
      const tid = fb.tutorialId ?? 0;
      if (!groupMap.has(tid)) {
        groupMap.set(tid, {
          tutorialId: tid,
          tutorialTitle:
            (fb.tutorialTitle as string | null | undefined) ??
            courseMap[tid] ??
            t("dashboard.fbTutorialFallback", { id: tid }),
          feedbacks: [],
        });
      }
      groupMap.get(tid)!.feedbacks.push(fb);
    });

    return Array.from(groupMap.values());
  }, [data, courseMap, searchTerm, sortOrder, t]);

  const totalFeedbacks = data?.total ?? 0;

  const toggleTutorial = (tutorialId: number) => {
    setExpandedTutorials((prev) => {
      const next = new Set(prev);
      if (next.has(tutorialId)) {
        next.delete(tutorialId);
      } else {
        next.add(tutorialId);
      }
      return next;
    });
  };

  const handleUpdateStatus = (id: number, newStatus: number) => {
    setUpdatingId(id);
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const formatFeedbackDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString(locale === "en" ? "en-US" : "zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardAdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.fbTitle")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("dashboard.fbSummary", {
                groups: tutorialGroups.length,
                total: totalFeedbacks,
              })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t("dashboard.fbRefresh")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search by tutorial name */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("dashboard.fbSearch")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder={t("dashboard.fbStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.fbAllStatus")}</SelectItem>
              <SelectItem value="0">{t("dashboard.fbPending")}</SelectItem>
              <SelectItem value="1">{t("dashboard.fbProcessing")}</SelectItem>
              <SelectItem value="2">{t("dashboard.fbResolved")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Date sort */}
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "desc" | "asc")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{t("dashboard.fbSortNewest")}</SelectItem>
              <SelectItem value="asc">{t("dashboard.fbSortOldest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tutorial Groups */}
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {t("common.loading")}
          </div>
        ) : tutorialGroups.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-base">{t("dashboard.fbEmpty")}</p>
            <p className="text-sm mt-1">{t("dashboard.fbEmptyDesc")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tutorialGroups.map((group) => {
              const isExpanded = expandedTutorials.has(group.tutorialId);
              const pendingCount = group.feedbacks.filter((f) => f.status === 0).length;
              const processingCount = group.feedbacks.filter((f) => f.status === 1).length;
              const doneCount = group.feedbacks.filter((f) => f.status === 2).length;

              return (
                <Card key={group.tutorialId} className="overflow-hidden">
                  {/* Tutorial Header Row — click to expand */}
                  <CardHeader
                    className="py-4 px-5 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                    onClick={() => toggleTutorial(group.tutorialId)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-muted-foreground shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {group.tutorialTitle}
                        </span>
                        {/* Link to tutorial */}
                        <a
                          href={`/learn/${group.tutorialId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title={t("dashboard.fbViewTutorial")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {/* Status counts */}
                      <div className="flex items-center gap-2 shrink-0">
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2.5 py-0.5">
                            {t("dashboard.fbPending")} {pendingCount}
                          </span>
                        )}
                        {processingCount > 0 && (
                          <span className="inline-flex items-center text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                            {t("dashboard.fbProcessing")} {processingCount}
                          </span>
                        )}
                        {doneCount > 0 && (
                          <span className="inline-flex items-center text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                            {t("dashboard.fbResolved")} {doneCount}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                          <MessageSquare className="w-3 h-3" />
                          {t("dashboard.fbCount", { count: group.feedbacks.length })}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expanded Feedback List */}
                  {isExpanded && (
                    <CardContent className="p-0 border-t border-border">
                      <div className="divide-y divide-border/60">
                        {group.feedbacks.map((fb) => {
                          const nextStatus = NEXT_STATUS[fb.status];
                          const isUpdating = updatingId === fb.id;

                          return (
                            <div
                              key={fb.id}
                              className="p-5 hover:bg-muted/10 transition-colors"
                            >
                              {/* Row 1: Meta info + status badge */}
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-muted rounded px-2 py-0.5">
                                    {t("dashboard.fbFeedbackId", { id: fb.id })}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    {fb.userName ??
                                      t("dashboard.fbUserName", {
                                        id: fb.userId ?? t("dashboard.fbAnonymous"),
                                      })}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatFeedbackDate(fb.createdAt)}
                                  </span>
                                  {fb.targetLanguage && (
                                    <span className="text-xs uppercase bg-muted px-2 py-0.5 rounded">
                                      {fb.targetLanguage}
                                    </span>
                                  )}
                                </div>
                                {/* Status badge */}
                                <span
                                  className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${STATUS_COLORS[fb.status]}`}
                                >
                                  {STATUS_LABELS[fb.status]}
                                </span>
                              </div>

                              {/* Row 2: Original & Translated content */}
                              {(fb.originalText || fb.translatedText) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                  {fb.originalText && (
                                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                      <p className="text-xs font-medium text-amber-700 mb-1.5">
                                        📄 {t("dashboard.fbOriginalTitle")}
                                      </p>
                                      <p className="text-sm text-amber-900 leading-relaxed">
                                        {fb.originalText}
                                      </p>
                                    </div>
                                  )}
                                  {fb.translatedText && (
                                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                                      <p className="text-xs font-medium text-blue-700 mb-1.5">
                                        🌐 {t("dashboard.fbTranslatedTitle")}
                                      </p>
                                      <p className="text-sm text-blue-900 leading-relaxed">
                                        {fb.translatedText}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Row 3: Feedback content */}
                              <div className="rounded-lg bg-muted/40 border border-border p-3 mb-4">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                  💬 {t("dashboard.fbContentTitle")}
                                </p>
                                <p className="text-sm text-foreground leading-relaxed">
                                  {fb.feedbackContent}
                                </p>
                              </div>

                              {/* Row 4: Admin note (if any) */}
                              {fb.adminNote && (
                                <div className="rounded-lg bg-green-50 border border-green-200 p-3 mb-4">
                                  <p className="text-xs font-medium text-green-700 mb-1">
                                    ✅ {t("dashboard.fbAdminNote")}
                                  </p>
                                  <p className="text-sm text-green-900">{fb.adminNote}</p>
                                </div>
                              )}

                              {/* Row 5: Action button */}
                              <div className="flex items-center justify-end gap-2">
                                {nextStatus ? (
                                  <Button
                                    size="sm"
                                    variant={fb.status === 0 ? "outline" : "default"}
                                    className="gap-1.5 h-8 text-xs"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateStatus(fb.id, nextStatus.value)}
                                  >
                                    {isUpdating && (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    )}
                                    {nextStatus.label}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">
                                    {t("dashboard.fbDone")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardAdminLayout>
  );
}
