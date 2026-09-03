import { readFile } from "node:fs/promises";
import ts from "typescript";
import { fetchV1 } from "../api/v1";

// OpenAPI and ecosystem manifests are decoded JSON whose shapes are validated below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any> & {
  package?: string;
  registries?: Record<string, Json>;
  version?: string;
  state?: string;
  model?: string;
  runtimeTargets?: string[];
};
type GapwiseClient = {
  info(): Promise<unknown>;
  buildings: { list(): Promise<unknown>; get(building: string): Promise<unknown> };
  places: { list(): Promise<unknown>; get(placeId: string): Promise<unknown> };
  routes: { calculate(input: { from: string; to: string }): Promise<unknown> };
  gaps: {
    plan(input: {
      from: string;
      to: string;
      term: "Fall";
      weekday: "Sunday";
      startTime: number;
      endTime: number;
    }): Promise<unknown>;
  };
};
type GapwiseModule = {
  Gapwise: new (options: { fetch: typeof fetch }) => GapwiseClient;
};

const errors: string[] = [];
const fail = (message: string) => errors.push(message);
const spec = JSON.parse(await readFile("public/openapi.json", "utf8")) as Json;
const ecosystem = JSON.parse(await readFile("gapwise.ecosystem.json", "utf8")) as Json;
const npmPackage = JSON.parse(await readFile("sdk/javascript/package.json", "utf8")) as Json;
const jsrPackage = JSON.parse(await readFile("sdk/javascript/jsr.json", "utf8")) as Json;

const canonicalOperations = Object.entries(spec["paths"] as Record<string, Json>)
  .filter(([path]) => !path.startsWith("/api/"))
  .flatMap(([path, item]) =>
    ["get", "post", "put", "patch", "delete"]
      .filter((method) => item[method])
      .map((method) => `${method.toUpperCase()} ${path}`),
  )
  .sort();

const expectedOperations = [
  "GET /",
  "GET /buildings",
  "GET /buildings/{building}",
  "GET /places",
  "GET /places/{placeId}",
  "POST /gaps/plan",
  "POST /routes",
].sort();

if (JSON.stringify(canonicalOperations) !== JSON.stringify(expectedOperations))
  fail(
    `OpenAPI canonical operations drifted:\n  expected ${expectedOperations.join(", ")}\n  received ${canonicalOperations.join(", ")}`,
  );

const tsSdk = ecosystem["sdks"]?.typescript as Json | undefined;
if (tsSdk?.package !== npmPackage["name"] || tsSdk?.package !== jsrPackage["name"])
  fail(
    `TypeScript SDK package identity drifted: ecosystem=${String(tsSdk?.package)}, npm=${String(npmPackage["name"])}, jsr=${String(jsrPackage["name"])}.`,
  );

for (const [registry, manifest] of [
  ["npm", npmPackage],
  ["jsr", jsrPackage],
] as const) {
  const registryState = tsSdk?.registries?.[registry] as Json | undefined;
  if (registryState?.version !== manifest["version"])
    fail(
      `${registry} version drifted: ecosystem=${String(registryState?.version)}, package=${String(manifest["version"])}.`,
    );
  if (registryState?.state !== "published")
    fail(`${registry} release state must be published after the verified 0.1.0 releases.`);
}

if (tsSdk?.model !== "single-portable-implementation")
  fail("TypeScript SDK distribution model must remain single-portable-implementation.");

const runtimeTargets = tsSdk?.runtimeTargets as string[] | undefined;
for (const target of ["node", "bun", "deno", "browser"])
  if (!runtimeTargets?.includes(target)) fail(`TypeScript SDK manifest is missing ${target}.`);

if (ecosystem["contract"]?.sdkParityRequired !== true)
  fail("Ecosystem manifest must require TypeScript/Python SDK parity.");

const calls: string[] = [];
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  calls.push(`${init?.method ?? "GET"} ${url.pathname.replace("/v1", "") || "/"}`);
  return Response.json({
    data: url.pathname.endsWith("/buildings") || url.pathname.endsWith("/places") ? [] : {},
    meta: {
      apiVersion: "v1",
      dataVersion: "fixture-v1",
      requestId: "contract-fixture",
      ...(url.pathname.endsWith("/buildings") || url.pathname.endsWith("/places")
        ? { pagination: { limit: 50, offset: 0, count: 0, total: 0, nextOffset: null } }
        : {}),
    },
  });
};

// Use a runtime-computed module specifier so the root app's stricter tsconfig does not
// typecheck the independently-built SDK source under a second, incompatible compiler policy.
const sdkModulePath = "../sdk/javascript/src/index";
const { Gapwise } = (await import(sdkModulePath)) as GapwiseModule;
const client = new Gapwise({ fetch: fixtureFetch });
await client.info();
await client.buildings.list();
await client.buildings.get("MN");
await client.places.list();
await client.places.get("utm-library");
await client.routes.calculate({ from: "MN", to: "IB" });
await client.gaps.plan({
  from: "MN",
  to: "IB",
  term: "Fall",
  weekday: "Sunday",
  startTime: 600,
  endTime: 720,
});

const normalizedCalls = calls
  .map((call) =>
    call
      .replace("/buildings/MN", "/buildings/{building}")
      .replace("/places/utm-library", "/places/{placeId}"),
  )
  .sort();

if (JSON.stringify(normalizedCalls) !== JSON.stringify(expectedOperations))
  fail(
    `JavaScript SDK operations drifted:\n  expected ${expectedOperations.join(", ")}\n  received ${normalizedCalls.join(", ")}`,
  );

const runtimeCases = [
  ["root", "GET"],
  ["buildings", "GET"],
  ["building&building=MN", "GET"],
  ["places", "GET"],
  ["place&placeId=utm-library", "GET"],
  ["routes", "POST"],
  ["gap-plan", "POST"],
] as const;

for (const [resource, method] of runtimeCases) {
  const body =
    resource === "routes"
      ? { from: "MN", to: "IB" }
      : resource === "gap-plan"
        ? {
            from: "MN",
            to: "IB",
            term: "Fall",
            weekday: "Saturday",
            startTime: 600,
            endTime: 720,
          }
        : undefined;
  const response = await fetchV1(
    new Request(`https://api.gapwise.ca/api/v1?resource=${resource}`, {
      method,
      ...(body
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    }),
    new Date("2026-08-24T15:00:00Z"),
  );
  const payload = (await response.json()) as Json;
  if (
    !response.ok ||
    !("data" in payload) ||
    payload["meta"]?.apiVersion !== "v1" ||
    !payload["meta"]?.requestId
  )
    fail(
      `HTTP implementation does not satisfy the success envelope for ${method} ${resource}: ${response.status}`,
    );
}

const errorResponse = await fetchV1(
  new Request("https://api.gapwise.ca/api/v1?resource=building&building=NOPE"),
);
const errorPayload = (await errorResponse.json()) as Json;
if (
  errorResponse.status !== 404 ||
  typeof errorPayload["error"]?.code !== "string" ||
  typeof errorPayload["error"]?.message !== "string" ||
  errorPayload["meta"]?.apiVersion !== "v1" ||
  !errorPayload["meta"]?.requestId
)
  fail("HTTP implementation drifted from the OpenAPI error envelope.");

const source = await readFile("sdk/javascript/src/types.ts", "utf8");
const tree = ts.createSourceFile(
  "types.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const aliases = new Map<string, string[]>();
for (const node of tree.statements) {
  if (!ts.isTypeAliasDeclaration(node)) continue;
  const values: string[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isLiteralTypeNode(child) && ts.isStringLiteral(child.literal))
      values.push(child.literal.text);
    else ts.forEachChild(child, visit);
  };
  visit(node.type);
  if (values.length) aliases.set(node.name.text, values);
}

for (const [sdkName, schemaName] of Object.entries({
  Term: "Term",
  Weekday: "Weekday",
  VerificationStatus: "Provenance.verificationStatus",
  BuildingCategory: "Building.category",
  RouteMode: "RoutePreferencesInput.mode",
  PlaceKind: "CampusPlace.kind",
  AvailabilityState: "PlaceAvailability.state",
})) {
  const [name, property] = schemaName.split(".");
  if (!name) {
    fail(`Missing OpenAPI schema name for TypeScript ${sdkName}.`);
    continue;
  }
  const schema = spec["components"].schemas[name];
  const expected = (property ? schema.properties[property].enum : schema.enum) as string[];
  const actual = aliases.get(sdkName) ?? [];
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(
      `TypeScript ${sdkName} enum drifted: expected ${expected.join(" | ")}; received ${actual.join(" | ")}`,
    );
}

const maintainedDocs = [
  "README.md",
  "docs/DEVELOPER_PLATFORM.md",
  "docs/GAPWISE_PLATFORM.md",
  "docs/ECOSYSTEM_INTEGRATION.md",
  "docs/SDK_RELEASE.md",
  "sdk/javascript/README.md",
  "sdk/python/README.md",
];
const docs = await Promise.all(
  maintainedDocs.map(async (path) => [path, await readFile(path, "utf8")] as const),
);
for (const [path, text] of docs) {
  if (/v1-preview|https:\/\/gapwise\.ca\/sdk\/gapwise-utm|public v1-preview/i.test(text))
    fail(`${path} describes the retired preview/browser SDK contract.`);

  if (
    /(?:not published to npm|not yet published[^\n]*npm|neither package is published|names are publication targets and are not published)/i.test(
      text,
    )
  )
    fail(`${path} still describes the verified @gapwise/sdk npm release as unpublished.`);

  if (
    /(?:configured_not_published|JSR[^\n]*(?:reserved|not yet published|not released|pending until)|reserved[^\n]*JSR|After a JSR version is actually released)/i.test(
      text,
    )
  )
    fail(`${path} still describes the verified @gapwise/sdk JSR release as unpublished.`);

  if (
    /(?:not published to PyPI|not yet published[^\n]*PyPI|awaiting (?:its )?first verified PyPI release)/i.test(
      text,
    )
  )
    fail(`${path} still describes the verified gapwise PyPI release as unpublished.`);
}

if (errors.length) {
  console.error(
    `Public contract conformance failed (${errors.length} drift${errors.length === 1 ? "" : "s"}):\n- ${errors.join("\n- ")}`,
  );
  process.exit(1);
}
console.log(
  `Public contract conformance passed: ${canonicalOperations.length} canonical operations, HTTP envelopes, TypeScript enums, SDK fixture calls, published registry metadata, ecosystem manifest, and maintained docs agree.`,
);
