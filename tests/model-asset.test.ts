import { describe, expect, test } from "bun:test";

type GlbJson = {
  nodes?: Array<{ name?: string }>;
};

async function modelJson(): Promise<GlbJson> {
  const buffer = await Bun.file("public/models/utm-entrance-monument.glb").arrayBuffer();
  const view = new DataView(buffer);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  const jsonLength = view.getUint32(12, true);
  const bytes = new Uint8Array(buffer, 20, jsonLength);
  return JSON.parse(new TextDecoder().decode(bytes).replace(/\0|\s+$/g, "")) as GlbJson;
}

describe("UTM monument asset", () => {
  test("contains one plaque label layer", async () => {
    const names = (await modelJson()).nodes?.map((node) => node.name ?? "") ?? [];

    expect(names.filter((name) => name === "plaque_label")).toHaveLength(1);
    expect(names).not.toContain("UTM Plaque Lettering Front");
  });
});
