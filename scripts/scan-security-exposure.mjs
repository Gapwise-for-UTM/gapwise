import { spawnSync } from "node:child_process";

const selfPath = "scripts/scan-security-exposure.mjs";

const highConfidenceSecretPatterns = [
  "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
  "(sk-proj-|sk-ant-|sk_live_|rk_live_|ghp_|github_pat_|glpat-|xox[baprs]-)[A-Za-z0-9_=-]{12,}",
  "AIza[0-9A-Za-z_-]{35}",
  "postgres(ql)?://[^[:space:]/:]+:[^[:space:]@]+@",
  "SUPABASE_(SERVICE_ROLE|SECRET)_KEY[[:space:]]*=[[:space:]]*eyJ[A-Za-z0-9._-]{40,}",
];
const historySecretPattern = highConfidenceSecretPatterns.map((value) => `(${value})`).join("|");

const forbiddenClientSecretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "PRIVATE_DATA_KEK",
  "GAPWISE_AI_ENCRYPTION_KEY",
  "DATABASE_URL",
  "POSTGRES_URL",
];
const dangerousVitePattern =
  "VITE_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY|DATABASE|DB_URL|PASSWORD|TOKEN)";

function runGit(args, { allowNoMatch = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (allowNoMatch && result.status === 1) return "";
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function removeKnownSyntheticFixtures(output) {
  return output
    .split("\n")
    .filter((line) => line && !line.includes("@example.invalid:"))
    .join("\n");
}

function grepCommit(commit) {
  const output = runGit(
    ["grep", "-nI", "-E", historySecretPattern, commit, "--", ".", `:(exclude)${selfPath}`],
    { allowNoMatch: true },
  );
  return removeKnownSyntheticFixtures(output).trim();
}

function trackedFiles() {
  return runGit(["ls-files", "-z"])
    .split("\0")
    .map((value) => value.trim())
    .filter(Boolean);
}

function fail(title, details) {
  console.error(`\n${title}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exitCode = 1;
}

const files = trackedFiles();

const trackedEnvFiles = files.filter((file) => {
  const basename = file.split("/").at(-1);
  return basename?.startsWith(".env") && basename !== ".env.example";
});
if (trackedEnvFiles.length > 0) {
  fail("Tracked environment files are not allowed.", trackedEnvFiles);
}

const privateKeyFiles = files.filter((file) => /\.(pem|p12|pfx|key)$/i.test(file));
if (privateKeyFiles.length > 0) {
  fail("Private-key/container files are not allowed in the repository.", privateKeyFiles);
}

const dangerousViteMatches = runGit(
  [
    "grep",
    "-nI",
    "-E",
    dangerousVitePattern,
    "HEAD",
    "--",
    ".",
    `:(exclude)${selfPath}`,
    ":(exclude)tests/**",
  ],
  { allowNoMatch: true },
).trim();
if (dangerousViteMatches) {
  fail("Secret-shaped environment names must never use the VITE_ client-exposure prefix.", [
    dangerousViteMatches,
  ]);
}

const browserSourceFiles = files.filter(
  (file) =>
    file.startsWith("src/") &&
    !file.startsWith("src/server/") &&
    !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file),
);
if (browserSourceFiles.length > 0) {
  const clientSecretPattern = forbiddenClientSecretNames.join("|");
  const clientSecretMatches = runGit(
    ["grep", "-nI", "-E", clientSecretPattern, "HEAD", "--", ...browserSourceFiles],
    { allowNoMatch: true },
  ).trim();
  if (clientSecretMatches) {
    fail("Server-only secret names were referenced from browser source.", [clientSecretMatches]);
  }
}

const productionRouteFiles = files.filter(
  (file) => file.startsWith("api/") || file.startsWith("src/routes/"),
);
const suspiciousRouteFiles = productionRouteFiles.filter((file) => {
  const relative = file.startsWith("api/") ? file.slice(4) : file.slice("src/routes/".length);
  return relative
    .split("/")
    .some((segment) => /^(admin|debug|devtools?|internal)(?:[._-]|$)/i.test(segment));
});
if (suspiciousRouteFiles.length > 0) {
  fail(
    "Admin/debug/internal production routes require explicit security review before they can ship.",
    suspiciousRouteFiles,
  );
}

const commits = runGit(["rev-list", "HEAD"])
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const historicalFindings = [];
for (const commit of commits) {
  const match = grepCommit(commit);
  if (match) historicalFindings.push({ commit, match });
}
if (historicalFindings.length > 0) {
  console.error("\nHigh-confidence credential material was found in reachable Git history.");
  for (const finding of historicalFindings) {
    console.error(`\ncommit ${finding.commit}\n${finding.match}`);
  }
  process.exitCode = 1;
}

if (process.exitCode) process.exit(process.exitCode);

console.log(
  `Security exposure scan passed: ${files.length} tracked files and ${commits.length} reachable commit(s) checked.`,
);
