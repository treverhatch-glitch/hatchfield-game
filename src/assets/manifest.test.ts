/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LIVERIES, TEXTURES, allAssetPaths } from "./manifest";

const pub = (p: string) => resolve(process.cwd(), "public", p.replace(/^\//, ""));

describe("asset manifest", () => {
  it("every path exists in public/", () => {
    const missing = allAssetPaths().filter((p) => !existsSync(pub(p)));
    expect(missing).toEqual([]);
  });
  it("textures are power-of-two and small", () => {
    for (const t of Object.values(TEXTURES)) {
      expect(t.size & (t.size - 1)).toBe(0);
      expect(readFileSync(pub(t.albedo)).length).toBeLessThan(64 * 1024);
    }
  });
  it("has 8 liveries with hex colours", () => {
    expect(Object.keys(LIVERIES)).toHaveLength(8);
    for (const l of Object.values(LIVERIES)) expect(l.stripePrimary).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
