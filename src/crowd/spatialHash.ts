/**
 * Uniform-grid spatial hash rebuilt every tick with a counting sort, so
 * neighbour queries are O(k) and rebuilds are O(n) with no allocation once
 * warmed up. Sized for 1,000–5,000 pedestrians.
 */
export class SpatialHash {
  readonly cell: number
  private tableSize: number
  private cellStart: Int32Array
  private cellCount: Int32Array
  private sorted: Int32Array
  private keys: Int32Array

  constructor(cellSize = 1.2, tableSize = 8192) {
    this.cell = cellSize
    this.tableSize = tableSize
    this.cellStart = new Int32Array(tableSize + 1)
    this.cellCount = new Int32Array(tableSize)
    this.sorted = new Int32Array(1024)
    this.keys = new Int32Array(1024)
  }

  private hash(cx: number, cz: number): number {
    const h = Math.imul(cx, 92837111) ^ Math.imul(cz, 689287499)
    return (h >>> 0) % this.tableSize
  }

  /** Rebuild from flat coordinate arrays; `alive[i]` false skips agent i. */
  build(xs: Float32Array, zs: Float32Array, n: number, alive?: Uint8Array) {
    if (this.sorted.length < n) {
      this.sorted = new Int32Array(n * 2)
      this.keys = new Int32Array(n * 2)
    }
    this.cellCount.fill(0)
    const inv = 1 / this.cell
    for (let i = 0; i < n; i++) {
      if (alive && !alive[i]) {
        this.keys[i] = -1
        continue
      }
      const k = this.hash(Math.floor(xs[i] * inv), Math.floor(zs[i] * inv))
      this.keys[i] = k
      this.cellCount[k]++
    }
    let acc = 0
    for (let k = 0; k < this.tableSize; k++) {
      this.cellStart[k] = acc
      acc += this.cellCount[k]
    }
    this.cellStart[this.tableSize] = acc
    const fill = this.cellCount
    fill.fill(0)
    for (let i = 0; i < n; i++) {
      const k = this.keys[i]
      if (k < 0) continue
      this.sorted[this.cellStart[k] + fill[k]++] = i
    }
  }

  /** Calls `fn(j)` for every indexed agent in cells overlapping the radius. */
  query(x: number, z: number, r: number, fn: (j: number) => void) {
    const inv = 1 / this.cell
    const x0 = Math.floor((x - r) * inv)
    const x1 = Math.floor((x + r) * inv)
    const z0 = Math.floor((z - r) * inv)
    const z1 = Math.floor((z + r) * inv)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.hash(cx, cz)
        const end = this.cellStart[k + 1]
        for (let p = this.cellStart[k]; p < end; p++) fn(this.sorted[p])
      }
    }
  }
}
