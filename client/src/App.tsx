import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminLayout from "./components/AdminLayout";
import Home from "./pages/Home";
import LearnPortal from "./pages/LearnPortal";
import LearnView from "./pages/LearnView";
import DocumentUpload from "./pages/admin/DocumentUpload";
import DocumentList from "./pages/admin/DocumentList";
import TranslationJobs from "./pages/admin/TranslationJobs";
import GlossaryManager from "./pages/admin/GlossaryManager";
import UserManager from "./pages/admin/UserManager";
// Independent Dashboard (username/password auth)
import DashboardLogin from "./pages/dashboard/DashboardLogin";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DashboardCourses from "./pages/dashboard/DashboardCourses";
import DashboardFeedbacks from "./pages/dashboard/DashboardFeedbacks";
import DashboardGlossary from "./pages/dashboard/DashboardGlossary";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function OAuthFallback() {
  const [, nav] = useLocation();
  useEffect(() => {
    nav("/dashboard/login");
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/learn" component={LearnPortal} />
      <Route path="/learn/:id" component={LearnView} />

      {/* Original OAuth admin routes */}
      <Route path="/admin/documents">
        {() => <AdminRoute component={DocumentList} />}
      </Route>
      <Route path="/admin/upload">
        {() => <AdminRoute component={DocumentUpload} />}
      </Route>
      <Route path="/admin/jobs">
        {() => <AdminRoute component={TranslationJobs} />}
      </Route>
      <Route path="/admin/glossary">
        {() => <AdminRoute component={GlossaryManager} />}
      </Route>
      <Route path="/admin/users">
        {() => <AdminRoute component={UserManager} />}
      </Route>

      {/* Independent Dashboard routes (username/password auth) */}
      <Route path="/dashboard/login" component={DashboardLogin} />
      <Route path="/dashboard" component={DashboardHome} />
      <Route path="/dashboard/courses" component={DashboardCourses} />
      <Route path="/dashboard/feedbacks" component={DashboardFeedbacks} />
      <Route path="/dashboard/glossary" component={DashboardGlossary} />

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
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
