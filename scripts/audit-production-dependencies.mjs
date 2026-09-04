import { spawn } from "node:child_process";

const MAX_ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 5_000;

const transientFailurePattern =
  /ConnectionClosed|audit request failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network error|socket hang up/i;

function runAuditAttempt() {
  return new Promise((resolve) => {
    const child = spawn("bun", ["audit", "--prod", "--audit-level=high"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let combinedOutput = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stderr.write(text);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, ATTEMPT_TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        exitCode: 1,
        output: `${combinedOutput}\n${error.message}`,
        timedOut,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code ?? 1,
        output: combinedOutput,
        timedOut,
      });
    });
  });
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  if (attempt > 1) {
    console.error(`Retrying production dependency audit (${attempt}/${MAX_ATTEMPTS})...`);
  }

  const result = await runAuditAttempt();

  if (result.exitCode === 0) {
    process.exit(0);
  }

  const isTransient = result.timedOut || transientFailurePattern.test(result.output);

  if (!isTransient) {
    console.error(
      "Production dependency audit failed with a non-transient result; refusing to retry or mask it.",
    );
    process.exit(result.exitCode);
  }

  if (result.timedOut) {
    console.error(`Production dependency audit timed out after ${ATTEMPT_TIMEOUT_MS / 1000}s.`);
  } else {
    console.error("Production dependency audit hit a transient transport failure.");
  }

  if (attempt === MAX_ATTEMPTS) {
    console.error("Production dependency audit exhausted its bounded retry budget.");
    process.exit(result.exitCode);
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}
