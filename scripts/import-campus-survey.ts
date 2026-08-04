import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { convertSurveyToRoutingData, SurveyValidationError } from "../src/data/utm/survey-format";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultInput = resolve(repositoryRoot, "survey/2026-08-04-template.json");
const defaultOutput = resolve(repositoryRoot, "src/data/utm/generated/survey-routing.json");

type Options = { input: string; output: string; dryRun: boolean };

function usage(): string {
  return [
    "Usage: bun run survey:import -- <survey.json> [--output <path>] [--dry-run]",
    "",
    "Defaults:",
    `  input:  ${defaultInput}`,
    `  output: ${defaultOutput}`,
  ].join("\n");
}

function parseArguments(args: string[]): Options {
  let input = defaultInput;
  let output = defaultOutput;
  let dryRun = false;
  let inputSeen = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--output") {
      const next = args[index + 1];
      if (!next) throw new Error("--output requires a path.\n\n" + usage());
      output = resolve(repositoryRoot, next);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}\n\n${usage()}`);
    } else if (!inputSeen) {
      input = resolve(repositoryRoot, argument);
      inputSeen = true;
    } else {
      throw new Error(`Unexpected argument: ${argument}\n\n${usage()}`);
    }
  }
  return { input, output, dryRun };
}

async function run(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  let input: unknown;
  try {
    input = JSON.parse(await readFile(options.input, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read survey JSON at ${options.input}: ${detail}`);
  }

  const routingData = convertSurveyToRoutingData(input);
  const serialized = `${JSON.stringify(routingData, null, 2)}\n`;
  const summary = `${routingData.nodes.length} nodes and ${routingData.edges.length} edges`;
  if (options.dryRun) {
    process.stdout.write(`Dry run passed: ${summary}. No files were written.\n`);
    process.stdout.write(`Production target: ${options.output}\n`);
    return;
  }
  if (routingData.nodes.length === 0 || routingData.edges.length === 0) {
    throw new Error(
      "Refusing to replace production routing data with an empty survey. Add at least one connected node and edge, then run the dry-run again.",
    );
  }

  await mkdir(dirname(options.output), { recursive: true });
  const temporaryOutput = `${options.output}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryOutput, serialized, { encoding: "utf8", flag: "wx" });
    await rename(temporaryOutput, options.output);
  } catch (error) {
    await unlink(temporaryOutput).catch(() => undefined);
    throw error;
  }
  process.stdout.write(`Imported ${summary} into ${options.output}.\n`);
}

run().catch((error: unknown) => {
  if (error instanceof SurveyValidationError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
});
