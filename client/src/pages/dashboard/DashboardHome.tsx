import DashboardAdminLayout from "@/components/DashboardAdminLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, MessageSquare, BookMarked, Clock } from "lucide-react";
import { Link } from "wouter";
import { useT } from "@/i18n";

export default function DashboardHome() {
  const t = useT();
  const coursesQuery = trpc.courses.list.useQuery({ page: 1, pageSize: 1 });
  const feedbacksQuery = trpc.feedbacks.adminList.useQuery({ page: 1, pageSize: 1 });
  const pendingFeedbacksQuery = trpc.feedbacks.adminList.useQuery({ page: 1, pageSize: 1, status: 0 });
  const glossaryQuery = trpc.glossary.list.useQuery({});

  const stats = [
    {
      label: t("dashboard.statCourses"),
      value: coursesQuery.data?.total ?? 0,
      icon: BookOpen,
      href: "/dashboard/courses",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: t("dashboard.statFeedbacks"),
      value: feedbacksQuery.data?.total ?? 0,
      icon: MessageSquare,
      href: "/dashboard/feedbacks",
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
      label: t("dashboard.statPending"),
      value: pendingFeedbacksQuery.data?.total ?? 0,
      icon: Clock,
      href: "/dashboard/feedbacks?status=0",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: t("dashboard.statGlossary"),
      value: glossaryQuery.data?.length ?? 0,
      icon: BookMarked,
      href: "/dashboard/glossary",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <DashboardAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.homeOverview")}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.homeWelcome")}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, href, color, bg }) => (
            <Link key={href} href={href}>
              <a className="block">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-5 pb-4">
                    <div className={`inline-flex p-2.5 rounded-lg ${bg} mb-3`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/dashboard/courses">
              <a className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">{t("dashboard.quickCourses")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.quickCoursesDesc")}</p>
                </div>
              </a>
            </Link>
            <Link href="/dashboard/feedbacks">
              <a className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">{t("dashboard.quickFeedbacks")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.quickFeedbacksDesc")}</p>
                </div>
              </a>
            </Link>
            <Link href="/dashboard/glossary">
              <a className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <BookMarked className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">{t("dashboard.quickGlossary")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.quickGlossaryDesc")}</p>
                </div>
              </a>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardAdminLayout>
  );
}
