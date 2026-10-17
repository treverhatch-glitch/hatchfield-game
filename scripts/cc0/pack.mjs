// Hatchfield CC0 asset packer.
//   node pack.mjs <source-root> <out-dir> [only-name ...]
// Reads assets.json (next to this file). Per asset: drop unused clips, flatten + join per
// material (static models), weld/dedup/prune, strip physical-only extensions (the game renders
// MeshStandard), glass -> blended tint, textures -> WebP via tex.py (native resolution unless a
// smaller size is visually identical), meshopt reorder + 16-bit quantise + EXT_meshopt_compression.
// No simplification: full source detail is kept.
// Needs @gltf-transform/{core,extensions,functions} and meshoptimizer resolvable from this folder
// (e.g. symlink scripts/cc0/node_modules to a scratch install of those packages), plus python3 with Pillow+numpy.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP, KHRMaterialsTransmission, KHRMaterialsClearcoat, KHRMaterialsIOR, KHRMaterialsSpecular, KHRMaterialsSheen, KHRMaterialsVolume } from '@gltf-transform/extensions'
import { flatten, join, weld, dedup, prune, reorder, quantize } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [srcRoot, outDir, ...only] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'assets.json'), 'utf8'))
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

for (const a of manifest.assets) {
  if (only.length && !only.includes(a.out)) continue
  const opts = a.opts ?? {}
  const doc = await io.read(path.join(srcRoot, a.src))
  const root = doc.getRoot()
  for (const E of [KHRMaterialsTransmission, KHRMaterialsClearcoat, KHRMaterialsIOR, KHRMaterialsSpecular, KHRMaterialsSheen, KHRMaterialsVolume]) doc.createExtension(E).dispose()
  for (const m of root.listMaterials()) {
    if (/glass|glazing/i.test(m.getName())) {
      m.setAlphaMode('BLEND').setBaseColorTexture(null)
      m.setBaseColorFactor(opts.glass ?? [0.16, 0.2, 0.24, 0.5]).setRoughnessFactor(0.06).setMetallicFactor(0.1)
    }
  }
  if (opts.keepAnims) {
    const re = new RegExp(opts.keepAnims, 'i')
    for (const an of root.listAnimations()) if (!re.test(an.getName())) an.dispose()
  }
  const skinned = root.listSkins().length > 0
  if (!skinned) await doc.transform(flatten(), join({ keepNamed: false }))
  await doc.transform(weld(), dedup(), prune())
  doc.createExtension(EXTTextureWebP).setRequired(true)
  let ti = 0
  for (const t of root.listTextures()) {
    const mats = root.listMaterials()
    const kind = mats.some((m) => m.getNormalTexture() === t) ? 'normal' : mats.some((m) => m.getBaseColorTexture() === t || m.getEmissiveTexture() === t) ? 'color' : 'data'
    const tin = `/tmp/cc0pack_${process.pid}_${ti}`
    const tout = `${tin}.webp`
    ti++
    fs.writeFileSync(tin, t.getImage())
    const sz = execFileSync('python3', [path.join(here, 'tex.py'), tin, tout, kind]).toString().trim()
    t.setImage(fs.readFileSync(tout)).setMimeType('image/webp')
    const u = t.getURI()
    if (u) t.setURI(u.replace(/\.(png|jpe?g)$/i, '.webp'))
    if (process.env.VERBOSE) console.log('  tex', t.getName(), kind, (t.getSize() ?? []).join('x'), '->', sz)
    fs.rmSync(tin)
    fs.rmSync(tout)
  }
  await doc.transform(reorder({ encoder: MeshoptEncoder }), ...(skinned ? [] : [quantize({ quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14, quantizeColor: 10 })]))
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })
  const dst = path.join(outDir, a.out)
  await io.write(dst, doc)
  let tris = 0
  for (const me of root.listMeshes()) for (const p of me.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  console.log(JSON.stringify({ out: a.out, kb: Math.round(fs.statSync(dst).size / 1024), tris: Math.round(tris), mats: root.listMaterials().length, anims: root.listAnimations().map((x) => x.getName()).join(',') }))
}
