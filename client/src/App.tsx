import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import LearnPortal from "./pages/LearnPortal";
import LearnView from "./pages/LearnView";
// Independent Dashboard (username/password auth)
import DashboardLogin from "./pages/dashboard/DashboardLogin";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DashboardCourses from "./pages/dashboard/DashboardCourses";
import DashboardFeedbacks from "./pages/dashboard/DashboardFeedbacks";
import DashboardGlossary from "./pages/dashboard/DashboardGlossary";
import DashboardCourseImageReview from "./pages/dashboard/DashboardCourseImageReview";

function OAuthFallback() {
  const [, nav] = useLocation();
  useEffect(() => {
    nav("/dashboard/login");
  }, []);
  return null;
}

function RedirectRoute({ to }: { to: string }) {
  const [, nav] = useLocation();
  useEffect(() => {
    nav(to);
  }, [nav, to]);
  return null;
}

function RedirectAdminImageReview() {
  const [, params] = useRoute("/admin/documents/:id/images");
  const [, nav] = useLocation();
  useEffect(() => {
    if (params?.id) nav(`/dashboard/courses/${params.id}/images`);
    else nav("/dashboard/courses");
  }, [nav, params?.id]);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/learn" component={LearnPortal} />
      <Route path="/learn/:id" component={LearnView} />

      {/* Independent Dashboard routes (username/password auth) */}
      <Route path="/dashboard/login" component={DashboardLogin} />
      <Route path="/dashboard" component={DashboardHome} />
      <Route path="/dashboard/courses" component={DashboardCourses} />
      <Route path="/dashboard/courses/:id/images" component={DashboardCourseImageReview} />
      <Route path="/dashboard/feedbacks" component={DashboardFeedbacks} />
      <Route path="/dashboard/glossary" component={DashboardGlossary} />

      {/* Legacy /admin/* redirects to /dashboard/* (components deleted, routes kept for bookmark compat) */}
      <Route path="/admin/documents/:id/images" component={RedirectAdminImageReview} />
      <Route path="/admin/:rest*">
        {(params) => {
          const rest = params?.["rest*"] ?? "";
          if (rest.startsWith("glossary")) return <RedirectRoute to="/dashboard/glossary" />;
          if (rest.startsWith("users")) return <RedirectRoute to="/dashboard" />;
          return <RedirectRoute to="/dashboard/courses" />;
        }}
      </Route>

      {/* Catch OAuth redirect when no external provider configured */}
      <Route path="/app-auth" component={OAuthFallback} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
