/**
 * Binding table: defaults, conflicts, reset, and localStorage.
 * Pure aside from the two storage helpers.
 */
import {
  ACTIONS,
  type ActionId,
  type Binding,
  actionDef,
  bindingKey,
  isActionId,
  sameBinding,
} from './actions.ts'

export const CONTROLS_KEY = 'hatchfield-controls'

export type BindingTable = Record<ActionId, Binding[]>

export function defaultBindings(): BindingTable {
  const table = {} as BindingTable
  for (const action of ACTIONS) table[action.id] = action.defaults.map((binding) => ({ ...binding }))
  return table
}

export function bindingsEqual(table: BindingTable, id: ActionId): boolean {
  const cur = table[id] ?? []
  const defaults = actionDef(id)?.defaults ?? []
  if (cur.length !== defaults.length) return false
  return defaults.every((binding, i) => cur[i] && sameBinding(binding, cur[i]))
}

/** Other actions that already use this binding. */
export function bindingOwners(table: BindingTable, binding: Binding, except?: ActionId): ActionId[] {
  const key = bindingKey(binding)
  const owners: ActionId[] = []
  for (const action of ACTIONS) {
    if (action.id === except) continue
    if ((table[action.id] ?? []).some((item) => bindingKey(item) === key)) owners.push(action.id)
  }
  return owners
}

/** Replace one action's bindings. The new binding is taken off every other action. */
export function rebind(table: BindingTable, id: ActionId, binding: Binding): { table: BindingTable; stole: ActionId[] } {
  const stole = bindingOwners(table, binding, id)
  const next = clone(table)
  const key = bindingKey(binding)
  for (const owner of stole) {
    next[owner] = next[owner].filter((item) => bindingKey(item) !== key)
  }
  next[id] = [{ ...binding }]
  return { table: next, stole }
}

export function resetAction(table: BindingTable, id: ActionId): { table: BindingTable; stole: ActionId[] } {
  const defaults = actionDef(id)?.defaults ?? []
  let next = clone(table)
  const stole = new Set<ActionId>()
  for (const binding of defaults) {
    for (const owner of bindingOwners(next, binding, id)) stole.add(owner)
  }
  for (const owner of stole) {
    const blocked = new Set(defaults.map(bindingKey))
    next[owner] = next[owner].filter((item) => !blocked.has(bindingKey(item)))
  }
  next[id] = defaults.map((binding) => ({ ...binding }))
  return { table: next, stole: [...stole] }
}

export function resetAll(): BindingTable {
  return defaultBindings()
}

export function loadBindings(raw: string | null): BindingTable {
  const table = defaultBindings()
  if (!raw) return table
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return table
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isActionId(id) || !Array.isArray(value)) continue
      const bindings = value.map(sanitizeBinding).filter((binding): binding is Binding => binding != null)
      table[id] = bindings
    }
  } catch {
    return defaultBindings()
  }
  return table
}

export function saveBindings(table: BindingTable, store: Pick<Storage, 'setItem'> | null = defaultStore()): void {
  try {
    store?.setItem(CONTROLS_KEY, JSON.stringify(table))
  } catch {
    /* private mode */
  }
}

export function readBindings(store: Pick<Storage, 'getItem'> | null = defaultStore()): BindingTable {
  try {
    return loadBindings(store?.getItem(CONTROLS_KEY) ?? null)
  } catch {
    return defaultBindings()
  }
}

function sanitizeBinding(value: unknown): Binding | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<Binding>
  if (row.device === 'key' && typeof (row as KeyShape).code === 'string' && (row as KeyShape).code) {
    return { device: 'key', code: (row as KeyShape).code }
  }
  if (row.device === 'wheel' && ((row as WheelShape).dir === 'in' || (row as WheelShape).dir === 'out')) {
    return { device: 'wheel', dir: (row as WheelShape).dir }
  }
  if (row.device === 'pad' && (row as PadShape).control === 'button' && Number.isInteger((row as PadShape).index)) {
    return { device: 'pad', control: 'button', index: (row as PadShape).index }
  }
  if (
    row.device === 'pad' &&
    (row as AxisShape).control === 'axis' &&
    Number.isInteger((row as AxisShape).index) &&
    ((row as AxisShape).sign === 1 || (row as AxisShape).sign === -1)
  ) {
    return { device: 'pad', control: 'axis', index: (row as AxisShape).index, sign: (row as AxisShape).sign }
  }
  return null
}

interface KeyShape { code: string }
interface WheelShape { dir: 'in' | 'out' }
interface PadShape { control: 'button'; index: number }
interface AxisShape { control: 'axis'; index: number; sign: 1 | -1 }

function clone(table: BindingTable): BindingTable {
  const next = {} as BindingTable
  for (const action of ACTIONS) next[action.id] = (table[action.id] ?? []).map((binding) => ({ ...binding }))
  return next
}

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
