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
});

describe("account deletion and RLS security", () => {
  test("derives deletion identity from the verified bearer token", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).toContain("deleteUser(data.user.id)");
    expect(source).not.toMatch(/body.*user_?id/i);
    expect(source).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });

  test("allows the active production origin without reflecting rejected origins", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain('"https://gapwise-utm.vercel.app"');
    expect(source).toContain("const originAllowed = !origin || configuredOrigins.has(origin)");
    expect(source).toContain("if (!originAllowed)");
    expect(source).not.toContain("defaultOrigins[0]");
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
      "supabase/migrations/20260804040016_remove_schedule_source_filename.sql",
      "utf8",
    );
    const syncService = await readFile("src/features/sync/sync-service.ts", "utf8");
    const databaseTypes = await readFile("src/lib/database.types.ts", "utf8");
    expect(migration).toMatch(/drop column if exists source_filename/i);
    expect(migration).not.toMatch(/policy|row level security/i);
    expect(syncService).not.toContain("source_filename");
    expect(databaseTypes).not.toContain("source_filename");
  });
});
