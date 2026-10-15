/// <reference types="node" />
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PBR_V2, PICTOGRAMS_V2, SIGNS_V2, TAILS_V2, allV2Paths, pngOf } from "./manifestV2";

const pub = (p: string) => resolve(process.cwd(), "public", p.replace(/^\//, ""));
const packPresent = existsSync(pub("/assets/v2/textures"));

describe("asset pack v2 manifest", () => {
  it("has 7 PBR sets with 4 maps at 1024 and 512", () => {
    expect(Object.keys(PBR_V2)).toHaveLength(7);
    for (const s of Object.values(PBR_V2)) for (const m of Object.values(s.maps)) expect(Object.keys(m).sort()).toEqual(["1024", "512"]);
  });
  it("has 8 tails", () => expect(Object.keys(TAILS_V2)).toHaveLength(8));
  it("ships every Batch 11 sign the manifest points at", () => {
    const paths = [...new Set([...Object.values(SIGNS_V2), ...Object.values(PICTOGRAMS_V2)])];
    expect(paths.length).toBeGreaterThan(0);
    const missing = paths.filter((p) => !existsSync(pub(p)));
    expect(missing).toEqual([]);
    expect(SIGNS_V2.lost_bag_yellow_black).toBe(SIGNS_V2.baggage_reclaim_yellow_black);
    expect(PICTOGRAMS_V2.lost_bag).toBe(PICTOGRAMS_V2.baggage_reclaim);
    expect(SIGNS_V2.food_yellow_black).toBe(SIGNS_V2.shops_yellow_black);
  });
  it.skipIf(!packPresent)("every v2 webp exists once the pack is unzipped", () => {
    const missing = allV2Paths().filter((p) => !existsSync(pub(p)));
    expect(missing).toEqual([]);
  });
  it.skipIf(!packPresent)("png twins are complete when any of them were committed", () => {
    const pngs = allV2Paths().map((p) => pngOf(p));
    const present = pngs.filter((p) => existsSync(pub(p)));
    if (present.length === 0) return;
    expect(present).toEqual(pngs);
  });
});
