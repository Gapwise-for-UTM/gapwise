import { afterEach, describe, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtures: string[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gapwise-campus-sync-"));
  fixtures.push(root);
  for (const directory of [
    "gapwise/scripts",
    "gapwise/src/data/utm",
    "gapwise/public/data",
    "data/data/utm",
    "data/public/data",
  ]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await copyFile("scripts/sync-campus-data.ts", join(root, "gapwise/scripts/sync-campus-data.ts"));
  const put = (path: string, value: string) => writeFile(join(root, path), value);
  const read = (path: string) => readFile(join(root, path), "utf8");
  await put("data/data/utm/entrances.geojson", "canonical entrance bytes\n");
  await put("data/data/utm/SHA256SUMS", "source-only checksums\n");
  await put("data/public/data/utm-campus-v1.json", '{"buildings":[]}\n');
  await put("gapwise/src/data/utm/entrances.geojson", "old mirror\n");
  await put("gapwise/src/data/utm/obsolete.json", "obsolete\n");
  await put("gapwise/public/data/utm-campus-v1.json", "old snapshot\n");
  const run = async (mode: string) => {
    const process = Bun.spawn([Bun.which("bun")!, "scripts/sync-campus-data.ts", mode], {
      cwd: join(root, "gapwise"),
      stdout: "pipe",
      stderr: "pipe",
    });
    return { code: await process.exited, error: await new Response(process.stderr).text() };
  };
  return { root, put, read, run };
}

describe("canonical campus mirror CLI", () => {
  test("syncs the complete mirror and public snapshot, removes stale files, and is idempotent", async () => {
    const f = await fixture();
    expect((await f.run("--check")).code).toBe(1);
    expect((await f.run("--write")).code).toBe(0);
    expect(await f.read("gapwise/src/data/utm/entrances.geojson")).toBe(
      await f.read("data/data/utm/entrances.geojson"),
    );
    expect(await f.read("gapwise/public/data/utm-campus-v1.json")).toBe(
      await f.read("data/public/data/utm-campus-v1.json"),
    );
    expect(await Bun.file(join(f.root, "gapwise/src/data/utm/obsolete.json")).exists()).toBe(false);
    expect(await Bun.file(join(f.root, "gapwise/src/data/utm/SHA256SUMS")).exists()).toBe(false);
    expect((await f.run("--write")).code).toBe(0);
    expect((await f.run("--check")).code).toBe(0);
    await f.put("gapwise/public/data/utm-campus-v1.json", "snapshot-only drift\n");
    expect((await f.run("--check")).error).toContain("public/data/utm-campus-v1.json");
  });

  test("rejects a missing canonical snapshot before modifying any mirror file", async () => {
    const f = await fixture();
    await rm(join(f.root, "data/public/data/utm-campus-v1.json"));
    expect((await f.run("--write")).code).toBe(2);
    expect(await f.read("gapwise/src/data/utm/entrances.geojson")).toBe("old mirror\n");
    expect(await f.read("gapwise/src/data/utm/obsolete.json")).toBe("obsolete\n");
    expect(await f.read("gapwise/public/data/utm-campus-v1.json")).toBe("old snapshot\n");
  });

  test("rejects publishing a missing snapshot before changing canonical data or checksums", async () => {
    const f = await fixture();
    await rm(join(f.root, "gapwise/public/data/utm-campus-v1.json"));
    expect((await f.run("--publish")).code).toBe(2);
    expect(await f.read("data/data/utm/entrances.geojson")).toBe("canonical entrance bytes\n");
    expect(await f.read("data/data/utm/SHA256SUMS")).toBe("source-only checksums\n");
  });
});
