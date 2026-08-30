const REDACTED = "[REDACTED]";

const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu;
const COOKIE_HEADER = /\b(?:set-cookie|cookie)\s*:\s*[^\r\n]+/giu;
const SENSITIVE_ASSIGNMENT =
  /\b(authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|apikey|service[_-]?role(?:[_-]?key)?|password|secret|private[_-]?key|kek)\b(["']?)(\s*[:=]\s*)(["']?)([^\s,"';&}]+)\4/giu;
const SUPABASE_AUTH_STORAGE =
  /(sb-[A-Za-z0-9_-]+-auth-token)(["']?)(\s*[:=]\s*)(["']?)([^\s,"';&}]+)\4/giu;

/**
 * Removes credential-shaped values before diagnostic text reaches hosted logs.
 * This intentionally targets named secret fields and common auth formats rather
 * than redacting arbitrary high-entropy strings, preserving useful stack traces.
 */
export function redactSensitiveLogText(value: string): string {
  return value
    .replace(COOKIE_HEADER, (match) => `${match.slice(0, match.indexOf(":") + 1)} ${REDACTED}`)
    .replace(BEARER_TOKEN, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(
      SENSITIVE_ASSIGNMENT,
      (_match, key: string, keyQuote: string, separator: string, valueQuote: string) => {
        return `${key}${keyQuote}${separator}${valueQuote}${REDACTED}${valueQuote}`;
      },
    )
    .replace(
      SUPABASE_AUTH_STORAGE,
      (_match, key: string, keyQuote: string, separator: string, valueQuote: string) => {
        return `${key}${keyQuote}${separator}${valueQuote}${REDACTED}${valueQuote}`;
      },
    );
}
