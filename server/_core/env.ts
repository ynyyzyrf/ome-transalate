import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // LLM Provider (default)
  LLM_PROVIDER: z.enum(["openai", "anthropic", "deepseek"]).default("openai"),
  LLM_MODEL: z.string().default("gpt-4o"),

  // Per-task LLM routing (optional overrides for each task type)
  LLM_TRANSLATE_PROVIDER: z.enum(["openai", "anthropic", "deepseek"]).optional(),
  LLM_TRANSLATE_MODEL: z.string().optional(),
  LLM_EXPLAIN_PROVIDER: z.enum(["openai", "anthropic", "deepseek"]).optional(),
  LLM_EXPLAIN_MODEL: z.string().optional(),

  // API Keys (conditional by provider)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // Dashboard admin auth (optional — independent secret for the dashboard session cookie.
  // Strongly recommended so a leaked learner JWT secret cannot forge a dashboard session.)
  DASHBOARD_JWT_SECRET: z.string().min(32).optional(),
  // Dashboard setup key (optional — when unset, the /dashboard setup endpoint is disabled)
  DASHBOARD_SETUP_KEY: z.string().optional(),

  // OIDC SSO (optional — for internal SSO login)
  OIDC_ISSUER_URL: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_JWKS_URL: z.string().optional(),

  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().optional(),
  UPLOADS_DIR: z.string().optional(),

  // AWS/S3 (optional, for file storage)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Legacy Manus/Forge (optional)
  BUILT_IN_FORGE_API_URL: z.string().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  // Legacy OAuth (optional)
  OAUTH_SERVER_URL: z.string().optional(),
  VITE_APP_ID: z.string().optional(),
  OWNER_OPEN_ID: z.string().optional(),

  // MinerU Agent API (optional, used for non-DOCX file parsing fallback)
  MINERU_BASE_URL: z.string().optional(),
  MINERU_TIMEOUT_SECONDS: z.coerce.number().int().positive().optional(),
  MINERU_API_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  // Backward compatibility aliases
  appId: string | undefined;
  cookieSecret: string;
  databaseUrl: string;
  oAuthServerUrl: string | undefined;
  ownerOpenId: string | undefined;
  forgeApiUrl: string | undefined;
  forgeApiKey: string | undefined;
};

function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isTestEnv = nodeEnv === "test";

  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL ?? (isTestEnv ? "mysql://test:test@127.0.0.1:3306/test" : undefined),
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_TRANSLATE_PROVIDER: process.env.LLM_TRANSLATE_PROVIDER,
    LLM_TRANSLATE_MODEL: process.env.LLM_TRANSLATE_MODEL,
    LLM_EXPLAIN_PROVIDER: process.env.LLM_EXPLAIN_PROVIDER,
    LLM_EXPLAIN_MODEL: process.env.LLM_EXPLAIN_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    JWT_SECRET: process.env.JWT_SECRET ?? (isTestEnv ? "test-jwt-secret-please-change-in-real-env-123456" : undefined),
    DASHBOARD_JWT_SECRET: process.env.DASHBOARD_JWT_SECRET,
    DASHBOARD_SETUP_KEY: process.env.DASHBOARD_SETUP_KEY,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_JWKS_URL: process.env.OIDC_JWKS_URL,
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT,
    FRONTEND_URL: process.env.FRONTEND_URL,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    BUILT_IN_FORGE_API_URL: process.env.BUILT_IN_FORGE_API_URL,
    BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
    OAUTH_SERVER_URL: process.env.OAUTH_SERVER_URL,
    VITE_APP_ID: process.env.VITE_APP_ID,
    OWNER_OPEN_ID: process.env.OWNER_OPEN_ID,
    MINERU_BASE_URL: process.env.MINERU_BASE_URL,
    MINERU_TIMEOUT_SECONDS: process.env.MINERU_TIMEOUT_SECONDS,
    MINERU_API_KEY: process.env.MINERU_API_KEY,
  });

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const message = "[Config] Invalid environment variables:\n" + missing;
    if (isTestEnv) {
      throw new Error(message);
    }
    console.error(message);
    process.exit(1);
  }

  const env = result.data;
  const parsedNodeEnv = env.NODE_ENV;

  return {
    ...env,
    isProduction: parsedNodeEnv === "production",
    isDevelopment: parsedNodeEnv === "development",
    isTest: parsedNodeEnv === "test",
    // Backward compatibility aliases
    appId: env.VITE_APP_ID,
    cookieSecret: env.JWT_SECRET,
    databaseUrl: env.DATABASE_URL,
    oAuthServerUrl: env.OAUTH_SERVER_URL,
    ownerOpenId: env.OWNER_OPEN_ID,
    forgeApiUrl: env.BUILT_IN_FORGE_API_URL,
    forgeApiKey: env.BUILT_IN_FORGE_API_KEY,
  };
}

export const ENV = loadEnv();
