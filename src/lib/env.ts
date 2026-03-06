/**
 * Production environment validation.
 * Fails fast at startup if required env vars are missing.
 */

interface EnvRequirement {
  key: string;
  required: boolean;
  requiredInProd: boolean;
  description: string;
}

const ENV_CONTRACT: EnvRequirement[] = [
  { key: "POSTGRES_URL", required: true, requiredInProd: true, description: "PostgreSQL connection string" },
  { key: "AUTH_SECRET", required: true, requiredInProd: true, description: "Auth.js encryption secret" },
  { key: "AUTH_GITHUB_ID", required: true, requiredInProd: true, description: "GitHub OAuth client ID" },
  { key: "AUTH_GITHUB_SECRET", required: true, requiredInProd: true, description: "GitHub OAuth client secret" },
  { key: "CRON_SECRET", required: false, requiredInProd: true, description: "Bearer token for /api/cron" },
];

export function validateEnv(): { valid: boolean; missing: string[] } {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  for (const req of ENV_CONTRACT) {
    const value = process.env[req.key];
    const isRequired = req.required || (isProd && req.requiredInProd);

    if (isRequired && (!value || value.trim() === "")) {
      missing.push(`${req.key} — ${req.description}`);
    }
  }

  if (missing.length > 0 && isProd) {
    console.error(
      `[commute-dashboard] Missing required env vars:\n${missing.map((m) => `  - ${m}`).join("\n")}`
    );
  }

  return { valid: missing.length === 0, missing };
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
