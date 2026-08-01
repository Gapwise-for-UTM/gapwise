import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("account deletion and RLS security", () => {
  test("derives deletion identity from the verified bearer token", async () => {
    const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");
    expect(source).toContain("admin.auth.getUser(token)");
    expect(source).toContain("deleteUser(data.user.id)");
    expect(source).not.toMatch(/body.*user_?id/i);
    expect(source).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });
  test("all user tables use RLS, ownership checks, and cascading deletion", async () => {
    const sql = await readFile("supabase/migrations/20260801000000_user_sync.sql", "utf8");
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
});
