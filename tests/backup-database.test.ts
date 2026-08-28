import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("database backup helper", () => {
  test("keeps credentials out of output and writes private, verifiable artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "gapwise-backup-test-"));
    temporaryRoots.push(root);
    const fakeBin = join(root, "bin");
    const outputDir = join(root, "backup");
    await mkdir(fakeBin);

    const fakeSupabase = join(fakeBin, "supabase");
    await writeFile(
      fakeSupabase,
      `#!/bin/sh
set -eu
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -f)
      out="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
[ -n "$out" ]
printf '%s\\n' 'fixture logical dump' > "$out"
`,
      "utf8",
    );
    await chmod(fakeSupabase, 0o700);

    const secretUrl = "postgresql://operator:super-secret@example.invalid:5432/postgres";
    const process = Bun.spawn(["bash", "scripts/backup-database.sh", outputDir], {
      env: {
        ...globalThis.process.env,
        PATH: `${fakeBin}:${globalThis.process.env.PATH ?? ""}`,
        SUPABASE_DB_URL: secretUrl,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(`${stdout}\n${stderr}`).not.toContain(secretUrl);

    for (const filename of ["roles.sql", "schema.sql", "data.sql"]) {
      expect(await readFile(join(outputDir, filename), "utf8")).toContain("fixture logical dump");
    }

    const evidence = await readFile(join(outputDir, "EVIDENCE.md"), "utf8");
    expect(evidence).toContain("sha256sum --check SHA256SUMS");
    expect(evidence).toContain("roles.sql");
    expect(evidence).toContain("schema.sql");
    expect(evidence).toContain("data.sql");
    expect(evidence).not.toContain("fixture logical dump");
    expect(evidence).not.toContain(secretUrl);

    const checksumProcess = Bun.spawn(["sha256sum", "--check", "SHA256SUMS"], {
      cwd: outputDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await checksumProcess.exited).toBe(0);

    expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    for (const filename of ["roles.sql", "schema.sql", "data.sql", "SHA256SUMS", "EVIDENCE.md"]) {
      expect((await stat(join(outputDir, filename))).mode & 0o777).toBe(0o600);
    }
  });
});
