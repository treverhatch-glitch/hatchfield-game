import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PBR_V2, TAILS_V2, allV2Paths, pngOf } from "./manifestV2";

const pub = (p: string) => resolve(process.cwd(), "public", p.replace(/^\//, ""));
const packPresent = existsSync(pub("/assets/v2/textures"));

describe("asset pack v2 manifest", () => {
  it("has 7 PBR sets with 4 maps at 1024 and 512", () => {
    expect(Object.keys(PBR_V2)).toHaveLength(7);
    for (const s of Object.values(PBR_V2)) for (const m of Object.values(s.maps)) expect(Object.keys(m).sort()).toEqual(["1024", "512"]);
  });
  it("has 8 tails", () => expect(Object.keys(TAILS_V2)).toHaveLength(8));
  it.skipIf(!packPresent)("every v2 path (webp + png) exists once the pack is unzipped", () => {
    const missing = allV2Paths().flatMap((p) => [p, pngOf(p)]).filter((p) => !existsSync(pub(p)));
    expect(missing).toEqual([]);
  });
});
