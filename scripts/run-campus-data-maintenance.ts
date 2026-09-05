import { spawnSync } from "node:child_process";

const [operation, ...forwardedArgs] = process.argv.slice(2);

function run(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function syncFromCanonical() {
  run(["scripts/sync-campus-data.ts", "--write"]);
}

function publishCanonical() {
  run(["scripts/sync-campus-data.ts", "--publish"]);
}

switch (operation) {
  case "survey-import":
    syncFromCanonical();
    run(["scripts/import-campus-survey.ts", ...forwardedArgs]);
    publishCanonical();
    break;
  case "survey-dry-run":
    syncFromCanonical();
    run(["scripts/import-campus-survey.ts", "--dry-run", ...forwardedArgs]);
    break;
  case "routing-refresh":
    syncFromCanonical();
    run(["scripts/generate-outdoor-routing.ts", ...forwardedArgs]);
    publishCanonical();
    break;
  case "routing-audit":
    syncFromCanonical();
    run(["scripts/audit-campus-routing.ts", ...forwardedArgs]);
    publishCanonical();
    break;
  default:
    console.error(
      "Usage: bun scripts/run-campus-data-maintenance.ts " +
        "<survey-import|survey-dry-run|routing-refresh|routing-audit> [...args]",
    );
    process.exit(2);
}
