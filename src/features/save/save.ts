/**
 * Versioned save/load with a migration chain and a compact shareable layout code.
 * The sim owns the actual state shape; it registers a SaveAdapter.
 * `openSave` migrates older schema versions, then a validator repairs or flags fields.
 */

export const SAVE_FORMAT = 'hatchfield-save'

export interface SaveEnvelope<T = unknown> {
  format: typeof SAVE_FORMAT
  /** Schema version of `data`. Older versions run through the migration chain. */
  version: number
  savedAt: number
  checksum: string
  data: T
}

/** A field the validator rewrote, or a field too damaged to guess. */
export interface SaveIssue {
  path: string
  kind: 'repaired' | 'flagged'
  message: string
}

export interface OpenedSave<T> {
  envelope: SaveEnvelope<T>
  issues: SaveIssue[]
}

/** Runs after migrations. May return a repaired copy and a list of issues. */
export type SaveValidator = (data: unknown) => { data: unknown; issues: SaveIssue[] }

/** Implemented by the sim: snapshot to plain JSON and restore from it. */
export interface SaveAdapter<T> {
  readonly version: number
  snapshot(): T
  restore(data: T): void
}

/** Migration from version `from` to `from + 1`. */
export type Migration = (data: unknown) => unknown

export class SaveError extends Error {}

/** FNV-1a 32-bit hash as 8 hex chars. Deterministic, not cryptographic. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** JSON.stringify with sorted object keys so checksums are stable. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
}

export function serialize<T>(adapter: SaveAdapter<T>, now: number): string {
  const data = adapter.snapshot()
  const env: SaveEnvelope<T> = { format: SAVE_FORMAT, version: adapter.version, savedAt: now, checksum: fnv1a(stableStringify(data)), data }
  return JSON.stringify(env)
}

/**
 * Parses, verifies and migrates a save. `migrations[v]` upgrades v -> v+1.
 * Throws SaveError on corruption or a save from a newer game version.
 */
export function deserialize<T>(text: string, targetVersion: number, migrations: Record<number, Migration> = {}): SaveEnvelope<T> {
  let env: SaveEnvelope
  try {
    env = JSON.parse(text) as SaveEnvelope
  } catch {
    throw new SaveError('save is not valid JSON')
  }
  if (!env || env.format !== SAVE_FORMAT || typeof env.version !== 'number') throw new SaveError('not a Hatchfield save')
  if (fnv1a(stableStringify(env.data)) !== env.checksum) throw new SaveError('save checksum mismatch (corrupted)')
  if (env.version > targetVersion) throw new SaveError(`save is from a newer version (${env.version} > ${targetVersion})`)
  let data = env.data
  for (let v = env.version; v < targetVersion; v++) {
    const m = migrations[v]
    if (!m) throw new SaveError(`no migration from v${v}`)
    data = m(data)
  }
  return { ...env, version: targetVersion, checksum: fnv1a(stableStringify(data)), data: data as T }
}

export function load<T>(adapter: SaveAdapter<T>, text: string, migrations: Record<number, Migration> = {}): SaveEnvelope<T> {
  const env = deserialize<T>(text, adapter.version, migrations)
  adapter.restore(env.data)
  return env
}

export function isSaveEnvelope(value: unknown): value is SaveEnvelope {
  if (!value || typeof value !== 'object') return false
  const env = value as Partial<SaveEnvelope>
  return env.format === SAVE_FORMAT && typeof env.version === 'number' && typeof env.checksum === 'string' && 'data' in env
}

/** Payload of a stored save. Envelope saves return `data`; older raw snapshots return themselves. */
export function storedData(text: string): unknown {
  const parsed = JSON.parse(text) as unknown
  return isSaveEnvelope(parsed) ? parsed.data : parsed
}

const passThrough: SaveValidator = (data) => ({ data, issues: [] })

function finish<T>(version: number, savedAt: number, data: unknown, issues: SaveIssue[]): OpenedSave<T> {
  return {
    envelope: {
      format: SAVE_FORMAT,
      version,
      savedAt,
      checksum: fnv1a(stableStringify(data)),
      data: data as T,
    },
    issues,
  }
}

/**
 * Parses, migrates to `targetVersion`, then validates.
 * Checksum mismatches and future versions still throw. Field damage is repaired or flagged.
 */
export function openSave<T>(
  text: string,
  targetVersion: number,
  migrations: Record<number, Migration> = {},
  validate: SaveValidator = passThrough,
): OpenedSave<T> {
  const env = deserialize<unknown>(text, targetVersion, migrations)
  const checked = validate(env.data)
  return finish(targetVersion, env.savedAt, checked.data, checked.issues)
}

/**
 * Loads either a versioned envelope or a pre-envelope snapshot.
 * Unversioned JSON is the apron-save-v25 shape: already the current document, so it is validated and not migrated.
 */
export function readStoredSave<T>(
  text: string,
  targetVersion: number,
  migrations: Record<number, Migration> = {},
  validate: SaveValidator = passThrough,
): OpenedSave<T> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new SaveError('save is not valid JSON')
  }
  if (isSaveEnvelope(parsed)) return openSave(text, targetVersion, migrations, validate)
  const checked = validate(parsed)
  return finish(targetVersion, 0, checked.data, checked.issues)
}

/** Key/value store so saves work with localStorage, IndexedDB wrappers or tests. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryStore(): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v) },
    removeItem: (k) => { m.delete(k) },
    dump: () => Object.fromEntries(m),
  }
}

export class SaveSlots<T> {
  private readonly store: KeyValueStore
  private readonly adapter: SaveAdapter<T>
  private readonly migrations: Record<number, Migration>
  private readonly prefix: string
  constructor(store: KeyValueStore, adapter: SaveAdapter<T>, migrations: Record<number, Migration> = {}, prefix = 'hatchfield.save.') {
    this.store = store
    this.adapter = adapter
    this.migrations = migrations
    this.prefix = prefix
  }
  save(slot: string, now: number): void { this.store.setItem(this.prefix + slot, serialize(this.adapter, now)) }
  load(slot: string): SaveEnvelope<T> | null {
    const t = this.store.getItem(this.prefix + slot)
    return t === null ? null : load(this.adapter, t, this.migrations)
  }
  remove(slot: string): void { this.store.removeItem(this.prefix + slot) }
}

// ---------- Shareable layout codes ----------

/** Structural stand-in for branding's LogoSpec (kept loose so this module doesn't import src/branding). */
export type LogoSpecLike = Record<string, unknown>

export interface LayoutPiece {
  /** Item type id, e.g. 'gate', 'checkin', 'floor'. */
  t: string
  x: number
  y: number
  /** Rotation in quarter turns 0..3. */
  r?: number
}

export interface ShareableLayout {
  name: string
  code?: string
  pieces: LayoutPiece[]
  logo?: LogoSpecLike
}

export const SHARE_PREFIX = 'HF1'

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new SaveError('layout code is damaged')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

const toBase64Url = (s: string): string => bytesToB64Url(new TextEncoder().encode(s))
const fromBase64Url = (s: string): string => new TextDecoder().decode(b64UrlToBytes(s))

/** Zigzag + LEB128 varints: small deltas take one byte. */
export function packVarints(nums: number[]): Uint8Array {
  const out: number[] = []
  for (const n of nums) {
    if (!Number.isInteger(n)) throw new SaveError('layout coordinates must be integers')
    let z = n >= 0 ? n * 2 : -n * 2 - 1
    while (z >= 0x80) { out.push((z % 0x80) | 0x80); z = Math.floor(z / 0x80) }
    out.push(z)
  }
  return Uint8Array.from(out)
}

export function unpackVarints(bytes: Uint8Array): number[] {
  const out: number[] = []
  let z = 0, mul = 1
  for (const b of bytes) {
    z += (b & 0x7f) * mul
    if (b & 0x80) { mul *= 0x80; continue }
    out.push(z % 2 ? -(z + 1) / 2 : z / 2)
    z = 0; mul = 1
  }
  if (mul !== 1) throw new SaveError('layout code is damaged')
  return out
}

/**
 * Compact form: piece types are dictionary-coded and pieces packed as
 * [typeIndex, dx, dy, r] tuples (delta-encoded after a stable sort) written as
 * varints. Format: HF1.<meta base64url>.<pieces base64url>.<checksum>.
 */
export function encodeLayout(l: ShareableLayout): string {
  const pieces = [...l.pieces].sort((a, b) => a.y - b.y || a.x - b.x || a.t.localeCompare(b.t))
  const types = [...new Set(pieces.map((p) => p.t))].sort()
  const packed: number[] = []
  let px = 0, py = 0
  for (const p of pieces) {
    packed.push(types.indexOf(p.t), p.x - px, p.y - py, p.r ?? 0)
    px = p.x; py = p.y
  }
  const meta = toBase64Url(stableStringify({ n: l.name, c: l.code, k: types, g: l.logo }))
  const body = bytesToB64Url(packVarints(packed))
  return `${SHARE_PREFIX}.${meta}.${body}.${fnv1a(meta + body).slice(0, 6)}`
}

export function decodeLayout(code: string): ShareableLayout {
  const parts = code.trim().split('.')
  if (parts.length !== 4 || parts[0] !== SHARE_PREFIX) throw new SaveError('not a Hatchfield layout code')
  if (fnv1a(parts[1] + parts[2]).slice(0, 6) !== parts[3]) throw new SaveError('layout code checksum mismatch')
  let o: { n: string; c?: string; k: string[]; p: number[]; g?: LogoSpecLike }
  try {
    o = { ...(JSON.parse(fromBase64Url(parts[1])) as Omit<typeof o, 'p'>), p: unpackVarints(b64UrlToBytes(parts[2])) }
  } catch (e) {
    throw e instanceof SaveError ? e : new SaveError('layout code is damaged')
  }
  if (o.p.length % 4 !== 0 || o.p.some((v, i) => i % 4 === 0 && (v < 0 || v >= o.k.length))) throw new SaveError('layout code is damaged')
  const pieces: LayoutPiece[] = []
  let x = 0, y = 0
  for (let i = 0; i < o.p.length; i += 4) {
    x += o.p[i + 1]; y += o.p[i + 2]
    const piece: LayoutPiece = { t: o.k[o.p[i]], x, y }
    if (o.p[i + 3]) piece.r = o.p[i + 3]
    pieces.push(piece)
  }
  const out: ShareableLayout = { name: o.n, pieces }
  if (o.c !== undefined) out.code = o.c
  if (o.g !== undefined) out.logo = o.g
  return out
}
