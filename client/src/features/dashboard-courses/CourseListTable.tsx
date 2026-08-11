import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  BookOpen,
  Pencil,
  Trash2,
  MessageSquare,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import type { Course } from "./types";
import { useT, useI18n } from "@/i18n";

interface CourseListTableProps {
  items: Course[];
  isLoading: boolean;
  onEdit: (course: Course) => void;
  onDelete: (id: number) => void;
  retryPending: boolean;
  onRetry: (id: number) => void;
}

export function CourseListTable({
  items,
  isLoading,
  onEdit,
  onDelete,
  retryPending,
  onRetry,
}: CourseListTableProps) {
  const t = useT();
  const { locale } = useI18n();
  const [search, setSearch] = useState("");

  const filtered = search
    ? items.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <>
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("dashboard.courseSearch")}
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
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{t("dashboard.noCourses")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colName")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colInstructor")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colCategory")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colStatus")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colTransStatus")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colUploaded")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colUpdated")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colFeedbackCount")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("dashboard.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((course) => (
                    <tr
                      key={course.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                        {course.id}
                      </td>
                      <td className="py-3 px-4 font-medium max-w-[200px]">
                        <span className="truncate block" title={course.title ?? ""}>
                          {course.title ?? t("dashboard.unnamed")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {course.instructor ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {course.category ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={course.isPublished === "yes" ? "default" : "secondary"}>
                          {course.isPublished === "yes"
                            ? t("dashboard.published")
                            : t("dashboard.unpublished")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {course.status === "completed" ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {t("dashboard.transCompleted")}
                          </Badge>
                        ) : course.status === "processing" ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-800"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            {t("dashboard.transProcessing")}
                          </Badge>
                        ) : course.status === "pending" ? (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {t("dashboard.transPending")}
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {t("dashboard.transFailed")}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => onRetry(course.id)}
                              disabled={retryPending}
                            >
                              <RotateCw
                                className={cn("w-3 h-3", retryPending && "animate-spin")}
                              />
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(course.createdAt, locale)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(course.updatedAt, locale)}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/dashboard/feedbacks?tutorialId=${course.id}`}>
                          <a className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {course.feedbackCount ?? 0}
                          </a>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/courses/${course.id}/images`}>
                            <a
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title={t("dashboard.imageReview")}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </a>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => onEdit(course)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => onDelete(course.id)}
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
    </>
  );
}
