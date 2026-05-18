import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { documentsRouter } from "./routers/documents";
import { glossaryRouter } from "./routers/glossary";
import { aiRouter, translationJobsRouter, userRouter, usersAdminRouter } from "./routers/ai";
import { feedbacksRouter } from "./routers/feedbacks";
import { dashboardRouter } from "./routers/dashboard";
import { coursesRouter } from "./routers/courses";
import { dashboardFeedbacksRouter } from "./routers/dashboardFeedbacks";
import { authLocalRouter } from "./routers/authLocal";
import { authOidcRouter } from "./routers/authOidc";
import { progressRouter } from "./routers/progress";
import { exercisesRouter } from "./routers/exercises";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  documents: documentsRouter,
  glossary: glossaryRouter,
  ai: aiRouter,
  translationJobs: translationJobsRouter,
  user: userRouter,
  usersAdmin: usersAdminRouter,
  // New modules
  feedbacks: feedbacksRouter,
  dashboard: dashboardRouter,
  courses: coursesRouter,
  dashboardFeedbacks: dashboardFeedbacksRouter,
  // Local email+password authentication
  authLocal: authLocalRouter,
  // OIDC SSO login (placeholder — see authOidc.ts for implementation guide)
  authOidc: authOidcRouter,
  // Learning progress tracking
  progress: progressRouter,
  // Exercises / quizzes
  exercises: exercisesRouter,
});

export type AppRouter = typeof appRouter;
