import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("supply-chain configuration", () => {
  test("GitHub Actions dependencies are pinned to immutable revisions", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    const externalActions = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);

    expect(externalActions.length).toBeGreaterThan(0);
    for (const action of externalActions) {
      expect(action).toMatch(/@[a-f0-9]{40}$/);
    }
  });

  test("does not load fonts from Google", async () => {
    const sources = await Promise.all(
      [
        "index.html",
        "src/routes/__root.tsx",
        "src/styles.css",
        "public/_headers",
        "vercel.json",
      ].map((path) => readFile(path, "utf8")),
    );
    expect(sources.join("\n")).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  test("uses a narrow browser execution and connection policy", async () => {
    const [vercel, fallbackHeaders] = await Promise.all([
      readFile("vercel.json", "utf8"),
      readFile("public/_headers", "utf8"),
    ]);
    for (const source of [vercel, fallbackHeaders]) {
      expect(source).toMatch(/script-src 'self'(?: 'wasm-unsafe-eval')?\s*;/u);
      expect(source).not.toContain("'unsafe-eval'");
      expect(source).toContain("object-src 'none'");
      expect(source).toContain("frame-ancestors 'none'");
      expect(source).toContain("Strict-Transport-Security");
      expect(source).toContain("https://olrtvbblxbgcxbhvujaw.supabase.co");
      expect(source).not.toContain("https://*.supabase.co");
      expect(source).not.toContain("valhalla1.openstreetmap.de");
    }
  });

  test("keeps client error telemetry generic and has no raw HTML sink", async () => {
    const [reporter, root, boundary] = await Promise.all([
      readFile("src/lib/lovable-error-reporting.ts", "utf8"),
      readFile("src/routes/__root.tsx", "utf8"),
      readFile("src/components/AppErrorBoundary.tsx", "utf8"),
    ]);
    expect(reporter).not.toMatch(/captureException\?\.\(\s*error\s*[,)]/u);
    expect(reporter).toContain('new Error("Gapwise client rendering error")');
    expect(root).not.toContain("console.error(error)");
    expect(boundary).not.toContain("console.error(error, info)");
    await expect(readFile("src/components/ui/chart.tsx", "utf8")).rejects.toThrow();
  });
});

describe("account deletion and RLS security", () => {
  test("derives deletion identity from the verified bearer token", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).toContain("deleteUser(data.user.id)");
    expect(source).not.toMatch(/body.*user_?id/i);
    expect(source).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });

  test("allows only exact configured account-deletion origins", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain('"https://gapwise-utm.vercel.app"');
    expect(source).toContain("configuredOrigins.has(origin)");
    expect(source).toContain("const originAllowed = isAllowedOrigin(origin)");
    expect(source).toContain("if (!originAllowed)");
    expect(source).not.toContain("gapwisePreviewOrigin");
    expect(source).not.toContain("https://*.vercel.app");
    expect(source).not.toContain("defaultOrigins[0]");
  });

  test("authoritative encrypted mode clears cross-account and legacy plaintext state", async () => {
    const [route, preferences, remembered] = await Promise.all([
      readFile("src/routes/index.tsx", "utf8"),
      readFile("src/features/sync/preferences.ts", "utf8"),
      readFile("src/hooks/use-preferences.ts", "utf8"),
    ]);
    expect(
      route.match(/restoredSource\.current === "cloud" \|\| isEncryptedPrivateCloudAuthoritative/g),
    ).toHaveLength(2);
    expect(preferences).toContain("storage?.removeItem(LOCAL_PREFERENCES_KEY)");
    expect(remembered).toContain("window.localStorage.removeItem(TIMETABLE_KEY)");
    expect(remembered).toContain("window.localStorage.removeItem(REMEMBER_KEY)");
  });

  test("authoritative encrypted cloud deletion does not require legacy plaintext tables", async () => {
    const syncService = await readFile("src/features/sync/sync-service.ts", "utf8");
    expect(syncService.match(/if \(isEncryptedPrivateCloudAuthoritative\) return;/g)).toHaveLength(2);
  });

  test("all user tables use RLS, ownership checks, and cascading deletion", async () => {
    const sql = await readFile("supabase/migrations/20260801171701_user_sync.sql", "utf8");
    for (const table of ["user_schedules", "user_preferences"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`references auth.users(id) on delete cascade`);
      expect(sql).toContain(`${table}_insert_own`);
      expect(sql).toContain(`${table}_update_own`);
      expect(sql).toContain(`${table}_delete_own`);
      expect(sql).toContain(`revoke all on table public.${table} from anon`);
    }
    expect(sql).not.toContain("using (true)");
  });

  test("authenticated table grants stay least-privileged", async () => {
    const sql = await readFile(
      "supabase/migrations/20260803043410_harden_table_privileges.sql",
      "utf8",
    );
    expect(sql).toContain("revoke all on table public.user_schedules from anon, authenticated");
    expect(sql).toContain("revoke all on table public.user_preferences from anon, authenticated");
    expect(sql).not.toMatch(/grant\s+all/i);
    expect(sql.match(/grant select, insert, update, delete/g)).toHaveLength(2);
  });

  test("removes source filenames without changing RLS policies", async () => {
    const migration = await readFile(
      "supabase/migrations/20260807132654_remove_schedule_source_filename.sql",
      "utf8",
    );
    const syncService = await readFile("src/features/sync/sync-service.ts", "utf8");
    const databaseTypes = await readFile("src/lib/database.types.ts", "utf8");
    expect(migration).toMatch(/drop column if exists source_filename/i);
    expect(migration).not.toMatch(/policy|row level security/i);
    expect(syncService).not.toContain("source_filename");
    expect(databaseTypes).not.toContain("source_filename");
  });

  test("stores residence choice in the existing owner-scoped preferences row", async () => {
    const migration = await readFile(
      "supabase/migrations/20260810200438_add_residence_preferences.sql",
      "utf8",
    );
    expect(migration).toContain("alter table public.user_preferences");
    expect(migration).toContain("add column day_origin");
    expect(migration).toContain("add column residence_building_code");
    expect(migration).toContain("day_origin in ('commute', 'residence')");
    expect(migration).toMatch(/day_origin = 'residence'[\s\S]*residence_building_code is not null/);
    expect(migration).not.toMatch(/create policy|using\s*\(true\)/i);
  });
});
